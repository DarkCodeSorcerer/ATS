import axios from "axios";

// Use environment variable for API URL (set in Vercel for production)
// Falls back to localhost for development
const API_URL = import.meta.env.VITE_API_URL || "https://ats-w53t.onrender.com";

// Log the API URL being used (for debugging)
if (import.meta.env.DEV) {
  console.log("🔗 API URL:", API_URL);
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000 // 30 seconds timeout
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Don't set Content-Type for FormData - let browser set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

// Response interceptor to handle errors better
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (error.code === "ERR_NETWORK" || error.message === "Network Error" || error.code === "ECONNREFUSED") {
      const currentApiUrl = import.meta.env.VITE_API_URL || "https://ats-w53t.onrender.com";
      error.message = `❌ Cannot connect to backend at ${currentApiUrl}\n\n` +
        `🔧 Quick Fix Steps:\n\n` +
        `1️⃣  Start Backend Server:\n` +
        `   Open terminal and run:\n` +
        `   cd backend\n` +
        `   bun run src/index.ts\n\n` +
        `2️⃣  Check .env Files:\n` +
        `   backend/.env should have: PORT=5000\n` +
        `   frontend/.env should have: VITE_API_URL=https://ats-w53t.onrender.com\n\n` +
        `3️⃣  Check MongoDB:\n` +
        `   Make sure MongoDB is running\n` +
        `   Windows: net start MongoDB\n` +
        `   Mac/Linux: brew services start mongodb-community\n\n` +
        `4️⃣  Test Backend:\n` +
        `   Open browser: https://ats-w53t.onrender.com/health\n` +
        `   Should show: {"status":"ok"}\n\n` +
        `5️⃣  Restart Frontend:\n` +
        `   Stop frontend (Ctrl+C) and restart: bun run dev\n\n` +
        `📖 See CHECK_SETUP.md for detailed instructions`;
      error.isNetworkError = true;
    }
    // Handle timeout errors
    if (error.code === "ECONNABORTED") {
      error.message = "⏱️ Request timeout. Server may be slow or not responding. Please try again.";
      error.isNetworkError = true;
    }
    return Promise.reject(error);
  }
);


