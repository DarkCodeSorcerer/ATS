export type ApplicationStatus = "applied" | "interview" | "offer" | "rejected";

export interface Application {
  _id: string;
  companyName: string;
  position: string;
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  status: ApplicationStatus;
  dateApplied: string;
  notes?: string;
  resumeFileName?: string;
  resumeFilePath?: string;
}

export interface JobDescription {
  _id: string;
  title: string;
  description: string;
  position?: string;
  company?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApplicationAnalytics {
  total: number;
  recent: number;
  byStatus: {
    applied: number;
    interview: number;
    offer: number;
    rejected: number;
  };
}


