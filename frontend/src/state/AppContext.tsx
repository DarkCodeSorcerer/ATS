import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api/client";
import { Application, ApplicationStatus, ApplicationPagination, ApplicationAnalytics } from "../types";
import toast from "react-hot-toast";

interface AppContextValue {
  applications: Application[];
  pagination?: ApplicationPagination;
  analytics?: ApplicationAnalytics;
  loading: boolean;
  fetchApplications(filters?: { status?: string; company?: string; position?: string; search?: string; sortBy?: string; sortOrder?: string; page?: number; limit?: number; dateFrom?: string; dateTo?: string }): Promise<void>;
  fetchAnalytics(): Promise<void>;
  addApplication(payload: Omit<Application, "_id">): Promise<void>;
  updateApplication(id: string, data: Partial<Application>): Promise<void>;
  deleteApplication(id: string): Promise<void>;
  bulkDelete(ids: string[]): Promise<void>;
  bulkUpdateStatus(ids: string[], status: ApplicationStatus): Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [pagination, setPagination] = useState<ApplicationPagination | undefined>(undefined);
  const [analytics, setAnalytics] = useState<ApplicationAnalytics | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<{ status?: string; company?: string; position?: string; search?: string; sortBy?: string; sortOrder?: string; page?: number; limit?: number; dateFrom?: string; dateTo?: string } | undefined>(undefined);
  
  // Track ongoing requests to prevent duplicates
  const fetchingApplicationsRef = useRef(false);
  const fetchingAnalyticsRef = useRef(false);

