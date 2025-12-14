import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { useApplications } from "../state/AppContext";
import { ApplicationForm } from "../components/ApplicationForm";
import { ApplicationList } from "../components/ApplicationList";
import { AnalyticsDashboard } from "../components/AnalyticsDashboard";
import { Navbar } from "../components/Navbar";

export const ApplicationTrackingPage: React.FC = () => {
  const { isAuthed } = useAuth();
  const { fetchApplications } = useApplications();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    
    // Only fetch if authenticated - ApplicationList will handle fetching with filters
    // So we don't need to fetch here to avoid duplicate requests
  }, [isAuthed, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Application Tracking</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track your job applications, manage status, and export data
            </p>
          </div>
          <AnalyticsDashboard />
          <ApplicationForm />
          <ApplicationList />
        </div>
      </div>
    </div>
  );
};

