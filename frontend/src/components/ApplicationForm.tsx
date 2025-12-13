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
  const [submitting, setSubmitting] = useState(false);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);

  // Check backend connection on mount (silently)
  useEffect(() => {
    checkBackendConnection().then((result) => {
      setBackendConnected(result.connected);
      if (!result.connected) {
        console.warn("⚠️ Backend not connected:", result.message);
      }
    });
  }, []);

  const retryConnection = async () => {
    setCheckingConnection(true);
    const result = await checkBackendConnection();
    setBackendConnected(result.connected);
    setCheckingConnection(false);
    if (result.connected) {
      toast.success("✅ Backend connected successfully!");
    } else {
      toast.error(result.message);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check backend connection before submitting
    const connectionCheck = await checkBackendConnection();
    if (!connectionCheck.connected) {
      const apiUrl = import.meta.env.VITE_API_URL || "https://ats-w53t.onrender.com";
      toast.error(
        `❌ Cannot connect to backend at ${apiUrl}\n\n` +
        `🔧 To fix:\n` +
        `1. Open terminal: cd backend && bun run src/index.ts\n` +
        `2. Verify MongoDB is running\n` +
        `3. Check .env files match (both port 5000)\n` +
        `4. Click "Retry" button above after starting backend`,
        { duration: 10000 }
      );
      setBackendConnected(false);
      return;
    }
    
    setBackendConnected(true);
    setSubmitting(true);
    try {
      // Clean up empty strings - send undefined for empty optional fields
      const payload: any = {
        companyName: form.companyName.trim(),
        position: form.position.trim(),
        status: form.status,
        dateApplied: form.dateApplied,
      };
      
      if (form.candidateName?.trim()) payload.candidateName = form.candidateName.trim();
      if (form.candidateEmail?.trim()) payload.candidateEmail = form.candidateEmail.trim();
      if (form.candidatePhone?.trim()) payload.candidatePhone = form.candidatePhone.trim();
      if (form.notes?.trim()) payload.notes = form.notes.trim();
      
      await addApplication(payload);
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
    } catch (err: any) {
      // Error is already handled in AppContext, just log it here
      console.error("Application form submission error:", err);
      // Don't show duplicate error toast - AppContext already shows it
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="bg-white p-4 rounded shadow space-y-3" onSubmit={submit}>
      {backendConnected === false && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-semibold">⚠️ Backend Not Connected</span>
              </div>
              <p className="text-sm text-red-700 mt-1">
                Cannot connect to backend server at {import.meta.env.VITE_API_URL || "https://ats-w53t.onrender.com"}
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
            <strong>Quick Fix:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Open terminal and run: <code className="bg-red-200 px-1 rounded">cd backend && bun run src/index.ts</code></li>
              <li>Make sure MongoDB is running</li>
              <li>Check backend/.env has PORT=5000</li>
              <li>Check frontend/.env has VITE_API_URL=http://localhost:5000</li>
            </ol>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Company *" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
        <input className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Position *" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} required />
        <input className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Candidate Name" value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })} />
        <input className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200" type="email" placeholder="Candidate Email" value={form.candidateEmail} onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })} />
        <input className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200" type="tel" placeholder="Candidate Phone" value={form.candidatePhone} onChange={(e) => setForm({ ...form, candidatePhone: e.target.value })} />
        <select className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ApplicationStatus })}>
          <option value="applied">Applied</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
        </select>
        <input className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-200" type="date" value={form.dateApplied} onChange={(e) => setForm({ ...form, dateApplied: e.target.value })} required />
      </div>
      <textarea className="border p-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <button 
        type="submit"
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        disabled={submitting}
      >
        {submitting ? "Adding..." : "Add Application"}
      </button>
    </form>
  );
};


