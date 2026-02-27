"use client";

import React from "react";
import type { TabId } from "@/lib/types";

interface TabBarProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
        id: "dashboard",
        label: "Dashboard",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
        ),
    },
    {
        id: "timeline",
        label: "Timeline",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        ),
    },
    {
        id: "ask-ai",
        label: "Ask AI",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        ),
    },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
    return (
        <nav className="tab-bar">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => onTabChange(tab.id)}
                    aria-label={tab.label}
                >
                    {tab.icon}
                    <span>{tab.label}</span>
                </button>
            ))}
        </nav>
    );
}
