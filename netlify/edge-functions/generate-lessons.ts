import type { Context } from "@netlify/edge-functions";
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Unified JSON parser ─────────────────────────────────────────────────────
function extractLessonsArray(raw: string): any[] | null {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
            if (parsed.topicTitle && parsed.detailedLesson) return [parsed];
            for (const key of Object.keys(parsed)) {
                if (Array.isArray(parsed[key]) && parsed[key].length > 0) return parsed[key];
            }
        }
    } catch { }

    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
        try {
            const arr = JSON.parse(match[0]);
            if (Array.isArray(arr) && arr.length > 0) return arr;
        } catch { }
    }

    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        try {
            const obj = JSON.parse(objectMatch[0]);
            if (obj.topicTitle && obj.detailedLesson) return [obj];
        } catch { }
    }

    return null;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert UK English Teacher with 20 years of classroom experience.
You create detailed, engaging, and pedagogically sound lesson plans.
You ALWAYS output ONLY valid JSON — no markdown fences, no explanatory text, just the raw JSON.`;

const LESSON_SCHEMA = `Each lesson object MUST have ALL of these fields:
- "dayNumber": number
- "topicTitle": string (concise, descriptive title)
- "fiveMinuteSummary": string (2-3 sentences a teacher reads aloud before class to frame the lesson)
- "detailedLesson": string (4-6 paragraphs of rich, practical teaching content with examples; separate paragraphs with \\n\\n)
- "kidFriendlyExamples": array of exactly 3 strings (concrete classroom activities with clear instructions)
- "quiz": object with a "questions" array of 5 questions, each having:
    - "question": string
    - "options": array of exactly 4 strings
    - "correctAnswer": string (must exactly match one option)
    - "explanation": string (why the answer is correct, 1-2 sentences)`;

function buildPrompt(totalLessons: number, text: string, context: string): string {
    return `Generate a JSON array of exactly ${totalLessons} lesson plan object(s) based on the syllabus below.${context ? `\n\nSPECIFIC INSTRUCTION: ${context}` : ''}

${LESSON_SCHEMA}

Return ONLY the JSON array [...]. No wrapper object, no markdown, no extra text.

