import { NextRequest, NextResponse } from "next/server";
import { extractLimiter } from "@/lib/rate-limit";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

const SYSTEM_PROMPT = `You are a strict medical document extraction engine.

You must extract only information explicitly present in the OCR text.

Rules:
1. Do NOT guess.
2. Do NOT infer missing information.
3. Do NOT complete partial values.
4. Do NOT use medical knowledge outside the text.
5. If a field is missing, return null.
6. If a list has no entries, return [].
7. If uncertain about document type, return "unknown".
8. Output must be valid JSON only.
9. Do not include explanations.
10. Do not include markdown.
11. Do not include comments.
12. Do not provide medical advice.

For medical test reports:
- Only mark a test as abnormal if BOTH value and reference range are explicitly present.
- Compare numeric value strictly against the provided reference range.
- If reference range missing, abnormal_flag must be null.
- If comparison cannot be determined, abnormal_flag must be null.

Return only one JSON object.

STEP 1: Determine document_type.
Allowed values: "medical_test_report", "prescription", "unknown"

STEP 2: Based on document_type, extract fields using the schemas below.

STEP 3: For medical_test_report, compute abnormal_flag ONLY when reference range is explicitly present.

If any value is unclear or not explicitly written, return null.

If document_type = "medical_test_report", return EXACTLY:
{
  "document_type": "medical_test_report",
  "patient_name": null,
  "patient_age": null,
  "patient_gender": null,
  "report_date": null,
  "lab_name": null,
  "doctor_name": null,
  "test_results": [
    {
      "test_name": null,
      "value": null,
      "unit": null,
      "reference_range": null,
      "abnormal_flag": null
    }
  ]
}

Abnormal Flag Rules:
- If value > upper limit -> "high"
- If value < lower limit -> "low"
- If within range -> "normal"
- If reference range missing -> null
- If value not numeric -> null
- If range format unclear -> null
- Never assume clinical meaning. Only compare numbers.

If document_type = "prescription", return EXACTLY:
{
  "document_type": "prescription",
  "patient_name": null,
  "age": null,
  "date": null,
  "doctor_name": null,
  "hospital_name": null,
  "medications": [
    {
      "medicine_name": null,
      "dosage": null,
      "frequency": null,
      "duration": null,
      "instructions": null
    }
  ]
}

If document_type = "unknown", return: { "document_type": "unknown" }

STRICT MODE ENFORCEMENT:
- If information is not explicitly present, return null.
- Do not complete partial names.
- Do not assume gender from name.
- Do not assume units.
- Do not interpret lab results medically.
- Do not explain results.
- Do not add extra fields.
- Output must be valid JSON only.`;

function sanitizeText(text: string): string {
    return text
        .replace(/[<>{}]/g, "")
        .replace(/\\/g, "")
        .substring(0, 10000);
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get("x-forwarded-for") || "anonymous";
        const { success } = extractLimiter.check(30, ip);
        if (!success) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again in a minute." },
                { status: 429 }
            );
        }

        const body = await request.json();
        const rawText = sanitizeText(body.text || "");

        if (!rawText.trim()) {
            return NextResponse.json({ error: "No text provided" }, { status: 400 });
        }

        if (!GROQ_API_KEY) {
            return NextResponse.json({
                extracted: { document_type: "unknown" },
            });
        }

        const userPrompt = "Below is raw OCR text extracted from a medical document.\n\nRAW OCR TEXT:\n\"\"\"\n" + rawText + "\n\"\"\"";

        const groqBody = JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
            ],
            temperature: 0,
            max_tokens: 3000,
        });

        // Retry with exponential backoff for transient Groq errors
        let response: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + GROQ_API_KEY,
                    "Content-Type": "application/json",
                },
                body: groqBody,
            });

            if (response.ok) break;

            console.error(`Groq error (attempt ${attempt + 1}/3): status ${response.status}`);

            // Don't retry on client errors (except 429)
            if (response.status < 500 && response.status !== 429) break;

            // Wait before retrying: 1s, 2s
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }

        if (!response || !response.ok) {
            const status = response?.status ?? 500;
            if (status === 429) {
                return NextResponse.json(
                    { error: "AI model rate limit reached. Please wait a minute and try again." },
                    { status: 429 }
                );
            }
            return NextResponse.json(
                { error: "AI service temporarily unavailable. Please try again." },
                { status: 502 }
            );
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        console.log("AI raw response (first 500 chars):", content.substring(0, 500));

        let extracted;
        try {
            let jsonStr = content;

            // Strip markdown code fences
            const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1].trim();
            }

            // Find outermost JSON object
            const firstBrace = jsonStr.indexOf("{");
            const lastBrace = jsonStr.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            extracted = JSON.parse(jsonStr);

            // Validate document_type
            if (!["medical_test_report", "prescription", "unknown"].includes(extracted.document_type)) {
                extracted.document_type = "unknown";
            }
        } catch (parseErr) {
            console.error("Failed to parse AI response as JSON:", parseErr);
            console.error("Full AI response:", content);
            extracted = { document_type: "unknown" };
        }

        return NextResponse.json({ extracted });
    } catch (error) {
        console.error("Extract API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
