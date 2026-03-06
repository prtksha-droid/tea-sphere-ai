require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const upload = multer({ dest: "uploads/" });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -------------------------------------------------------
Yield Impact Simulator
-------------------------------------------------------*/
function simulateImpact({ severity, areaHa, yieldKgPerHa, pricePerKg }) {

  const baselineYieldKg = areaHa * yieldKgPerHa;

  const lossPctMap = {
    mild: 0.15,
    moderate: 0.30,
    severe: 0.50
  };

  const lossPctNoAction = lossPctMap[severity] ?? 0.25;
  const lossPctImmediate = Math.max(0.05, lossPctNoAction * 0.25);

  const noActionLostKg = baselineYieldKg * lossPctNoAction;
  const immediateLostKg = baselineYieldKg * lossPctImmediate;

  return {
    baselineYieldKg,
    scenarios: {
      no_action: {
        lossPct: lossPctNoAction,
        lostKg: noActionLostKg,
        revenueLoss: noActionLostKg * pricePerKg
      },
      immediate_action: {
        lossPct: lossPctImmediate,
        lostKg: immediateLostKg,
        revenueLoss: immediateLostKg * pricePerKg
      }
    },
    savings: {
      savedKg: noActionLostKg - immediateLostKg,
      savedRevenue:
        (noActionLostKg - immediateLostKg) * pricePerKg
    }
  };
}

/* -------------------------------------------------------
Risk Prediction Model
-------------------------------------------------------*/
function calculateRisk({ temperature = 32, humidity = 45 }) {

  let risk = 0;

  if (temperature > 30) risk += 40;
  if (humidity < 50) risk += 40;
  if (temperature > 34) risk += 20;

  return Math.min(risk, 100);
}

/* -------------------------------------------------------
Plantation Health Index
-------------------------------------------------------*/
function plantationHealthScore(riskScore) {

  let score = 100 - riskScore;

  if (score < 0) score = 0;

  return score;
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* -------------------------------------------------------
Leaf Diagnosis Endpoint
-------------------------------------------------------*/
app.post("/api/diagnose", upload.single("image"), async (req, res) => {

  let filePath;

  try {

    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    filePath = req.file.path;

    const areaHa = Number(req.body.areaHa ?? 10);
    const yieldKgPerHa = Number(req.body.yieldKgPerHa ?? 2200);
    const pricePerKg = Number(req.body.pricePerKg ?? 180);

    const imageBase64 = fs.readFileSync(filePath, { encoding: "base64" });
    const mimeType = req.file.mimetype || "image/jpeg";

    const prompt = `
You are a senior agricultural scientist specializing in tea plantation pathology and pest management.

Carefully analyze the uploaded tea leaf image.

Identify the most likely disease, pest, or physiological stress affecting the tea plant.

Return ONLY JSON using the structure below.

{
 "diagnosis": {
  "label": "name of disease or pest",
  "confidence": number between 0 and 1,
  "severity": "mild | moderate | severe"
 },

 "report": {
  "executive_summary": "Short overview of the detected issue",

  "visual_symptoms": "Detailed description of visible symptoms on the leaf",

  "scientific_explanation": "Biological explanation of the disease or pest and how it affects tea plants",

  "environmental_conditions": "Weather and plantation conditions that typically cause this issue",

  "plant_physiology_impact": "How this issue affects photosynthesis, plant growth, and yield",

  "yield_risk_analysis": "Potential yield loss percentages and plantation productivity impact",

  "economic_impact": "Possible economic consequences for tea estates",

  "spread_risk": "Likelihood of the disease spreading across the plantation",

  "monitoring_recommendations": "How plantation managers should monitor and track this issue",

  "treatment_strategy": {
 "chemical_control": "Specific chemical or fungicide treatment including active ingredient and dosage",
 "cultural_control": "Agronomic field management actions like pruning, sanitation, irrigation changes",
 "biological_control": "Biological control methods if applicable",
 "monitoring_protocol": "Detailed inspection schedule and monitoring strategy",
 "long_term_prevention": "Long-term plantation management practices to prevent recurrence"
},

  "long_term_prevention": "Best agricultural practices to prevent this issue in future"
 },

 "recommended_actions": [
  "Immediate field action 1",
  "Immediate field action 2",
  "Immediate field action 3",
  "Monitoring action 4",
  "Prevention action 5"
 ]
}

Rules:
- Return ONLY JSON.
- Always provide a detailed report.
- Assume the reader is a plantation manager or agricultural researcher.
`;

    const resp = await client.chat.completions.create({

  model: "gpt-4.1-mini",

  response_format: { type: "json_object" },

  messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
              }
            }
          ]
        }
      ],

      temperature: 0.2
    });

    const raw = resp.choices?.[0]?.message?.content ?? "{}";
