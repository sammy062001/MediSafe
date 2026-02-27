"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getAllDocuments, getProfile, saveDocument, deleteDocument } from "@/lib/db";
import { buildHealthSnapshot } from "@/lib/health-snapshot";
import type { HealthSnapshot, Profile, MediDocument, MedicalTestReport, Prescription } from "@/lib/types";
import UploadFlow from "./UploadFlow";
import ConfirmationDialog from "./ConfirmationDialog";

interface DateGroup {
    date: string;
    label: string;
    reports: MediDocument[];
    prescriptions: MediDocument[];
}

export default function Dashboard() {
    const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [docs, setDocs] = useState<MediDocument[]>([]);
    const [showUpload, setShowUpload] = useState(false);
    const [showDocList, setShowDocList] = useState(false);
    const [editingDoc, setEditingDoc] = useState<MediDocument | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        (async () => {
            const [allDocs, snap, prof] = await Promise.all([
                getAllDocuments(),
                buildHealthSnapshot(),
                getProfile(),
            ]);
            setDocs(allDocs);
            setSnapshot(snap);
            setProfile(prof ?? null);
        })();
    }, [refreshKey]);

    const handleDocSaved = () => setRefreshKey((k) => k + 1);

    const handleEditConfirm = async (data: import("@/lib/types").ExtractedData, docDate: string) => {
        if (!editingDoc) return;
        const updated: MediDocument = { ...editingDoc, extracted: data, documentDate: docDate };
        await saveDocument(updated);
        setEditingDoc(null);
        setRefreshKey((k) => k + 1);
    };

    const handleDeleteDoc = async (id: string) => {
        if (confirm("Delete this document?")) {
            await deleteDocument(id);
            setRefreshKey((k) => k + 1);
        }
    };

    const getDocLabel = (doc: MediDocument): string => {
        if (doc.extracted.document_type === "medical_test_report") return "🔬 Lab Report";
        if (doc.extracted.document_type === "prescription") return "💊 Prescription";
        return "📄 Document";
    };

    // Group documents by date, separate reports and prescriptions
    const grouped = useMemo((): DateGroup[] => {
        const map = new Map<string, { reports: MediDocument[]; prescriptions: MediDocument[] }>();
        for (const doc of docs) {
            const key = doc.documentDate || "unknown";
            if (!map.has(key)) map.set(key, { reports: [], prescriptions: [] });
            const g = map.get(key)!;
            if (doc.extracted.document_type === "medical_test_report") g.reports.push(doc);
            else if (doc.extracted.document_type === "prescription") g.prescriptions.push(doc);
            else g.reports.push(doc);
        }
        const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
        return sortedKeys.map((key) => {
            const d = new Date(key);
            const label = isNaN(d.getTime()) ? "Unknown Date" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
            return { date: key, label, ...map.get(key)! };
        });
    }, [docs]);

    return (
        <>
            {showUpload && <UploadFlow onClose={() => setShowUpload(false)} onDocumentSaved={handleDocSaved} />}

            {/* Edit modal — reuse ConfirmationDialog */}
            {editingDoc && (
                <ConfirmationDialog
                    extracted={editingDoc.extracted}
                    fileName={editingDoc.fileName}
                    onConfirm={handleEditConfirm}
                    onCancel={() => setEditingDoc(null)}
                />
            )}

            {/* Document List Modal */}
            {showDocList && (
                <div className="modal-overlay" onClick={() => setShowDocList(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>📂 All Documents ({docs.length})</h2>
                        </div>
                        <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                            {docs.length === 0 ? (
                                <div style={{ textAlign: "center", padding: 20, color: "var(--gray-400)" }}>No documents yet.</div>
                            ) : (
                                docs.map((doc) => (
                                    <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--gray-100)" }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "var(--gray-100)" }}>
                                            {doc.fileType === "image" && doc.fileData ? (
                                                <img src={doc.fileData} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>📄</div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getDocLabel(doc)}</div>
                                            <div style={{ fontSize: "0.65rem", color: "var(--gray-400)" }}>
                                                {doc.fileName} · {new Date(doc.documentDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </div>
                                        </div>
                                        <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.62rem" }} onClick={() => { setShowDocList(false); setEditingDoc(doc); }}>✏️ Edit</button>
                                        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.72rem", color: "var(--gray-400)" }} onClick={() => handleDeleteDoc(doc.id)}>🗑</button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary btn-block" onClick={() => setShowDocList(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Card */}
            {profile && (
                <div className="card" style={{ marginBottom: 16, background: "linear-gradient(135deg, var(--blue-50) 0%, #E0F2F1 100%)", border: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: "50%",
                            background: "linear-gradient(135deg, var(--blue-400) 0%, var(--blue-600) 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "var(--white)", fontSize: "1.3rem", fontWeight: 700, flexShrink: 0,
                            boxShadow: "0 2px 8px rgba(25,118,210,0.3)",
                        }}>
                            {profile.name ? profile.name.charAt(0).toUpperCase() : "👤"}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--gray-800)" }}>
                                {profile.name ? "Hi, " + profile.name + "!" : "Welcome back!"}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", marginTop: 2 }}>
                                {profile.age} years · {profile.gender}
                            </div>
                            {profile.knownConditions.length > 0 && (
                                <div className="tag-list" style={{ marginTop: 6 }}>
                                    {profile.knownConditions.map((c) => (<span key={c} className="tag blue" style={{ fontSize: "0.62rem" }}>{c}</span>))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="section-title">Quick Actions</div>
            <button className="btn btn-primary btn-block btn-lg" style={{ marginBottom: 20 }} onClick={() => setShowUpload(true)}>📄 Upload Medical Document</button>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div className="card" style={{ textAlign: "center", cursor: "pointer", transition: "all var(--transition)" }} onClick={() => setShowDocList(true)}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--blue-400)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--gray-200)"; }}
                >
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--blue-500)" }}>{docs.length}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--gray-500)" }}>Documents ↗</div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--teal-500)" }}>{snapshot ? snapshot.currentMedications.length : 0}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--gray-500)" }}>Medications</div>
                </div>
            </div>

            {/* ─── Date-grouped Health Data ───────────────────────────── */}
            {grouped.length > 0 && grouped.map((group) => {
                const hasData = group.reports.length > 0 || group.prescriptions.length > 0;
                if (!hasData) return null;

                return (
                    <div key={group.date} style={{ marginBottom: 20 }}>
                        {/* Date header */}
                        <div style={{
                            fontSize: "0.82rem", fontWeight: 700, color: "var(--gray-700)",
                            padding: "8px 0 6px", borderBottom: "2px solid var(--blue-100)", marginBottom: 10,
                        }}>
                            📅 {group.label}
                        </div>

                        {/* Lab Reports for this date */}
                        {group.reports.map((doc) => {
                            if (doc.extracted.document_type !== "medical_test_report") return null;
                            const report = doc.extracted as MedicalTestReport;
                            return (
                                <div key={doc.id} className="card" style={{ marginBottom: 8 }}>
                                    {/* Header row */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--gray-800)" }}>
                                                🔬 {report.lab_name || "Lab Report"}
                                            </div>
                                            {report.doctor_name && <div style={{ fontSize: "0.65rem", color: "var(--gray-400)" }}>Dr. {report.doctor_name}</div>}
                                        </div>
                                        <div style={{ display: "flex", gap: 4 }}>
                                            <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.6rem", padding: "2px 8px" }} onClick={() => setEditingDoc(doc)}>✏️</button>
                                            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.65rem", color: "var(--gray-400)" }} onClick={() => handleDeleteDoc(doc.id)}>🗑</button>
                                        </div>
                                    </div>

                                    {/* Test results */}
                                    {report.test_results.length > 0 ? (
                                        report.test_results.map((t, i) => (
                                            <div key={i} className="lab-row">
                                                <div>
                                                    <div className="lab-name">{t.test_name || "Unknown Test"}</div>
                                                    <div className="lab-ref">{t.reference_range || "No ref"}</div>
                                                </div>
                                                <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 6 }}>
                                                    <div className={"lab-value " + (t.abnormal_flag || "")}>
                                                        {t.value ?? "—"} {t.unit || ""}
                                                    </div>
                                                    {t.abnormal_flag && t.abnormal_flag !== "normal" && (
                                                        <span style={{
                                                            background: t.abnormal_flag === "high" ? "var(--red-50)" : "var(--amber-50)",
                                                            color: t.abnormal_flag === "high" ? "var(--red-400)" : "var(--amber-600)",
                                                            fontSize: "0.55rem", fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                                                        }}>
                                                            {t.abnormal_flag.toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", padding: "4px 0" }}>No test results</div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Prescriptions for this date */}
                        {group.prescriptions.map((doc) => {
                            if (doc.extracted.document_type !== "prescription") return null;
                            const rx = doc.extracted as Prescription;
                            return (
                                <div key={doc.id} className="card" style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--gray-800)" }}>
                                                💊 {rx.hospital_name || "Prescription"}
                                            </div>
                                            {rx.doctor_name && <div style={{ fontSize: "0.65rem", color: "var(--gray-400)" }}>Dr. {rx.doctor_name}</div>}
                                        </div>
                                        <div style={{ display: "flex", gap: 4 }}>
                                            <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.6rem", padding: "2px 8px" }} onClick={() => setEditingDoc(doc)}>✏️</button>
                                            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.65rem", color: "var(--gray-400)" }} onClick={() => handleDeleteDoc(doc.id)}>🗑</button>
                                        </div>
                                    </div>

                                    {rx.medications.length > 0 ? (
                                        rx.medications.map((m, i) => (
                                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < rx.medications.length - 1 ? "1px solid var(--gray-100)" : "none" }}>
                                                <div>
                                                    <div style={{ fontSize: "0.8rem", fontWeight: 500 }}>{m.medicine_name || "Unknown"}</div>
                                                    <div style={{ fontSize: "0.65rem", color: "var(--gray-400)" }}>
                                                        {[m.frequency, m.duration].filter(Boolean).join(" · ") || ""}
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                                    {m.dosage && <span className="tag teal" style={{ fontSize: "0.6rem" }}>{m.dosage}</span>}
                                                    {m.instructions && <span className="tag gray" style={{ fontSize: "0.55rem" }}>{m.instructions}</span>}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", padding: "4px 0" }}>No medications</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })}

            {/* Empty state */}
            {docs.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">🏥</div>
                    <h3>Your Health Vault is Empty</h3>
                    <p>Upload your first medical document to start building your health profile.</p>
                </div>
            )}
        </>
    );
}
