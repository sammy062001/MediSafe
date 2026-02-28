"use client";

import React, { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { track } from "@vercel/analytics";
import { v4 as uuidv4 } from "uuid";
import { saveDocument } from "@/lib/db";
import type { MediDocument, ExtractedData } from "@/lib/types";
import ConfirmationDialog from "./ConfirmationDialog";

interface UploadFlowProps {
    onClose: () => void;
    onDocumentSaved: () => void;
}

type UploadStage = "dropzone" | "processing" | "confirming";

interface ProcessedFile {
    file: File;
    fileName: string;
    fileType: "pdf" | "image";
    fileDataUrl: string;
    fileMime: string;
    rawText: string;
    extracted: ExtractedData;
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function UploadFlow({ onClose, onDocumentSaved }: UploadFlowProps) {
    const [stage, setStage] = useState<UploadStage>("dropzone");
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [error, setError] = useState("");

    // Queue of files to process
    const [fileQueue, setFileQueue] = useState<File[]>([]);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [totalFiles, setTotalFiles] = useState(0);
    const [currentProcessed, setCurrentProcessed] = useState<ProcessedFile | null>(null);
    const [savedCount, setSavedCount] = useState(0);
    const processingRef = useRef(false);

    const processFile = useCallback(async (file: File): Promise<ProcessedFile | null> => {
        const isPdf = file.type === "application/pdf";
        const base64 = await fileToBase64(file);
        let text = "";

        try {
            if (isPdf) {
                setStatusText(`Extracting text from ${file.name}...`);
                setProgress(20);
                const pdfjsLib = await import("pdfjs-dist");
                pdfjsLib.GlobalWorkerOptions.workerSrc =
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" +
                    pdfjsLib.version +
                    "/pdf.worker.min.mjs";

                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const pages: string[] = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    const strings = content.items
                        .filter((item) => "str" in item)
                        .map((item) => (item as { str: string }).str);
                    pages.push(strings.join(" "));
                    setProgress(20 + Math.round((i / pdf.numPages) * 30));
                }
                text = pages.join("\n\n");
            } else {
                setStatusText(`Running OCR on ${file.name}...`);
                setProgress(20);
                const Tesseract = await import("tesseract.js");
                const result = await Tesseract.recognize(file, "eng", {
                    logger: (info) => {
                        if (info.status === "recognizing text" && typeof info.progress === "number") {
                            setProgress(20 + Math.round(info.progress * 30));
                        }
                    },
                });
                text = result.data.text;
            }

            if (!text.trim()) {
                return null;
            }

            setStatusText(`Analyzing ${file.name} with AI...`);
            setProgress(60);

            const res = await axios.post("/api/extract", { text: text.substring(0, 8000) });
            setProgress(100);

            return {
                file,
                fileName: file.name,
                fileType: isPdf ? "pdf" : "image",
                fileDataUrl: base64,
                fileMime: file.type,
                rawText: text,
                extracted: res.data.extracted,
            };
        } catch (err) {
            console.error("Processing error:", err);
            throw err;
        }
    }, []);

    const processNextFile = useCallback(async (files: File[], index: number) => {
        if (index >= files.length) {
            return;
        }

        processingRef.current = true;
        setStage("processing");
        setError("");
        setCurrentFileIndex(index);

        try {
            const result = await processFile(files[index]);
            if (result) {
                setCurrentProcessed(result);
                setStage("confirming");
            } else {
                setError(`No text could be extracted from ${files[index].name}. Skipping...`);
                if (index + 1 < files.length) {
                    setTimeout(() => processNextFile(files, index + 1), 1500);
                } else {
                    setStage("dropzone");
                    if (savedCount > 0) onDocumentSaved();
                }
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : `Failed to process ${files[index].name}.`
            );
            if (index + 1 < files.length) {
                setTimeout(() => processNextFile(files, index + 1), 1500);
            } else {
                setStage("dropzone");
                if (savedCount > 0) onDocumentSaved();
            }
        } finally {
            processingRef.current = false;
        }
    }, [processFile, savedCount, onDocumentSaved]);

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (acceptedFiles.length > 0) {
                setFileQueue(acceptedFiles);
                setTotalFiles(acceptedFiles.length);
                setCurrentFileIndex(0);
                setSavedCount(0);
                processNextFile(acceptedFiles, 0);
            }
        },
        [processNextFile]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/pdf": [".pdf"],
            "image/*": [".png", ".jpg", ".jpeg", ".webp", ".bmp"],
        },
        multiple: true,
    });

    const cameraInputRef = useRef<HTMLInputElement>(null);

    const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const fileArray = Array.from(files);
            setFileQueue(fileArray);
            setTotalFiles(fileArray.length);
            setCurrentFileIndex(0);
            setSavedCount(0);
            processNextFile(fileArray, 0);
        }
        if (cameraInputRef.current) cameraInputRef.current.value = "";
    };

    const handleConfirm = async (editedData: ExtractedData, docDate: string) => {
        if (!currentProcessed) return;

        const doc: MediDocument = {
            id: uuidv4(),
            fileName: currentProcessed.fileName,
            fileType: currentProcessed.fileType,
            fileData: currentProcessed.fileDataUrl,
            fileMimeType: currentProcessed.fileMime,
            uploadedAt: new Date().toISOString(),
            documentDate: docDate,
            rawText: currentProcessed.rawText,
            extracted: editedData,
        };
        await saveDocument(doc);
        track("document_uploaded", { type: editedData.document_type });
        const newSaved = savedCount + 1;
        setSavedCount(newSaved);
        onDocumentSaved();

        const nextIndex = currentFileIndex + 1;
        if (nextIndex < fileQueue.length) {
            setCurrentProcessed(null);
            processNextFile(fileQueue, nextIndex);
        } else {
            onClose();
        }
    };

    const handleSkip = () => {
        const nextIndex = currentFileIndex + 1;
        if (nextIndex < fileQueue.length) {
            setCurrentProcessed(null);
            processNextFile(fileQueue, nextIndex);
        } else {
            if (savedCount > 0) onDocumentSaved();
            onClose();
        }
    };

    if (stage === "confirming" && currentProcessed) {
        return (
            <div style={{ position: "relative" }}>
                {totalFiles > 1 && (
                    <div className="batch-progress-bar">
                        <span>📄 File {currentFileIndex + 1} of {totalFiles}</span>
                        {savedCount > 0 && <span style={{ color: "var(--success)" }}>✓ {savedCount} saved</span>}
                        {currentFileIndex + 1 < totalFiles && (
                            <button className="btn btn-secondary btn-sm" onClick={handleSkip} style={{ marginLeft: "auto", padding: "4px 12px", fontSize: "0.75rem" }}>
                                Skip →
                            </button>
                        )}
                    </div>
                )}
                <ConfirmationDialog
                    extracted={currentProcessed.extracted}
                    fileName={currentProcessed.fileName}
                    onConfirm={handleConfirm}
                    onCancel={handleSkip}
                />
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content">
                <div className="modal-header">
                    <h2>📄 Upload Documents</h2>
                    <p>Upload medical reports, lab results, or prescriptions.</p>
                </div>

                <div className="modal-body">
                    {error && (
                        <div className="disclaimer" style={{ marginBottom: 16, borderColor: "#EF9A9A", background: "#FFEBEE", color: "#C62828" }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {stage === "dropzone" && (
                        <div {...getRootProps()} className={"dropzone " + (isDragActive ? "active" : "")}>
                            <input {...getInputProps()} />
                            <div className="dropzone-icon">📁</div>
                            <div className="dropzone-text">
                                {isDragActive ? "Drop your files here..." : "Drag & drop files, or click to browse"}
                            </div>
                            <div className="dropzone-hint">Select multiple files • Supports PDF, PNG, JPG, JPEG, WebP</div>
                        </div>
                    )}

                    {stage === "dropzone" && (
                        <div className="camera-section">
                            <div className="camera-divider"><span>or</span></div>
                            <button
                                className="btn btn-secondary btn-block camera-btn"
                                onClick={() => cameraInputRef.current?.click()}
                            >
                                📷 Take Photo
                            </button>
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleCameraCapture}
                                style={{ display: "none" }}
                            />
                        </div>
                    )}

                    {stage === "processing" && (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                            <div className="spinner spinner-lg" style={{ margin: "0 auto 16px" }} />
                            {totalFiles > 1 && (
                                <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 600, marginBottom: 8 }}>
                                    Processing file {currentFileIndex + 1} of {totalFiles}
                                </div>
                            )}
                            <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--gray-700)", marginBottom: 8 }}>
                                {statusText}
                            </div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: progress + "%" }} />
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", marginTop: 6 }}>
                                {progress}% complete
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary btn-block" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
