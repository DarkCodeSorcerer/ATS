import React, { useState, useEffect, useRef } from "react";
import { useApplications } from "../state/AppContext";
import { Application, ApplicationStatus } from "../types";
import toast from "react-hot-toast";

function exportCsv(apps: Application[]) {
  const header = ["Company", "Position", "Candidate Name", "Email", "Phone", "Status", "Date Applied", "Notes"];
  const rows = apps.map((a) => [
    a.companyName || "", 
    a.position || "", 
    a.candidateName || "",
    a.candidateEmail || "",
    a.candidatePhone || "",
    a.status || "", 
    a.dateApplied ? (typeof a.dateApplied === "string" ? a.dateApplied.slice(0, 10) : new Date(a.dateApplied).toISOString().slice(0, 10)) : "", 
    a.notes || ""
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const ApplicationList: React.FC = () => {
  const { 
    applications, 
    pagination,
    updateApplication, 
    deleteApplication, 
    bulkDelete,
    bulkUpdateStatus,
    loading, 
    fetchApplications 
  } = useApplications();
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("dateApplied");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const lastFetchRef = React.useRef<string>("");

  // Sync currentPage with pagination from server (only if different)
  useEffect(() => {
    if (pagination && pagination.page !== currentPage && !loading) {
      setCurrentPage(pagination.page);
    }
  }, [pagination?.page, currentPage, loading]);

  // Fetch applications when filters/sorting/pagination changes
  useEffect(() => {
    // Create a unique key for this fetch request
    const fetchKey = `${search}-${statusFilter}-${dateFrom}-${dateTo}-${sortBy}-${sortOrder}-${currentPage}-${pageSize}`;
    
    // Skip if already fetching with same parameters
    if (lastFetchRef.current === fetchKey && loading) {
      return;
    }

    const timeoutId = setTimeout(() => {
      // Update last fetch key
      lastFetchRef.current = fetchKey;
      
      fetchApplications({
        search: search || undefined,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: pageSize
      }).catch((error: any) => {
        console.error("Failed to fetch applications:", error);
        // Don't show error for 401 (unauthorized) - user will be redirected to login
        if (error.response?.status === 401) {
          return;
        }
        // Don't show error for network errors if backend is clearly not running
        if (error.isNetworkError || error.code === "ERR_NETWORK" || error.code === "ECONNREFUSED") {
          const apiUrl = import.meta.env.VITE_API_URL || "https://ats-backend-rqqg.onrender.com";
          toast.error(
            `❌ Cannot connect to backend at ${apiUrl}\n\n` +
            `🔧 Please:\n` +
            `1. Start backend: cd backend && bun run src/index.ts\n` +
            `2. Check https://ats-backend-rqqg.onrender.com/health in browser\n` +
            `3. See CHECK_SETUP.md for help`,
            { duration: 8000 }
          );
          return;
        }
        // Show error for other failures
        toast.error("Failed to load applications. Please try again.");
      });
    }, search ? 500 : 0); // Debounce search

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, dateFrom, dateTo, sortBy, sortOrder, currentPage, pageSize]); // Removed fetchApplications from deps - it's stable now

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(applications.map(a => a._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select applications to delete");
      return;
    }
    if (!confirm(`Delete ${selectedIds.size} application(s)?`)) return;
    
    try {
      await bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (error) {
      // Error already handled in context
    }
  };

  const handleBulkStatusUpdate = async (status: ApplicationStatus) => {
    if (selectedIds.size === 0) {
      toast.error("Please select applications to update");
      return;
    }
    
    try {
      await bulkUpdateStatus(Array.from(selectedIds), status);
      setSelectedIds(new Set());
    } catch (error) {
      // Error already handled in context
    }
  };

  const setStatus = async (id: string, status: ApplicationStatus) => {
    try {
      await updateApplication(id, { status });
    } catch (error) {
      // Error already handled in context
      console.error("Failed to update status:", error);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
    fetchApplications({ page: 1, limit: pageSize });
  };

  const hasFilters = search || statusFilter || dateFrom || dateTo;
  const hasSelection = selectedIds.size > 0;

  if (loading && applications.length === 0) {
    return (
      <div className="bg-white rounded shadow p-8">
        <div className="text-center text-gray-500">Loading applications...</div>
      </div>
    );
  }
  
  if (!loading && applications.length === 0 && !hasFilters && !pagination) {
    return (
      <div className="bg-white rounded shadow p-8">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">No applications yet.</p>
          <p className="text-sm">Add your first application above!</p>
        </div>
      </div>
    );
  }

  if (!loading && applications.length === 0 && hasFilters) {
    return (
      <div className="bg-white rounded shadow p-8">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">No applications match your filters.</p>
          <button
            onClick={clearFilters}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Clear Filters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded shadow overflow-hidden">
      <div className="px-4 py-3 border-b space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-lg">Applications {pagination && `(${pagination.total})`}</h3>
          <div className="flex gap-2">
            <button 
              className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 border border-blue-200 rounded hover:bg-blue-50" 
              onClick={() => exportCsv(applications)}
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {hasSelection && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-blue-700">
              {selectedIds.size} selected
            </span>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleBulkStatusUpdate("interview")}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Mark as Interview
              </button>
              <button
                onClick={() => handleBulkStatusUpdate("offer")}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Mark as Offer
              </button>
              <button
                onClick={() => handleBulkStatusUpdate("rejected")}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Mark as Rejected
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-800"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Filters and Sorting */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2 items-center">
            <input
              type="text"
              className="border p-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              placeholder="Search company, position, candidate name, or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
            <select
              className="border p-2 rounded w-full md:w-40 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="applied">Applied</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
            </select>
            <input
              type="date"
              className="border p-2 rounded w-full md:w-40 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
            />
            <input
              type="date"
              className="border p-2 rounded w-full md:w-40 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
            />
            <select
            className="border p-2 rounded w-full md:w-40 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="dateApplied">Date Applied</option>
            <option value="companyName">Company</option>
            <option value="position">Position</option>
            <option value="candidateName">Candidate Name</option>
            <option value="status">Status</option>
          </select>
          <select
            className="border p-2 rounded w-full md:w-32 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
            {hasFilters && (
            <button
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition font-medium text-sm whitespace-nowrap"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
          </div>
        </div>

        {/* Pagination Info */}
        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {pagination.total === 0 ? 0 : Math.max(1, Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total))} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} applications
            </span>
            <select
              className="border rounded px-2 py-1"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="200">200 per page</option>
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left w-12">
                <input
                  type="checkbox"
                  checked={applications.length > 0 && selectedIds.size === applications.length}
                  onChange={handleSelectAll}
                  className="cursor-pointer"
                />
              </th>
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Position</th>
              <th className="px-4 py-2 text-left">Candidate</th>
              <th className="px-4 py-2 text-left">Contact</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Resume</th>
              <th className="px-4 py-2 text-left">Notes</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 && !loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No applications match your filters
                </td>
              </tr>
            ) : (
              applications.map((a) => (
                <tr key={a._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(a._id)}
                      onChange={() => handleSelectOne(a._id)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2 font-medium">{a.companyName}</td>
                  <td className="px-4 py-2">{a.position}</td>
                  <td className="px-4 py-2">{a.candidateName || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2 text-sm">
                    {a.candidateEmail && <div className="text-blue-600">{a.candidateEmail}</div>}
                    {a.candidatePhone && <div className="text-gray-600">{a.candidatePhone}</div>}
                    {!a.candidateEmail && !a.candidatePhone && <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    <select 
                      value={a.status} 
                      className="border rounded p-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-200" 
                      onChange={(e) => setStatus(a._id, e.target.value as ApplicationStatus)}
                    >
                      <option value="applied">Applied</option>
                      <option value="interview">Interview</option>
                      <option value="offer">Offer</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {a.dateApplied 
                      ? (typeof a.dateApplied === "string" 
                          ? a.dateApplied.slice(0, 10) 
                          : new Date(a.dateApplied).toISOString().slice(0, 10))
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {a.resumeFileName ? (
                      <a
                        href={`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/applications/${a._id}/resume`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          const token = localStorage.getItem("token");
                          if (token) {
                            fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/applications/${a._id}/resume`, {
                              headers: {
                                Authorization: `Bearer ${token}`
                              }
                            })
                              .then(res => res.blob())
                              .then(blob => {
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = a.resumeFileName || "resume.pdf";
                                document.body.appendChild(link);
                                link.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(link);
                              })
                              .catch(err => {
                                console.error("Failed to download resume:", err);
                                toast.error("Failed to download resume");
                              });
                          }
                        }}
                      >
                        📄 {a.resumeFileName}
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm max-w-xs truncate" title={a.notes || ""}>{a.notes || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2">
                    <button 
                      className="text-red-600 hover:text-red-800 text-sm" 
                      onClick={async () => {
                        if (confirm("Delete this application?")) {
                          try {
                            await deleteApplication(a._id);
                          } catch (error) {
                            // Error already handled in context
                            console.error("Delete failed:", error);
                          }
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={currentPage === pagination.totalPages}
            className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
