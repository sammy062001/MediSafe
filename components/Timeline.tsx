"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getAllDocuments, deleteDocument, saveDocument } from "@/lib/db";
import type { MediDocument, ExtractedData } from "@/lib/types";
import ConfirmationDialog from "./ConfirmationDialog";

interface TimelineProps {
    refreshKey?: number;
}

export default function Timeline({ refreshKey }: TimelineProps) {
    const [docs, setDocs] = useState<MediDocument[]>([]);
    const [viewingDoc, setViewingDoc] = useState<MediDocument | null>(null);
    const [editingDoc, setEditingDoc] = useState<MediDocument | null>(null);

    useEffect(() => {
        (async () => {
            const allDocs = await getAllDocuments();
            setDocs(allDocs);
        })();
    }, [refreshKey]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Delete this document from your vault?")) {
            await deleteDocument(id);
            setDocs((prev) => prev.filter((d) => d.id !== id));
            if (viewingDoc?.id === id) setViewingDoc(null);
        }
    };

    const handleEditConfirm = async (data: ExtractedData, docDate: string) => {
        if (!editingDoc) return;
        const updated: MediDocument = { ...editingDoc, extracted: data, documentDate: docDate };
        await saveDocument(updated);
        setEditingDoc(null);
        setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    };

    const getDocLabel = (doc: MediDocument): string => {
        if (doc.extracted.document_type === "medical_test_report") return "Lab Report";
        if (doc.extracted.document_type === "prescription") return "Prescription";
        return "Document";
    };

    // Group by date
    const grouped = useMemo(() => {
        const groups: { date: string; label: string; docs: MediDocument[] }[] = [];
        const map = new Map<string, MediDocument[]>();
        for (const doc of docs) {
            const key = doc.documentDate || "unknown";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(doc);
        }
        const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
        for (const key of sortedKeys) {
            const d = new Date(key);
            const label = isNaN(d.getTime()) ? "Unknown Date" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
            groups.push({ date: key, label, docs: map.get(key)! });
        }
        return groups;
    }, [docs]);

    if (docs.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>No Documents Yet</h3>
                <p>Upload medical documents from the Dashboard to see them here.</p>
            </div>
        );
    }

    // ─── Edit modal ────────────────────────────────────────────────
    if (editingDoc) {
        return (
            <ConfirmationDialog
                extracted={editingDoc.extracted}
                fileName={editingDoc.fileName}
                onConfirm={handleEditConfirm}
                onCancel={() => setEditingDoc(null)}
            />
        );
    }

    // ─── Full-screen viewer ────────────────────────────────────────
    if (viewingDoc) {
        return (
            <div className="modal-overlay" onClick={() => setViewingDoc(null)} style={{ background: "rgba(0,0,0,0.92)" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "linear-gradient(rgba(0,0,0,0.7), transparent)" }}>
                    <div style={{ color: "white" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                            {viewingDoc.extracted.document_type === "medical_test_report" ? "🔬 " : "💊 "}
                            {getDocLabel(viewingDoc)}
                        </div>
                        <div style={{ fontSize: "0.68rem", opacity: 0.7, marginTop: 1 }}>
                            {viewingDoc.fileName} · {new Date(viewingDoc.documentDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setViewingDoc(null); setEditingDoc(viewingDoc); }}
                            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "6px 12px", fontSize: "0.72rem", cursor: "pointer", fontWeight: 500 }}
                        >✏️ Edit</button>
                        {viewingDoc.fileData && (
                            <a href={viewingDoc.fileData} download={viewingDoc.fileName} onClick={(e) => e.stopPropagation()}
                                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "6px 12px", fontSize: "0.72rem", textDecoration: "none", fontWeight: 500 }}>⬇ Download</a>
                        )}
                        <button onClick={() => setViewingDoc(null)}
                            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "6px 12px", fontSize: "0.72rem", cursor: "pointer", fontWeight: 500 }}>✕</button>
                    </div>
                </div>

                <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "92vw", maxHeight: "85vh", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 40 }}>
                    {viewingDoc.fileType === "image" && viewingDoc.fileData ? (
                        <img src={viewingDoc.fileData} alt={viewingDoc.fileName} style={{ maxWidth: "100%", maxHeight: "82vh", borderRadius: 8, objectFit: "contain" }} />
                    ) : viewingDoc.fileType === "pdf" && viewingDoc.fileData ? (
                        <iframe src={viewingDoc.fileData} title={viewingDoc.fileName} style={{ width: "92vw", height: "82vh", border: "none", borderRadius: 8, background: "white" }} />
                    ) : (
                        <div style={{ color: "white", textAlign: "center", padding: 40 }}>
                            <div style={{ fontSize: "3rem", marginBottom: 12 }}>📄</div>
                            <p>Original file not available</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── Date-grouped gallery ─────────────────────────────────────
    return (
        <div>
            {grouped.map((group) => (
                <div key={group.date} style={{ marginBottom: 20 }}>
                    <div style={{
                        fontSize: "0.82rem", fontWeight: 700, color: "var(--gray-700)",
                        padding: "8px 0 6px", borderBottom: "1px solid var(--gray-100)", marginBottom: 8,
                        display: "flex", alignItems: "center", gap: 8,
                    }}>
                        <span>{group.label}</span>
                        <span style={{ fontSize: "0.65rem", fontWeight: 400, color: "var(--gray-400)" }}>
                            {group.docs.length} {group.docs.length === 1 ? "file" : "files"}
                        </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 4 }}>
                        {group.docs.map((doc) => (
                            <div key={doc.id} onClick={() => setViewingDoc(doc)} style={{
                                position: "relative", aspectRatio: "1", borderRadius: 6,
                                overflow: "hidden", cursor: "pointer", background: "var(--gray-100)",
                            }}>
                                {doc.fileType === "image" && doc.fileData ? (
                                    <img src={doc.fileData} alt={doc.fileName} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                ) : (
                                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, var(--blue-50) 0%, var(--gray-100) 100%)" }}>
                                        <div style={{ fontSize: "1.8rem" }}>📄</div>
                                        <div style={{ fontSize: "0.55rem", color: "var(--gray-500)", fontWeight: 500, marginTop: 2 }}>PDF</div>
                                    </div>
                                )}
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "16px 6px 5px", color: "white" }}>
                                    <div style={{ fontSize: "0.55rem", fontWeight: 600 }}>
                                        {doc.extracted.document_type === "medical_test_report" ? "🔬" : "💊"}
                                    </div>
                                </div>
                                {doc.extracted.document_type === "medical_test_report" &&
                                    doc.extracted.test_results.some((t) => t.abnormal_flag === "high" || t.abnormal_flag === "low") && (
                                        <div style={{ position: "absolute", top: 4, right: 4, background: "var(--red-400)", color: "white", fontSize: "0.48rem", fontWeight: 700, padding: "1px 4px", borderRadius: 3 }}>⚠</div>
                                    )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