  const fetchApplications = useCallback(async (filters?: { status?: string; company?: string; position?: string; search?: string; sortBy?: string; sortOrder?: string; page?: number; limit?: number; dateFrom?: string; dateTo?: string }) => {
    // Prevent duplicate simultaneous requests
    if (fetchingApplicationsRef.current) {
      console.log("Skipping duplicate fetchApplications request");
      return;
    }

    // Check if user is authenticated before making request
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("Cannot fetch applications: No authentication token");
      setLoading(false);
      return; // Silently return if not authenticated
    }

    fetchingApplicationsRef.current = true;
    setLoading(true);
    setCurrentFilters(filters);
    try {
      const { data } = await api.get("/applications", { params: filters });
      if (data && data.applications && data.pagination) {
        setApplications(data.applications);
        setPagination(data.pagination);
      } else if (Array.isArray(data)) {
        // Backward compatibility - old format (array of applications)
        setApplications(data);
        setPagination(undefined);
      } else {
        // Invalid response format
        console.error("Invalid response format from API:", data);
        setApplications([]);
        setPagination(undefined);
      }
    } catch (error: any) {
      console.error("Error fetching applications:", error);
      // Don't clear existing applications on error, just log it
      if (error.response?.status === 401) {
        // Unauthorized - clear token and let auth flow handle it
        console.warn("Unauthorized access - clearing token");
        localStorage.removeItem("token");
        setApplications([]);
        setPagination(undefined);
        // Don't throw error for 401 - it's expected if user isn't logged in
        return;
      }
      // Only throw error for actual failures (network errors, server errors, etc.)
      throw error;
    } finally {
      setLoading(false);
      fetchingApplicationsRef.current = false;
    }
  }, []); // Empty dependency array - function is stable

  const fetchAnalytics = useCallback(async () => {
    // Prevent duplicate simultaneous requests
    if (fetchingAnalyticsRef.current) {
      console.log("Skipping duplicate fetchAnalytics request");
      return;
    }

    // Check if user is authenticated before making request
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("Cannot fetch analytics: No authentication token");
      return; // Silently return if not authenticated
    }

    fetchingAnalyticsRef.current = true;
    try {
      const { data } = await api.get("/applications/analytics");
      setAnalytics(data);
    } catch (error: any) {
      console.error("Failed to fetch analytics", error);
      // Don't throw error for 401 - it's expected if user isn't logged in
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        setAnalytics(undefined);
        return;
      }
      // Silently fail for analytics - it's not critical
    } finally {
      fetchingAnalyticsRef.current = false;
    }
  }, []); // Empty dependency array - function is stable

  const addApplication = async (payload: Omit<Application, "_id"> | FormData) => {
    try {
      const { data } = await api.post("/applications", payload);
      
      // Check if new application matches current filters
      let shouldShow = true;
      if (currentFilters) {
        if (currentFilters.status && data.status !== currentFilters.status) {
          shouldShow = false;
        }
        if (currentFilters.company && !data.companyName.toLowerCase().includes(currentFilters.company.toLowerCase())) {
          shouldShow = false;
        }
        if (currentFilters.position && !data.position.toLowerCase().includes(currentFilters.position.toLowerCase())) {
          shouldShow = false;
        }
        if (currentFilters.search) {
          const searchLower = currentFilters.search.toLowerCase();
          const matchesCompany = data.companyName.toLowerCase().includes(searchLower);
          const matchesPosition = data.position.toLowerCase().includes(searchLower);
          const matchesCandidate = data.candidateName?.toLowerCase().includes(searchLower) || false;
          const matchesEmail = data.candidateEmail?.toLowerCase().includes(searchLower) || false;
          if (!matchesCompany && !matchesPosition && !matchesCandidate && !matchesEmail) {
            shouldShow = false;
          }
        }
      }
      
      // If filters are active and application doesn't match, refetch with filters
      if (currentFilters && !shouldShow) {
        // Refetch to update the list properly
        await fetchApplications(currentFilters);
        toast.success("Application added successfully (filtered out by current filters)");
      } else {
        // Add to state immediately if it matches filters or no filters are active
        setApplications((prev) => [data, ...prev]);
        // Update pagination total if available
        if (pagination) {
          setPagination({ ...pagination, total: pagination.total + 1 });
        }
        toast.success("Application added successfully");
      }
    } catch (error: any) {
      // Better error handling for network errors
      let errorMsg = "Failed to add application";
      
      if (error.isNetworkError || error.code === "ERR_NETWORK" || error.code === "ECONNREFUSED" || error.message?.includes("Network Error")) {
        const apiUrl = import.meta.env.VITE_API_URL || "https://ats-backend-rqqg.onrender.com";
        errorMsg = `❌ Cannot connect to backend server at ${apiUrl}\n\n` +
          `🔧 Quick Fix:\n` +
          `1. Open terminal and run: cd backend && bun run src/index.ts\n` +
          `2. Verify backend/.env has: PORT=5000\n` +
          `3. Verify frontend/.env has: VITE_API_URL=https://ats-backend-rqqg.onrender.com\n` +
          `4. Make sure MongoDB is running\n` +
          `5. Restart both servers if you changed .env files\n\n` +
          `💡 Check backend terminal for startup errors!`;
      } else if (error.response) {
        // Server responded with error
        const responseData = error.response.data || {};
        errorMsg = responseData.message || responseData.error || `Server error: ${error.response.status}`;
        
        // Log full error for debugging
        if (process.env.NODE_ENV === "development") {
          console.error("Full error response:", responseData);
        }
        
        // Check if there's a "received" field with debugging info
        if (responseData.received) {
          console.warn("Backend received:", responseData.received);
        }
        
        if (responseData.errors) {
          const errors = responseData.errors;
          const errorDetails = Object.entries(errors)
            .filter(([key, value]: [string, any]) => {
              // Only include fields that have actual errors
              if (value && typeof value === 'object' && '_errors' in value) {
                return Array.isArray(value._errors) && value._errors.length > 0;
              }
              return false;
            })
            .map(([key, value]: [string, any]) => {
              const fieldName = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();
              return `${fieldName}: ${value._errors?.join(", ") || "Required"}`;
            })
            .join("; ");
          if (errorDetails) {
            errorMsg = errorDetails;
          }
        }
        
        // If we still don't have a good message, use the status message
        if (errorMsg === `Server error: ${error.response.status}` && error.response.status === 400) {
          errorMsg = "Please check all required fields are filled correctly. Make sure Company Name, Position, and Date Applied are provided.";
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      console.error("Add application error:", error);
      toast.error(errorMsg);
      throw error; // Re-throw so form can handle it
    }
  };

  const updateApplication = async (id: string, data: Partial<Application>) => {
    try {
      const res = await api.put(`/applications/${id}`, data);
      setApplications((prev) => prev.map((a) => (a._id === id ? res.data : a)));
      toast.success("Application updated");
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || "Failed to update application";
      toast.error(errorMsg);
      throw error;
    }
  };

  const deleteApplication = async (id: string) => {
    try {
      await api.delete(`/applications/${id}`);
      setApplications((prev) => prev.filter((a) => a._id !== id));
      if (pagination) {
        setPagination({ ...pagination, total: pagination.total - 1 });
      }
      toast.success("Application deleted");
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || "Failed to delete application";
      toast.error(errorMsg);
      throw error;
    }
  };

  const bulkDelete = async (ids: string[]) => {
    try {
      const { data } = await api.post("/applications/bulk", { action: "delete", ids });
      await fetchApplications(currentFilters);
      toast.success(`Deleted ${data.deletedCount} applications`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Bulk delete failed");
      throw error;
    }
  };

  const bulkUpdateStatus = async (ids: string[], status: ApplicationStatus) => {
    try {
      const { data } = await api.post("/applications/bulk", { action: "updateStatus", ids, data: { status } });
      await fetchApplications(currentFilters);
      toast.success(`Updated ${data.modifiedCount} applications`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Bulk update failed");
      throw error;
    }
  };

  // Don't fetch on mount - let pages handle fetching when user is authenticated
  // This prevents errors when user is not logged in yet

  return (
    <AppContext.Provider value={{ 
      applications, 
      pagination,
      analytics,
      loading, 
      fetchApplications, 
      fetchAnalytics,
      addApplication, 
      updateApplication, 
      deleteApplication,
      bulkDelete,
      bulkUpdateStatus
    }}>
      {children}
    </AppContext.Provider>
  );
};

export function useApplications() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApplications must be used within AppProvider");
  return ctx;
}