SYLLABUS:
${text}`;
}

// ─── Helper: call OpenAI-compatible chat endpoint ────────────────────────────
async function tryOpenAICompat(opts: {
    apiKey: string;
    baseURL: string;
    model: string;
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    timeoutMs?: number;
}): Promise<any[] | null> {
    const client = new OpenAI({
        apiKey: opts.apiKey,
        baseURL: opts.baseURL,
        timeout: opts.timeoutMs ?? 45000,
    });
    const response = await client.chat.completions.create({
        model: opts.model,
        messages: [
            { role: 'system', content: opts.systemPrompt },
            { role: 'user', content: opts.userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: opts.maxTokens ?? 6000,
    });
    const content = response.choices[0].message.content || '';
    return extractLessonsArray(content);
}

// ─── Edge Function ────────────────────────────────────────────────────────────
export default async (req: Request, _ctx: Context) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const errors: string[] = [];

    try {
        const bodyText = await req.text();
        const { text, totalLessons = 20, promptContext = '' } = JSON.parse(bodyText || '{}');

        if (!text || text.trim().length < 10) {
            return Response.json({ error: 'Missing or too-short syllabus text. Please upload a valid PDF.' }, { status: 400 });
        }

        const n = Number(totalLessons);
        console.log(`[START] Generating ${n} lessons. Input chars: ${text.length}`);

        // Groq free tier limits (on_demand):
        //   llama-3.3-70b-versatile: 12 000 TPM  → keep input ≤ ~3 000 chars
        //   llama-3.1-8b-instant   :  6 000 TPM  → keep input ≤ ~1 500 chars
        // The output budget (quiz + detail) is ~3 000-4 000 tokens, so input must be tiny.
        const GROQ_KEY = Netlify.env.get('GROQ_API_KEY') ?? '';
        const GEMINI_KEY = Netlify.env.get('GEMINI_API_KEY') ?? '';
        const OPENAI_KEY = Netlify.env.get('OPENAI_API_KEY') ?? '';
        const TOGETHER_KEY = Netlify.env.get('TOGETHER_API_KEY') ?? '';
        const MISTRAL_KEY = Netlify.env.get('MISTRAL_API_KEY') ?? '';
        const DEEPSEEK_KEY = Netlify.env.get('DEEPSEEK_API_KEY') ?? '';
        const CF_ACCOUNT = Netlify.env.get('CF_ACCOUNT_ID') ?? '';
        const CF_TOKEN = Netlify.env.get('CF_API_TOKEN') ?? '';

        // ── 1. GROQ ──────────────────────────────────────────────────────────
        if (GROQ_KEY.startsWith('gsk_')) {
            const groqModels = [
                // input budget: 12k TPM − 6k output tokens ≈ 6k tokens ≈ 3k chars
                { name: 'llama-3.3-70b-versatile', maxInputChars: 3000, maxOut: 6000 },
                // input budget: 6k TPM − 3k output tokens ≈ 3k tokens ≈ 1.5k chars
                { name: 'llama-3.1-8b-instant',    maxInputChars: 1500, maxOut: 3000 },
            ];
            for (const { name: model, maxInputChars, maxOut } of groqModels) {
                try {
                    console.log(`-> Groq/${model}...`);
                    const prompt = buildPrompt(n, text.substring(0, maxInputChars), promptContext);
                    const lessons = await tryOpenAICompat({
                        apiKey: GROQ_KEY,
                        baseURL: 'https://api.groq.com/openai/v1',
                        model,
                        systemPrompt: SYSTEM_PROMPT,
                        userPrompt: prompt,
                        maxTokens: maxOut,
                        timeoutMs: 30000,
                    });
                    if (lessons && lessons.length > 0) {
                        console.log(`-> SUCCESS Groq/${model}`);
                        return Response.json(lessons);
                    }
                    errors.push(`Groq/${model}: empty/invalid result`);
                    break; // don't cascade to smaller model unless it was a size error
                } catch (err: any) {
                    const msg: string = err.message ?? '';
                    errors.push(`Groq/${model}: ${msg}`);
                    console.error(`-> Groq/${model} failed: ${msg}`);
                    // Only try the smaller model on size/rate errors
                    const isRetryable = msg.includes('Request too large') ||
                        msg.includes('decommissioned') ||
                        (msg.toLowerCase().includes('rate limit') && msg.includes('tokens per day'));
                    if (isRetryable) continue;
                    break;
                }
            }
        }

        // ── 2. GEMINI ─────────────────────────────────────────────────────────
        if (GEMINI_KEY) {
            const genAI = new GoogleGenerativeAI(GEMINI_KEY);
            // gemini-1.5-flash has a true free tier with daily RPM quota (no credit card needed)
            const geminiModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];
            const geminiInput = text.substring(0, 20000);
            const geminiPrompt = buildPrompt(n, geminiInput, promptContext);

            for (const modelName of geminiModels) {
                try {
                    console.log(`-> Gemini/${modelName}...`);
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } as any,
                    });
                    const result = await model.generateContent(SYSTEM_PROMPT + '\n\n' + geminiPrompt);
                    const lessons = extractLessonsArray(result.response.text());
                    if (lessons && lessons.length > 0) {
                        console.log(`-> SUCCESS Gemini/${modelName}`);
                        return Response.json(lessons);
                    }
                    errors.push(`Gemini/${modelName}: empty/invalid result`);
                } catch (err: any) {
                    const msg: string = err.message ?? '';
                    errors.push(`Gemini/${modelName}: ${msg}`);
                    console.error(`-> Gemini/${modelName} failed: ${msg}`);
                    // If credits depleted on the paid-tier models, fall through to the next
                }
            }
        }

        // ── 3. TOGETHER AI (generous free tier, no billing required) ──────────
        if (TOGETHER_KEY) {
            try {
                console.log('-> Together AI...');
                const prompt = buildPrompt(n, text.substring(0, 12000), promptContext);
                const lessons = await tryOpenAICompat({
                    apiKey: TOGETHER_KEY,
                    baseURL: 'https://api.together.xyz/v1',
                    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
                    systemPrompt: SYSTEM_PROMPT,
                    userPrompt: prompt,
                    maxTokens: 8000,
                    timeoutMs: 60000,
                });
                if (lessons && lessons.length > 0) {
                    console.log('-> SUCCESS Together AI');
                    return Response.json(lessons);
                }
                errors.push('Together AI: empty/invalid result');
            } catch (err: any) {
                errors.push(`Together AI: ${err.message}`);
                console.error(`-> Together AI failed: ${err.message}`);
            }
        }

        // ── 4. OPENAI ────────────────────────────────────────────────────────
        if (OPENAI_KEY.startsWith('sk-')) {
            try {
                console.log('-> OpenAI gpt-4o-mini...');
                const prompt = buildPrompt(n, text.substring(0, 20000), promptContext);
                const lessons = await tryOpenAICompat({
                    apiKey: OPENAI_KEY,
                    baseURL: 'https://api.openai.com/v1',
                    model: 'gpt-4o-mini',
                    systemPrompt: SYSTEM_PROMPT,
                    userPrompt: prompt,
                    maxTokens: 8000,
                    timeoutMs: 45000,
                });
                if (lessons && lessons.length > 0) {
                    console.log('-> SUCCESS OpenAI');
                    return Response.json(lessons);
                }
                errors.push('OpenAI: empty/invalid result');
            } catch (err: any) {
                errors.push(`OpenAI: ${err.message}`);
                console.error(`-> OpenAI failed: ${err.message}`);
            }
        }

        // ── 5. CLOUDFLARE WORKERS AI (free, no billing) ───────────────────────
        if (CF_ACCOUNT && CF_TOKEN) {
            try {
                console.log('-> Cloudflare Workers AI...');
                const cfRes = await fetch(
                    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
                    {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messages: [
                                { role: 'system', content: SYSTEM_PROMPT },
                                { role: 'user', content: buildPrompt(n, text.substring(0, 4000), promptContext) },
                            ],
                        }),
                    }
                );
                const cfData: any = await cfRes.json();
                if (cfData.success && cfData.result?.response) {
                    const lessons = extractLessonsArray(cfData.result.response);
                    if (lessons && lessons.length > 0) {
                        console.log('-> SUCCESS Cloudflare');
                        return Response.json(lessons);
                    }
                }
                errors.push('Cloudflare: empty/invalid result');
            } catch (err: any) {
                errors.push(`Cloudflare: ${err.message}`);
                console.error(`-> Cloudflare failed: ${err.message}`);
            }
        }

        // ── 6. MISTRAL ───────────────────────────────────────────────────────
        if (MISTRAL_KEY) {
            try {
                console.log('-> Mistral...');
                const prompt = buildPrompt(n, text.substring(0, 16000), promptContext);
                const lessons = await tryOpenAICompat({
                    apiKey: MISTRAL_KEY,
                    baseURL: 'https://api.mistral.ai/v1',
                    model: 'mistral-small-latest',
                    systemPrompt: SYSTEM_PROMPT,
                    userPrompt: prompt,
                    maxTokens: 8000,
                    timeoutMs: 90000,  // Mistral free tier can be slow
                });
                if (lessons && lessons.length > 0) {
                    console.log('-> SUCCESS Mistral');
                    return Response.json(lessons);
                }
                errors.push('Mistral: empty/invalid result');
            } catch (err: any) {
                errors.push(`Mistral: ${err.message}`);
                console.error(`-> Mistral failed: ${err.message}`);
            }
        }

        // ── 7. DEEPSEEK ──────────────────────────────────────────────────────
        if (DEEPSEEK_KEY.startsWith('sk-')) {
            try {
                console.log('-> DeepSeek...');
                const prompt = buildPrompt(n, text.substring(0, 12000), promptContext);
                const lessons = await tryOpenAICompat({
                    apiKey: DEEPSEEK_KEY,
                    baseURL: 'https://api.deepseek.com',
                    model: 'deepseek-chat',
                    systemPrompt: SYSTEM_PROMPT,
                    userPrompt: prompt,
                    maxTokens: 8000,
                    timeoutMs: 60000,
                });
                if (lessons && lessons.length > 0) {
                    console.log('-> SUCCESS DeepSeek');
                    return Response.json(lessons);
                }
                errors.push('DeepSeek: empty/invalid result');
            } catch (err: any) {
                errors.push(`DeepSeek: ${err.message}`);
                console.error(`-> DeepSeek failed: ${err.message}`);
            }
        }

        console.error('!!! ALL PROVIDERS FAILED', errors);
        return Response.json({
            error: 'All AI providers failed. Please try again in a moment.',
            details: errors,
        }, { status: 503 });

    } catch (err: any) {
        console.error('[CRITICAL]', err.message);
        return Response.json({ error: err.message, details: errors }, { status: 500 });
    }
};
