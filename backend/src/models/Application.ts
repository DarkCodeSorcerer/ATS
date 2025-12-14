import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    companyName: { type: String, required: true },
    position: { type: String, required: true },
    // Candidate information for recruiters
    candidateName: { type: String },
    candidateEmail: { type: String },
    candidatePhone: { type: String },
    status: {
      type: String,
      enum: ["applied", "interview", "offer", "rejected"],
      default: "applied"
    },
    dateApplied: { type: Date, required: true },
    notes: { type: String },
    resumeFileName: { type: String },
    resumeFilePath: { type: String }
  },
  { timestamps: true }
);

export const Application = mongoose.model("Application", applicationSchema);