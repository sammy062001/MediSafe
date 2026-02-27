// ─── Profile ────────────────────────────────────────────────────
export interface Profile {
    name?: string;
    age: number;
    gender: string;
    knownConditions: string[];
}

// ─── Test Result ────────────────────────────────────────────────
export interface TestResult {
    test_name: string | null;
    value: number | string | null;
    unit: string | null;
    reference_range: string | null;
    abnormal_flag: "high" | "low" | "normal" | null;
}

// ─── Medication ─────────────────────────────────────────────────
export interface Medication {
    medicine_name: string | null;
    dosage: string | null;
    frequency: string | null;
    duration: string | null;
    instructions: string | null;
}

// ─── Extracted Data (Medical Test Report) ───────────────────────
export interface MedicalTestReport {
    document_type: "medical_test_report";
    patient_name: string | null;
    patient_age: string | null;
    patient_gender: string | null;
    report_date: string | null;
    lab_name: string | null;
    doctor_name: string | null;
    test_results: TestResult[];
}

// ─── Extracted Data (Prescription) ──────────────────────────────
export interface Prescription {
    document_type: "prescription";
    patient_name: string | null;
    age: string | null;
    date: string | null;
    doctor_name: string | null;
    hospital_name: string | null;
    medications: Medication[];
}

// ─── Extracted Data (Unknown) ───────────────────────────────────
export interface UnknownDocument {
    document_type: "unknown";
}

// ─── Union type ─────────────────────────────────────────────────
export type ExtractedData = MedicalTestReport | Prescription | UnknownDocument;

// ─── Document ───────────────────────────────────────────────────
export interface MediDocument {
    id: string;
    fileName: string;
    fileType: "pdf" | "image";
    fileData: string; // base64 data URL of original file
    fileMimeType: string; // e.g. "image/png", "application/pdf"
    uploadedAt: string;
    documentDate: string;
    rawText: string;
    extracted: ExtractedData;
}

// ─── Chat ───────────────────────────────────────────────────────
export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}

export interface Conversation {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
}

// ─── Health Snapshot ────────────────────────────────────────────
export interface SourcedMedication extends Medication {
    sourceDoc: string;  // filename of the source document
    sourceDate: string; // date of the source document
}

export interface SourcedTestResult extends TestResult {
    sourceDoc: string;
    sourceDate: string;
}

export interface HealthSnapshot {
    activeConditions: string[];
    currentMedications: SourcedMedication[];
    latestLabs: SourcedTestResult[];
}

// ─── Tab ────────────────────────────────────────────────────────
export type TabId = "dashboard" | "timeline" | "ask-ai";
