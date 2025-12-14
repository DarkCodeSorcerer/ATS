import React from "react";
import { ResumeMatcher } from "../components/ResumeMatcher";
import { Navbar } from "../components/Navbar";

export const ResumeMatchPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <ResumeMatcher />
      </div>
    </div>
  );
};

