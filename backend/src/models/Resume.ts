import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    jobDescriptionId: { type: String, required: true }, // Reference to job description
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application" }, // Link to application (optional)
    fileName: { type: String, required: true },
    originalText: { type: String, required: true },
    // Parsed fields
    skills: [{ type: String }],
    keywords: [{ type: String }],
    email: { type: String, default: "" },
    experience: [
      {
        company: String,
        position: String,
        duration: String,
        description: String
      }
    ],
    education: [
      {
        degree: String,
        institution: String,
        year: String,
        field: String
      }
    ],
    certificates: [{ type: String }],
    // Matching results
    matchScore: { type: Number, default: 0 },
    matchPercentage: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["shortlisted", "rejected", "low_priority"],
      default: "rejected"
    },
    matchedKeywords: [{ type: String }],
    missingKeywords: [{ type: String }]
  },
  { timestamps: true }
);

// Index for faster queries
resumeSchema.index({ userId: 1, jobDescriptionId: 1, matchScore: -1 });
resumeSchema.index({ status: 1, matchScore: -1 });

export const Resume = mongoose.model("Resume", resumeSchema);

