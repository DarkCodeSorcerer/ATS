import React, { useState, useEffect } from "react";
import { useApplications } from "../state/AppContext";
import { ApplicationStatus } from "../types";
import toast from "react-hot-toast";
import { checkBackendConnection } from "../utils/connectionCheck";

export const ApplicationForm: React.FC = () => {
  const { addApplication } = useApplications();
  const [form, setForm] = useState({
    companyName: "",
    position: "",
    candidateName: "",
    candidateEmail: "",
    candidatePhone: "",
    status: "applied" as ApplicationStatus,
    dateApplied: new Date().toISOString().slice(0, 10),
    notes: ""
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);

  // Check backend connection on mount (with retry for production)
  useEffect(() => {
    const checkConnection = async (retryCount: number = 0) => {
      const result = await checkBackendConnection(retryCount);
      setBackendConnected(result.connected);
      
      if (!result.connected) {
        console.warn("⚠️ Backend not connected:", result.message);
        
        // Auto-retry for production (Render spin-up)
        const apiUrl = import.meta.env.VITE_API_URL || "https://ats-backend-rqqg.onrender.com";
        const isProduction = apiUrl.includes("render.com");
        
        if (isProduction && result.retryable && retryCount < 2) {
          // Wait 5 seconds then retry (gives backend time to spin up)
          setTimeout(() => {
            checkConnection(retryCount + 1);
          }, 5000);
        }
      }
    };
    
    checkConnection();
  }, []);

  const retryConnection = async (retryCount: number = 0) => {
    setCheckingConnection(true);
    const apiUrl = import.meta.env.VITE_API_URL || "https://ats-backend-rqqg.onrender.com";
    const isProduction = apiUrl.includes("render.com");
    
    // Show loading message for production (Render spin-up)
    if (isProduction) {
      toast.loading(
        retryCount === 0 
          ? "Waiting for backend to spin up (this may take 30-45 seconds)..." 
          : `Retrying connection (attempt ${retryCount + 1}/3)...`,
        { 
          id: "connection-check",
          duration: 45000 
        }
      );
    } else {
      toast.loading("Checking backend connection...", { 
        id: "connection-check",
        duration: 10000 
      });
    }
    
    try {
      const result = await checkBackendConnection(retryCount);
      setBackendConnected(result.connected);
      
      if (result.connected) {
        toast.success("✅ Backend connected successfully!", { id: "connection-check" });
      } else {
        // If retryable and we haven't maxed out, auto-retry
        if (result.retryable && retryCount < 2 && isProduction) {
          toast.loading(
            `Backend is spinning up... Retrying in 5 seconds (attempt ${retryCount + 2}/3)`,
            { id: "connection-check", duration: 5000 }
          );
          setTimeout(() => {
            retryConnection(retryCount + 1);
          }, 5000);
          return; // Don't set checkingConnection to false yet
        } else {
          toast.error(result.message, { 
            id: "connection-check",
            duration: 20000 // Longer duration for detailed error
          });
        }
      }
    } catch (error: any) {
      toast.error(`Connection check failed: ${error.message}`, { 
        id: "connection-check",
        duration: 10000 
      });
      setBackendConnected(false);
    } finally {
      if (retryCount === 0 || !isProduction) {
        setCheckingConnection(false);
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check backend connection before submitting
    const connectionCheck = await checkBackendConnection(0);
    if (!connectionCheck.connected) {
      const apiUrl = import.meta.env.VITE_API_URL || "https://ats-backend-rqqg.onrender.com";
      const isProduction = apiUrl.includes("render.com") || apiUrl.includes("railway.app");
      
      if (isProduction) {
        toast.error(
          `❌ Cannot connect to backend at ${apiUrl}\n\n` +
          `🔧 Render Free Tier:\n` +
          `- Backend spins down after 15 min inactivity\n` +
          `- First request takes ~30 seconds to wake up\n\n` +
          `Try:\n` +
          `1. Wait 30 seconds and click "Retry" above\n` +
          `2. Check ${apiUrl}/health in browser\n` +
          `3. Verify backend is Web Service (not Static Site) on Render`,
          { duration: 12000 }
        );
      } else {
        toast.error(
          `❌ Cannot connect to backend at ${apiUrl}\n\n` +
          `🔧 To fix:\n` +
          `1. Open terminal: cd backend && bun run src/index.ts\n` +
          `2. Verify MongoDB is running\n` +
          `3. Check .env files match (both port 5000)\n` +
          `4. Click "Retry" button above after starting backend`,
          { duration: 10000 }
        );
      }
      setBackendConnected(false);
      return;
    }
    
    setBackendConnected(true);
    setSubmitting(true);
    try {
      // Validate required fields before submission
      if (!form.companyName?.trim()) {
        toast.error("Company name is required");
        setSubmitting(false);
        return;
      }
      if (!form.position?.trim()) {
        toast.error("Position is required");
        setSubmitting(false);
        return;
      }
      if (!form.dateApplied) {
        toast.error("Date applied is required");
        setSubmitting(false);
        return;
      }
      
      // Clean up empty strings - send undefined for empty optional fields
      const payload: any = {
        companyName: form.companyName.trim(),
        position: form.position.trim(),
        status: form.status || "applied",
        dateApplied: form.dateApplied,
      };
      
      if (form.candidateName?.trim()) payload.candidateName = form.candidateName.trim();
      if (form.candidateEmail?.trim()) payload.candidateEmail = form.candidateEmail.trim();
      if (form.candidatePhone?.trim()) payload.candidatePhone = form.candidatePhone.trim();
      if (form.notes?.trim()) payload.notes = form.notes.trim();
      
      // If resume file is selected, upload it using FormData
      if (resumeFile) {
        const formData = new FormData();
        formData.append("resume", resumeFile);
        
        // Always append required fields (even if empty, backend will validate)
        formData.append("companyName", form.companyName.trim() || "");
        formData.append("position", form.position.trim() || "");
        formData.append("status", form.status || "applied");
        formData.append("dateApplied", form.dateApplied || "");
        
        // Append optional fields only if they have values
        if (form.candidateName?.trim()) {
          formData.append("candidateName", form.candidateName.trim());
        }
        if (form.candidateEmail?.trim()) {
          formData.append("candidateEmail", form.candidateEmail.trim());
        }
        if (form.candidatePhone?.trim()) {
          formData.append("candidatePhone", form.candidatePhone.trim());
        }
        if (form.notes?.trim()) {
          formData.append("notes", form.notes.trim());
        }
        
        // Debug: Log FormData contents (development only)
        if (import.meta.env.DEV) {
          console.log("Sending FormData with resume file:", resumeFile.name);
          for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
              console.log(`${key}:`, value.name, `(${value.size} bytes)`);
            } else {
              console.log(`${key}:`, value);
            }
          }
        }
        
        await addApplication(formData as any);
      } else {
        await addApplication(payload);
      }
      
      setForm({ 
        companyName: "", 
        position: "",
        candidateName: "",
        candidateEmail: "",
        candidatePhone: "",
        notes: "",
        status: "applied" as ApplicationStatus,
        dateApplied: new Date().toISOString().slice(0, 10)
      });
      setResumeFile(null);
    } catch (err: any) {
      // Error is already handled in AppContext, just log it here
      console.error("Application form submission error:", err);
      // Don't show duplicate error toast - AppContext already shows it
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="bg-white p-6 rounded-lg shadow-md space-y-4 border border-gray-100" onSubmit={submit}>
      {backendConnected === false && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-semibold">⚠️ Backend Not Connected</span>
              </div>
              <p className="text-sm text-red-700 mt-1">
                Cannot connect to backend server at {import.meta.env.VITE_API_URL || "https://ats-backend-rqqg.onrender.com"}
                {(() => {
                  const apiUrl = import.meta.env.VITE_API_URL || "https://ats-backend-rqqg.onrender.com";
                  if (apiUrl.includes("render.com")) {
                    return (
                      <span className="block mt-1 text-xs text-orange-600">
                        💡 Render free tier: Backend may be spinning up (takes ~30-45 seconds)
                      </span>
                    );
                  }
                  return null;
                })()}
              </p>
            </div>
            <button
              type="button"
              onClick={retryConnection}
              disabled={checkingConnection}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {checkingConnection ? "Checking..." : "Retry"}
            </button>
          </div>
          <div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded">
            <strong>Troubleshooting Steps:</strong>
            {(() => {
              const apiUrl = import.meta.env.VITE_API_URL || "https://ats-backend-rqqg.onrender.com";
              const isProduction = apiUrl.includes("render.com") || apiUrl.includes("railway.app");
              
              if (isProduction) {
                return (
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>
                      <strong>Test Backend:</strong>{" "}
                      <a 
                        href={`${apiUrl}/health`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="underline font-semibold"
                      >
                        Open {apiUrl}/health
                      </a>
                      {" "}in browser
                      <ul className="list-disc list-inside ml-4 mt-1">
                        <li>If shows {"{"}"status":"ok"{"}"} → Backend works! Wait 30s and click Retry</li>
                        <li>If 404 error → Backend is Static Site (WRONG!) Must be Web Service</li>
                        <li>If timeout → Backend is spinning up, wait 30-40 seconds</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Check Render Dashboard:</strong>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        <li>Go to render.com dashboard</li>
                        <li>Verify service type is <strong>"Web Service"</strong> (NOT Static Site)</li>
                        <li>Check "Logs" tab for errors</li>
                        <li>Verify deployment status is "Live" (green)</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Verify Environment Variables:</strong>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        <li>PORT=5000 (or auto-assigned)</li>
                        <li>MONGO_URI=your-mongodb-connection-string</li>
                        <li>JWT_SECRET=your-secret-key</li>
                        <li>CORS_ORIGIN=your-frontend-url</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Render Free Tier Behavior:</strong>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        <li>Spins down after 15 min inactivity</li>
                        <li>First request takes ~30-40 seconds</li>
                        <li>This is normal - just wait and retry!</li>
                      </ul>
                    </li>
                  </ol>
                );
              } else {
                return (
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Open terminal and run: <code className="bg-red-200 px-1 rounded">cd backend && bun run src/index.ts</code></li>
                    <li>Make sure MongoDB is running</li>
                    <li>Check backend/.env has PORT=5000</li>
                    <li>Check frontend/.env has VITE_API_URL=http://localhost:5000</li>
                    <li>Test: Open <a href="http://localhost:5000/health" target="_blank" rel="noopener noreferrer" className="underline">http://localhost:5000/health</a> in browser</li>
                  </ol>
                );
              }
            })()}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-red-500">*</span></label>
          <input 
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" 
            placeholder="Enter company name" 
            value={form.companyName} 
            onChange={(e) => setForm({ ...form, companyName: e.target.value })} 
            required 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Position <span className="text-red-500">*</span></label>
          <input 
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" 
            placeholder="Enter position" 
            value={form.position} 
            onChange={(e) => setForm({ ...form, position: e.target.value })} 
            required 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Name</label>
          <input 
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" 
            placeholder="Enter candidate name" 
            value={form.candidateName} 
            onChange={(e) => setForm({ ...form, candidateName: e.target.value })} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Email</label>
          <input 
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" 
            type="email" 
            placeholder="Enter email address" 
            value={form.candidateEmail} 
            onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Phone</label>
          <input 
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" 
            type="tel" 
            placeholder="Enter phone number" 
            value={form.candidatePhone} 
            onChange={(e) => setForm({ ...form, candidatePhone: e.target.value })} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select 
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white" 
            value={form.status} 
            onChange={(e) => setForm({ ...form, status: e.target.value as ApplicationStatus })}
          >
            <option value="applied">Applied</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Applied <span className="text-red-500">*</span></label>
          <input 
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" 
            type="date" 
            value={form.dateApplied} 
            onChange={(e) => setForm({ ...form, dateApplied: e.target.value })} 
            required 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Resume (PDF, DOCX, or Image)
            <span className="text-xs text-gray-500 ml-2 font-normal">(Optional)</span>
          </label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // Validate file size (10MB limit)
                if (file.size > 10 * 1024 * 1024) {
                  toast.error("File size must be less than 10MB");
                  e.target.value = "";
                  return;
                }
                setResumeFile(file);
                toast.success(`Resume selected: ${file.name}`);
              }
            }}
          />
          {resumeFile && (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-600 bg-blue-50 p-1.5 rounded">
              <span className="font-medium">Selected:</span>
              <span className="truncate flex-1">{resumeFile.name}</span>
              <button
                type="button"
                onClick={() => {
                  setResumeFile(null);
                  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                  if (fileInput) fileInput.value = "";
                }}
                className="text-red-600 hover:text-red-700 text-xs font-medium whitespace-nowrap"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea 
          className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none" 
          placeholder="Add any additional notes..." 
          rows={3} 
          value={form.notes} 
          onChange={(e) => setForm({ ...form, notes: e.target.value })} 
        />
      </div>
      <div className="pt-2">
        <button 
          type="submit"
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200"
          disabled={submitting}
        >
          {submitting ? "Adding Application..." : "Add Application"}
        </button>
      </div>
    </form>
  );
};