console.log("AI RAW RESPONSE:", raw);

let parsed;

try {

  // Try parsing AI JSON
  parsed = JSON.parse(raw);

} catch {

  // Fallback if AI returns invalid JSON
  parsed = {
    diagnosis: {
      label: "Unknown",
      confidence: 0.3,
      severity: "moderate"
    },
    report: {
      executive_summary: raw || "AI analysis failed.",
      visual_symptoms: "AI response formatting failed.",
      scientific_explanation: "",
      environmental_conditions: "",
      plant_physiology_impact: "",
      yield_risk_analysis: "",
      economic_impact: "",
      spread_risk: "",
      monitoring_recommendations: "",
      treatment_strategy: {
        chemical_control: "",
        cultural_control: "",
        biological_control: "",
        monitoring_protocol: "",
        long_term_prevention: ""
      },
      long_term_prevention: ""
    },
    recommended_actions: []
  };

    }

    /* Impact Simulation */
    const impact = simulateImpact({
      severity: parsed?.diagnosis?.severity,
      areaHa,
      yieldKgPerHa,
      pricePerKg
    });

    /* Risk Prediction */
    const riskScore = calculateRisk({
      temperature: 32,
      humidity: 45
    });

    const healthScore = plantationHealthScore(riskScore);

    res.json({

      ok: true,

      input: {
        areaHa,
        yieldKgPerHa,
        pricePerKg
      },

      diagnosis: parsed.diagnosis,

      report: parsed.report,

      recommended_actions: parsed.recommended_actions,

      riskScore,

      healthScore,

      impact
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Server error",
      details: err.message
    });

  } finally {

    if (filePath) {
      fs.unlink(filePath, () => {});
    }
  }
});


/* -------------------------------------------------------
Report Translation Endpoint
-------------------------------------------------------*/

app.post("/api/translate-report", async (req, res) => {

  try {

    const { report, language } = req.body;

    const prompt = `
Translate the following agricultural report into ${language}.

Keep the meaning accurate for farmers and plantation workers.

Return ONLY the translated text.

Report:
${JSON.stringify(report)}
`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    });

    const translated = resp.choices[0].message.content;

    res.json({
      ok: true,
      translation: translated
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Translation failed"
    });

  }

});

/* -------------------------------------------------------
Agent Monitoring Endpoint
-------------------------------------------------------*/
app.post("/api/agent-summary", async (req, res) => {

  try {

    const {
      estateName = "Demo Estate",
      last7DaysFindings = []
    } = req.body || {};

    const prompt = `
You are an AI plantation monitoring agent.

Generate a weekly plantation health report.

Return JSON:

{
 "weekly_summary": "string",
 "risk_score_0_100": number,
 "top_risks": ["..."],
 "recommended_plan_7_days": ["..."]
}

Estate: ${estateName}
Findings: ${JSON.stringify(last7DaysFindings)}
`;

    const resp = await client.chat.completions.create({
     model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    let parsed;

    try {
      parsed = JSON.parse(resp.choices[0].message.content);
    } catch {
      parsed = {
        weekly_summary: resp.choices[0].message.content,
        risk_score_0_100: 50,
        top_risks: [],
        recommended_plan_7_days: []
      };
    }

    res.json({ ok: true, agent: parsed });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

/* -------------------------------------------------------
Server Start
-------------------------------------------------------*/
const port = process.env.PORT || 3001;

app.listen(port, () =>
  console.log(`✅ Tea POC server running on http://localhost:${port}`)
);