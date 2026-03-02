import { useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:3001";

export default function App() {
  const [file, setFile] = useState(null);
  const [areaHa, setAreaHa] = useState(10);
  const [yieldKgPerHa, setYieldKgPerHa] = useState(2200);
  const [pricePerKg, setPricePerKg] = useState(180);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [agentLoading, setAgentLoading] = useState(false);
  const [agent, setAgent] = useState(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  async function runDiagnosis() {
    if (!file) return alert("Please upload a leaf image first.");
    setLoading(true);
    setResult(null);
    setAgent(null);

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("areaHa", String(areaHa));
      form.append("yieldKgPerHa", String(yieldKgPerHa));
      form.append("pricePerKg", String(pricePerKg));

      const { data } = await axios.post(`${API_BASE}/api/diagnose`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setResult(data);
    } catch (e) {
      console.error(e);
      alert("Diagnosis failed. Check server logs.");
    } finally {
      setLoading(false);
    }
  }

  async function runAgentMode() {
    if (!result?.ai?.diagnosis?.label) return alert("Run diagnosis first.");
    setAgentLoading(true);
    setAgent(null);

    try {
      // Mock last 7 days findings for SaaS feel (POC)
      const findings = [
        { label: result.ai.diagnosis.label, severity: result.ai.diagnosis.severity, count: 7 },
        { label: "Healthy", severity: "mild", count: 21 }
      ];

      const { data } = await axios.post(`${API_BASE}/api/agent-summary`, {
        estateName: "Khumtai Demo Estate",
        last7DaysFindings: findings,
        areaHa,
        yieldKgPerHa,
        pricePerKg
      });

      setAgent(data.agent);
    } catch (e) {
      console.error(e);
      alert("Agent mode failed. Check server logs.");
    } finally {
      setAgentLoading(false);
    }
  }

  const impact = result?.impact;
  const noAction = impact?.scenarios?.no_action;
  const immediate = impact?.scenarios?.immediate_action;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20, fontFamily: "system-ui" }}>
      <h2>TeaSphere AI — POC</h2>
      <p style={{ marginTop: -8, opacity: 0.7 }}>
        Upload a leaf image → AI diagnosis → yield & revenue impact → Agent mode summary
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h3>1) Upload leaf image</h3>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {previewUrl && (
            <div style={{ marginTop: 12 }}>
              <img
                src={previewUrl}
                alt="preview"
                style={{ width: "100%", borderRadius: 12, border: "1px solid #eee" }}
              />
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h3>2) Baseline inputs (POC)</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              Area (hectares)
              <input value={areaHa} onChange={(e) => setAreaHa(Number(e.target.value))} />
            </label>
            <label>
              Yield (kg/ha)
              <input
                value={yieldKgPerHa}
                onChange={(e) => setYieldKgPerHa(Number(e.target.value))}
              />
            </label>
            <label>
              Price (₹/kg)
              <input value={pricePerKg} onChange={(e) => setPricePerKg(Number(e.target.value))} />
            </label>

            <button
              onClick={runDiagnosis}
              disabled={loading}
              style={{ padding: "10px 12px", borderRadius: 10 }}
            >
              {loading ? "Diagnosing..." : "Run AI Diagnosis"}
            </button>

            <button
              onClick={runAgentMode}
              disabled={agentLoading || !result}
              style={{ padding: "10px 12px", borderRadius: 10 }}
            >
              {agentLoading ? "Agent running..." : "Activate Estate Monitor (Agent Mode)"}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h3>3) Diagnosis</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <b>Label:</b> {result.ai?.diagnosis?.label || "—"} <br />
              <b>Confidence:</b>{" "}
              {typeof result.ai?.diagnosis?.confidence === "number"
                ? (result.ai.diagnosis.confidence * 100).toFixed(0) + "%"
                : "—"}
              <br />
              <b>Severity:</b> {result.ai?.diagnosis?.severity || "—"}
              <div style={{ marginTop: 12 }}>
                <b>Symptoms</b>
                <ul>
                  {(result.ai?.symptoms || []).slice(0, 8).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <b>Recommended actions</b>
              <ul>
                {(result.ai?.recommended_actions || []).slice(0, 8).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
              <div style={{ opacity: 0.8 }}>
                <b>Notes:</b> {result.ai?.notes || "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {impact && (
        <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h3>4) Yield & Revenue Impact (Simulation)</h3>
          <p style={{ marginTop: -8, opacity: 0.75 }}>
            POC simulator: compares “No action” vs “Immediate action” outcomes.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, border: "1px solid #f0f0f0", borderRadius: 12 }}>
              <b>Baseline yield</b>
              <div style={{ fontSize: 22 }}>{impact.baselineYieldKg.toFixed(0)} kg</div>
            </div>

            <div style={{ padding: 12, border: "1px solid #f0f0f0", borderRadius: 12 }}>
              <b>No action</b>
              <div>Loss: {(noAction.lossPct * 100).toFixed(0)}%</div>
              <div>Lost: {noAction.lostKg.toFixed(0)} kg</div>
              <div>₹ Loss: {noAction.revenueLoss.toFixed(0)}</div>
            </div>

            <div style={{ padding: 12, border: "1px solid #f0f0f0", borderRadius: 12 }}>
              <b>Immediate action</b>
              <div>Loss: {(immediate.lossPct * 100).toFixed(0)}%</div>
              <div>Lost: {immediate.lostKg.toFixed(0)} kg</div>
              <div>₹ Loss: {immediate.revenueLoss.toFixed(0)}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 12, border: "1px dashed #ddd", borderRadius: 12 }}>
            <b>Estimated savings:</b> {impact.savings.savedKg.toFixed(0)} kg / ₹{" "}
            {impact.savings.savedRevenue.toFixed(0)}
          </div>
        </div>
      )}

      {agent && (
        <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h3>5) Agent Mode — Weekly Executive Summary</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div>
              <div style={{ whiteSpace: "pre-wrap" }}>{agent.weekly_summary}</div>

              <div style={{ marginTop: 12 }}>
                <b>Top risks</b>
                <ul>
                  {(agent.top_risks || []).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div>
                <b>7-day plan</b>
                <ul>
                  {(agent.recommended_plan_7_days || []).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ padding: 12, border: "1px solid #f0f0f0", borderRadius: 12 }}>
              <b>Risk score</b>
              <div style={{ fontSize: 34 }}>{agent.risk_score_0_100}</div>
              <div style={{ marginTop: 12, opacity: 0.85 }}>
                <b>Best case:</b> {agent.expected_business_impact?.best_case}
                <br />
                <b>Worst case:</b> {agent.expected_business_impact?.worst_case}
              </div>
            </div>
          </div>
        </div>
      )}

     <div style={{ marginTop: 28, opacity: 0.7, fontSize: 12 }}>
  POC note: This demo uses AI + simulation to illustrate value. Future phases will replace simulation
  with estate datasets and trained models.
</div>
    </div>
  );
}