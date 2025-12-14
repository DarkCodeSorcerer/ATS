import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import mongoose from "mongoose";
import fs from "fs";
import { authMiddleware } from "../middleware/auth.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { Resume } from "../models/Resume.ts";
import { Application } from "../models/Application.ts";
import { parseResume } from "../utils/resumeParser.ts";
import { matchResumeToJD } from "../utils/matcher.ts";
import { extractTextFromPDF, isPDF } from "../utils/pdfParser.ts";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Single resume match (text input)
const payloadSchema = z.object({
  resumeText: z.string().min(10, "Resume is too short"),
  jobDescription: z.string().min(10, "Job description is too short")
});

// Bulk upload schema
const bulkSchema = z.object({
  jobDescription: z.string().min(10, "Job description is too short"),
  jobDescriptionId: z.string().min(1, "Job description ID is required")
});

// Helper to read file as text (handles PDF and text files)
async function readFileAsText(file: Express.Multer.File): Promise<string> {
  try {
    // Check if it's a PDF
    if (isPDF(file.buffer)) {
      return await extractTextFromPDF(file.buffer);
    }
    
    // Try UTF-8 first
    let text = file.buffer.toString("utf-8");
    // If we got mostly replacement characters, try other encodings
    if (text.includes('\ufffd') || text.length < file.buffer.length * 0.5) {
      try {
        text = file.buffer.toString("latin1");
      } catch {
        text = file.buffer.toString("utf16le");
      }
    }
    // Clean up common encoding issues
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Remove null bytes and other control characters (except newlines and tabs)
    text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    return text;
  } catch (err: any) {
    // Last resort: try to decode as ASCII
    return file.buffer.toString("ascii").replace(/[^\x20-\x7E\n\r\t]/g, '');
  }
}

// Single resume match endpoint (backward compatible)
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  const { resumeText, jobDescription } = parsed.data;
  
  // Parse resume
  const parsedResume = parseResume(resumeText);
  
  // Match against JD
  const matchResult = matchResumeToJD(
    parsedResume.keywords,
    parsedResume.skills,
    resumeText,
    jobDescription
  );

  return res.json({
    score: matchResult.matchScore,
    matchPercentage: matchResult.matchPercentage,
    decision: matchResult.status,
    threshold: 80,
    matchedKeywords: matchResult.matchedKeywords,
    missingKeywords: matchResult.missingKeywords,
    parsedResume
  });
});

