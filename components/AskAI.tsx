"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import { track } from "@vercel/analytics";
import { v4 as uuidv4 } from "uuid";
import { getProfile } from "@/lib/db";
import { buildHealthSnapshot } from "@/lib/health-snapshot";
import {
    getAllConversations,
    saveConversation,
    deleteConversation,
} from "@/lib/db";
import type { ChatMessage, Conversation } from "@/lib/types";

// Lightweight markdown → HTML for chat bubbles
function renderMarkdown(text: string): string {
    return text
        // Bold: **text**
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic: *text*
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Bullet points: lines starting with - or •
        .replace(/^[\-•]\s+(.+)$/gm, '<li>$1</li>')
        // Numbered lists: lines starting with 1. 2. etc
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Wrap consecutive <li> in <ul>
        .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
        // Line breaks
        .replace(/\n/g, '<br/>');
}

export default function AskAI() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConv, setActiveConv] = useState<Conversation | null>(null);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingConvs, setLoadingConvs] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load conversations from IndexedDB on mount
    useEffect(() => {
        (async () => {
            const convs = await getAllConversations();
            setConversations(convs);
            setLoadingConvs(false);
        })();
    }, []);

    // Auto-scroll when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeConv?.messages]);

    // Focus input when entering a chat
    useEffect(() => {
        if (activeConv) {
            inputRef.current?.focus();
        }
    }, [activeConv?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleNewChat = useCallback(() => {
        const now = new Date().toISOString();
        const conv: Conversation = {
            id: uuidv4(),
            title: "New Chat",
            messages: [],
            createdAt: now,
            updatedAt: now,
        };
        setActiveConv(conv);
        setInput("");
    }, []);

    const handleOpenConv = useCallback((conv: Conversation) => {
        setActiveConv(conv);
        setInput("");
    }, []);

    const handleBack = useCallback(() => {
        setActiveConv(null);
    }, []);

    const handleDeleteConv = useCallback(
        async (e: React.MouseEvent, convId: string) => {
            e.stopPropagation();
            await deleteConversation(convId);
            setConversations((prev) => prev.filter((c) => c.id !== convId));
            if (activeConv?.id === convId) {
                setActiveConv(null);
            }
        },
        [activeConv?.id]
    );

    const sendMessage = async () => {
        const question = input.trim();
        if (!question || loading || !activeConv) return;

        const userMsg: ChatMessage = {
            id: uuidv4(),
            role: "user",
            content: question,
            timestamp: new Date().toISOString(),
        };

        // Auto-title from first user message
        const isFirstMessage = activeConv.messages.length === 0;
        const title = isFirstMessage
            ? question.length > 40
                ? question.substring(0, 40) + "…"
                : question
            : activeConv.title;

        const updatedConv: Conversation = {
            ...activeConv,
            title,
            messages: [...activeConv.messages, userMsg],
            updatedAt: new Date().toISOString(),
        };

        setActiveConv(updatedConv);
        setInput("");
        setLoading(true);

        // Save immediately (with user message)
        await saveConversation(updatedConv);
        setConversations((prev) => {
            const filtered = prev.filter((c) => c.id !== updatedConv.id);
            return [updatedConv, ...filtered];
        });

        try {
            const [profile, snapshot] = await Promise.all([
                getProfile(),
                buildHealthSnapshot(),
            ]);

            // Build history (exclude the current question — it goes as `question`)
            const history = updatedConv.messages
                .slice(0, -1) // everything before this message
                .map((m) => ({ role: m.role, content: m.content }));

            const res = await axios.post("/api/chat", {
                question,
                profile: profile ?? null,
                snapshot,
                history,
            });

            const assistantMsg: ChatMessage = {
                id: uuidv4(),
                role: "assistant",
                content: res.data.reply,
                timestamp: new Date().toISOString(),
            };

            const finalConv: Conversation = {
                ...updatedConv,
                messages: [...updatedConv.messages, assistantMsg],
                updatedAt: new Date().toISOString(),
            };

            setActiveConv(finalConv);
            track("chat_message_sent");
            await saveConversation(finalConv);
            setConversations((prev) => {
                const filtered = prev.filter((c) => c.id !== finalConv.id);
                return [finalConv, ...filtered];
            });
        } catch {
            const errorMsg: ChatMessage = {
                id: uuidv4(),
                role: "assistant",
                content:
                    "Sorry, I couldn't process your request right now. Please try again.",
                timestamp: new Date().toISOString(),
            };
            const errorConv: Conversation = {
                ...updatedConv,
                messages: [...updatedConv.messages, errorMsg],
                updatedAt: new Date().toISOString(),
            };
            setActiveConv(errorConv);
            await saveConversation(errorConv);
            setConversations((prev) => {
                const filtered = prev.filter((c) => c.id !== errorConv.id);
                return [errorConv, ...filtered];
            });
        } finally {
            setLoading(false);
        }
    };

    // ─── Conversation List View ─────────────────────────────────
    if (!activeConv) {
        return (
            <div className="conv-list-container">
                <div className="conv-list-header">
                    <div>
                        <h2 className="conv-list-title">💬 Conversations</h2>
                        <p className="conv-list-subtitle">
                            Your AI chat history
                        </p>
                    </div>
                    <button className="new-chat-btn" onClick={handleNewChat}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        New Chat
                    </button>
                </div>

                {loadingConvs ? (
                    <div className="empty-state" style={{ paddingTop: 60 }}>
                        <div className="spinner spinner-lg" />
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="empty-state" style={{ paddingTop: 60 }}>
                        <div className="empty-state-icon">🤖</div>
                        <h3>No Conversations Yet</h3>
                        <p>
                            Start a new chat to ask about your health data,
                            medications, or lab results.
                        </p>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={handleNewChat}
                            style={{ marginTop: 20 }}
                        >
                            Start Your First Chat
                        </button>
                    </div>
                ) : (
                    <div className="conv-list">
                        {conversations.map((conv) => {
                            const lastMsg =
                                conv.messages[conv.messages.length - 1];
                            const preview = lastMsg
                                ? lastMsg.content.length > 60
                                    ? lastMsg.content.substring(0, 60) + "…"
                                    : lastMsg.content
                                : "No messages yet";
                            const timeStr = formatRelativeTime(conv.updatedAt);

                            return (
                                <div
                                    key={conv.id}
                                    className="conv-card"
                                    onClick={() => handleOpenConv(conv)}
                                >
                                    <div className="conv-card-icon">💬</div>
                                    <div className="conv-card-body">
                                        <div className="conv-card-title">
                                            {conv.title}
                                        </div>
                                        <div className="conv-card-preview">
                                            {preview}
                                        </div>
                                    </div>
                                    <div className="conv-card-meta">
                                        <span className="conv-card-time">
                                            {timeStr}
                                        </span>
                                        <button
                                            className="conv-delete-btn"
                                            onClick={(e) =>
                                                handleDeleteConv(e, conv.id)
                                            }
                                            aria-label="Delete conversation"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                                <line x1="10" y1="11" x2="10" y2="17" />
                                                <line x1="14" y1="11" x2="14" y2="17" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ─── Active Chat View ───────────────────────────────────────
    return (
        <div className="chat-container">
            <div className="chat-header">
                <button className="chat-back-btn" onClick={handleBack} aria-label="Back to conversations">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <div className="chat-header-info">
                    <span className="chat-header-title">{activeConv.title}</span>
                    <span className="chat-header-status">
                        {activeConv.messages.length === 0
                            ? "New conversation"
                            : `${activeConv.messages.length} messages`}
                    </span>
                </div>
            </div>

            <div className="disclaimer">
                ⚠️ <strong>Medical Disclaimer:</strong> MediSafe AI provides
                general health information only. It is not a substitute for
                professional medical advice, diagnosis, or treatment. Always
                consult your healthcare provider.
            </div>

            <div className="chat-messages">
                {activeConv.messages.length === 0 && (
                    <div className="empty-state" style={{ paddingTop: 40 }}>
                        <div className="empty-state-icon">💬</div>
                        <h3>Ask a Health Question</h3>
                        <p>
                            I can help you understand your medical documents, lab
                            results, and health data.
                        </p>
                    </div>
                )}

                {activeConv.messages.map((msg) => (
                    <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                        {msg.role === "assistant" ? (
                            <div className="chat-bubble-content md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                        ) : (
                            <div className="chat-bubble-content">{msg.content}</div>
                        )}
                        <div className="chat-bubble-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div
                        className="chat-bubble assistant"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <div className="spinner" />
                        <span
                            style={{
                                color: "var(--gray-400)",
                                fontSize: "0.8rem",
                            }}
                        >
                            Thinking...
                        </span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-row">
                <input
                    ref={inputRef}
                    className="form-input"
                    placeholder="Ask about your health data..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                    disabled={loading}
                />
                <button
                    className="btn btn-primary"
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    style={{ minWidth: 44 }}
                >
                    ↑
                </button>
            </div>
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────
function formatRelativeTime(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoDate).toLocaleDateString();
}
