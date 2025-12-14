# TalentFlow - Intelligent Applicant Tracking System

**TalentFlow** is a full-stack Applicant Tracking System (ATS) built with Bun, TypeScript, MongoDB, and React. Designed specifically for recruiters who sort through hundreds of applications, TalentFlow streamlines the hiring process with intelligent resume matching, comprehensive application tracking, and powerful filtering capabilities.

## 🌐 Live Demo

**Try TalentFlow Now!**

Visit the live application at: **[https://ats-tracking.netlify.app/](https://ats-tracking.netlify.app/)**

1. Click the link above to access the live application
2. Create a new account to get started
3. Explore all features including:
   - Application tracking and management
   - Resume matching and ranking
   - Analytics dashboard
   - Bulk operations and filtering

The live demo is fully functional and allows you to experience all the features of TalentFlow without local setup.

## ⚠️ Important Note: Resume Upload Format

**For Resume Matching and Checking:**

Currently, for optimal text extraction and resume analysis accuracy, **please use image files (JPG, PNG, JPEG)** when uploading resumes for matching. The OCR (Optical Character Recognition) system is optimized for image-based resume processing, ensuring the best possible text extraction and matching results.

**Future Enhancement:**

PDF scanning with comprehensive result display is under active development. In upcoming releases, PDF files will be automatically scanned and analyzed with detailed matching results presented in an intuitive visual interface. This enhancement will provide seamless PDF processing capabilities alongside the existing image-based workflow.

## 🏗️ Project Structure

```
TalentFlow/
├── backend/          # Express API server with Bun runtime
│   ├── src/
│   │   ├── routes/   # API route handlers
│   │   ├── models/   # MongoDB schemas
│   │   ├── middleware/ # Auth middleware
│   │   └── utils/    # Resume parsing & matching utilities
│   └── .env          # Backend configuration
├── frontend/         # React + Vite frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/     # Page components
│   │   ├── state/     # Context providers
│   │   └── api/       # API client
│   └── .env          # Frontend configuration
└── README.md         # This file

## 🚀 Quick Start

**Option 1: Try the Live Demo**

Visit **[https://ats-tracking.netlify.app/](https://ats-tracking.netlify.app/)** to use TalentFlow immediately. Simply create an account and start managing your applications!

**Option 2: Local Development Setup**

If you want to run TalentFlow locally for development or customization, follow the setup instructions below.

### Manual Setup

#### Backend Setup

1. **Install dependencies:**
   ```bash
   cd backend
   bun install
   ```

2. **Create `.env` file in `backend/` directory:**
   ```
   PORT=5000
   MONGO_URI=(your mongoDB connection)
   JWT_SECRET=(Your secret key)
   CORS_ORIGIN=http://localhost:5173
   ```

3. **Start MongoDB** (if using local MongoDB):
   - **Windows:** `net start MongoDB`
   - **Mac/Linux:** `brew services start mongodb-community`
   - **Alternative:** Use MongoDB Atlas (cloud) and update `MONGO_URI` in `.env`

4. **Run backend server:**
   ```bash
   bun run src/index.ts
   ```
   The backend will run on `http://localhost:5000`

#### Frontend Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   bun install
   ```

2. **Create `.env` file in `frontend/` directory:**
   ```
   VITE_API_URL=http://localhost:5000
   ```
   **IMPORTANT:** The port in `VITE_API_URL` (5000) must match the `PORT` in backend `.env` file!

3. **Run frontend dev server:**
   ```bash
   bun run dev
   ```
   Open http://localhost:5173

## 🔧 Configuration

### Port Configuration

**Critical:** The backend and frontend ports must match!

- **Backend `.env`:** `PORT=5000`
- **Frontend `.env`:** `VITE_API_URL=http://localhost:5000`

If you need to use a different port (e.g., 4000):
- Change `PORT=4000` in `backend/.env`
- Change `VITE_API_URL=http://localhost:4000` in `frontend/.env`
- Restart both servers

### Environment Variables

**Backend `.env`:**
- `PORT` - Server port (default: 5000)
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens (change in production!)
- `CORS_ORIGIN` - Allowed frontend origin

**Frontend `.env`:**
- `VITE_API_URL` - Backend API URL (must match backend PORT)

## 🐛 Troubleshooting

### "Cannot connect to server" Error

1. **Check backend is running:**
   - Look for "✅ API running on http://localhost:5000" in backend terminal
   - Test: Open http://localhost:5000/health in browser (should show `{"status":"ok"}`)

2. **Verify ports match:**
   - Backend `.env`: `PORT=5000`
   - Frontend `.env`: `VITE_API_URL=http://localhost:5000`
   - Both must use the same port number!

3. **Check MongoDB is running:**
   - Backend terminal should show "✅ Database connected successfully"
   - If not, start MongoDB or use MongoDB Atlas

4. **Restart servers:**
   - Stop both servers (Ctrl+C)
   - Start backend first, then frontend
   - Hard refresh browser (Ctrl+Shift+R)

### Port Already in Use

If port 5000 is busy:
1. Find what's using it:
   ```powershell
   # Windows
   netstat -ano | findstr :5000
   ```
2. Kill the process or change ports:
   - Backend `.env`: `PORT=4000`
   - Frontend `.env`: `VITE_API_URL=http://localhost:4000`
   - Restart both servers

### Database Connection Failed

1. **Local MongoDB:**
   - Start MongoDB service: `net start MongoDB` (Windows)
   - Check `MONGO_URI` in backend `.env`
   - Try: `mongodb://127.0.0.1:27017/ats`

2. **MongoDB Atlas (Cloud):**
   - Get connection string from MongoDB Atlas
   - Update `MONGO_URI` in backend `.env`
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/ats`

### Verification

After setup, verify:
- **Browser console** shows: `🔗 API URL: http://localhost:5000`
- **Backend terminal** shows: `✅ API running on http://localhost:5000`
- **Health check** (http://localhost:5000/health) returns: `{"status":"ok"}`

## ✨ Features

- **Authentication**: Secure JWT-based login/signup system
- **Unified Dashboard**: 
  - Quick overview of hiring pipeline
  - Recent applications preview
  - Quick navigation to all features
- **Application Tracking**: 
  - CRUD operations for job applications
  - Track company, position, candidate details, status, dates, and notes
  - **Date Range Filters**: Filter applications by date applied (from/to)
  - **Tags System**: Add custom tags to applications for better organization
  - Filter by status, company, position, tags, and date range
  - Search across company, position, candidate name, and email
  - Sort by date, company, position, status
  - Pagination support (25, 50, 100, 200 per page)
  - Bulk operations (delete, status update)
  - CSV export functionality
- **Resume Matching System**:
  - Single or bulk resume upload
  - **Saved Job Descriptions**: Save and reuse multiple job descriptions
  - Automatic resume parsing to extract:
    - Skills and technical keywords
    - Work experience and duration
    - Education and degrees
    - Certificates and certifications
  - Intelligent job description analysis
  - Automatic matching algorithm with match score (0-100%)
  - Keyword matching (matched vs missing keywords)
  - Automatic shortlisting (≥80% match) or low-priority (<80%)
  - Rank, filter, and sort resumes by match score
  - Visual match score indicators
  - **Use Stored Resumes**: Access and match resumes uploaded through the Applications page
  - **Bulk Selection**: Select multiple stored resumes for batch matching
- **Analytics Dashboard**:
  - Total applications count
  - Recent applications (30 days)
  - Status breakdown (Applied, Interview, Offer, Rejected)
  - Interview rate and offer rate calculations
- **Modern UI**: 
  - Responsive Tailwind CSS design
  - Toast notifications for user feedback
  - Loading states and error handling
  - Clean, intuitive interface

## 🎨 Design Decisions & Assumptions

### Technology Stack Choices

**Backend: Bun Runtime**
- **Decision:** Chose Bun over Node.js for faster startup times and built-in TypeScript support
- **Assumption:** Development team is comfortable with modern JavaScript runtimes
- **Benefit:** Faster development cycle, better performance, native TypeScript support

**Database: MongoDB**
- **Decision:** Used MongoDB (NoSQL) instead of PostgreSQL/MySQL
- **Reasoning:** 
  - Flexible schema for resume data (varies by format)
  - Easy to store unstructured resume content
  - Good for rapid prototyping and iteration
  - Natural fit for document-based resume storage
- **Assumption:** Resume data structure may vary, requiring schema flexibility

**Frontend: React + Vite**
- **Decision:** React with Vite instead of Create React App
- **Reasoning:**
  - Vite provides faster HMR (Hot Module Replacement)
  - Better build performance
  - Modern tooling with minimal configuration
- **Assumption:** Team prefers React ecosystem and modern build tools

**State Management: React Context API**
- **Decision:** Used Context API instead of Redux or Zustand
- **Reasoning:**
  - Simpler for this application size
  - No additional dependencies
  - Sufficient for shared state (applications, auth, analytics)
- **Assumption:** Application state complexity is manageable with Context API
- **Note:** Used `useCallback` and `useRef` to prevent infinite re-renders and optimize performance

**UI Framework: Tailwind CSS**
- **Decision:** Tailwind CSS for styling instead of Material-UI or styled-components
- **Reasoning:**
  - Utility-first approach for rapid UI development
  - Smaller bundle size (with purging)
  - Consistent design system
  - Easy to customize
- **Assumption:** Team prefers utility-first CSS approach

### Architecture Decisions

**RESTful API Design**
- **Decision:** REST API instead of GraphQL
- **Reasoning:**
  - Simpler to implement and understand
  - Sufficient for current use cases
  - Easier debugging and testing
- **Assumption:** API requirements are straightforward and don't need GraphQL's flexibility

**JWT Authentication**
- **Decision:** JWT tokens stored in localStorage
- **Reasoning:**
  - Stateless authentication
  - Simple implementation
  - Works well with SPA architecture
- **Assumption:** Security requirements allow client-side token storage
- **Note:** In production, consider httpOnly cookies for better security

**File Upload: Multer**
- **Decision:** Used Multer for handling file uploads
- **Reasoning:**
  - Standard Express middleware
  - Handles multipart/form-data efficiently
  - Supports multiple file types
- **Assumption:** File sizes are reasonable (not handling GB-sized files)

**Resume Parsing: Multiple Strategies**
- **Decision:** Implemented multiple parsing strategies (PDF, DOCX, OCR for images)
- **Reasoning:**
  - Resumes come in various formats
  - Need to support common formats (PDF, Word, images)
  - Fallback to OCR for image-based resumes
- **Assumption:** Most resumes are in PDF or Word format, images are less common
- **Important Note:** For optimal resume checking and text extraction, **please use image files (JPG, PNG, JPEG)** when uploading resumes. The OCR system is optimized for image-based resume processing. PDF scanning and result display functionality is currently under development and will be available in a future release.

### Algorithm & Matching Logic

**Keyword-Based Matching**
- **Decision:** Simple keyword matching instead of ML/NLP models
- **Reasoning:**
  - Fast and predictable
  - Easy to understand and debug
  - No need for training data
  - Sufficient for initial matching
- **Assumption:** Keyword matching provides acceptable accuracy for initial screening
- **Limitation:** May miss semantic similarities (e.g., "JS" vs "JavaScript")

**Match Score Calculation**
- **Decision:** Percentage-based score (matched keywords / total keywords)
- **Formula:** `(matchedKeywords / totalJDKeywords) * 100`
- **Threshold:** 80% for automatic shortlisting
- **Assumption:** 80% match indicates strong candidate fit
- **Note:** Threshold can be adjusted based on hiring needs

**Skill Extraction: Predefined Lists**
- **Decision:** Hardcoded technical skills list instead of dynamic extraction
- **Reasoning:**
  - Consistent skill recognition
  - Covers common tech stack
  - Fast lookup
- **Assumption:** Most candidates use standard skill names
- **Limitation:** May miss newer or niche technologies

### Data Model Assumptions

**Application Schema**
- **Assumption:** Each application belongs to one user (recruiter)
- **Assumption:** Status follows linear progression: Applied → Interview → Offer/Rejected
- **Assumption:** Candidate information (name, email, phone) is optional (for manual entries)

**Resume Storage**
- **Decision:** Store resume files and parsed data separately
- **Reasoning:**
  - Original file needed for download
  - Parsed data needed for matching
  - Allows re-parsing if parser improves
- **Assumption:** Resume files are typically < 10MB

**User Model**
- **Assumption:** Simple email/password authentication is sufficient
- **Assumption:** No role-based access control needed initially
- **Note:** Can be extended for multi-tenant or role-based systems

### Performance Optimizations

**Request Deduplication**
- **Decision:** Implemented request deduplication using refs
- **Reasoning:** Prevent infinite loops from useEffect dependencies
- **Implementation:** `useCallback` for stable function references, `useRef` for tracking ongoing requests

**Pagination**
- **Decision:** Server-side pagination (default 50 items per page)
- **Reasoning:**
  - Better performance with large datasets
  - Reduces memory usage
  - Faster initial load
- **Assumption:** Most users don't need to see all applications at once

**Debounced Search**
- **Decision:** 500ms debounce for search input
- **Reasoning:**
  - Reduces API calls while typing
  - Better user experience
  - Less server load
- **Assumption:** Users type at reasonable speed

### Security Assumptions

**CORS Configuration**
- **Decision:** Single origin in development (`http://localhost:5173`)
- **Assumption:** Production will have specific allowed origins
- **Note:** Currently permissive for development ease

**JWT Secret**
- **Assumption:** Default secret is acceptable for development
- **Critical:** Must change in production environment
- **Note:** Consider using environment-specific secrets

**File Upload Security**
- **Assumption:** File type validation is sufficient
- **Note:** In production, add virus scanning and size limits

### Error Handling Strategy

**Graceful Degradation**
- **Decision:** Show user-friendly error messages instead of technical errors
- **Reasoning:** Better UX, less confusion
- **Implementation:** Network errors show setup instructions, 401 errors redirect to login

**Silent Failures for Non-Critical Features**
- **Decision:** Analytics failures don't block main functionality
- **Reasoning:** Analytics is nice-to-have, not critical
- **Assumption:** Users can still use the app if analytics fails

### UI/UX Assumptions

**Progressive Disclosure**
- **Assumption:** Users prefer to see summary first (analytics), then details (list)
- **Implementation:** Dashboard → Analytics → Application List hierarchy

**Bulk Operations**
- **Assumption:** Recruiters often need to update multiple applications at once
- **Implementation:** Bulk delete and bulk status update features

**Export Functionality**
- **Assumption:** Users need to export data for external analysis
- **Implementation:** CSV export with all application fields

### Scalability Assumptions

**Current Scale**
- **Assumption:** System handles hundreds to low thousands of applications per user
- **Assumption:** Single MongoDB instance is sufficient
- **Assumption:** No need for caching layer (Redis) initially

**Future Considerations**
- Can add Redis for session management
- Can implement Elasticsearch for better search
- Can add message queue for async resume processing
- Can implement microservices if needed

### Development Assumptions

**Development Environment**
- **Assumption:** Developers use Windows, Mac, or Linux
- **Implementation:** Batch files for Windows, shell scripts can be added for Unix
- **Assumption:** MongoDB is available locally or via Atlas

**Code Organization**
- **Decision:** Feature-based folder structure (routes, models, components)
- **Reasoning:** Easy to find related code
- **Assumption:** Team size is small, no need for complex monorepo structure

## 📝 API Endpoints

### Authentication
- `POST /auth/signup` - Create new user account
- `POST /auth/login` - Login and get JWT token

### Applications
- `GET /applications` - Get applications (with filters, pagination, sorting)
- `POST /applications` - Create new application
- `PUT /applications/:id` - Update application
- `DELETE /applications/:id` - Delete application
- `POST /applications/bulk` - Bulk operations (delete, update status)
- `GET /applications/analytics` - Get analytics data

### Resume Matching
- `POST /match/upload` - Upload single resume
- `POST /match/upload-bulk` - Upload multiple resumes
- `POST /match/match` - Match resumes against job description
- `GET /match/resumes` - Get all resumes with match scores

### Health Check
- `GET /health` - Server health check

## 🔒 Security Considerations

- JWT tokens for authentication
- Password hashing with bcrypt
- CORS protection
- Helmet.js for security headers
- Input validation with Zod
- MongoDB injection prevention via Mongoose

**Production Recommendations:**
- Use environment variables for all secrets
- Implement rate limiting
- Add request validation middleware
- Use HTTPS
- Implement proper logging and monitoring
- Add file upload size limits and virus scanning
- Consider httpOnly cookies for tokens

## 📦 Dependencies

### Backend
- `express` - Web framework
- `mongoose` - MongoDB ODM
- `jsonwebtoken` - JWT authentication
- `bcryptjs` - Password hashing
- `multer` - File upload handling
- `pdf-parse` - PDF parsing
- `zod` - Schema validation
- `cors` - CORS middleware
- `helmet` - Security headers
- `morgan` - HTTP request logging

### Frontend
- `react` - UI library
- `react-router-dom` - Routing
- `axios` - HTTP client
- `react-hot-toast` - Notifications
- `tailwindcss` - CSS framework
- `pdf-parse` - PDF parsing (client-side)
- `tesseract.js` - OCR for images

## 🚧 Known Limitations

1. **Resume Parsing:** May not extract all information from complex resume formats
2. **Matching Algorithm:** Keyword-based, may miss semantic similarities
3. **File Size:** No explicit file size limits (assumes reasonable sizes)
4. **Concurrent Users:** Not tested with high concurrent load
5. **Error Recovery:** Some errors may require manual intervention
6. **Resume Upload Format:** Currently, for optimal resume checking and text extraction accuracy, **please use image files (JPG, PNG, JPEG)** when uploading resumes. PDF scanning with comprehensive result display is under active development and will be available in a future release.

## 🔮 Future Enhancements

- [ ] **PDF Scanning & Result Display**: Enhanced PDF processing with comprehensive text extraction and visual result presentation. PDF files will be scanned and analyzed with detailed matching results displayed in an intuitive interface.
- [ ] Advanced ML-based resume matching
- [ ] Email integration for application tracking
- [ ] Calendar integration for interviews
- [ ] Multi-user collaboration features
- [ ] Advanced analytics and reporting
- [ ] Resume template generation
- [ ] Interview scheduling system
- [ ] Candidate communication portal
- [ ] Integration with job boards
- [ ] Mobile app support

## 📄 License

This project is for demonstration purposes.

## 👥 Contributing

This is a demonstration project. For production use, consider:
- Adding comprehensive tests
- Implementing CI/CD pipeline
- Adding monitoring and logging
- Security audit
- Performance testing
- Documentation for API consumers

