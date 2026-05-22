import type { Context } from "@netlify/edge-functions";
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── JSON extractor ───────────────────────────────────────────────────────────
function extractLessonsArray(raw: string): any[] | null {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        if (typeof parsed === 'object' && parsed !== null) {
            if (parsed.topicTitle) return [parsed];
            for (const k of Object.keys(parsed)) {
                if (Array.isArray(parsed[k]) && parsed[k].length > 0) return parsed[k];
            }
        }
    } catch { }

    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) { try { const a = JSON.parse(arrMatch[0]); if (Array.isArray(a) && a.length > 0) return a; } catch { } }
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) { try { const o = JSON.parse(objMatch[0]); if (o.topicTitle) return [o]; } catch { } }
    return null;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert UK English Teacher with 20 years of classroom experience.
You ALWAYS output ONLY valid JSON — no markdown fences, no explanatory text, just the raw JSON.`;

// Phase 1 — lightweight outline only (titles + summaries).
// Output is ~30 tokens per lesson → 20 lessons ≈ 600 tokens total.
const OUTLINE_SCHEMA = `Each object MUST have exactly these fields:
- "dayNumber": number (sequential, 1 to N)
- "topicTitle": string (clear, descriptive lesson title)
- "fiveMinuteSummary": string (2-3 sentences describing what this lesson covers)
- "completed": false
- "detailedLesson": ""
- "kidFriendlyExamples": []
- "quiz": {"questions": []}`;

// Phase 2 — full detail for a single lesson.
// Output is ~700-900 tokens per lesson call — very manageable.
const DETAIL_SCHEMA = `The lesson object MUST have ALL of these fields:
- "dayNumber": number
- "topicTitle": string
- "fiveMinuteSummary": string (2-3 sentences)
- "detailedLesson": string (4-6 paragraphs with examples and strategies; separate paragraphs with \\n\\n)
- "kidFriendlyExamples": array of 3 strings (concrete classroom activities with clear instructions)
- "quiz": object with "questions" array of 5 questions, each:
    - "question": string
    - "options": array of 4 strings
    - "correctAnswer": string (must match one option exactly)
    - "explanation": string (1-2 sentences)`;

function buildOutlinePrompt(n: number, text: string): string {
    return `Generate a JSON array of exactly ${n} lesson outline objects from this syllabus.\n\n${OUTLINE_SCHEMA}\n\nReturn ONLY the JSON array. No markdown, no extra text.\n\nSYLLABUS:\n${text}`;
}

function buildDetailPrompt(n: number, text: string, ctx: string): string {
    return `Generate a JSON array of exactly ${n} lesson plan object(s).${ctx ? `\n\nSPECIFIC INSTRUCTION: ${ctx}` : ''}\n\n${DETAIL_SCHEMA}\n\nReturn ONLY the JSON array. No markdown, no extra text.\n\nCONTEXT:\n${text}`;
}

// ─── OpenAI-compatible helper ─────────────────────────────────────────────────
async function tryOpenAICompat(opts: {
    apiKey: string; baseURL: string; model: string;
    systemPrompt: string; userPrompt: string;
    maxTokens?: number; timeoutMs?: number;
}): Promise<any[] | null> {
    const client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL, timeout: opts.timeoutMs ?? 45000 });
    const res = await client.chat.completions.create({
        model: opts.model,
        messages: [{ role: 'system', content: opts.systemPrompt }, { role: 'user', content: opts.userPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: opts.maxTokens ?? 6000,
    });
    return extractLessonsArray(res.choices[0].message.content || '');
}

// ─── Edge Function ────────────────────────────────────────────────────────────
export default async (req: Request, _ctx: Context) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const errors: string[] = [];

    try {
        const body = JSON.parse(await req.text() || '{}');
        const {
            text,
            totalLessons = 20,
            promptContext = '',
            outlineOnly = false,   // Phase 1: just titles + summaries
        } = body;

        if (!text || text.trim().length < 10) {
            return Response.json({ error: 'Missing or too-short syllabus text.' }, { status: 400 });
        }

        const n = Number(totalLessons);
        const mode = outlineOnly ? 'OUTLINE' : 'DETAIL';
        console.log(`[START] mode=${mode} lessons=${n} inputChars=${text.length}`);

        // ── Token budget per mode ────────────────────────────────────────────
        // OUTLINE: output is tiny (~30 tok/lesson → 600 tok for 20). Input can be large.
        //   Groq 12k TPM: reserve 700 out → 11,300 in ≈ 22,000 chars
        //   Groq  6k TPM: reserve 700 out →  5,300 in ≈ 10,000 chars
        // DETAIL (single lesson): output ~800 tok. Input should be ≤ 3,000 chars.
        //   Groq 12k TPM: reserve 900 out → 11,100 in ≈ but limit to 3k for safety
        const GROQ_KEY    = Netlify.env.get('GROQ_API_KEY')    ?? '';
        const GEMINI_KEY  = Netlify.env.get('GEMINI_API_KEY')  ?? '';
        const OPENAI_KEY  = Netlify.env.get('OPENAI_API_KEY')  ?? '';
        const TOGETHER_KEY= Netlify.env.get('TOGETHER_API_KEY')?? '';
        const MISTRAL_KEY = Netlify.env.get('MISTRAL_API_KEY') ?? '';
        const DEEPSEEK_KEY= Netlify.env.get('DEEPSEEK_API_KEY')?? '';
        const CF_ACCOUNT  = Netlify.env.get('CF_ACCOUNT_ID')   ?? '';
        const CF_TOKEN    = Netlify.env.get('CF_API_TOKEN')    ?? '';

        const buildPrompt = outlineOnly
            ? (chars: number) => buildOutlinePrompt(n, text.substring(0, chars))
            : (chars: number) => buildDetailPrompt(n, text.substring(0, chars), promptContext);

        // ── 1. GROQ ──────────────────────────────────────────────────────────
        if (GROQ_KEY.startsWith('gsk_')) {
            // For outline mode: input budget is huge (output is tiny)
            // For detail mode: keep input tight to leave room for rich output
            const groqCfg = outlineOnly
                ? [
                    { name: 'llama-3.3-70b-versatile', maxIn: 20000, maxOut: 1500 },
                    { name: 'llama-3.1-8b-instant',    maxIn:  8000, maxOut:  800 },
                  ]
                : [
                    { name: 'llama-3.3-70b-versatile', maxIn:  3000, maxOut: 4000 },
                    { name: 'llama-3.1-8b-instant',    maxIn:  1500, maxOut: 2000 },
                  ];

            for (const { name, maxIn, maxOut } of groqCfg) {
                try {
                    console.log(`-> Groq/${name}...`);
                    const lessons = await tryOpenAICompat({
                        apiKey: GROQ_KEY, baseURL: 'https://api.groq.com/openai/v1', model: name,
                        systemPrompt: SYSTEM_PROMPT, userPrompt: buildPrompt(maxIn),
                        maxTokens: maxOut, timeoutMs: 30000,
                    });
                    if (lessons && lessons.length > 0) { console.log(`-> SUCCESS Groq/${name}`); return Response.json(lessons); }
                    errors.push(`Groq/${name}: empty result`); break;
                } catch (err: any) {
                    const msg: string = err.message ?? '';
                    errors.push(`Groq/${name}: ${msg}`);
                    console.error(`-> Groq/${name} failed: ${msg}`);
                    const retry = msg.includes('Request too large') || msg.includes('decommissioned') ||
                        (msg.toLowerCase().includes('rate limit') && msg.includes('tokens per day'));
                    if (retry) continue; else break;
                }
            }
        }

        // ── 2. TOGETHER AI (free Llama 3.3 70B) ─────────────────────────────
        if (TOGETHER_KEY) {
            try {
                console.log('-> Together AI...');
                const maxIn = outlineOnly ? 30000 : 8000;
                const maxOut = outlineOnly ? 1500 : 6000;
                const lessons = await tryOpenAICompat({
                    apiKey: TOGETHER_KEY, baseURL: 'https://api.together.xyz/v1',
                    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
                    systemPrompt: SYSTEM_PROMPT, userPrompt: buildPrompt(maxIn),
                    maxTokens: maxOut, timeoutMs: 90000,
                });
                if (lessons && lessons.length > 0) { console.log('-> SUCCESS Together AI'); return Response.json(lessons); }
                errors.push('Together AI: empty result');
            } catch (err: any) {
                errors.push(`Together AI: ${err.message}`);
                console.error(`-> Together AI failed: ${err.message}`);
            }
        }

        // ── 3. GEMINI ─────────────────────────────────────────────────────────
        if (GEMINI_KEY) {
            const genAI = new GoogleGenerativeAI(GEMINI_KEY);
            // gemini-1.5-flash has a genuine free tier (1500 req/day, no credit card)
            const geminiModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];
            const maxIn = outlineOnly ? 40000 : 12000;
            const prompt = buildPrompt(maxIn);
            for (const modelName of geminiModels) {
                try {
                    console.log(`-> Gemini/${modelName}...`);
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } as any,
                    });
                    const result = await model.generateContent(SYSTEM_PROMPT + '\n\n' + prompt);
                    const lessons = extractLessonsArray(result.response.text());
                    if (lessons && lessons.length > 0) { console.log(`-> SUCCESS Gemini/${modelName}`); return Response.json(lessons); }
                    errors.push(`Gemini/${modelName}: empty result`);
                } catch (err: any) {
                    errors.push(`Gemini/${modelName}: ${err.message}`);
                    console.error(`-> Gemini/${modelName} failed: ${err.message}`);
                }
            }
        }

        // ── 4. OPENAI ────────────────────────────────────────────────────────
        if (OPENAI_KEY.startsWith('sk-')) {
            try {
                console.log('-> OpenAI gpt-4o-mini...');
                const maxIn = outlineOnly ? 30000 : 10000;
                const lessons = await tryOpenAICompat({
                    apiKey: OPENAI_KEY, baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini',
                    systemPrompt: SYSTEM_PROMPT, userPrompt: buildPrompt(maxIn),
                    maxTokens: outlineOnly ? 1500 : 6000, timeoutMs: 45000,
                });
                if (lessons && lessons.length > 0) { console.log('-> SUCCESS OpenAI'); return Response.json(lessons); }
                errors.push('OpenAI: empty result');
            } catch (err: any) {
                errors.push(`OpenAI: ${err.message}`);
                console.error(`-> OpenAI failed: ${err.message}`);
            }
        }

        // ── 5. CLOUDFLARE WORKERS AI (free) ───────────────────────────────────
        if (CF_ACCOUNT && CF_TOKEN) {
            try {
                console.log('-> Cloudflare Workers AI...');
                const maxIn = outlineOnly ? 8000 : 3000;
                const cfRes = await fetch(
                    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
                    {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messages: [
                                { role: 'system', content: SYSTEM_PROMPT },
                                { role: 'user', content: buildPrompt(maxIn) },
                            ],
                        }),
                    }
                );
                const cfData: any = await cfRes.json();
                if (cfData.success && cfData.result?.response) {
                    const lessons = extractLessonsArray(cfData.result.response);
                    if (lessons && lessons.length > 0) { console.log('-> SUCCESS Cloudflare'); return Response.json(lessons); }
                }
                errors.push('Cloudflare: empty result');
            } catch (err: any) {
                errors.push(`Cloudflare: ${err.message}`);
                console.error(`-> Cloudflare failed: ${err.message}`);
            }
        }

        // ── 6. MISTRAL ───────────────────────────────────────────────────────
        if (MISTRAL_KEY) {
            try {
                console.log('-> Mistral...');
                const maxIn = outlineOnly ? 25000 : 8000;
                const lessons = await tryOpenAICompat({
                    apiKey: MISTRAL_KEY, baseURL: 'https://api.mistral.ai/v1', model: 'mistral-small-latest',
                    systemPrompt: SYSTEM_PROMPT, userPrompt: buildPrompt(maxIn),
                    maxTokens: outlineOnly ? 1500 : 6000, timeoutMs: 90000,
                });
                if (lessons && lessons.length > 0) { console.log('-> SUCCESS Mistral'); return Response.json(lessons); }
                errors.push('Mistral: empty result');
            } catch (err: any) {
                errors.push(`Mistral: ${err.message}`);
                console.error(`-> Mistral failed: ${err.message}`);
            }
        }

        // ── 7. DEEPSEEK ──────────────────────────────────────────────────────
        if (DEEPSEEK_KEY.startsWith('sk-')) {
            try {
                console.log('-> DeepSeek...');
                const maxIn = outlineOnly ? 20000 : 6000;
                const lessons = await tryOpenAICompat({
                    apiKey: DEEPSEEK_KEY, baseURL: 'https://api.deepseek.com', model: 'deepseek-chat',
                    systemPrompt: SYSTEM_PROMPT, userPrompt: buildPrompt(maxIn),
                    maxTokens: outlineOnly ? 1500 : 6000, timeoutMs: 60000,
                });
                if (lessons && lessons.length > 0) { console.log('-> SUCCESS DeepSeek'); return Response.json(lessons); }
                errors.push('DeepSeek: empty result');
            } catch (err: any) {
                errors.push(`DeepSeek: ${err.message}`);
                console.error(`-> DeepSeek failed: ${err.message}`);
            }
        }

        console.error('!!! ALL PROVIDERS FAILED', errors);
        return Response.json({ error: 'All AI providers failed. Please try again in a moment.', details: errors }, { status: 503 });

    } catch (err: any) {
        console.error('[CRITICAL]', err.message);
        return Response.json({ error: err.message, details: errors }, { status: 500 });
    }
};
