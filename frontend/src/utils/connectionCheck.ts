import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "https://ats-backend-rqqg.onrender.com";

export async function checkBackendConnection(retryCount: number = 0): Promise<{ connected: boolean; message: string; retryable?: boolean }> {
  const isProduction = API_URL.includes("render.com") || API_URL.includes("railway.app") || API_URL.includes("vercel.app") || API_URL.includes("netlify.app");
  const maxRetries = isProduction ? 2 : 0; // Allow 2 retries for production (Render spin-up)
  
  try {
    // Use direct axios call for health check (no auth needed)
    // Increased timeout for Render free tier (spins down after inactivity, first request takes ~30s)
    const response = await axios.get(`${API_URL}/health`, { 
      timeout: isProduction ? 45000 : 5000, // 45 seconds for production (Render), 5s for local
      validateStatus: () => true, // Accept any status to check if server responds
      // Add headers to help with CORS if needed
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Check if we got a valid response
    if (response.status === 200 && response.data?.status === "ok") {
      return { connected: true, message: "✅ Backend is connected" };
    }
    
    // Got a response but not 200/ok
    if (response.status === 404) {
      return {
        connected: false,
        message: `Backend at ${API_URL} returned 404.\n\n` +
          `This usually means:\n` +
          `1. Backend is deployed as Static Site (wrong!) - must be Web Service\n` +
          `2. Health endpoint doesn't exist\n` +
          `3. Wrong backend URL\n\n` +
          `Fix: Deploy backend as Web Service on Render, not Static Site`
      };
    }
    
    return { 
      connected: false, 
      message: `Backend responded but health check failed.\n\n` +
        `Status: ${response.status}\n` +
        `Response: ${JSON.stringify(response.data)}\n\n` +
        `Check Render dashboard for deployment errors.`
    };
  } catch (error: any) {
    const errorCode = error.code || error.message || "";
    const errorMessage = error.message || "";
    
    // Network errors
    if (errorCode === "ERR_NETWORK" || errorCode === "ECONNREFUSED" || 
        errorMessage.includes("Network Error") || errorMessage.includes("connect ECONNREFUSED") ||
        errorMessage.includes("Failed to fetch") || errorMessage.includes("ERR_INTERNET_DISCONNECTED")) {
      
      if (isProduction) {
        // For Render, network errors might mean it's spinning up - suggest retry
        const isRetryable = retryCount < maxRetries;
        
        return {
          connected: false,
          retryable: isRetryable,
          message: `❌ Cannot connect to backend at ${API_URL}\n\n` +
            `🔍 Most Likely: Backend is spinning up (Render free tier)\n` +
            `   - Takes ~30-45 seconds after 15 min inactivity\n` +
            `   - This is NORMAL, not an error!\n\n` +
            `${isRetryable ? `⏳ Auto-retrying in a moment...\n\n` : ``}` +
            `🔍 Other Possible Issues:\n\n` +
            `1. Backend deployment issue:\n` +
            `   - Check Render dashboard → Logs tab\n` +
            `   - Verify service type is "Web Service" (NOT Static Site)\n` +
            `   - Check deployment status is "Live" (green)\n\n` +
            `2. Test Backend Directly:\n` +
            `   - Open ${API_URL}/health in browser\n` +
            `   - If shows {"status":"ok"} → Backend works! Just wait and retry\n` +
            `   - If 404 → Backend is Static Site (WRONG!)\n` +
            `   - If timeout → Backend is spinning up (wait 30-40s)\n\n` +
            `✅ What to do:\n` +
            `- Wait 30-40 seconds\n` +
            `- Click "Retry" button above\n` +
            `- Or refresh the page`
        };
      } else {
        return {
          connected: false,
          message: `❌ Backend server is not running at ${API_URL}\n\n` +
            `🔧 Quick Fix:\n\n` +
            `1. Start Backend:\n` +
            `   Open terminal and run:\n` +
            `   cd backend\n` +
            `   bun run src/index.ts\n\n` +
            `2. Check MongoDB:\n` +
            `   Make sure MongoDB is running\n` +
            `   Windows: net start MongoDB\n` +
            `   Mac/Linux: brew services start mongodb-community\n\n` +
            `3. Verify .env Files:\n` +
            `   backend/.env: PORT=5000\n` +
            `   frontend/.env: VITE_API_URL=http://localhost:5000\n\n` +
            `4. Test Backend:\n` +
            `   Open: http://localhost:5000/health\n` +
            `   Should show: {"status":"ok"}`
        };
      }
    }
    
    // Timeout errors
    if (errorCode === "ECONNABORTED" || errorMessage.includes("timeout")) {
      if (isProduction) {
        const isRetryable = retryCount < maxRetries;
        
        return {
          connected: false,
          retryable: isRetryable,
          message: `⏱️ Backend at ${API_URL} is taking too long to respond.\n\n` +
            `✅ This is NORMAL for Render free tier:\n` +
            `- Backend spins down after 15 minutes of inactivity\n` +
            `- First request after spin-down takes ~30-45 seconds\n` +
            `- This is expected behavior, not an error!\n\n` +
            `${isRetryable ? `⏳ Auto-retrying in a moment...\n\n` : ``}` +
            `✅ What to do:\n` +
            `1. Wait 30-45 seconds (backend is waking up)\n` +
            `2. Click "Retry" button above\n` +
            `3. Backend will connect once it's awake\n\n` +
            `💡 Tip: First request is slow (~30-45s), subsequent requests are fast!`
        };
      } else {
        return {
          connected: false,
          message: `⏱️ Backend at ${API_URL} is not responding (timeout).\n\n` +
            `Check:\n` +
            `1. Backend server is running (check terminal)\n` +
            `2. MongoDB is running\n` +
            `3. No firewall blocking port 5000\n` +
            `4. Backend didn't crash (check terminal for errors)`
        };
      }
    }
    
    // CORS errors
    if (errorMessage.includes("CORS") || errorCode === "ERR_CORS") {
      return {
        connected: false,
        message: `🚫 CORS Error: Backend is blocking requests.\n\n` +
          `Fix:\n` +
          `1. Check Render environment variables\n` +
          `2. Set CORS_ORIGIN to your frontend URL\n` +
          `3. Example: CORS_ORIGIN=https://your-app.netlify.app\n` +
          `4. Redeploy backend after changing CORS_ORIGIN`
      };
    }
    
    // Other errors
    return {
      connected: false,
      message: `❌ Connection error: ${errorMessage || "Unknown error"}\n\n` +
        `Error code: ${errorCode || "N/A"}\n\n` +
        `Try:\n` +
        `1. Check ${API_URL}/health in browser\n` +
        `2. Check Render dashboard for errors\n` +
        `3. Verify backend is Web Service (not Static Site)`
    };
  }
}

