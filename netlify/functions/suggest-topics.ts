import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const SYSTEM_PROMPT = `You are an expert educational AI assistant.
Your task is to generate exactly 5 engaging, age-appropriate educational topics based on the student's age/grade and their interests.
You MUST output ONLY valid JSON — no markdown fences, no explanatory text, just the raw JSON.
The output must be a JSON array of objects.`;

const SCHEMA = `[
    {
        "topicTitle": "A catchy, short title for the lesson topic",
        "summary": "A 2-3 sentence summary of what the student will learn."
    }
]`;

// ─── Safe JSON parser ──────────────────────────────────────────────────────────
function parseTopicsResponse(raw: string): { topicTitle: string; summary: string }[] {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            return parsed;
        }
    } catch {
        // Attempt to extract JSON array from anywhere in the string
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch { /* fall through */ }
        }
    }
    throw new Error('Failed to parse AI response into a JSON array.');
}

const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { ageGroup, interests } = JSON.parse(event.body || '{}');

        if (!ageGroup) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing ageGroup.' }) };
        }

        const groqKey = process.env.GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const mistralKey = process.env.MISTRAL_API_KEY;

        const interestsText = interests ? `Their interests include: ${interests}.` : 'Make the topics generally engaging for this age group.';
        
        const userPrompt = `Generate 5 fun, educational topic suggestions for a student in the following age/grade: ${ageGroup}.
${interestsText}
The topics should be diverse and interesting.
SCHEMA:
${SCHEMA}

Return ONLY the JSON array.`;

        let aiResponse = '';

        // ── 1. GROQ (primary + small-model fallback) ────────────────────────────
        if (groqKey && groqKey.startsWith('gsk_')) {
            const groqModels = [
                'llama-3.3-70b-versatile',
                'llama-3.1-8b-instant',
            ];
            for (const model of groqModels) {
                if (aiResponse) break;
                try {
                    console.log(`-> Trying Groq (${model}) for suggest-topics...`);
                    const groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 8000 });
                    const response = await groq.chat.completions.create({
                        model,
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 1024,
                    });
                    aiResponse = response.choices[0]?.message?.content || '';
                    if (aiResponse) console.log(`-> SUCCESS: Groq/${model}`);
                } catch (err: any) {
                    console.warn(`Groq/${model} failed:`, err?.message || err);
                    const msg = err?.message || '';
                    if (
                        msg.includes('decommissioned') ||
                        msg.toLowerCase().includes('rate limit') ||
                        msg.includes('tokens per day')
                    ) continue;
                    break;
                }
            }
        }

        // ── 2. GEMINI (Fallback) ────────────────────────────────────────────────
        if (!aiResponse && geminiKey) {
            try {
                console.log('-> Trying Gemini for suggest-topics...');
                const genAI = new GoogleGenerativeAI(geminiKey);
                const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
                for (const modelName of geminiModels) {
                    if (aiResponse) break;
                    try {
                        const model = genAI.getGenerativeModel({ model: modelName });
                        const result = await model.generateContent([
                            { text: SYSTEM_PROMPT },
                            { text: userPrompt }
                        ]);
                        aiResponse = result.response.text();
                        if (aiResponse) console.log(`-> SUCCESS: Gemini/${modelName}`);
                    } catch (gErr: any) {
                        console.warn(`Gemini/${modelName} failed:`, gErr?.message || gErr);
                    }
                }
            } catch (err) {
                console.warn('Gemini init failed:', err);
            }
        }

        // ── 3. OPENAI (Fallback) ────────────────────────────────────────────────
        if (!aiResponse && openaiKey && openaiKey.startsWith('sk-')) {
            try {
                console.log('-> Trying OpenAI for suggest-topics...');
                const openai = new OpenAI({ apiKey: openaiKey, timeout: 8000 });
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 1024,
                });
                aiResponse = response.choices[0]?.message?.content || '';
                if (aiResponse) console.log('-> SUCCESS: OpenAI');
            } catch (err: any) {
                console.warn('OpenAI failed:', err?.message || err);
            }
        }

        // ── 4. MISTRAL (Final fallback) ─────────────────────────────────────────
        if (!aiResponse && mistralKey) {
            try {
                console.log('-> Trying Mistral for suggest-topics...');
                const mistral = new OpenAI({ apiKey: mistralKey, baseURL: 'https://api.mistral.ai/v1', timeout: 10000 });
                const response = await mistral.chat.completions.create({
                    model: 'mistral-small-latest',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 1024,
                });
                aiResponse = response.choices[0]?.message?.content || '';
                if (aiResponse) console.log('-> SUCCESS: Mistral');
            } catch (err: any) {
                console.warn('Mistral failed:', err?.message || err);
            }
        }

        if (!aiResponse) {
            console.error('!!! All AI providers failed for suggest-topics !!!');
            return {
                statusCode: 503,
                body: JSON.stringify({ error: 'All AI providers failed to generate topics.' })
            };
        }

        const result = parseTopicsResponse(aiResponse);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suggestions: result })
        };

    } catch (err: any) {
        console.error('[CRITICAL] suggest-topics error:', err?.message || err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || 'Internal Server Error' })
        };
    }
};

export { handler };
