Mediread MVP Implementation Plan
Goal
Create a privacy‑focused AI‑powered personal health vault that runs entirely in the browser with a lightweight serverless proxy for LLM calls.

Proposed Changes
Frontend (Next.js)
Initialize a new Next.js app in e:/MediRead using npx -y create-next-app@latest ./.
Add TypeScript support.
Install dependencies: idb for IndexedDB, react-dropzone for file uploads, tesseract.js for OCR, pdfjs-dist for PDF text extraction, axios for HTTP requests.
Create three main pages/tabs using a custom TabBar component: Dashboard, Timeline, Ask AI.
Implement a Profile Setup modal shown on first load; store profile in IndexedDB.
Build Upload Flow component:
Accept PDF or image files.
If image, run OCR via tesseract.js to extract raw text. If PDF, extract text via pdfjs-dist.
Send raw text to backend proxy (/api/extract) which uses OpenRouter → google/gemma-3-27b-it:free model.
Design Confirmation Dialog to display extracted JSON, allow editing, then persist both JSON and original file in IndexedDB with timestamps.
Implement Health Snapshot utility that aggregates active conditions, medications, and latest labs from stored documents.
Create Ask AI chat UI that sends a concise payload (profile + snapshot + relevant document JSON) to the proxy endpoint /api/chat, which uses OpenRouter → openrouter/free model.
Ensure all UI follows a calm medical aesthetic: soft blues, large readable fonts, mobile‑first responsive layout.
Backend (Serverless Proxy)
Add a pages/api/extract.ts handler that receives raw text, forwards it to OpenRouter (google/gemma-3-27b-it:free) with a system prompt to return the structured JSON schema.
Add a pages/api/chat.ts handler that receives the minimal payload, forwards it to OpenRouter (openrouter/free), and returns the response.
Security measures:
API key stored in environment variable (OPENROUTER_API_KEY). Never exposed to client.
Rate limiting using lru-cache (e.g., max 5 requests per minute per IP).
Sanitize incoming text with a simple whitelist and escape special characters to mitigate prompt injection.
Do not log request bodies; only log request metadata.
IndexedDB Schema
ts
interface Profile { name?: string; age: number; gender: string; knownConditions: string[]; }
interface Document {
  id: string; // uuid
  fileName: string;
  fileType: 'pdf' | 'image';
  uploadedAt: string; // ISO timestamp
  documentDate: string; // user‑confirmed
  rawText: string;
  extracted: ExtractedData;
}
interface ExtractedData {
  document_type: string;
  document_date: string;
  medications: {name:string; dosage:string; frequency:string}[];
  lab_values: {test_name:string; value:number; unit:string; reference_range:string; flag:string}[];
  conditions_detected: string[];
  short_summary: string;
}
Verification Plan
Automated Tests (using Jest & React Testing Library)
Profile Persistence Test – Verify that the profile modal saves data to IndexedDB and loads it on subsequent loads.
Upload Flow Test – Mock file upload, ensure OCR runs for images, and that the proxy /api/extract is called with correct payload.
Confirmation Editing Test – Simulate user editing a field in the confirmation dialog and confirm that the edited JSON is stored.
Health Snapshot Aggregation Test – Insert multiple documents into IndexedDB and assert that the snapshot reflects the latest labs and active conditions.
Chat Payload Test – Verify that the /api/chat request body contains only the minimal required data.
Manual Tests
First‑time Setup: Open the app in a fresh browser, confirm the profile modal appears, fill data, and ensure it persists after refresh.
Responsive Layout: Resize the browser to mobile widths; tabs should stack vertically and remain usable.
Document Timeline: Upload several documents, check they appear chronologically with correct dates.
AI Interaction: Ask a health‑related question; verify the response includes the disclaimer and does not suggest medication changes.
Security Check: Inspect network tab; ensure no OPENROUTER_API_KEY appears in client requests.
Acceptance Criteria
All data stays client‑side except LLM calls.
No authentication flow.
UI meets the calm medical aesthetic.
All automated tests pass (npm test).
Manual test steps are reproducible.

Comment
Ctrl+Alt+M
