app.post("/api/diagnose", upload.single("image"), async (req, res) => {

  let filePath;

  try {

    console.log("📥 Diagnose request received");

    if (!req.file) {
      console.log("❌ No file uploaded");
      return res.status(400).json({ error: "No image uploaded" });
    }

    filePath = req.file.path;

    const areaHa = Number(req.body.areaHa ?? 10);
    const yieldKgPerHa = Number(req.body.yieldKgPerHa ?? 2200);
    const pricePerKg = Number(req.body.pricePerKg ?? 180);

    const imageBase64 = fs.readFileSync(filePath, { encoding: "base64" });
    const mimeType = req.file.mimetype || "image/jpeg";

    console.log("📷 Image loaded");

    const resp = await client.chat.completions.create({

      model: "gpt-4.1-mini",

      response_format: { type: "json_object" },

      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this tea leaf and return JSON diagnosis."
            },
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

    console.log("🤖 AI response received");

    const raw = resp?.choices?.[0]?.message?.content ?? "{}";

    let parsed;

    try {

      parsed = JSON.parse(raw);

    } catch (parseErr) {

      console.log("⚠️ JSON parse failed");

      parsed = {
        diagnosis: {
          label: "Unknown",
          confidence: 0.3,
          severity: "moderate"
        },
        report: {
          executive_summary: raw
        },
        recommended_actions: []
      };

    }

    const impact = simulateImpact({
      severity: parsed?.diagnosis?.severity,
      areaHa,
      yieldKgPerHa,
      pricePerKg
    });

    const riskScore = calculateRisk({
      temperature: 32,
      humidity: 45
    });

    const healthScore = plantationHealthScore(riskScore);

    const result = {

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
    };

    console.log("✅ Returning result");

    return res.json(result);

  } catch (err) {

    console.error("❌ Diagnose error:", err);

    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: err.message
    });

  } finally {

    if (filePath) {
      fs.unlink(filePath, () => {});
    }

  }

});