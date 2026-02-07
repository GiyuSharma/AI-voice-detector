import os

from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from tensorflow.keras.models import load_model

from utils import *

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
REPORT_DIR = os.path.join(BASE_DIR, "reports")
MODEL_PATH = os.path.join(BASE_DIR, "model", "voice_cnn_model.h5")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(REPORT_DIR, exist_ok=True)

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

model = load_model(MODEL_PATH)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    file = request.files["audio"]
    audio_path = os.path.join(UPLOAD_DIR, file.filename)
    file.save(audio_path)

    mel, audio, sr = extract_mel(audio_path)
    preds = model.predict(mel, verbose=0)[0]

    fake_pct = float((preds[1] + preds[2]) * 100)

    save_spectrogram(audio, sr)
    save_timeline(fake_pct)
    save_heatmap(audio, sr, fake_pct)

    frame_table = frame_probability_table(audio, sr, fake_pct)
    realtime_series = [row["fake_probability"] for row in frame_table]
    save_realtime_graph(realtime_series)

    summary = random_summary(fake_pct)
    pdf_name = generate_pdf(fake_pct, summary, frame_table)

    return jsonify({
        "fake_percentage": round(fake_pct, 2),
        "summary": summary,
        "spectrogram": "/static/spectrogram.png",
        "timeline": "/static/timeline.png",
        "heatmap": "/static/heatmap.png",
        "realtime_series": realtime_series,
        "frame_table": frame_table,
        "report": f"/reports/{pdf_name}"
    })

@app.route("/reports/<path:filename>")
def download_report(filename):
    return send_from_directory(REPORT_DIR, filename)

# Vercel serverless handler
app_handler = app

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
