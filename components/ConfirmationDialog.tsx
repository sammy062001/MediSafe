"use client";

import React, { useState } from "react";
import type { ExtractedData, MedicalTestReport, Prescription, TestResult, Medication } from "@/lib/types";

interface ConfirmationDialogProps {
    extracted: ExtractedData;
    fileName: string;
    onConfirm: (data: ExtractedData, docDate: string) => void;
    onCancel: () => void;
}

export default function ConfirmationDialog({ extracted, fileName, onConfirm, onCancel }: ConfirmationDialogProps) {
    const [data, setData] = useState<ExtractedData>(JSON.parse(JSON.stringify(extracted)));

    const inferredDate = (): string => {
        if (data.document_type === "medical_test_report" && data.report_date) return data.report_date;
        if (data.document_type === "prescription" && data.date) return data.date;
        return "";
    };

    const [docDate, setDocDate] = useState(inferredDate());
    const [dateError, setDateError] = useState(false);

    const handleSave = () => {
        if (!docDate) {
            setDateError(true);
            return;
        }
        // Sync date back to extracted data
        if (data.document_type === "medical_test_report") {
            (data as MedicalTestReport).report_date = docDate;
        } else if (data.document_type === "prescription") {
            (data as Prescription).date = docDate;
        }
        onConfirm(data, docDate);
    };

    // ─── UNKNOWN ──────────────────────────────────────────────────
    if (data.document_type === "unknown") {
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-header">
                        <h2>⚠️ Unknown Document</h2>
                        <p>From: {fileName}</p>
                    </div>
                    <div className="modal-body">
                        <div className="disclaimer">
                            The AI could not classify this document. Please ensure the image/PDF is clear and try again.
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary btn-block" onClick={onCancel}>Close</button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── MEDICAL TEST REPORT ──────────────────────────────────────
    if (data.document_type === "medical_test_report") {
        const report = data as MedicalTestReport;

        const updateField = (field: keyof MedicalTestReport, value: string) => {
            setData({ ...report, [field]: value || null } as MedicalTestReport);
        };

        const updateTest = (index: number, field: keyof TestResult, value: string | number | null) => {
            const updated = [...report.test_results];
            updated[index] = { ...updated[index], [field]: value === "" ? null : value };
            setData({ ...report, test_results: updated });
        };

        const removeTest = (index: number) => {
            const updated = report.test_results.filter((_, i) => i !== index);
            setData({ ...report, test_results: updated });
        };

        const addTest = () => {
            setData({
                ...report,
                test_results: [...report.test_results, { test_name: null, value: null, unit: null, reference_range: null, abnormal_flag: null }],
            });
        };

        return (
            <div className="modal-overlay">
                <div className="modal-content" style={{ maxHeight: "90vh" }}>
                    <div className="modal-header">
                        <h2>🔬 Lab Report — Review & Edit</h2>
                        <p style={{ fontSize: "0.72rem" }}>From: {fileName}</p>
                    </div>
                    <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                        {/* Date — required */}
                        <div className="form-group">
                            <label className="form-label">
                                Report Date <span style={{ color: "var(--red-400)" }}>*</span>
                            </label>
                            <input
                                className="form-input"
                                type="date"
                                value={docDate}
                                onChange={(e) => { setDocDate(e.target.value); setDateError(false); }}
                                style={dateError ? { borderColor: "var(--red-400)", boxShadow: "0 0 0 2px rgba(239,83,80,0.2)" } : {}}
                            />
                            {dateError && <div style={{ color: "var(--red-400)", fontSize: "0.7rem", marginTop: 4 }}>⚠ Date is required before saving</div>}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Patient Name</label>
                                <input className="form-input" value={report.patient_name || ""} onChange={(e) => updateField("patient_name", e.target.value)} placeholder="—" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Age</label>
                                <input className="form-input" value={report.patient_age || ""} onChange={(e) => updateField("patient_age", e.target.value)} placeholder="—" />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Gender</label>
                                <input className="form-input" value={report.patient_gender || ""} onChange={(e) => updateField("patient_gender", e.target.value)} placeholder="—" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Lab Name</label>
                                <input className="form-input" value={report.lab_name || ""} onChange={(e) => updateField("lab_name", e.target.value)} placeholder="—" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Doctor Name</label>
                            <input className="form-input" value={report.doctor_name || ""} onChange={(e) => updateField("doctor_name", e.target.value)} placeholder="—" />
                        </div>

                        {/* Test Results */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                            <div className="section-title" style={{ margin: 0 }}>Test Results ({report.test_results.length})</div>
                            <button className="btn btn-secondary btn-sm" onClick={addTest} style={{ fontSize: "0.68rem" }}>+ Add Test</button>
                        </div>

                        {report.test_results.map((t, i) => (
                            <div key={i} className="card" style={{ padding: 10, marginTop: 8, position: "relative" }}>
                                <button
                                    onClick={() => removeTest(i)}
                                    style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)", fontSize: "0.7rem" }}
                                >✕</button>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <div className="form-group" style={{ marginBottom: 4 }}>
                                        <label className="form-label" style={{ fontSize: "0.62rem" }}>Test Name</label>
                                        <input className="form-input" style={{ fontSize: "0.78rem" }} value={t.test_name || ""} onChange={(e) => updateTest(i, "test_name", e.target.value)} placeholder="e.g. Hemoglobin" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 4 }}>
                                        <label className="form-label" style={{ fontSize: "0.62rem" }}>Value</label>
                                        <input className="form-input" style={{ fontSize: "0.78rem" }} value={t.value ?? ""} onChange={(e) => updateTest(i, "value", e.target.value)} placeholder="e.g. 12.5" />
                                    </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: "0.62rem" }}>Unit</label>
                                        <input className="form-input" style={{ fontSize: "0.78rem" }} value={t.unit || ""} onChange={(e) => updateTest(i, "unit", e.target.value)} placeholder="g/dL" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: "0.62rem" }}>Ref Range</label>
                                        <input className="form-input" style={{ fontSize: "0.78rem" }} value={t.reference_range || ""} onChange={(e) => updateTest(i, "reference_range", e.target.value)} placeholder="12–16" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: "0.62rem" }}>Flag</label>
                                        <select className="form-input" style={{ fontSize: "0.78rem" }} value={t.abnormal_flag || ""} onChange={(e) => updateTest(i, "abnormal_flag", e.target.value || null)}>
                                            <option value="">—</option>
                                            <option value="normal">normal</option>
                                            <option value="high">high</option>
                                            <option value="low">low</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="modal-footer">
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
                        <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave}>Save to Vault</button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── PRESCRIPTION ─────────────────────────────────────────────
    const rx = data as Prescription;

    const updateRxField = (field: keyof Prescription, value: string) => {
        setData({ ...rx, [field]: value || null } as Prescription);
    };

    const updateMed = (index: number, field: keyof Medication, value: string | null) => {
        const updated = [...rx.medications];
        updated[index] = { ...updated[index], [field]: value === "" ? null : value };
        setData({ ...rx, medications: updated });
    };

    const removeMed = (index: number) => {
        setData({ ...rx, medications: rx.medications.filter((_, i) => i !== index) });
    };

    const addMed = () => {
        setData({
            ...rx,
            medications: [...rx.medications, { medicine_name: null, dosage: null, frequency: null, duration: null, instructions: null }],
        });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxHeight: "90vh" }}>
                <div className="modal-header">
                    <h2>💊 Prescription — Review & Edit</h2>
                    <p style={{ fontSize: "0.72rem" }}>From: {fileName}</p>
                </div>
                <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                    {/* Date — required */}
                    <div className="form-group">
                        <label className="form-label">
                            Prescription Date <span style={{ color: "var(--red-400)" }}>*</span>
                        </label>
                        <input
                            className="form-input"
                            type="date"
                            value={docDate}
                            onChange={(e) => { setDocDate(e.target.value); setDateError(false); }}
                            style={dateError ? { borderColor: "var(--red-400)", boxShadow: "0 0 0 2px rgba(239,83,80,0.2)" } : {}}
                        />
                        {dateError && <div style={{ color: "var(--red-400)", fontSize: "0.7rem", marginTop: 4 }}>⚠ Date is required before saving</div>}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Patient Name</label>
                            <input className="form-input" value={rx.patient_name || ""} onChange={(e) => updateRxField("patient_name", e.target.value)} placeholder="—" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Age</label>
                            <input className="form-input" value={rx.age || ""} onChange={(e) => updateRxField("age", e.target.value)} placeholder="—" />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Doctor Name</label>
                            <input className="form-input" value={rx.doctor_name || ""} onChange={(e) => updateRxField("doctor_name", e.target.value)} placeholder="—" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Hospital </label>
                            <input className="form-input" value={rx.hospital_name || ""} onChange={(e) => updateRxField("hospital_name", e.target.value)} placeholder="—" />
                        </div>
                    </div>

                    {/* Medications */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <div className="section-title" style={{ margin: 0 }}>Medications ({rx.medications.length})</div>
                        <button className="btn btn-secondary btn-sm" onClick={addMed} style={{ fontSize: "0.68rem" }}>+ Add Med</button>
                    </div>

                    {rx.medications.map((m, i) => (
                        <div key={i} className="card" style={{ padding: 10, marginTop: 8, position: "relative" }}>
                            <button
                                onClick={() => removeMed(i)}
                                style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)", fontSize: "0.7rem" }}
                            >✕</button>
                            <div className="form-group" style={{ marginBottom: 6 }}>
                                <label className="form-label" style={{ fontSize: "0.62rem" }}>Medicine Name</label>
                                <input className="form-input" style={{ fontSize: "0.78rem" }} value={m.medicine_name || ""} onChange={(e) => updateMed(i, "medicine_name", e.target.value)} placeholder="e.g. Paracetamol" />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <div className="form-group" style={{ marginBottom: 4 }}>
                                    <label className="form-label" style={{ fontSize: "0.62rem" }}>Dosage</label>
                                    <input className="form-input" style={{ fontSize: "0.78rem" }} value={m.dosage || ""} onChange={(e) => updateMed(i, "dosage", e.target.value)} placeholder="500mg" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 4 }}>
                                    <label className="form-label" style={{ fontSize: "0.62rem" }}>Frequency</label>
                                    <input className="form-input" style={{ fontSize: "0.78rem" }} value={m.frequency || ""} onChange={(e) => updateMed(i, "frequency", e.target.value)} placeholder="Twice daily" />
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: "0.62rem" }}>Duration</label>
                                    <input className="form-input" style={{ fontSize: "0.78rem" }} value={m.duration || ""} onChange={(e) => updateMed(i, "duration", e.target.value)} placeholder="5 days" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: "0.62rem" }}>Instructions</label>
                                    <input className="form-input" style={{ fontSize: "0.78rem" }} value={m.instructions || ""} onChange={(e) => updateMed(i, "instructions", e.target.value)} placeholder="After food" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave}>Save to Vault</button>
                </div>
            </div>
        </div>
    );
}
