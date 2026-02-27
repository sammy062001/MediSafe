import { NextRequest, NextResponse } from "next/server";
import { apiLimiter } from "@/lib/rate-limit";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

const SYSTEM_PROMPT = `You are MediSafe AI — a friendly, knowledgeable health assistant inside the MediSafe health vault app.

Your personality:
- Be warm, conversational, and approachable — like a helpful friend who happens to know a lot about health.
- For casual messages (greetings, small talk), respond naturally and warmly. Don't force medical advice into every reply.
- For health-related questions, be thorough, clear, and cite your sources.
- ALWAYS explain in simple, everyday language as if talking to someone with no medical background.
- Avoid medical jargon. When you must use a medical term, immediately explain what it means in plain English (e.g., "Hemoglobin (the protein in your blood that carries oxygen)").

Response formatting (IMPORTANT):
- Use **bold** for key terms, test names, and important values.
- Use bullet points or numbered lists to organize information clearly.
- Keep paragraphs short (2-3 sentences max).
- Use line breaks between sections for readability.

When answering health questions:
1. Identify what the user is asking about (specific tests, medications, conditions, trends).
2. Use ONLY the health data provided in the context. Do NOT make up values.
3. For each lab value, explain it like this:
   - What the test is for (in plain English)
   - What the user's value is
   - What the normal/ideal range is
   - Whether they are within range, above, or below — and what that could mean in simple terms
   Example: "Your **Hemoglobin** is **12.5 g/dL**. Ideally, it should be between **13.0–17.0 g/dL** for men. Yours is slightly low, which could mean your blood isn't carrying oxygen as efficiently as it should. This can sometimes make you feel tired or short of breath."
4. Use careful language: "could mean", "may be associated with", "can sometimes indicate".
5. Do NOT provide definitive diagnoses, recommend medication changes, or give treatment advice.
6. If the user asks general questions like "what's wrong with me" or "summarize my health", review ALL available health data and give a comprehensive overview.

Citations (IMPORTANT):
- Do NOT place citations inline in the text.
- Instead, collect ALL source references and list them at the very end under a "**Sources:**" section.
- Format each source as: • Document name — Date
- Only cite documents explicitly listed in the provided context.
- If no health data is available, mention that clearly.

For casual conversation, just be friendly — no need to add sources.`;


function sanitizeInput(str: string): string {
    return str.replace(/[<>{}\\]/g, "").substring(0, 5000);
}

interface HistoryMessage {
    role: "user" | "assistant";
    content: string;
}

export async function POST(request: NextRequest) {
    try {
        // Rate limit
        const ip = request.headers.get("x-forwarded-for") || "anonymous";
        const { success } = apiLimiter.check(5, ip);
        if (!success) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again in a minute." },
                { status: 429 }
            );
        }

        const body = await request.json();
        const question = sanitizeInput(body.question || "");
        const profile = body.profile;
        const snapshot = body.snapshot;
        const history: HistoryMessage[] = body.history || [];

        if (!question.trim()) {
            return NextResponse.json({ error: "No question provided" }, { status: 400 });
        }

        // Build context message
        let context = "";
        if (profile) {
            context += `\nUser Profile: Age ${profile.age}, Gender: ${profile.gender}`;
            if (profile.knownConditions?.length) {
                context += `, Known conditions: ${profile.knownConditions.join(", ")}`;
            }
        }
        if (snapshot) {
            if (snapshot.activeConditions?.length) {
                context += `\nActive Conditions: ${snapshot.activeConditions.join(", ")}`;
            }
            if (snapshot.currentMedications?.length) {
                context += `\nCurrent Medications:`;
                for (const m of snapshot.currentMedications) {
                    context += `\n  - ${m.medicine_name || "Unknown"} (${m.dosage || "N/A"}, ${m.frequency || "N/A"}) [Source: ${m.sourceDoc || "Unknown"}, ${m.sourceDate || "Unknown date"}]`;
                }
            }
            if (snapshot.latestLabs?.length) {
                context += `\nLatest Lab Results:`;
                for (const l of snapshot.latestLabs) {
                    context += `\n  - ${l.test_name}: ${l.value} ${l.unit || ""} (Ref: ${l.reference_range || "N/A"}, Flag: ${l.abnormal_flag || "normal"}) [Source: ${l.sourceDoc || "Unknown"}, ${l.sourceDate || "Unknown date"}]`;
                }
            }
        }

        if (!GROQ_API_KEY) {
            return NextResponse.json({
                reply:
                    "MediSafe AI is not configured yet. Please set the GROQ_API_KEY environment variable to enable AI chat.",
            });
        }

        // Build messages array — merge health context into system prompt
        let systemContent = SYSTEM_PROMPT;
        if (context) {
            systemContent += `\n\n--- USER'S HEALTH DATA (from their uploaded documents) ---\n${context}\n--- END HEALTH DATA ---\n\nYou MUST use this health data when answering health-related questions. Reference specific values and cite the source documents.`;
        }

        const messages: { role: string; content: string }[] = [
            { role: "system", content: systemContent },
        ];

        // Add conversation history (cap to last 20 messages to stay within token limits)
        const recentHistory = history.slice(-20);
        for (const msg of recentHistory) {
            messages.push({
                role: msg.role,
                content: sanitizeInput(msg.content),
            });
        }

        // Add current question
        messages.push({ role: "user", content: question });

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages,
                temperature: 0.7,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            console.error("Groq error status:", response.status);
            if (response.status === 429) {
                return NextResponse.json({
                    reply: "⏳ Rate-limited by Groq. Please wait a moment and try again.",
                });
            }
            return NextResponse.json(
                { error: "AI service temporarily unavailable" },
                { status: 502 }
            );
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "I could not generate a response. Please try again.";

        return NextResponse.json({ reply });
    } catch (error) {
        console.error("Chat API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
