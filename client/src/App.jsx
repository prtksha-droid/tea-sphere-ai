import { useState } from "react";
import axios from "axios";

const API_BASE = "https://tea-sphere-ai.onrender.com";

export default function App() {

  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [translatedReport, setTranslatedReport] = useState(null);
  const [translating, setTranslating] = useState(false);

  const handleUpload = (e) => {
    setImage(e.target.files[0]);
  };

  const runDiagnosis = async () => {

    if (!image) {
      alert("Upload a tea leaf image first");
      return;
    }

    const formData = new FormData();
    formData.append("image", image);

    setLoading(true);

    try {

      const res = await axios.post(
        `${API_BASE}/api/diagnose`,
        formData
      );

      setResult(res.data);
      setTranslatedReport(null);

    } catch (err) {
      console.error(err);
      alert("Diagnosis failed");
    }

    setLoading(false);
  };

  const translateReport = async (language) => {

  setTranslating(true);

  try {

    const res = await axios.post(
      `${API_BASE}/api/translate-report`,
      {
        report: result.report,
        language
      }
    );

    let translated = res.data.translation;

    try {
      translated = JSON.parse(translated);
    } catch {}

    setTranslatedReport(translated);

  } catch (err) {

    console.error(err);
    alert("Translation failed");

  }

  setTranslating(false);

};

  const severityColor = (severity) => {

    if (severity === "mild") return "#4CAF50";
    if (severity === "moderate") return "#FFC107";
    if (severity === "severe") return "#F44336";

    return "#999";
  };

  return (

    <div style={styles.container}>

      <h1 style={styles.title}>TeaSphere AI</h1>
      <p style={styles.subtitle}>
        AI Tea Plantation Intelligence Platform
      </p>

      <div style={styles.uploadSection}>

        <input type="file" onChange={handleUpload} />

        <button style={styles.button} onClick={runDiagnosis}>
          Run AI Diagnosis
        </button>

      </div>

      {loading && <p>Analyzing leaf image...</p>}

      {result && (

        <div style={styles.dashboard}>

          <div style={styles.card}>

            <h2>Leaf Diagnosis</h2>

            <p>
              <b>Disease / Pest:</b> {result?.diagnosis?.label || "Unknown"}
            </p>

            <p>
              <b>Confidence:</b>{" "}
              {result?.diagnosis?.confidence
                ? (result.diagnosis.confidence * 100).toFixed(0) + "%"
                : "N/A"}
            </p>

            <p>
              <b>Severity:</b>{" "}
              <span
                style={{
                  background: severityColor(result?.diagnosis?.severity),
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: "6px"
                }}
              >
                {result?.diagnosis?.severity || "Unknown"}
              </span>
            </p>

          </div>

          <div style={styles.metricsRow}>

            <div style={styles.metricCard}>
              <h3>Health Score</h3>
              <h1>{result?.healthScore ?? "-"} / 100</h1>
            </div>

            <div style={styles.metricCard}>
              <h3>Risk Score</h3>
              <h1>{result?.riskScore ?? "-"}%</h1>
            </div>

          </div>

          <div style={styles.card}>

            <h2>Economic Impact</h2>

            <p>
              <b>Baseline Yield:</b> {result?.impact?.baselineYieldKg ?? "-"} kg
            </p>

            <p>
              <b>No Action Loss:</b> ₹
              {result?.impact?.scenarios?.no_action?.revenueLoss?.toFixed?.(0) ?? "-"}
            </p>

            <p>
              <b>Immediate Action Loss:</b> ₹
              {result?.impact?.scenarios?.immediate_action?.revenueLoss?.toFixed?.(0) ?? "-"}
            </p>

            <p>
              <b>Potential Savings:</b> ₹
              {result?.impact?.savings?.savedRevenue?.toFixed?.(0) ?? "-"}
            </p>

          </div>

          <div style={styles.card}>

            <h2>Recommended Actions</h2>

            <ul>
              {result?.recommended_actions?.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>

          </div>

          <div style={styles.card}>

            <h2>Agronomic Report</h2>

            <div style={{ marginBottom: 15 }}>

              <button
                style={styles.button}
                onClick={() => translateReport("Assamese")}
              >
                Translate to Assamese
              </button>

              <button
                style={{ ...styles.button, marginLeft: 10 }}
                onClick={() => translateReport("Hindi")}
              >
                Translate to Hindi
              </button>

            </div>
             {translating && (
  <p style={{ marginTop: 10, color: "#2563eb" }}>
    Translating report... please wait
  </p>
)}
            <p><b>Executive Summary:</b></p>
            <p>{result?.report?.executive_summary}</p>

            <p><b>Visual Symptoms:</b></p>
            <p>{result?.report?.visual_symptoms}</p>

            <p><b>Scientific Explanation:</b></p>
            <p>{result?.report?.scientific_explanation}</p>

            <p><b>Environmental Conditions:</b></p>
            <p>{result?.report?.environmental_conditions}</p>

            <p><b>Plant Physiology Impact:</b></p>
            <p>{result?.report?.plant_physiology_impact}</p>

            <p><b>Yield Risk Analysis:</b></p>
            <p>{result?.report?.yield_risk_analysis}</p>

            <h3>Treatment Strategy</h3>

            <p><b>Chemical Control:</b></p>
            <p>{result?.report?.treatment_strategy?.chemical_control}</p>

            <p><b>Cultural Control:</b></p>
            <p>{result?.report?.treatment_strategy?.cultural_control}</p>

            <p><b>Biological Control:</b></p>
            <p>{result?.report?.treatment_strategy?.biological_control}</p>

            <p><b>Monitoring Protocol:</b></p>
            <p>{result?.report?.treatment_strategy?.monitoring_protocol}</p>

            <p><b>Long-Term Prevention:</b></p>
            <p>{result?.report?.treatment_strategy?.long_term_prevention}</p>

            {translatedReport && (

<div style={{ marginTop: 25 }}>

<h3>Translated Report</h3>

<div
  style={{
    background: "#eef2ff",
    padding: 20,
    borderRadius: 10
  }}
>

<p><b>Executive Summary:</b></p>
<p>{translatedReport.executive_summary}</p>

<p><b>Symptoms:</b></p>
<p>{translatedReport.visual_symptoms}</p>

<p><b>Scientific Explanation:</b></p>
<p>{translatedReport.scientific_explanation}</p>

<p><b>Treatment:</b></p>
<p>{translatedReport.treatment_strategy?.chemical_control}</p>

</div>

</div>

)}

          </div>

        </div>

      )}

    </div>
  );
}

const styles = {

  container: {
    fontFamily: "Inter, Arial",
    background: "#f5f7fb",
    minHeight: "100vh",
    padding: "40px"
  },

  title: {
    fontSize: "36px",
    marginBottom: "5px"
  },

  subtitle: {
    color: "#666",
    marginBottom: "30px"
  },

  uploadSection: {
    marginBottom: "30px"
  },

  button: {
    marginLeft: "10px",
    padding: "10px 20px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer"
  },

  dashboard: {
    display: "grid",
    gap: "20px"
  },

  card: {
    background: "white",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.05)"
  },

  metricsRow: {
    display: "flex",
    gap: "20px"
  },

  metricCard: {
    flex: 1,
    background: "white",
    padding: "20px",
    borderRadius: "10px",
    textAlign: "center",
    boxShadow: "0 4px 10px rgba(0,0,0,0.05)"
  }

};