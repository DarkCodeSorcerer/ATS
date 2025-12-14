import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import { PORT, MONGO_URI, JWT_SECRET, CORS_ORIGIN } from "./env.ts";
import { connectDb } from "./db.ts";
import authRoutes from "./routes/auth.ts";
import applicationRoutes from "./routes/applications.ts";
import matchRoutes from "./routes/match.ts";
import jobDescriptionRoutes from "./routes/jobDescriptions.ts";

async function main() {
  // Log configuration (without sensitive data)
  console.log("🔧 Configuration:");
  console.log(`   PORT: ${PORT}`);
  console.log(`   CORS_ORIGIN: ${CORS_ORIGIN}`);
  console.log(`   MONGO_URI: ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`); // Hide credentials
  console.log("");

  // Connect to the database
  try {
    console.log("🔌 Connecting to MongoDB...");
    await connectDb(MONGO_URI);
    console.log("✅ Database connected successfully");
  } catch (err: any) {
    console.error("❌ Database connection failed!");
    console.error("   Error:", err.message || err);
    console.error("");
    console.error("💡 Troubleshooting:");
    console.error("   1. Make sure MongoDB is running");
    console.error("   2. Check MONGO_URI in backend/.env");
    console.error("   3. Try: mongodb://127.0.0.1:27017/ats");
    console.error("   4. Or use MongoDB Atlas (cloud)");
    console.error("");
    process.exit(1);
  }

  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS - Supports multiple origins (comma-separated) or single origin
  // In production, set CORS_ORIGIN to your Vercel frontend URL
  const allowedOrigins = typeof CORS_ORIGIN === "string" && CORS_ORIGIN.includes(",")
    ? CORS_ORIGIN.split(",").map(o => o.trim())
    : CORS_ORIGIN === "*" ? true : CORS_ORIGIN;
  
  app.use(cors({ 
    origin: allowedOrigins,
    credentials: true
  }));

  // Body parsers - urlencoded for form data, json for JSON
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // HTTP request logger
  app.use(morgan("dev"));

  // Health check endpoint - must be before auth middleware
  app.get("/health", (_req, res) => {
    res.json({ 
      status: "ok",
      timestamp: new Date().toISOString(),
      port: PORT
    });
  });

  // API Routes
  app.use("/auth", authRoutes);
  app.use("/applications", applicationRoutes);
  app.use("/match", matchRoutes);
  app.use("/job-descriptions", jobDescriptionRoutes);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // Start server - use PORT from environment (Railway/Render auto-assigns)
  const serverPort = process.env.PORT || PORT;
  app.listen(serverPort, () => {
    console.log("");
    console.log("🚀 ========================================");
    console.log(`✅ API running on port ${serverPort}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`📝 Local URL: http://localhost:${serverPort}`);
      console.log(`📝 Make sure frontend .env has: VITE_API_URL=http://localhost:${serverPort}`);
    }
    console.log(`🔗 Health check: /health`);
    console.log("🚀 ========================================");
    console.log("");
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${serverPort} is already in use!`);
      console.error("");
      console.error("💡 Solutions:");
      console.error(`   1. Stop the process using port ${serverPort}`);
      console.error(`   2. Or change PORT in backend/.env to another port (e.g., 4000)`);
      console.error(`   3. Update frontend/.env VITE_API_URL to match`);
      console.error("");
      process.exit(1);
    } else {
      console.error("❌ Server startup error:", err);
      process.exit(1);
    }
  });
}

// Start the application
main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

