# Deployment Secrets & Environment Variables Guide

To prepare your Movie Recommender project for deployment across Vercel and Render, you'll need to configure environment variables. This guide explains exactly what you need and where to get it.

---

## Backend Environment Variables (`backend/.env`)

These credentials must be provided to your Render backend instance. Create a file named `.env` inside the `backend/` folder locally, and set these in the Render dashboard for production.

### 1. `MONGODB_URI`
* **What it is:** The strict connection string to your MongoDB Atlas database.
* **Where to get it:**
  1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create an account.
  2. Create an **M0 Free Cluster**.
  3. Under **Database**, click **Connect** next to your cluster.
  4. Create a database user (username and password) and allow connection from anywhere (`0.0.0.0/0`).
  5. Choose **Drivers** and copy the connection string.
  6. **Important:** Replace `<password>` in the string with your actual password.
* **Example:** `MONGODB_URI=mongodb+srv://devang:myPassword123@cluster0.abcde.mongodb.net/stremflix?retryWrites=true&w=majority`

### 2. `JWT_SECRET_KEY`
* **What it is:** A secure, random string used to encrypt user login tokens.
* **Where to get it:**
  1. You can write any random long string, or generate one in your terminal using: `openssl rand -hex 32`
* **Example:** `JWT_SECRET_KEY=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08`

### 3. `TMDB_API_KEY`
* **What it is:** API key used to fetch movie details and posters from TMDB.
* **Where to get it:**
  1. Go to [TMDB API settings](https://www.themoviedb.org/settings/api).
  2. You already have this key from your previous local setup! Just copy it.
* **Example:** `TMDB_API_KEY=8265bd1679663a7ea12ac168da84d2e8`

### 4. `HUGGINGFACE_DATASET_REPO`
* **What it is:** The path to the Hugging Face dataset repository you created. The backend downloads missing dataset CSVs from here.
* **Where to get it:**
  1. Go to [Hugging Face](https://huggingface.co/) and create a free account.
  2. Click your profile picture -> **New Dataset**.
  3. Name it (e.g., `movie-recommender-data`). Keep it public.
  4. Upload your local `backend/data/*.csv` files to this repository via the web interface.
  5. The repo ID is `your-username/your-repo-name`.
* **Example:** `HUGGINGFACE_DATASET_REPO=DM-160105/movie-recommender-data`

### 5. `FRONTEND_URL`
* **What it is:** The live Vercel URL of your frontend. The backend requires this to allow Cross-Origin Resource Sharing (CORS) so your frontend can communicate with the backend.
* **Where to get it:**
  1. Deploy your frontend to Vercel.
  2. Vercel will provide you with a public URL (e.g., `https://stremflix-app.vercel.app`).
* **Example:** `FRONTEND_URL=https://stremflix-app.vercel.app`

---

## Frontend Environment Variables (`frontend/.env.local` / Vercel Settings)

These credentials must be provided to Vercel (or placed in `frontend/.env.local` for local development). 

### 1. `NEXT_PUBLIC_API_URL`
* **What it is:** The URL where your Render backend is active and listening for API requests.
* **Where to get it:**
  1. Once deployed, Render will provide a URL for your web service (e.g., `https://my-backend.onrender.com`).
* **Example:** `NEXT_PUBLIC_API_URL=https://my-backend.onrender.com`

> **Note:** To set this in Vercel, go to your Vercel Project Dashboard > Settings > Environment Variables, add `NEXT_PUBLIC_API_URL`, paste the value, and redeploy.

---

## Full Example Configuration Files

**`backend/.env`**
```env
MONGODB_URI=mongodb+srv://devang:myPassword123@cluster0.abcde.mongodb.net/stremflix?retryWrites=true&w=majority
JWT_SECRET_KEY=9f86d081884c7d659a2...
TMDB_API_KEY=8265bd1679663a7ea12ac168da84d2e8
HUGGINGFACE_DATASET_REPO=DM-160105/movie-recommender-data
FRONTEND_URL=https://my-vercel-frontend-url.vercel.app
```

**`frontend/.env.local` (and Vercel Settings)**
```env
NEXT_PUBLIC_API_URL=https://my-backend.onrender.com
```