// Use stored resumes from applications for matching
router.post("/use-stored-resumes", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { jobDescription, jobDescriptionId, applicationIds } = req.body;
    
    if (!jobDescription || !jobDescriptionId) {
      return res.status(400).json({ message: "Job description and ID are required" });
    }
    
    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ message: "Application IDs are required" });
    }
    
    const userId = req.userId!;
    const results = [];
    
    // Get applications with resume files
    const applications = await Application.find({
      userId,
      _id: { $in: applicationIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
      resumeFileName: { $exists: true, $ne: null, $ne: "" }
    });
    
    if (applications.length === 0) {
      return res.status(404).json({ message: "No applications with resume files found" });
    }
    
    // Get existing Resume entries for these applications
    const existingResumes = await Resume.find({
      userId,
      applicationId: { $in: applicationIds.map((id: string) => new mongoose.Types.ObjectId(id)) }
    });
    
    const resumeMap = new Map();
    existingResumes.forEach(resume => {
      if (resume.applicationId) {
        resumeMap.set(resume.applicationId.toString(), resume);
      }
    });
    
    // Process each application
    for (const app of applications) {
      let storedResume = resumeMap.get(app._id.toString());
      
      // If Resume entry doesn't exist, try to create it from the file
      if (!storedResume && app.resumeFilePath) {
        try {
          const fileBuffer = fs.readFileSync(app.resumeFilePath);
          let resumeText = "";
          
          // Extract text from PDF
          if (isPDF(fileBuffer)) {
            resumeText = await extractTextFromPDF(fileBuffer);
          } else {
            // For other file types, try to read as text
            try {
              resumeText = fileBuffer.toString("utf-8");
            } catch {
              resumeText = fileBuffer.toString("latin1");
            }
          }
          
          // Parse resume if we got text
          if (resumeText.length > 10) {
            const parsedResume = parseResume(resumeText);
            
            // Create Resume entry
            storedResume = await Resume.create({
              userId,
              jobDescriptionId: `app-${app._id}`,
              applicationId: app._id,
              fileName: app.resumeFileName || "resume",
              originalText: resumeText,
              skills: parsedResume.skills,
              keywords: parsedResume.keywords,
              email: parsedResume.email || app.candidateEmail || "",
              experience: parsedResume.experience,
              education: parsedResume.education,
              certificates: parsedResume.certificates,
              matchScore: 0,
              matchPercentage: 0,
              status: "rejected"
            });
          } else {
            // Skip if we couldn't extract text
            results.push({
              fileName: app.resumeFileName || "resume",
              error: "Could not extract text from resume file"
            });
            continue;
          }
        } catch (err: any) {
          console.error("Error creating Resume entry from file:", err);
          results.push({
            fileName: app.resumeFileName || "resume",
            error: `Failed to process resume file: ${err.message || "Unknown error"}`
          });
          continue;
        }
      }
      
      // If we still don't have a stored resume, skip
      if (!storedResume) {
        results.push({
          fileName: app.resumeFileName || "resume",
          error: "Resume entry not found and could not be created"
        });
        continue;
      }
      
      // Process the stored resume
      try {
        const resumeText = storedResume.originalText;
        
        // Match against JD
        const matchResult = matchResumeToJD(
          storedResume.keywords,
          storedResume.skills,
          resumeText,
          jobDescription
        );
        
        // Update resume with new match results
        storedResume.jobDescriptionId = jobDescriptionId;
        storedResume.matchScore = matchResult.matchScore;
        storedResume.matchPercentage = matchResult.matchPercentage;
        storedResume.status = matchResult.status;
        storedResume.matchedKeywords = matchResult.matchedKeywords;
        storedResume.missingKeywords = matchResult.missingKeywords;
        await storedResume.save();
        
        // Update application status based on resume matching result
        if (storedResume.applicationId) {
          try {
            let applicationStatus: "interview" | "rejected" | undefined = undefined;
            
            // If resume is shortlisted (≥80% match), update to interview
            if (matchResult.status === "shortlisted") {
              applicationStatus = "interview";
            }
            // If resume is rejected, update to rejected
            else if (matchResult.status === "rejected") {
              applicationStatus = "rejected";
            }
            
            if (applicationStatus) {
              await Application.findOneAndUpdate(
                { 
                  _id: storedResume.applicationId, 
                  userId 
                },
                { 
                  status: applicationStatus 
                }
              );
            }
          } catch (err: any) {
            console.error("Error updating application status:", err);
          }
        }
        
        results.push({
          id: storedResume._id,
          fileName: storedResume.fileName,
          matchPercentage: matchResult.matchPercentage,
          status: matchResult.status,
          email: storedResume.email,
          skills: storedResume.skills,
          matchedKeywords: matchResult.matchedKeywords.slice(0, 10),
          missingKeywords: matchResult.missingKeywords.slice(0, 10),
          applicationId: storedResume.applicationId?.toString()
        });
      } catch (err: any) {
        results.push({
          fileName: storedResume.fileName,
          error: err.message || "Failed to process resume"
        });
      }
    }
    
    return res.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to use stored resumes" });
  }
});

