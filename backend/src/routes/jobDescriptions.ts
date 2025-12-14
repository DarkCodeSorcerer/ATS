import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { JobDescription } from "../models/JobDescription.ts";
import { authMiddleware } from "../middleware/auth.ts";
import type { AuthRequest } from "../middleware/auth.ts";

const router = Router();

const jobDescSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  position: z.string().optional(),
  company: z.string().optional()
});

router.use(authMiddleware);

// Get all job descriptions for user
router.get("/", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const jobDescs = await JobDescription.find({ userId: req.userId })
      .sort({ updatedAt: -1 });
    
    res.json(jobDescs);
  } catch (error: any) {
    console.error("Error fetching job descriptions:", error);
    return res.status(500).json({ 
      message: "Failed to fetch job descriptions", 
      error: error.message || "Internal server error" 
    });
  }
});

// Create new job description
router.post("/", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const parsed = jobDescSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        message: "Invalid input", 
        errors: parsed.error.format()
      });
    }
    
    const jobDesc = await JobDescription.create({ ...parsed.data, userId: req.userId });
    res.status(201).json(jobDesc);
  } catch (error: any) {
    console.error("Error creating job description:", error);
    return res.status(500).json({ 
      message: "Failed to create job description", 
      error: error.message || "Internal server error" 
    });
  }
});

// Update job description
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid job description ID" });
    }

    const parsed = jobDescSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.format() });
    }

    const updated = await JobDescription.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id), userId: req.userId },
      { ...parsed.data, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Job description not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating job description:", error);
    return res.status(500).json({ 
      message: "Failed to update job description", 
      error: error.message || "Internal server error" 
    });
  }
});

// Delete job description
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid job description ID" });
    }

    const deleted = await JobDescription.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: req.userId
    });

    if (!deleted) {
      return res.status(404).json({ message: "Job description not found" });
    }

    res.json({ message: "Job description deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting job description:", error);
    return res.status(500).json({ 
      message: "Failed to delete job description", 
      error: error.message || "Internal server error" 
    });
  }
});

export default router;

