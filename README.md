# ResumeX: AI-Powered Resume Tailoring Chrome Extension

ResumeX is a production-ready, context-aware resume tailoring Chrome extension and API service. It automatically analyzes job descriptions from any job board, merges your real-time LinkedIn & GitHub profiles, and generates an ATS-optimized, tailored resume in both JSON and beautifully formatted PDF.

---

## 🚀 Key Features

*   **⚡ Chrome Extension UI**: Seamless Manifest V3 extension with one-click **Sync**, **Generate**, and **Auto-Fill** controls.
*   **🔄 Hybrid Profile Scraping**: Scrapes LinkedIn profiles (auto-scrolling to bypass lazy loading) and GitHub repositories client-side, merging them into a unified cache.
*   **⚙️ Settings Panel Credentials Cache**: Cache your personal email and phone number locally in the extension settings. Since LinkedIn's public main profile pages shield contact details for privacy, this cache serves as a reliable autofill fallback.
*   **🤖 Multi-Provider LLM Core**: Supports OpenAI (`gpt-4o-mini`), Google Gemini (`gemini-2.0-flash`), and OpenRouter (`google/gemini-2.0-flash-lite:free` or auto-routing) with dynamic temperature scaling.
*   **🛡️ Anti-Hallucination Guardrails**: Running programmatic cleanup logic (`cleanTailoredResume`) that cross-references LLM outputs against your real synced experience and education, discarding hallucinated entries.
*   **💾 Resume Vault (PostgreSQL + JSON Fallback)**: Stores resume histories in a local PostgreSQL database, with a seamless, fail-safe fallback to a local JSON database (`resumes_db.json`) if the database is offline.
*   **📐 Development Standards (GEMINI.md)**: Adheres to rigorous Test-Driven Development (TDD) with 100% test coverage, feature branch discipline, subagent maximization, and Ralph loops for autonomous resilience. Refer to [GEMINI.md](file:///home/liam/src/resumex/GEMINI.md) for full details.
*   **📥 Premium PDF Export**: Generates styled, ATS-compliant PDF resumes using `pdfkit` (bold section headers, right-aligned details, HSL-themed visual accents, and customized column-based skills layouts).
*   **📄 Tailored Cover Letter Generator**: Generates custom cover letters mapped to the target job description and your resume tailoring blueprint, automatically falling back to general parameters (like `"Hiring Company"`) if specific details are not parsed.
*   **🤖 Auto-Fill Application Engine**: Automatically detects form fields, parses application pages, autofills details, generates & populates cover letters, normalizes profile links into valid HTML5 URLs (ensuring `https://` prefix to bypass browser validation errors), and uploads the generated resume PDF into form inputs.

---

## 📂 Project Structure

```
resumex/
├── extension/                  # Chrome Extension Code
│   ├── manifest.json           # Extension configuration
│   ├── background.js           # Background service worker coordination
│   ├── contentScript.js        # Content script injection
│   ├── linkedinScraper.js      # Programmatic auto-scrolling LinkedIn scraper
│   ├── githubScraper.js        # GitHub repositories scraper
│   ├── formDetector.js         # Semantic form field detector
│   ├── autoApply.js            # Auto-fill executor
│   ├── applyController.js      # Form handler orchestration
│   ├── popup.html              # Extension visual popup interface
│   ├── popup.css               # Modern glassmorphism UI styles
│   ├── popup.js                # Core popup interaction logic
│   ├── popup_handlers.js       # Save & PDF download button handlers
│   └── popup_autofill.js       # Auto-fill triggering logic
├── backend/                    # Express.js API Server
│   ├── config/
│   │   └── database.js         # PostgreSQL connection pool config
│   ├── models/
│   │   └── schema.sql          # PostgreSQL database schema definition
│   │   └── Resume.js           # Database access layer for Resumes
│   ├── routes/
│   │   └── resumeVaultRoutes.js# Save, search, stats & PDF endpoints
│   ├── services/
│   │   ├── githubService.js    # Server-side GitHub API parser
│   │   ├── linkedinService.js  # Server-side LinkedIn RapidAPI aggregator
│   │   ├── jdParser.js         # Job description keyword extractor
│   │   ├── tailoringService.js # Deterministic matching & blueprint generator
│   │   ├── llmProvider.js      # OpenAI / Gemini / OpenRouter wrappers
│   │   ├── pdfExportService.js # Premium PDF compiler using PDFKit
│   │   ├── resumeVaultService.js # Dual-mode persistence layer (Mongo/Local)
│   │   └── resumeGenerator.js  # Full resume tailoring orchestrator
│   ├── promptTemplate.js       # Blueprint prompt engineering and STAR instructions
│   ├── mockData.js             # Mock profile data fallback
│   ├── resumes_db.json         # Local fail-safe database storage
│   ├── server.js               # Main Express.js server
│   ├── package.json            # Node backend dependencies
│   └── TESTING.md              # Detailed backend testing instructions
├── shared/                     # Shared schema files
├── resume.pdf                  # Sample compiled PDF
└── README.md                   # Project documentation
```

---

## 🛠️ Setup Instructions

### 1. Backend API Server Setup

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your environment. Copy `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```
4.  Configure the environment keys inside `.env` (refer to [GEMINI.md](file:///home/liam/src/resumex/GEMINI.md) for details):
    *   Set `LLM_PROVIDER` (e.g. `openrouter`, `openai`, or `gemini`).
    *   Add your API keys (`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`).
    *   Configure `PORT` (defaults to `3001` to prevent clashes).
    *   Configure the PostgreSQL variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DATABASE_URL`.
5.  Start the local PostgreSQL container (see [GEMINI.md](file:///home/liam/src/resumex/GEMINI.md) for Podman/Docker command).
6.  Start the server:
    ```bash
    npm start
    ```
    The server will run on `http://localhost:3001` (with dynamic database fallbacks enabled).

---

### 2. Chrome Extension Setup

1.  Open Google Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer mode** using the toggle switch in the top-right corner.
3.  Click **Load unpacked** in the top-left corner.
4.  Select the `extension` directory inside your local `resumex` repository.
5.  The **ResumeX** extension is now installed and visible in your extension bar!

---

## 🎯 How to Test

1.  **Sync Profile**: 
    Open the extension popup, enter your LinkedIn and GitHub URLs, and click **🔄 Sync**. The extension will open background tabs, scroll to lazy-load content, scrape your profiles, cache them in Chrome storage, and close the tabs.
2.  **Generate Tailored Resume**:
    Navigate to a job posting (e.g. using `extension/tests/test-job-listing.html`). Click the extension popup, enter a target job title, and click **Generate Tailored Resume**.
3.  **Download PDF**:
    Click **📥 Download PDF** in the popup to download the ATS-optimized resume styled with our custom layout.
4.  **Auto-Fill Application**:
    Click **🤖 Auto-Fill Application** inside the popup when on a job form (e.g. `extension/tests/test-form.html`). The extension will automatically populate the name, social links, and upload your generated PDF resume.
5.  **View Vault Statistics**:
    Resumes are saved locally in `backend/resumes_db.json`. Query the stats endpoint:
    ```bash
    curl http://localhost:3001/api/vault/stats
    ```

---

## 🚦 REST API Endpoints

### `POST /api/generate-tailored-resume`
Generates a tailored resume using job description and user profile payload.
*   **Payload**:
    ```json
    {
      "jobDescription": "Full Job Post Text...",
      "userProfile": { ... },
      "githubUsername": "SaadHaider01",
      "linkedinProfile": "https://linkedin.com/..."
    }
    ```

### `POST /api/generate-cover-letter`
Generates a tailored cover letter using the resume JSON, job description, company name, and job title.
*   **Payload**:
    ```json
    {
      "jobDescription": "Full Job Post Text...",
      "tailoringBlueprint": { ... },
      "resumeJSON": { ... },
      "company": "Company Name (optional, defaults to 'Hiring Company')",
      "jobTitle": "Job Title (required)"
    }
    ```

### `POST /api/save-resume`
Saves a tailored resume to MongoDB (or fallback `resumes_db.json`).

### `GET /api/resume/:id/pdf`
Downloads the compiled premium PDF for a specific saved resume.

### `GET /api/vault/stats`
Fetches total resume counts, top companies applied to, and application history.

---

**Last Updated:** June 2026
