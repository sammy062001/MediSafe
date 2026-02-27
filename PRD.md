# Product Requirements Document (PRD): MediSafe (Personal Health Vault)

## 1. Overview
**MediSafe** (formerly MediRead) is a local-first, privacy-centric personal health vault web application. It empowers users to digitize, securely store, and easily understand their medical documents (lab reports, prescriptions) without compromising their sensitive health data. The core premise is that **all medical data remains exclusively on the user's device**, utilizing the browser's IndexedDB. External AI APIs (Groq) are used strictly as stateless processing engines for OCR-to-JSON extraction and conversational Q&A, not for data storage.

## 2. Problem Statement
Individuals often struggle to manage scattered, physical, or poorly formatted medical records. When they do find them, understanding complex lab values (e.g., "Hemoglobin 12.5 g/dL") or deciphering doctors' prescriptions requires deciphering medical jargon. Existing cloud-based health apps require users to upload highly sensitive personal data to third-party servers, raising significant privacy and security concerns.

## 3. Product Vision & Goals
*   **Privacy First**: Provide a 100% local, client-side data vault.
*   **Accessibility**: Translate complex medical jargon into simple, layman-accessible language.
*   **Digitization**: Effortlessly convert physical/scanned documents into structured, queryable data.
*   **Actionable Intelligence**: Act as a personal health assistant that remembers the user's longitudinal health snapshot.

---

## 4. Technical Architecture & Stack

### Frontend & Framework
*   **Framework**: Next.js 16 (App Router)
*   **UI Library**: React 19
*   **Styling**: Vanilla CSS + Tailwind CSS v4 (optional usage)
*   **Language**: TypeScript

### Local Storage (Database)
*   **Library**: `idb` (IndexedDB wrapper)
*   **Target**: `mediread-vault` database.
*   **Stores**:
    *   `profile`: Singleton store for User Name, Age, Gender, Known Conditions.
    *   `documents`: Keyed by `id`, indexed by `by-date`. Stores raw text, base64 file data, and structured extracted JSON.
    *   `conversations`: Keyed by `id`, indexed by `by-updated`. Stores the Ask AI chat histories.

### Document Processing pipeline
*   **Upload/Capture**: Supports `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`. Includes multi-file batch upload and direct mobile camera capture (`<input capture="environment">`).
*   **Extraction (Client-side)**:
    *   **PDFs**: Uses `pdfjs-dist` to extract raw text strings client-side.
    *   **Images**: Uses `tesseract.js` for local Optical Character Recognition (OCR).
*   **Structuring (Server-side API)**:
    *   Raw text is sent to the Next.js API route (`/api/extract`).
    *   The API invokes the Groq API (`llama-3.3-70b-versatile`) with a strict System Prompt.
    *   The model parses the unstructured OCR text into a rigidly typed JSON schema (`MedicalTestReport` or `Prescription`).

### AI Conversational Assistant (`Ask AI`)
*   **Engine**: Groq API (`llama-3.3-70b-versatile`).
*   **Context Injection**: On every chat request, the API queries the local database to build a `HealthSnapshot` (Active Conditions, Current Medications with dosages, Latest Lab Results with reference ranges and abnormal flags). This snapshot is dynamically injected into the system prompt.
*   **Data Provenance & Citations**: The system prompt strictly requires the AI to ground all answers in the provided health snapshot and list exact sources (Document Name – Date) under a "Sources:" heading at the end of the response.
*   **Markdown Rendering**: AI responses use a lightweight custom markdown renderer for bolding, italics, and nested lists.

---

## 5. Core Features & Requirements

### 5.1 Profile Management
*   **Functionality**: Users provide basic demographic data (Age, Gender) and known chronic conditions.
*   **Purpose**: Contextualizes the AI's understanding of lab results and general health questions.

### 5.2 Document Upload & Processing Pipeline
*   **UX/UI**: A modal drag-and-drop zone. Must support multiple files simultaneously. Must offer a direct "Take Photo" button on mobile devices.
*   **Processing Flow**:
    1.  User selects files.
    2.  App loops through the queue sequentially.
    3.  Runs client-side extraction (PDF.js or Tesseract.js).
    4.  Passes text to `/api/extract` for structured JSON mapping (Groq Llama 3).
    5.  Presents a Confirmation Dialog to the user to review the extracted data (Patient Name, Report Date, Test Results or Medications).
    6.  User clicks "Save" -> Document written to IndexedDB -> Flow moves to the next file (if queued).

### 5.3 Dashboard View
*   **Functionality**: A central hub summarizing the user's current health state.
*   **Components**:
    *   **Active Conditions**: Derived from the user's manual profile entries and extrapolated from documents.
    *   **Current Medications**: Aggregated list of medicines extracted from Prescription documents.
    *   **Latest Lab Results**: Aggregated list of test results (e.g., Hemoglobin, Glucose) extracted from Medical Test Reports, highlighting "abnormal" flags (high/low).

### 5.4 Timeline View
*   **Functionality**: A chronological feed of all uploaded documents.
*   **Interactions**: Users can click on a document to view its metadata, extracted test results/medications, and the original base64 image/PDF rendering.

### 5.5 "Ask AI" Chatbot
*   **Functionality**: A conversational interface for the user to query their health data.
*   **Conversational Memory**: Chat sessions (`Conversations`) are persistent and saved locally to IndexedDB. Users can view past threads, delete them, or start new ones.
*   **Tone & Style**: Warm, friendly, and non-prescriptive. Translates medical jargon into plain English (e.g., explaining that Hemoglobin is the protein that carries oxygen).
*   **Guardrails**:
    *   Must *never* diagnose, prescribe, or recommend medication changes.
    *   Must append a medical disclaimer.
    *   Must structure its outputs cleanly (short paragraphs, bullet points) and group citations at the very end.

---

## 6. Data Schemas (Reference)

### Extracted Medical Data
*   **Medical Test Report**: Tracks `test_name`, `value`, `unit`, `reference_range`, and `abnormal_flag` (high, low, normal).
*   **Prescription**: Tracks `medicine_name`, `dosage`, `frequency`, `duration`, and `instructions`.

### Health Snapshot (Passed to AI Prompt)
In addition to the raw test/medication details, the application attaches a `sourceDoc` (filename) and `sourceDate` to every individual lab result and medication before passing it to the AI. This ensures the AI can confidently cite *where* and *when* it got a specific data point.

## 7. Operational Constraints & Rate Limiting
*   **External Dependencies**: Relies on the Groq API for massive-parameter LLM inference.
*   **Environment Variables**: Requires `GROQ_API_KEY` for both chat and extraction.
*   **Rate Limiting**: Custom Next.js middleware limits IP addresses to 5 requests per minute to prevent abuse or runaway API costs.

---
**End of PRD**
