import { getAllDocuments } from "./db";
import type { HealthSnapshot, SourcedMedication, SourcedTestResult } from "./types";

/**
 * Aggregates medications and latest lab values from all stored documents.
 * Deduplicates by name. Preserves source document info for citations.
 */
export async function buildHealthSnapshot(): Promise<HealthSnapshot> {
    const docs = await getAllDocuments(); // newest first

    const medMap = new Map<string, SourcedMedication>();
    const labMap = new Map<string, SourcedTestResult>();
    const conditions: string[] = [];

    for (const doc of docs) {
        const { extracted } = doc;
        const sourceDoc = doc.fileName;
        const sourceDate = doc.documentDate || doc.uploadedAt;

        if (extracted.document_type === "prescription") {
            for (const m of extracted.medications) {
                if (m.medicine_name) {
                    const key = m.medicine_name.toLowerCase().trim();
                    if (!medMap.has(key)) {
                        medMap.set(key, { ...m, sourceDoc, sourceDate });
                    }
                }
            }
        }

        if (extracted.document_type === "medical_test_report") {
            for (const t of extracted.test_results) {
                if (t.test_name) {
                    const key = t.test_name.toLowerCase().trim();
                    if (!labMap.has(key)) {
                        labMap.set(key, { ...t, sourceDoc, sourceDate });
                    }
                    // Track abnormal results as conditions
                    if (t.abnormal_flag === "high" || t.abnormal_flag === "low") {
                        const label = t.test_name + " (" + t.abnormal_flag + ")";
                        if (!conditions.includes(label)) {
                            conditions.push(label);
                        }
                    }
                }
            }
        }
    }

    return {
        activeConditions: conditions,
        currentMedications: Array.from(medMap.values()),
        latestLabs: Array.from(labMap.values()),
    };
}
