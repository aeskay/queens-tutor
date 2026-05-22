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
            if (parsed.topicTitle && parsed.detailedLesson) {
                return [parsed];
            }
            for (const key of Object.keys(parsed)) {
                if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
                    return parsed[key];
                }
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

const SYSTEM_PROMPT = `You are an expert UK English Teacher with 20 years of classroom experience.
You create detailed, engaging, and pedagogically sound lesson plans.
You ALWAYS output ONLY valid JSON — no markdown fences, no explanatory text, just the raw JSON.`;

const LESSON_SCHEMA = `Each lesson object MUST have ALL of these fields:
- "dayNumber": number
- "topicTitle": string (concise, descriptive title)
- "fiveMinuteSummary": string (2–3 sentences a teacher reads aloud before class to frame the lesson)
- "detailedLesson": string (4–6 paragraphs of rich, practical teaching content with examples and strategies; separate paragraphs with \\n\\n)
- "kidFriendlyExamples": array of exactly 3 strings (each is a concrete classroom activity or exercise with clear instructions)
- "quiz": object with a "questions" array of 5 to 10 questions (depending on the richness and depth of the topic, with a minimum of 5 and maximum of 10), each having:
    - "question": string
    - "options": array of exactly 4 strings
    - "correctAnswer": string (must exactly match one of the options)
    - "explanation": string (why the answer is correct, 2–3 sentences)`;

function buildPrompt(totalLessons: number, text: string, context: string): string {
    return `Generate a JSON array of exactly ${totalLessons} lesson plan object(s) based on the syllabus below.${context ? `\n\nSPECIFIC INSTRUCTION: ${context}` : ''}

${LESSON_SCHEMA}

Return ONLY the JSON array [...]. No wrapper object, no markdown, no extra text.

SYLLABUS:
${text.substring(0, 28000)}`;
}

