require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const upload = multer({ dest: "uploads/" });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Simple yield impact simulator (POC)
 * Based on the doc: Red Spider Mite can cause ~15–55% yield loss (we simulate by severity). :contentReference[oaicite:1]{index=1}
 */
function simulateImpact({ severity, areaHa, yieldKgPerHa, pricePerKg }) {
  const baselineYieldKg = areaHa * yieldKgPerHa;
  // Map severity -> loss%
  // mild=0.15, moderate=0.30, severe=0.50 (bounded by 15–55% in the doc)
  const lossPctMap = { mild: 0.15, moderate: 0.30, severe: 0.50 };
  const lossPctNoAction = lossPctMap[severity] ?? 0.25;

  // "Immediate action" reduces impact in POC (not scientifically validated; just demo)
  const lossPctImmediate = Math.max(0.05, lossPctNoAction * 0.25);

  const noActionLostKg = baselineYieldKg * lossPctNoAction;
  const immediateLostKg = baselineYieldKg * lossPctImmediate;

  const noActionRevenueLoss = noActionLostKg * pricePerKg;
  const immediateRevenueLoss = immediateLostKg * pricePerKg;

  return {
    baselineYieldKg,
    scenarios: {
      no_action: {
        lossPct: lossPctNoAction,
        lostKg: noActionLostKg,
        revenueLoss: noActionRevenueLoss
      },
      immediate_action: {
        lossPct: lossPctImmediate,
        lostKg: immediateLostKg,
        revenueLoss: immediateRevenueLoss
      }
    },
    savings: {
      savedKg: noActionLostKg - immediateLostKg,
      savedRevenue: noActionRevenueLoss - immediateRevenueLoss
    }
  };
}

app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * POST /api/diagnose
 * form-data: image (file)
 * body (optional JSON fields via form-data text): areaHa, yieldKgPerHa, pricePerKg
 */
app.post("/api/diagnose", upload.single("image"), async (req, res) => {
  let filePath;
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    filePath = req.file.path;

    const areaHa = Number(req.body.areaHa ?? 10);         // POC defaults
    const yieldKgPerHa = Number(req.body.yieldKgPerHa ?? 2200);
    const pricePerKg = Number(req.body.pricePerKg ?? 180);

    const imageBase64 = fs.readFileSync(filePath, { encoding: "base64" });
    const mimeType = req.file.mimetype || "image/jpeg";

    // Use OpenAI vision-capable model (your SDK will route it)
    const prompt = `
You are an agritech assistant for tea plantations.
Analyze the uploaded tea leaf image and return ONLY strict JSON with this schema:

{
  "diagnosis": {
    "label": "Red Spider Mite|Blister Blight|Nutrient Deficiency|Healthy|Unknown",
    "confidence": 0-1,
    "severity": "mild|moderate|severe"
  },
  "symptoms": ["..."],
  "recommended_actions": ["..."],
  "notes": "short",
  "assumptions": ["..."]
}

Important:
- If you suspect Red Spider Mite, mention bronzing/reddish discoloration and dry/hot conditions as cues (if visible).
- Keep actions practical (irrigation/humidity, predators, miticide suggestion if severe).
- Do not include any markdown or extra text. JSON only.
`.trim();

    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` }
            }
          ]
        }
      ],
      temperature: 0.2
    });

    const raw = resp.choices?.[0]?.message?.content ?? "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Fallback if model returns something messy
      parsed = {
        diagnosis: { label: "Unknown", confidence: 0.3, severity: "moderate" },
        symptoms: [],
        recommended_actions: ["Re-upload clearer image", "Consult agronomist for confirmation"],
        notes: "Model did not return strict JSON; fallback used.",
        assumptions: []
      };
    }

    const impact = simulateImpact({
      severity: parsed?.diagnosis?.severity ?? "moderate",
      areaHa,
      yieldKgPerHa,
      pricePerKg
    });

    res.json({
      ok: true,
      input: { areaHa, yieldKgPerHa, pricePerKg },
      ai: parsed,
      impact
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  } finally {
    if (filePath) fs.unlink(filePath, () => {});
  }
});

/**
 * POST /api/agent-summary
 * body: { estateName, last7DaysFindings: [{label,severity,count}], areaHa, yieldKgPerHa, pricePerKg }
 */
app.post("/api/agent-summary", async (req, res) => {
  try {
    const {
      estateName = "Demo Estate",
      last7DaysFindings = [],
      areaHa = 10,
      yieldKgPerHa = 2200,
      pricePerKg = 180
    } = req.body || {};

    const prompt = `
You are an "Estate Monitor" agent for a tea plantation.
Given last 7 days findings, write a concise executive summary + risk assessment + next actions.
Return ONLY strict JSON with schema:

{
  "weekly_summary": "string",
  "risk_score_0_100": number,
  "top_risks": ["..."],
  "recommended_plan_7_days": ["..."],
  "expected_business_impact": {
    "best_case": "string",
    "worst_case": "string"
  }
}

Estate: ${estateName}
Findings: ${JSON.stringify(last7DaysFindings)}
Context defaults: areaHa=${areaHa}, yieldKgPerHa=${yieldKgPerHa}, pricePerKg=${pricePerKg}
`.trim();

    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        weekly_summary: "Summary unavailable due to parsing fallback.",
        risk_score_0_100: 55,
        top_risks: ["Data quality / low sample size"],
        recommended_plan_7_days: ["Collect more images daily", "Validate diagnosis with supervisor"],
        expected_business_impact: {
          best_case: "Lower yield loss through early action.",
          worst_case: "Higher yield loss if infestation spreads."
        }
      };
    }

    res.json({ ok: true, agent: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`✅ Tea POC server running on http://localhost:${port}`));