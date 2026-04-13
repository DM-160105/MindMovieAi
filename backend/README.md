---
title: MindMovieAi Backend
emoji: 🎬
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# MindMovieAi Backend API

FastAPI-powered movie recommendation engine with deep learning, sentiment analysis, and emotion-aware matching.

## Endpoints

- `GET /` — Health check
- `GET /health` — Detailed server status (warm-up progress)
- `GET /movies` — Browse movie catalog
- `GET /recommend?title=X` — Content-based recommendations
- `POST /sentiment-predict` — PyTorch + TensorFlow sentiment analysis
- `POST /api/arc-recommend` — Emotional arc-based recommendations
- `POST /api/vibe-match` — Cinematic atmosphere fingerprint matching
