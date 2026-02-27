"use client";

import React, { useState } from "react";
import type { Profile } from "@/lib/types";

interface ProfileModalProps {
    onSave: (profile: Profile) => void;
}

export default function ProfileModal({ onSave }: ProfileModalProps) {
    const [name, setName] = useState("");
    const [age, setAge] = useState("");
    const [gender, setGender] = useState("");
    const [conditionInput, setConditionInput] = useState("");
    const [conditions, setConditions] = useState<string[]>([]);

    const addCondition = () => {
        const trimmed = conditionInput.trim();
        if (trimmed && !conditions.includes(trimmed)) {
            setConditions([...conditions, trimmed]);
            setConditionInput("");
        }
    };

    const removeCondition = (c: string) => {
        setConditions(conditions.filter((x) => x !== c));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!age || !gender) return;
        onSave({
            name: name || undefined,
            age: parseInt(age, 10),
            gender,
            knownConditions: conditions,
        });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>👋 Welcome to MediSafe</h2>
                    <p>Set up your profile to personalize your health vault.</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Name (optional)</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Age *</label>
                            <input
                                className="form-input"
                                type="number"
                                placeholder="e.g. 32"
                                min={1}
                                max={150}
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Gender *</label>
                            <select
                                className="form-select"
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                required
                            >
                                <option value="">Select gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                                <option value="prefer-not-to-say">Prefer not to say</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Known Conditions</label>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    className="form-input"
                                    type="text"
                                    placeholder="e.g. Diabetes, Hypertension"
                                    value={conditionInput}
                                    onChange={(e) => setConditionInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            addCondition();
                                        }
                                    }}
                                />
                                <button type="button" className="btn btn-secondary btn-sm" onClick={addCondition}>
                                    Add
                                </button>
                            </div>
                            {conditions.length > 0 && (
                                <div className="tag-list" style={{ marginTop: 8 }}>
                                    {conditions.map((c) => (
                                        <span key={c} className="tag blue" style={{ cursor: "pointer" }} onClick={() => removeCondition(c)}>
                                            {c} ✕
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="submit" className="btn btn-primary btn-block btn-lg">
                            Get Started
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
