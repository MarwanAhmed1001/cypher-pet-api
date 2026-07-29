# Cypher Pet Vercel Serverless API 🚀

A production-ready Vercel Serverless API using Node.js, Google Gemini AI (personality: "Cypher" - cold, Egyptian slang, max 100 chars), OpenWeatherMap integration (Cairo weather), TheSportsDB integration (latest sports results), and daily mood accumulation tracking.

---

## 📌 API Endpoints

### 1. `POST /api/chat`
Sends a message to Cypher and receives a personalized Egyptian slang response, mood classification, daily mood accumulation, and data type.

#### Request Body:
```json
{
  "message": "اخبار الجو ايه النهارده في القاهرة؟",
  "history": []
}
```

#### Response Example:
```json
{
  "reply": "الجو حار 26° في القاهرة.. متوجعش دماغي وتخرج بلاش طقس حر.",
  "mood": "ANNOYED",
  "daily_mood": "BORED",
  "data_type": "weather"
}
```

---

### 2. `GET /api/mood`
Gets the current mood state, dominant daily accumulated mood, and last reply.

#### Response Example:
```json
{
  "mood": "ANNOYED",
  "daily_mood": "BORED",
  "last_reply": "الجو حار 26° في القاهرة.. متوجعش دماغي وتخرج بلاش طقس حر.",
  "data_type": "weather"
}
```

---

## 🛠️ Environment Variables
Set these variables in Vercel Dashboard -> Settings -> Environment Variables:

- `GEMINI_API_KEY`: `AQ.Ab8RN6IRu-t-PKpHjJUklwxJCpxKli1CU2qIi7UgSbxjaoTQBA`
- `WEATHER_API_KEY`: OpenWeatherMap API key (e.g. for Cairo weather data)

---

## 🚀 How to Deploy on Vercel

```bash
# 1. Install Vercel CLI (if not installed)
npm i -g vercel

# 2. Deploy to Vercel
cd vercel_cypher_api
vercel
```

---

## 💻 How to Test Locally

```bash
npm install
node api/chat.js
```
