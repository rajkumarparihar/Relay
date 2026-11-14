import os

from flask import Flask

app = Flask(__name__)


@app.get("/")
def index():
    return {"message": "Flask server is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


def main():
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)
