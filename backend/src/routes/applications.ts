import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Application } from "../models/Application.ts";
import { Resume } from "../models/Resume.ts";
import { authMiddleware } from "../middleware/auth.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { extractTextFromPDF, isPDF } from "../utils/pdfParser.ts";
import { parseResume } from "../utils/resumeParser.ts";

const router = Router();

// Configure multer for resume uploads
const uploadDir = path.join(process.cwd(), "uploads", "resumes");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, `resume-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow no file (optional resume upload)
    if (!file) {
      cb(null, true);
      return;
    }
    const allowedTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: PDF, DOC, DOCX, JPG, PNG"));
    }
  }
});

const appSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  position: z.string().min(1, "Position is required"),
  candidateName: z.string().optional(),
  candidateEmail: z.preprocess(
    (val) => {
      if (!val || val === "" || val === "undefined") return undefined;
      return val;
    },
    z.string().email("Invalid email format").optional()
  ),
  candidatePhone: z.string().optional(),
  status: z.enum(["applied", "interview", "offer", "rejected"]).optional().default("applied"),
  dateApplied: z.preprocess(
    (val) => {
      if (!val) return undefined;
      // Handle both string dates and Date objects
      if (val instanceof Date) return val;
      const dateStr = val.toString().trim();
      if (!dateStr) return undefined;
      return new Date(dateStr);
    },
    z.date({ required_error: "Date applied is required" })
  ),
  notes: z.string().optional(),
  resumeFileName: z.string().optional(),
  resumeFilePath: z.string().optional()
});

router.use(authMiddleware);

router.post("/", upload.single("resume"), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Multer automatically parses FormData fields into req.body
    // Get all fields from req.body (works for both JSON and FormData)
    const bodyData = req.body || {};
    
    // Debug: Log received data (only in development)
    if (process.env.NODE_ENV !== "production") {
      console.log("Received body data:", Object.keys(bodyData));
      console.log("Company name:", bodyData.companyName);
      console.log("Position:", bodyData.position);
      console.log("Date applied:", bodyData.dateApplied);
      console.log("Has file:", !!req.file);
    }
    
    // Extract and validate required fields
    // FormData sends everything as strings, so we need to handle that
    // Handle both undefined, null, and empty string cases
    const companyName = (bodyData.companyName 
      ? (typeof bodyData.companyName === "string" 
          ? bodyData.companyName.trim() 
          : String(bodyData.companyName || "").trim())
      : "").trim();
    
    const position = (bodyData.position
      ? (typeof bodyData.position === "string"
          ? bodyData.position.trim()
          : String(bodyData.position || "").trim())
      : "").trim();
    
    const dateApplied = (bodyData.dateApplied
      ? (typeof bodyData.dateApplied === "string"
          ? bodyData.dateApplied.trim()
          : String(bodyData.dateApplied || "").trim())
      : "").trim();
    
    // Validate required fields
    if (!companyName || companyName.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        message: "Company name is required",
        received: { companyName: bodyData.companyName, allKeys: Object.keys(bodyData) }
      });
    }
    
    if (!position || position.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        message: "Position is required",
        received: { position: bodyData.position, allKeys: Object.keys(bodyData) }
      });
    }
    
    if (!dateApplied || dateApplied.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        message: "Date applied is required",
        received: { dateApplied: bodyData.dateApplied, allKeys: Object.keys(bodyData) }
      });
    }
    
    // Prepare cleaned data object for validation
    const cleanedData: any = {
      companyName,
      position,
      dateApplied,
      status: bodyData.status || "applied"
    };
    
    // Handle optional fields - convert empty strings to undefined
    if (bodyData.candidateName && typeof bodyData.candidateName === "string" && bodyData.candidateName.trim()) {
      cleanedData.candidateName = bodyData.candidateName.trim();
    } else {
      cleanedData.candidateName = undefined;
    }
    
    if (bodyData.candidateEmail && typeof bodyData.candidateEmail === "string" && bodyData.candidateEmail.trim()) {
      cleanedData.candidateEmail = bodyData.candidateEmail.trim();
    } else {
      cleanedData.candidateEmail = undefined;
    }
    
    if (bodyData.candidatePhone && typeof bodyData.candidatePhone === "string" && bodyData.candidatePhone.trim()) {
      cleanedData.candidatePhone = bodyData.candidatePhone.trim();
    } else {
      cleanedData.candidatePhone = undefined;
    }
    
    if (bodyData.notes && typeof bodyData.notes === "string" && bodyData.notes.trim()) {
      cleanedData.notes = bodyData.notes.trim();
    } else {
      cleanedData.notes = undefined;
    }
    
    // Handle resume file upload
    if (req.file) {
      cleanedData.resumeFileName = req.file.originalname;
      cleanedData.resumeFilePath = req.file.path;
    }
    
    const parsed = appSchema.safeParse(cleanedData);
    if (!parsed.success) {
      // Delete uploaded file if validation fails
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error("Validation error:", parsed.error.format());
      
      // Create a more user-friendly error message
      const errorMessages: string[] = [];
      const formattedErrors = parsed.error.format();
      
      if (formattedErrors.companyName?._errors) {
        errorMessages.push(`Company Name: ${formattedErrors.companyName._errors.join(", ")}`);
      }
      if (formattedErrors.position?._errors) {
        errorMessages.push(`Position: ${formattedErrors.position._errors.join(", ")}`);
      }
      if (formattedErrors.dateApplied?._errors) {
        errorMessages.push(`Date Applied: ${formattedErrors.dateApplied._errors.join(", ")}`);
      }
      if (formattedErrors.candidateEmail?._errors) {
        errorMessages.push(`Email: ${formattedErrors.candidateEmail._errors.join(", ")}`);
      }
      
      const errorMessage = errorMessages.length > 0 
        ? errorMessages.join("; ")
        : "Invalid input. Please check all required fields.";
      
      return res.status(400).json({ 
        message: errorMessage,
        errors: formattedErrors,
        details: parsed.error.errors 
      });
    }
    
    const app = await Application.create({ ...parsed.data, userId: req.userId });
    
    // If resume file was uploaded, extract text and store for Resume Matching
    if (req.file && app._id) {
      try {
        let resumeText = "";
        const fileBuffer = fs.readFileSync(req.file.path);
        
        // Extract text from PDF
        if (isPDF(fileBuffer)) {
          resumeText = await extractTextFromPDF(fileBuffer);
        } else {
          // For other file types, try to read as text (basic support)
          // In production, you might want to add DOCX parsing here
          try {
            resumeText = fileBuffer.toString("utf-8");
          } catch {
            resumeText = fileBuffer.toString("latin1");
          }
        }
        
        // Parse resume to extract structured data
        if (resumeText.length > 10) {
          const parsedResume = parseResume(resumeText);
          
          // Store resume for future matching (without jobDescriptionId initially)
          // Use a placeholder jobDescriptionId that indicates it's from an application
          await Resume.create({
            userId: req.userId,
            jobDescriptionId: `app-${app._id}`, // Temporary ID, will be updated when matched
            applicationId: app._id,
            fileName: req.file.originalname,
            originalText: resumeText,
            skills: parsedResume.skills,
            keywords: parsedResume.keywords,
            email: parsedResume.email || cleanedData.candidateEmail || "",
            experience: parsedResume.experience,
            education: parsedResume.education,
            certificates: parsedResume.certificates,
            matchScore: 0,
            matchPercentage: 0,
            status: "rejected" // Will be updated when matched
          });
        }
      } catch (error: any) {
        // Don't fail the application creation if resume parsing fails
        console.error("Error storing resume for matching:", error);
      }
    }
    
    res.status(201).json(app);
  } catch (error: any) {
    // Delete uploaded file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Error creating application:", error);
    
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({ message: "Duplicate entry", error: error.message });
    }
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Validation error", error: error.message });
    }
    
    return res.status(500).json({ 
      message: "Failed to create application", 
      error: error.message || "Internal server error" 
    });
  }
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { status, company, position, search, sortBy = "dateApplied", sortOrder = "desc", page = "1", limit = "50", dateFrom, dateTo } = req.query;
    const filter: Record<string, unknown> = { userId: req.userId };
    if (status && typeof status === "string") filter.status = status;
    if (company && typeof company === "string") filter.companyName = { $regex: company, $options: "i" };
    if (position && typeof position === "string") filter.position = { $regex: position, $options: "i" };
    // Single search field that searches company, position, candidate name, and email
    if (search && typeof search === "string") {
      filter.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { position: { $regex: search, $options: "i" } },
        { candidateName: { $regex: search, $options: "i" } },
        { candidateEmail: { $regex: search, $options: "i" } }
      ];
    }
    // Date range filter
    if (dateFrom || dateTo) {
      filter.dateApplied = {};
      if (dateFrom && typeof dateFrom === "string") {
        (filter.dateApplied as Record<string, unknown>).$gte = new Date(dateFrom);
      }
      if (dateTo && typeof dateTo === "string") {
        (filter.dateApplied as Record<string, unknown>).$lte = new Date(dateTo);
      }
    }
    
    // Sorting
    const sortField = typeof sortBy === "string" ? sortBy : "dateApplied";
    const sortDirection = typeof sortOrder === "string" && sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };
    
    // Pagination
    const pageNum = parseInt(typeof page === "string" ? page : "1", 10);
    const limitNum = parseInt(typeof limit === "string" ? limit : "50", 10);
    const skip = (pageNum - 1) * limitNum;
    
    const [apps, total] = await Promise.all([
      Application.find(filter).sort(sort).skip(skip).limit(limitNum),
      Application.countDocuments(filter)
    ]);
    
    res.json({
      applications: apps,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error("Error fetching applications:", error);
    return res.status(500).json({ 
      message: "Failed to fetch applications", 
      error: error.message || "Internal server error" 
    });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Clean up empty strings for optional fields
    const cleanedData: any = { ...req.body };
    if (cleanedData.candidateName === "") cleanedData.candidateName = undefined;
    if (cleanedData.candidateEmail === "") cleanedData.candidateEmail = undefined;
    if (cleanedData.candidatePhone === "") cleanedData.candidatePhone = undefined;
    if (cleanedData.notes === "") cleanedData.notes = undefined;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }

    const parsed = appSchema.partial().safeParse(cleanedData);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.format() });
    }

    const updated = await Application.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id), userId: req.userId },
      { $set: parsed.data },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Application not found" });
    }
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating application:", error);
    return res.status(500).json({ 
      message: "Failed to update application", 
      error: error.message || "Internal server error" 
    });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }

    const deleted = await Application.findOneAndDelete({ 
      _id: new mongoose.Types.ObjectId(req.params.id), 
      userId: req.userId 
    });
    if (!deleted) {
      return res.status(404).json({ message: "Application not found" });
    }
    res.json({ message: "Deleted" });
  } catch (error: any) {
    console.error("Error deleting application:", error);
    return res.status(500).json({ 
      message: "Failed to delete application", 
      error: error.message || "Internal server error" 
    });
  }
});

// Bulk operations for recruiters
router.post("/bulk", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { action, ids, data } = req.body;
    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Invalid bulk operation" });
    }
    
    // Validate and convert IDs to ObjectIds
    const objectIds = ids
      .map((id: string) => {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return null;
        }
        return new mongoose.Types.ObjectId(id);
      })
      .filter(Boolean) as mongoose.Types.ObjectId[];
    
    if (objectIds.length === 0) {
      return res.status(400).json({ message: "Invalid IDs provided" });
    }
    
    const filter = { _id: { $in: objectIds }, userId: req.userId };
    
    if (action === "delete") {
      const result = await Application.deleteMany(filter);
      return res.json({ message: `Deleted ${result.deletedCount} applications`, deletedCount: result.deletedCount });
    }
    
    if (action === "updateStatus" && data?.status) {
      const validStatuses = ["applied", "interview", "offer", "rejected"];
      if (!validStatuses.includes(data.status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const result = await Application.updateMany(filter, { $set: { status: data.status } });
      return res.json({ message: `Updated ${result.modifiedCount} applications`, modifiedCount: result.modifiedCount });
    }
    
    return res.status(400).json({ message: "Invalid action" });
  } catch (error: any) {
    console.error("Error in bulk operation:", error);
    return res.status(500).json({ 
      message: "Failed to perform bulk operation", 
      error: error.message || "Internal server error" 
    });
  }
});

// Analytics route - must come before /:id routes to avoid conflicts
router.get("/analytics", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userIdObj = new mongoose.Types.ObjectId(req.userId);
    const stats = await Application.aggregate([
      { $match: { userId: userIdObj } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);
    
    const total = await Application.countDocuments({ userId: userIdObj });
    const recent = await Application.countDocuments({
      userId: userIdObj,
      dateApplied: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
    
    const statusMap: Record<string, number> = {};
    stats.forEach((s) => {
      statusMap[s._id] = s.count;
    });
    
    res.json({
      total,
      recent,
      byStatus: {
        applied: statusMap.applied || 0,
        interview: statusMap.interview || 0,
        offer: statusMap.offer || 0,
        rejected: statusMap.rejected || 0
      }
    });
  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    return res.status(500).json({ 
      message: "Failed to fetch analytics", 
      error: error.message || "Internal server error" 
    });
  }
});

// Get stored resumes from applications (for Resume Matching page)
router.get("/stored-resumes", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get all applications that have resume files
    const applicationsWithResumes = await Application.find({
      userId: req.userId,
      resumeFileName: { $exists: true, $ne: null, $ne: "" }
    }).select("_id companyName position candidateName candidateEmail resumeFileName dateApplied resumeFilePath");

    // Get all Resume entries linked to applications
    const resumes = await Resume.find({
      userId: req.userId,
      applicationId: { $exists: true, $ne: null }
    }).select("_id applicationId fileName email skills jobDescriptionId createdAt");

    // Create a map of applicationId -> Resume for quick lookup
    const resumeMap = new Map();
    resumes.forEach(resume => {
      if (resume.applicationId) {
        const appId = resume.applicationId.toString();
        if (!resumeMap.has(appId)) {
          resumeMap.set(appId, []);
        }
        resumeMap.get(appId).push(resume);
      }
    });

    // Combine data - include all applications with resume files, even if Resume entry doesn't exist
    const storedResumes = applicationsWithResumes.map(app => {
      const appResumes = resumeMap.get(app._id.toString()) || [];
      // Use the most recent resume entry for this application, or create a placeholder
      const resume = appResumes.length > 0 
        ? appResumes.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]
        : null;
      
      return {
        applicationId: app._id,
        resumeId: resume?._id || null,
        fileName: resume?.fileName || app.resumeFileName || "resume",
        companyName: app.companyName || "Unknown",
        position: app.position || "Unknown",
        candidateName: app.candidateName || "",
        candidateEmail: resume?.email || app.candidateEmail || "",
        dateApplied: app.dateApplied || new Date(),
        skills: resume?.skills || [],
        hasResumeFile: !!app.resumeFilePath || !!app.resumeFileName
      };
    });

    res.json({ storedResumes });
  } catch (error: any) {
    console.error("Error fetching stored resumes:", error);
    return res.status(500).json({ 
      message: "Failed to fetch stored resumes", 
      error: error.message || "Internal server error" 
    });
  }
});

// Download resume file - must come after /analytics route
router.get("/:id/resume", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }

    const app = await Application.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: req.userId
    });

    if (!app) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (!app.resumeFilePath || !fs.existsSync(app.resumeFilePath)) {
      return res.status(404).json({ message: "Resume file not found" });
    }

    res.download(app.resumeFilePath, app.resumeFileName || "resume.pdf");
  } catch (error: any) {
    console.error("Error downloading resume:", error);
    return res.status(500).json({ 
      message: "Failed to download resume", 
      error: error.message || "Internal server error" 
    });
  }
});

export default router;


