import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Profile, MediDocument, Conversation } from "./types";

// ─── Schema ─────────────────────────────────────────────────────
interface MediReadDB extends DBSchema {
    profile: {
        key: "singleton";
        value: Profile;
    };
    documents: {
        key: string; // document id
        value: MediDocument;
        indexes: { "by-date": string };
    };
    conversations: {
        key: string; // conversation id
        value: Conversation;
        indexes: { "by-updated": string };
    };
}

// ─── Database Instance ──────────────────────────────────────────
let dbPromise: Promise<IDBPDatabase<MediReadDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MediReadDB>> {
    if (!dbPromise) {
        dbPromise = openDB<MediReadDB>("mediread-vault", 2, {
            upgrade(db, oldVersion) {
                if (oldVersion < 1) {
                    if (!db.objectStoreNames.contains("profile")) {
                        db.createObjectStore("profile");
                    }
                    if (!db.objectStoreNames.contains("documents")) {
                        const docStore = db.createObjectStore("documents", { keyPath: "id" });
                        docStore.createIndex("by-date", "documentDate");
                    }
                }
                if (oldVersion < 2) {
                    if (!db.objectStoreNames.contains("conversations")) {
                        const convStore = db.createObjectStore("conversations", { keyPath: "id" });
                        convStore.createIndex("by-updated", "updatedAt");
                    }
                }
            },
        });
    }
    return dbPromise;
}

// ─── Profile ────────────────────────────────────────────────────
export async function getProfile(): Promise<Profile | undefined> {
    const db = await getDB();
    return db.get("profile", "singleton");
}

export async function saveProfile(profile: Profile): Promise<void> {
    const db = await getDB();
    await db.put("profile", profile, "singleton");
}

// ─── Documents ──────────────────────────────────────────────────
export async function saveDocument(doc: MediDocument): Promise<void> {
    const db = await getDB();
    await db.put("documents", doc);
}

export async function getAllDocuments(): Promise<MediDocument[]> {
    const db = await getDB();
    const docs = await db.getAllFromIndex("documents", "by-date");
    return docs.reverse(); // newest first
}

export async function getDocument(
    id: string
): Promise<MediDocument | undefined> {
    const db = await getDB();
    return db.get("documents", id);
}

export async function deleteDocument(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("documents", id);
}

// ─── Conversations ──────────────────────────────────────────────
export async function saveConversation(conv: Conversation): Promise<void> {
    const db = await getDB();
    await db.put("conversations", conv);
}

export async function getAllConversations(): Promise<Conversation[]> {
    const db = await getDB();
    const convs = await db.getAllFromIndex("conversations", "by-updated");
    return convs.reverse(); // newest first
}

export async function getConversation(
    id: string
): Promise<Conversation | undefined> {
    const db = await getDB();
    return db.get("conversations", id);
}

export async function deleteConversation(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("conversations", id);
}

export async function clearAllConversations(): Promise<void> {
    const db = await getDB();
    await db.clear("conversations");
}
