# 📈 Fantasy Reddit Stocks

**Buy and sell Reddit posts like stocks, based on their popularity.**  
Track trends, build your portfolio, and see if you can outsmart the Reddit hive mind.

🎥 **Demo Video:** [Watch on YouTube](https://www.youtube.com/watch?v=XJgYtF8P5Vs)  
🌐 **Live App:** [Try it here](https://orange-wave-047d8e60f.2.azurestaticapps.net/)

---

## 🚀 Features

- **Real Reddit Data** – Fetches trending Reddit posts via Reddit's API.
- **Simulated Stock Market** – Prices go up or down based on post score changes.
- **Portfolio Tracking** – Buy, sell, and monitor your holdings.
- **Modern UI** – Built with React for a smooth experience.
- **Full-Stack App** – Node.js backend + REST API, React frontend.

---

## 🛠️ Tech Stack

- **Frontend:** React, Vite
- **Backend:** Node.js, Express
- **Database:** PostgreSQL (Dockerized)
- **Deployment:** Azure Static Web Apps (frontend), Azure App Service (backend)

---

## 🏃‍♂️ Run Locally

### 1. Clone the Repository
```bash
git clone https://github.com/yusuken64/fantasy-reddit-stocks.git
cd FantasyReddit
```

### 2. Create a .env File
Before starting the app, copy the example environment file and fill in your own secrets:
cp .env.example .env

Then open .env in a text editor and replace the placeholder values with your own credentials, such as:

A secure JWT_SECRET
Reddit API credentials (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET)
Optional adjustments to FRONTEND_URL or REDDIT_REDIRECT_URI if ports differ

### 3. Start All Services (Database + Backend + Frontend)
Make sure you have Docker and Docker Compose installed, then run:
docker compose up --build

This will:

Start a local SQL Server container (with data persisted in a volume)
Wait for SQL Server to become healthy before launching the backend
Launch both backend and frontend containers

Frontend will be available at http://localhost:5173
Backend will be available at http://localhost:8080