// Bulk resume upload endpoint
router.post("/bulk", authMiddleware, upload.array("resumes", 50), async (req: AuthRequest, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const { jobDescription, jobDescriptionId } = parsed.data;
    const userId = req.userId!;

    const results = [];

    // Process each resume
    for (const file of files) {
      try {
        // Read file content (handles PDF and text files)
        const resumeText = await readFileAsText(file);
        
        // Parse resume
        const parsedResume = parseResume(resumeText);
        
        // Match against JD
        const matchResult = matchResumeToJD(
          parsedResume.keywords,
          parsedResume.skills,
          resumeText,
          jobDescription
        );

        // Check if this resume is linked to an application (from stored resumes or by email)
        let applicationId: mongoose.Types.ObjectId | undefined = undefined;
        let existingResume = null;
        
        // Try to find existing resume by email
        if (parsedResume.email) {
          existingResume = await Resume.findOne({
            userId,
            email: parsedResume.email,
            jobDescriptionId: { $regex: /^app-/ } // From application
          });
          
          // If not found in Resume, try to find application by email
          if (!existingResume) {
            const app = await Application.findOne({
              userId,
              candidateEmail: parsedResume.email.toLowerCase()
            });
            if (app) {
              applicationId = app._id as mongoose.Types.ObjectId;
            }
          } else if (existingResume.applicationId) {
            applicationId = existingResume.applicationId as mongoose.Types.ObjectId;
          }
        }
        
        if (existingResume && existingResume.applicationId) {
          applicationId = existingResume.applicationId as mongoose.Types.ObjectId;
          
          // Update existing resume instead of creating new one
          existingResume.jobDescriptionId = jobDescriptionId;
          existingResume.matchScore = matchResult.matchScore;
          existingResume.matchPercentage = matchResult.matchPercentage;
          existingResume.status = matchResult.status;
          existingResume.matchedKeywords = matchResult.matchedKeywords;
          existingResume.missingKeywords = matchResult.missingKeywords;
          existingResume.originalText = resumeText;
          existingResume.skills = parsedResume.skills;
          existingResume.keywords = parsedResume.keywords;
          existingResume.experience = parsedResume.experience;
          existingResume.education = parsedResume.education;
          existingResume.certificates = parsedResume.certificates;
          await existingResume.save();
        } else {
          // Create new resume entry
          const resume = await Resume.create({
            userId,
            jobDescriptionId,
            applicationId: applicationId,
            fileName: file.originalname,
            originalText: resumeText,
            skills: parsedResume.skills,
            keywords: parsedResume.keywords,
            email: parsedResume.email,
            experience: parsedResume.experience,
            education: parsedResume.education,
            certificates: parsedResume.certificates,
            matchScore: matchResult.matchScore,
            matchPercentage: matchResult.matchPercentage,
            status: matchResult.status,
            matchedKeywords: matchResult.matchedKeywords,
            missingKeywords: matchResult.missingKeywords
          });
          existingResume = resume;
        }

        // Update application status based on resume matching result
        if (existingResume.applicationId) {
          try {
            let applicationStatus: "interview" | "rejected" | undefined = undefined;
            
            // If resume is shortlisted (≥80% match), update to interview
            if (matchResult.status === "shortlisted") {
              applicationStatus = "interview";
            }
            // If resume is rejected, update to rejected
            else if (matchResult.status === "rejected") {
              applicationStatus = "rejected";
            }
            
            if (applicationStatus) {
              await Application.findOneAndUpdate(
                { 
                  _id: existingResume.applicationId, 
                  userId 
                },
                { 
                  status: applicationStatus 
                }
              );
            }
          } catch (err: any) {
            console.error("Error updating application status:", err);
            // Don't fail the resume matching if application update fails
          }
        }

        results.push({
          id: existingResume._id,
          fileName: file.originalname,
          matchPercentage: matchResult.matchPercentage,
          status: matchResult.status,
          email: parsedResume.email,
          skills: parsedResume.skills,
          matchedKeywords: matchResult.matchedKeywords.slice(0, 10),
          missingKeywords: matchResult.missingKeywords.slice(0, 10),
          applicationId: existingResume.applicationId?.toString()
        });
      } catch (err: any) {
        results.push({
          fileName: file.originalname,
          error: err.message || "Failed to process resume"
        });
      }
    }

    return res.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Bulk upload failed" });
  }
});

// Get all resumes for a job description (with ranking, filtering, sorting)
router.get("/resumes/:jobDescriptionId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { jobDescriptionId } = req.params;
    const userId = req.userId!;
    const { status, sortBy = "matchScore", order = "desc" } = req.query;

    const filter: Record<string, unknown> = {
      userId,
      jobDescriptionId
    };

    if (status && typeof status === "string") {
      filter.status = status;
    }

    const sort: Record<string, 1 | -1> = {};
    if (sortBy === "matchScore" || sortBy === "matchPercentage") {
      sort[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sort.matchScore = -1; // Default sort
    }

    const resumes = await Resume.find(filter)
      .sort(sort)
      .select("-originalText") // Don't send full text
      .limit(100)
      .lean();

    return res.json({
      count: resumes.length,
      resumes
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to fetch resumes" });
  }
});

// Get single resume details
router.get("/resume/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const resume = await Resume.findOne({ _id: id, userId });
    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.json(resume);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to fetch resume" });
  }
});

// Update resume status (HR can manually change status)
router.patch("/resume/:id/status", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { status } = req.body;

    if (!["shortlisted", "rejected", "low_priority"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const resume = await Resume.findOneAndUpdate(
      { _id: id, userId },
      { status },
      { new: true }
    );

    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // Update corresponding application status
    if (resume.applicationId) {
      try {
        let applicationStatus: "interview" | "rejected" | undefined = undefined;
        
        // If resume is shortlisted, update application to interview
        if (status === "shortlisted") {
          applicationStatus = "interview";
        }
        // If resume is rejected, update application to rejected
        else if (status === "rejected") {
          applicationStatus = "rejected";
        }
        
        if (applicationStatus) {
          await Application.findOneAndUpdate(
            { 
              _id: resume.applicationId, 
              userId 
            },
            { 
              status: applicationStatus 
            }
          );
        }
      } catch (err: any) {
        console.error("Error updating application status:", err);
        // Don't fail the resume status update if application update fails
      }
    }

    return res.json(resume);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to update status" });
  }
});

export default router;
