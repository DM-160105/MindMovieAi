<div align="center">

<img src="frontend/public/favicon.png" width="200" height="200">

### MindMovie Ai

</div>

<div align="center">

[**<u>Explore the App</u>**](https://mind-movie-ai.vercel.app) • [**<u>API Documentation</u>**](https://recommendation-mindmovie.onrender.com/docs) • [**<u>Report Bug</u>**](https://github.com/dev1601/MindMovieAi/issues)

</div>

---

<div align="center">

[![Stars](https://img.shields.io/github/stars/DM-160105/MindMovieAi?style=for-the-badge&color=gold)](https://github.com/DM-160105/MindMovieAi/stargazers)
[![Forks](https://img.shields.io/github/forks/DM-160105/MindMovieAi?style=for-the-badge&color=blue)](https://github.com/DM-160105/MindMovieAi/network/members)
[![Issues](https://img.shields.io/github/issues/DM-160105/MindMovieAi?style=for-the-badge&color=red)](https://github.com/DM-160105/MindMovieAi/issues)
[![License](https://img.shields.io/github/license/DM-160105/MindMovieAi?style=for-the-badge&color=green)](LICENSE)

<div align="center">

### **Quick Navigation**

[**📖 Overview**](#-overview) • [**🚀 Demo**](#-demo) • [**✨ Features**](#-features) • [**🛠️ Tech Stack**](#️-tech-stack) • [**🏗️ Architecture**](#️-architecture)
[**⚙️ Setup**](#️-installation-guide) • [**📂 Structure**](#-project-structure) • [**🔌 API**](#-api-endpoints-quick-reference) • [**🛡️ License**](#-license) • [**✍️ Author**](#️-author)

</div>

**Next-generation movie discovery powered by artificial intelligence.**

</div>

---

## 📖 Overview

**MindMovie Ai** is a sophisticated, full-stack movie recommendation platform that goes beyond simple keyword matching. By leveraging advanced Machine Learning and Sentiment Analysis, it understands your current mood, cinematic vibes, and historical preferences to suggest the perfect film for every moment.

### 🌟 Problem Statement

Traditional streaming platforms often suffer from "Choice Paralysis." Users spend more time scrolling than watching. MindMovie Ai solves this by providing highly curated, context-aware recommendations that resonate with the user's emotional state.

### 🎯 Key Objectives

- **Personalization**: Deliver recommendations based on deep user profiling.
- **Context-Awareness**: Match films to specific "vibes" and "moods."
- **Cross-Platform**: Aggregate data from Hollywood, Bollywood, and Anime sources.
- **Seamless Auth**: Provide secure login via JWT, OTP, and Google OAuth.

---

## 🚀 Demo

> [!Tip]
>
> ### **Check out the live demo here:** [⚡️ MindMovie Ai ⚡️](https://mind-movie-ai.vercel.app)

---

## ✨ Features

- **🧠 Deep Learning Recommendations**: Hybrid model using Faiss similarity search and custom user-preference vectors.
- **🎭 Mood-Based Search**: Input your current and desired emotional state to find films that bridge the gap.
- **🔮 Cinematic Vibe Fingerprinting**: Discovery based on specific "atmospheric" descriptions (e.g., "Neon Noir," "Cozy Mystery").
- **📊 Sentiment-Driven Reviews**: Real-time analysis of your movie reviews to refine your recommendation profile.
- **🌐 Global Movie Library**: Unified access to TMDB, Bollywood datasets, and 2023 Anime catalogs.
- **🔐 Robust Authentication**: OTP-verified email registration and one-tap Google Login.
- **📱 Responsive & Modern UI**: Sleek, glassmorphic design built with Next.js 16 and Tailwind CSS.
- **📈 Activity Tracking**: Intelligent history logging to understand your evolving taste.

---

## 🛠️ Tech Stack

| Category     | Technology                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend** | ![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white) ![Framer](https://img.shields.io/badge/Framer_Motion-0055FF?style=flat-square&logo=framer&logoColor=white) |
| **Backend**  | ![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat-square&logo=fastapi) ![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)                                                                                                                                                                                                                                            |
| **Database** | ![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat-square&logo=mongodb&logoColor=white)                                                                                                                                                                                                                                                                                                                                |
| **AI / ML**  | ![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white) ![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=flat-square&logo=tensorflow&logoColor=white) ![NumPy](https://img.shields.io/badge/NumPy-013243?style=flat-square&logo=numpy&logoColor=white) ![Pandas](https://img.shields.io/badge/Pandas-150458?style=flat-square&logo=pandas&logoColor=white)           |
| **DevOps**   | ![Render](https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=white) ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=github-actions&logoColor=white)                                                                                                   |

---

## 🏗️ Architecture

MindMovie Ai follows a decoupled architecture:

1.  **Frontend**: Client-side Next.js app handles UI/UX and calls the FastAPI backend.
2.  **Backend**: High-performance FastAPI service manages Auth, Database (MongoDB), and ML Inference.
3.  **Hugging Face Integration**: Large datasets and model artifacts are synced from HF to keep the production repo lightweight.

---

## ⚙️ Installation Guide

### 1. Prerequisites & API Keys

Before starting, ensure you have **Node.js (v18+)** and **Python (3.9+)** installed. You will also need the following API keys:

| Service           | Purpose              | Source                                                                   |
| :---------------- | :------------------- | :----------------------------------------------------------------------- |
| **MongoDB Atlas** | Database Storage     | [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas/register)        |
| **TMDB API**      | Movie Posters & Data | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)   |
| **Hugging Face**  | Dataset/Model Sync   | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| **Google Cloud**  | Google OAuth Login   | [console.cloud.google.com](https://console.cloud.google.com/)            |

### 2. Clone Repository

```bash
git clone https://github.com/DM-160105/MindMovieAi.git
cd MindMovieAi
```

### 3. One-Command Setup (Recommended) 🚀

We provide an intelligent launcher that handles environment setup, dependency installation, and server execution in one go:

```bash
python3 local/run.py
```

_This script will interactively guide you through configuration and start both servers._

---

### 4. Manual Step-by-Step Setup

If you prefer manual control, follow these steps in order:

#### A. Backend & Data Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# 💡 Open .env and fill in your MONGODB_URI and TMDB_API_KEY
```

#### B. Initial Data Seeding & ML Training

Run these scripts from the project **root** to populate your database and build the recommendation engine:

1. **Seed Database**:

   ```bash
   python3 local/seed_arc.py    # Seeds mood & emotional arc data
   python3 local/seed_vibes.py  # Seeds cinematic vibe/atmosphere data
   ```

2. **Train AI Models**:

   ```bash
   python3 local/train_sentiment.py # Trains Sentiment Analysis (TF/Torch)
   ```

3. **Generate Recommendation Artifacts**:
   ```bash
   python3 local/generate_artifacts.py # Builds FAISS index & movie dictionary
   ```

#### C. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# 💡 Ensure NEXT_PUBLIC_API_URL is set to http://localhost:8000
npm run dev
```

---

## 📂 Project Structure

```text
MindMovieAi/
├── backend/                # FastAPI Application
│   ├── ml/                 # Sentiment & RecSys Logic
│   ├── database.py         # MongoDB Connectivity
│   ├── auth.py             # JWT & Session Logic
│   └── api.py              # Main API Routes
├── frontend/               # Next.js Application
│   ├── src/app/            # App Router Pages
│   ├── src/context/        # Auth & UI State
│   └── src/lib/            # API Call Utilities
├── local/                  # Dev & Seeding Scripts
└── README.md
```

---

## 🔌 API Endpoints (Quick Reference)

| Method   | Endpoint               | Description                               |
| :------- | :--------------------- | :---------------------------------------- |
| **POST** | `/token`               | Login & obtain Bearer Token               |
| **POST** | `/auth/google`         | Authenticate with Google ID Token         |
| **GET**  | `/recommend`           | Basic similarity-based recommendations    |
| **GET**  | `/predict-preferences` | AI-driven profile analysis                |
| **POST** | `/sentiment-predict`   | Consensus Sentiment analysis (TF + Torch) |

---

## 📑 Environment Variables

### Backend (`backend/.env`)

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET_KEY=your_random_secret_string
TMDB_API_KEY=your_tmdb_api_key
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
GOOGLE_CLIENT_ID=your_google_id
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_id
```

---

## 🗺️ Roadmap

- [ ] **Mobile App**: React Native version for iOS and Android.
- [ ] **Watch Parties**: Real-time room synchronization for friends.
- [ ] **Social Integration**: Share your emotional movie arcs on Instagram/Twitter.
- [ ] **AI Video Summaries**: Dynamic trailer generation using generative AI.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">

# ✍️ Author

<img src="https://github.com/DM-160105/MindMovieAi/blob/main/frontend/public/favicon.png" width="200" height="200">

### **Devang Makwana**

📧 [**<u>mindmovieai16@gmail.com</u>**](mailto:mindmovieai16@gmail.com)  
🔗 [**<u>LinkedIn</u>**](https://linkedin.com/in/devang-makwana) • [**<u>Portfolio</u>**](https://devang-makwana.github.io)

<div align="center">
  <sub>Built with ❤️ for movie lovers everywhere.</sub>
</div>
