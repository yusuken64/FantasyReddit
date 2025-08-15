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
cd fantasy-reddit-stocks
```

### 2. Setup Database
Make sure you have Docker installed, then run:
```bash
docker compose up
```

### 3. Start the Backend
```bash
cd server
npm install
node server.js
```

### 4. Start the Frontend
```bash
cd client
npm install
npm run dev
```

Frontend will be available at http://localhost:5173 (or similar, per Vite's output).
Backend will be available at http://localhost:3000.
