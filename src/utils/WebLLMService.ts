import { CreateMLCEngine, MLCEngine, type InitProgressReport } from "@mlc-ai/web-llm";

export type ProgressCallback = (report: InitProgressReport) => void;

class WebLLMService {
    private engine: MLCEngine | null = null;
    private modelId = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    // Alternately: "Phi-3-mini-4k-instruct-q4f16_1-MLC" or "Llama-3-8B-Instruct-q4f16_1-MLC"

    async init(onProgress?: ProgressCallback) {
        if (this.engine) {
            // Check if the engine is still valid (not lost)
            try {
                await this.engine.runtimeStatsText();
            } catch (e) {
                console.warn("GPU Device was likely lost, re-initializing...");
                this.engine = null;
            }
        }

        if (this.engine) return;

        try {
            this.engine = await CreateMLCEngine(this.modelId, {
                initProgressCallback: onProgress,
                logLevel: "WARN", // Reduce noise
            });
        } catch (e: any) {
            console.error("Failed to initialize WebLLM engine:", e);
            if (e.message?.includes("Device lost") || e.message?.includes("memory")) {
                throw new Error("Your GPU ran out of memory or is incompatible. Please try using Cloud AI or close other browser tabs.");
            }
            throw e;
        }
    }

    async generateLessons(text: string, totalLessons: number): Promise<any[]> {
        if (!this.engine) {
            throw new Error("Local AI engine not initialized. Please wait for the model to load.");
        }

        const prompt = `You are an expert UK English Teacher. Generate a JSON array of exactly ${totalLessons} lesson objects based on this syllabus. Each object MUST have these exact keys:
- "dayNumber": (number, 1 to ${totalLessons})
- "topicTitle": (string, lesson title)
- "fiveMinuteSummary": (string, lesson overview)
- "detailedLesson": (string, extensive explanation with examples, at least 3-4 paragraphs)
- "kidFriendlyExamples": (array of 3 strings for classroom activities)
- "quiz": (object with "questions" array, each question having "question", "options" array, "correctAnswer", and "explanation")

Syllabus: ${text.substring(0, 5000)}

IMPORTANT: Output ONLY valid JSON in an array format. No extra text.`;

        const messages = [
            { role: "system" as const, content: "You are a helpful assistant that outputs only JSON." },
            { role: "user" as const, content: prompt },
        ];

        const reply = await this.engine.chat.completions.create({
            messages,
            max_tokens: 4096, // Ensure enough space for 20 lessons
            temperature: 0.3, // Lower temp for more stable JSON
            // Removed response_format: { type: "json_object" } due to a bug in WebLLM's grammar compiler
        });

        let content = reply.choices[0].message.content || "[]";

        try {
            // ROBUST PARSER: Handle truncation by attempting to close JSON
            const fixTruncatedJson = (str: string) => {
                let openBraces = 0;
                let openBrackets = 0;
                let inString = false;
                let escaped = false;

                for (let i = 0; i < str.length; i++) {
                    const char = str[i];
                    if (escaped) { escaped = false; continue; }
                    if (char === '\\') { escaped = true; continue; }
                    if (char === '"') { inString = !inString; continue; }
                    if (!inString) {
                        if (char === '{') openBraces++;
                        if (char === '}') openBraces--;
                        if (char === '[') openBrackets++;
                        if (char === ']') openBrackets--;
                    }
                }

                if (inString) str += '"';
                while (openBraces > 0) { str += '}'; openBraces--; }
                while (openBrackets > 0) { str += ']'; openBrackets--; }
                return str;
            };

            const fixedContent = fixTruncatedJson(content);

            let parsedLessons: any[] = [];
            // Find the first [ and last ] to extract JSON array
            const start = fixedContent.indexOf('[');
            const end = fixedContent.lastIndexOf(']');

            if (start !== -1 && end !== -1) {
                try {
                    parsedLessons = JSON.parse(fixedContent.substring(start, end + 1));
                } catch (e) {
                    // If still failing, try a very aggressive approach
                    const fallbackExtract = fixedContent.substring(start);
                    parsedLessons = JSON.parse(fixTruncatedJson(fallbackExtract));
                }
            } else {
                parsedLessons = JSON.parse(fixTruncatedJson(content));
            }

            if (!Array.isArray(parsedLessons)) {
                if (typeof parsedLessons === 'object' && parsedLessons !== null) {
                    const keys = Object.keys(parsedLessons);
                    if (keys.length === 1 && Array.isArray((parsedLessons as any)[keys[0]])) {
                        parsedLessons = (parsedLessons as any)[keys[0]];
                    } else {
                        parsedLessons = [parsedLessons];
                    }
                } else {
                    parsedLessons = [];
                }
            }

            // Post-process to ensure critical fields exist
            return parsedLessons.map((l: any, i: number) => ({
                dayNumber: l.dayNumber || (i + 1),
                topicTitle: l.topicTitle || `Lesson ${i + 1}`,
                fiveMinuteSummary: l.fiveMinuteSummary || "No summary available.",
                detailedLesson: l.detailedLesson || "",
                kidFriendlyExamples: Array.isArray(l.kidFriendlyExamples) ? l.kidFriendlyExamples : ["Interactive workshop", "Practical exercises", "Q&A Session"],
                quiz: l.quiz || { questions: [] },
                completed: false
            }));

        } catch (e) {
            console.error("Failed to parse local LLM response:", content);
            throw new Error("Local AI generated invalid data or was interrupted. Please try again with fewer lessons or use Cloud AI.");
        }
    }

    async isWebGPUSupported(): Promise<boolean> {
        return 'gpu' in navigator;
    }
}

export const webLLMService = new WebLLMService();