export default async (req: Request, context: Context) => {
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

        const groqKey = Netlify.env.get('GROQ_API_KEY');
        const geminiKey = Netlify.env.get('GEMINI_API_KEY');
        const openaiKey = Netlify.env.get('OPENAI_API_KEY');
        const deepseekKey = Netlify.env.get('DEEPSEEK_API_KEY');
        const cfAccountId = Netlify.env.get('CF_ACCOUNT_ID');
        const cfApiToken = Netlify.env.get('CF_API_TOKEN');
        const mistralKey = Netlify.env.get('MISTRAL_API_KEY');

        const userPrompt = buildPrompt(Number(totalLessons), text, promptContext);
        console.log(`[START] Generating ${totalLessons} lessons. Text length: ${text.length}`);

        // ── 1. GROQ (free, fast, primary) ────────────────────────────────────
        if (groqKey && groqKey.startsWith('gsk_')) {
            const groqModels = [
                { name: 'llama-3.3-70b-versatile', maxChars: 28000 },
                { name: 'llama-3.1-8b-instant',    maxChars: 4000  },
            ];
            for (const { name: groqModel, maxChars } of groqModels) {
                try {
                    console.log(`-> Trying Groq (${groqModel})...`);
                    const groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 30000 });
                    const trimmedPrompt = buildPrompt(Number(totalLessons), text.substring(0, maxChars), promptContext);
                    const response = await groq.chat.completions.create({
                        model: groqModel,
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: trimmedPrompt },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.7,
                        max_tokens: 8000,
                    });
                    const content = response.choices[0].message.content || '';
                    const lessons = extractLessonsArray(content);
                    if (lessons && lessons.length > 0) {
                        console.log(`-> SUCCESS: Groq/${groqModel} (${lessons.length} lessons)`);
                        return Response.json(lessons);
                    }
                    errors.push(`Groq/${groqModel}: returned empty or invalid lessons array`);
                    break;
                } catch (err: any) {
                    console.error(`-> Groq/${groqModel} failed: ${err.message}`);
                    errors.push(`Groq/${groqModel}: ${err.message}`);
                    if (
                        (err.message && err.message.includes('decommissioned')) ||
                        (err.message && err.message.toLowerCase().includes('rate limit') && err.message.includes('tokens per day')) ||
                        (err.message && err.message.includes('Request too large'))
                    ) continue;
                    break;
                }
            }
        }

        // ── 2. GEMINI (free tier) ─────────────────────────────────────────────
        if (geminiKey) {
            console.log('-> Trying Gemini...');
            const genAI = new GoogleGenerativeAI(geminiKey);
            const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];

            for (const modelName of geminiModels) {
                try {
                    console.log(`   - Testing ${modelName}...`);
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        generationConfig: {
                            responseMimeType: 'application/json',
                            temperature: 0.7,
                        } as any,
                    });
                    const result = await model.generateContent(SYSTEM_PROMPT + '\n\n' + userPrompt);
                    const responseText = result.response.text();
                    const lessons = extractLessonsArray(responseText);
                    if (lessons && lessons.length > 0) {
                        console.log(`-> SUCCESS: Gemini/${modelName} (${lessons.length} lessons)`);
                        return Response.json(lessons);
                    }
                    errors.push(`Gemini/${modelName}: returned empty/invalid lessons`);
                } catch (err: any) {
                    console.error(`   - ${modelName} failed: ${err.message}`);
                    errors.push(`Gemini/${modelName}: ${err.message}`);
                }
            }
        }

        // ── 3. OPENAI ────────────────────────────────────────────────────────
        if (openaiKey && openaiKey.startsWith('sk-')) {
            try {
                console.log('-> Trying OpenAI (gpt-4o-mini)...');
                const openai = new OpenAI({ apiKey: openaiKey, timeout: 30000 });
                const trimmedPrompt = buildPrompt(Number(totalLessons), text.substring(0, 24000), promptContext);
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: trimmedPrompt },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7,
                });
                const content = response.choices[0].message.content || '';
                const lessons = extractLessonsArray(content);
                if (lessons && lessons.length > 0) {
                    console.log(`-> SUCCESS: OpenAI (${lessons.length} lessons)`);
                    return Response.json(lessons);
                }
                errors.push('OpenAI: returned empty or invalid lessons array');
            } catch (err: any) {
                console.error(`-> OpenAI failed: ${err.message}`);
                errors.push(`OpenAI: ${err.message}`);
            }
        }

        // ── 4. CLOUDFLARE WORKERS AI ──────────────────────────────────────────
        if (cfAccountId && cfApiToken) {
            try {
                console.log('-> Trying Cloudflare Workers AI...');
                const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${cfApiToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: userPrompt }
                        ]
                    })
                });
                const cfData = await response.json();
                if (cfData.success && cfData.result?.response) {
                    const lessons = extractLessonsArray(cfData.result.response);
                    if (lessons && lessons.length > 0) {
                        console.log(`-> SUCCESS: Cloudflare (${lessons.length} lessons)`);
                        return Response.json(lessons);
                    }
                }
                errors.push('Cloudflare: returned empty/invalid lessons');
            } catch (err: any) {
                console.error(`-> Cloudflare failed: ${err.message}`);
                errors.push(`Cloudflare: ${err.message}`);
            }
        }

        // ── 5. MISTRAL ───────────────────────────────────────────────────────
        if (mistralKey) {
            try {
                console.log('-> Trying Mistral...');
                const mistral = new OpenAI({ apiKey: mistralKey, baseURL: 'https://api.mistral.ai/v1', timeout: 30000 });
                const trimmedPrompt = buildPrompt(Number(totalLessons), text.substring(0, 24000), promptContext);
                const response = await mistral.chat.completions.create({
                    model: 'mistral-small-latest',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: trimmedPrompt },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7,
                });
                const content = response.choices[0].message.content || '';
                const lessons = extractLessonsArray(content);
                if (lessons && lessons.length > 0) {
                    console.log(`-> SUCCESS: Mistral (${lessons.length} lessons)`);
                    return Response.json(lessons);
                }
                errors.push('Mistral: returned empty or invalid lessons array');
            } catch (err: any) {
                console.error(`-> Mistral failed: ${err.message}`);
                errors.push(`Mistral: ${err.message}`);
            }
        }

        // ── 6. DEEPSEEK ──────────────────────────────────────────────────────
        if (deepseekKey && deepseekKey.startsWith('sk-')) {
            try {
                console.log('-> Trying DeepSeek...');
                const deepseek = new OpenAI({ apiKey: deepseekKey, baseURL: 'https://api.deepseek.com', timeout: 30000 });
                const trimmedPrompt = buildPrompt(Number(totalLessons), text.substring(0, 16000), promptContext);
                const response = await deepseek.chat.completions.create({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: trimmedPrompt },
                    ],
                    response_format: { type: 'json_object' },
                });
                const content = response.choices[0].message.content || '';
                const lessons = extractLessonsArray(content);
                if (lessons && lessons.length > 0) {
                    console.log(`-> SUCCESS: DeepSeek (${lessons.length} lessons)`);
                    return Response.json(lessons);
                }
                errors.push('DeepSeek: returned empty or invalid lessons array');
            } catch (err: any) {
                console.error(`-> DeepSeek failed: ${err.message}`);
                errors.push(`DeepSeek: ${err.message}`);
            }
        }

        console.error('!!! ALL AI PROVIDERS FAILED !!!', errors);
        return Response.json({
            error: 'All AI providers failed. Please try again in a moment.',
            details: errors,
        }, { status: 503 });

    } catch (error: any) {
        console.error('[CRITICAL ERROR]', error.message);
        return Response.json({ error: error.message, details: errors }, { status: 500 });
    }
};
