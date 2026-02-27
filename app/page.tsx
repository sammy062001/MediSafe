"use client";

import React, { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import TabBar from "@/components/TabBar";
import { getProfile, saveProfile } from "@/lib/db";
import type { TabId, Profile } from "@/lib/types";

// ── Lazy-load heavy tab components (only loaded when activated) ──
const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  loading: () => <TabSkeleton />,
});
const Timeline = dynamic(() => import("@/components/Timeline"), {
  loading: () => <TabSkeleton />,
});
const AskAI = dynamic(() => import("@/components/AskAI"), {
  loading: () => <TabSkeleton />,
});
const ProfileModal = dynamic(() => import("@/components/ProfileModal"), {
  ssr: false,
});

function TabSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>
      <div className="skeleton skeleton-lg" />
      <div className="skeleton" />
      <div className="skeleton skeleton-sm" />
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [showProfile, setShowProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const profile = await getProfile();
      if (!profile) {
        setShowProfile(true);
      }
      setProfileLoaded(true);
    })();
  }, []);

  const handleProfileSave = async (profile: Profile) => {
    await saveProfile(profile);
    setShowProfile(false);
  };

  if (!profileLoaded) {
    return (
      <div className="app-shell">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
          <div className="spinner spinner-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {showProfile && (
        <Suspense fallback={null}>
          <ProfileModal onSave={handleProfileSave} />
        </Suspense>
      )}

      <header className="app-header">
        <h1>🛡️ MediSafe</h1>
        <p>Your Personal Health Vault</p>
      </header>

      <main className="page-content">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "timeline" && <Timeline refreshKey={refreshKey} />}
        {activeTab === "ask-ai" && <AskAI />}
      </main>

      <TabBar activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setRefreshKey((k) => k + 1); }} />
    </div>
  );
}
