import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const SYSTEM_PROMPT = `You are an expert AI assistant that categorizes and summarizes educational documents.
You MUST output ONLY valid JSON — no markdown fences, no explanatory text, just the raw JSON.`;

const SCHEMA = `{
    "title": "A short, descriptive title for the document (max 6 words)",
    "summary": "A one-sentence summary of what this document contains."
}`;

// ─── Safe JSON parser ──────────────────────────────────────────────────────────
function parseSummaryResponse(raw: string, filename: string): { title: string; summary: string } {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        return {
            title: parsed.title || filename || 'Document',
            summary: parsed.summary || 'Summary could not be generated.',
        };
    } catch {
        // Attempt to extract JSON object from anywhere in the string
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                return {
                    title: parsed.title || filename || 'Document',
                    summary: parsed.summary || 'Summary could not be generated.',
                };
            } catch { /* fall through */ }
        }
        // Last resort: return filename as title, raw text as summary
        console.warn('Could not parse AI response as JSON, using raw text as summary.');
        return {
            title: filename || 'Document',
            summary: cleaned.substring(0, 200) || 'Summary could not be generated.',
        };
    }
}

const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { text, filename } = JSON.parse(event.body || '{}');

        if (!text) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing text.' }) };
        }

        const groqKey = process.env.GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const mistralKey = process.env.MISTRAL_API_KEY;

        const userPrompt = `Read the following text extract from a document named "${filename || 'document'}".
Generate a JSON object with a title and a one-sentence summary.
SCHEMA:
${SCHEMA}

Return ONLY the JSON object.

TEXT EXTRACT (first 1000 characters):
${text.substring(0, 1000)}`;

        let aiResponse = '';

        // ── 1. GROQ (primary + small-model fallback) ────────────────────────────
        if (groqKey && groqKey.startsWith('gsk_')) {
            const groqModels = [
                'llama-3.3-70b-versatile',
                'llama-3.1-8b-instant',  // fallback if daily limit on primary
            ];
            for (const model of groqModels) {
                if (aiResponse) break;
                try {
                    console.log(`-> Trying Groq (${model}) for summary...`);
                    const groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 8000 });
                    const response = await groq.chat.completions.create({
                        model,
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.3,
                        max_tokens: 256,
                    });
                    aiResponse = response.choices[0]?.message?.content || '';
                    if (aiResponse) console.log(`-> SUCCESS: Groq/${model}`);
                } catch (err: any) {
                    console.warn(`Groq/${model} failed for summary:`, err?.message || err);
                    // Only continue to smaller model on rate-limit or decommission
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
                console.log('-> Trying Gemini for summary...');
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
                console.log('-> Trying OpenAI for summary...');
                const openai = new OpenAI({ apiKey: openaiKey, timeout: 8000 });
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 256,
                });
                aiResponse = response.choices[0]?.message?.content || '';
                if (aiResponse) console.log('-> SUCCESS: OpenAI');
            } catch (err: any) {
                console.warn('OpenAI failed for summary:', err?.message || err);
            }
        }

        // ── 4. MISTRAL (Final fallback — free tier available) ───────────────────
        if (!aiResponse && mistralKey) {
            try {
                console.log('-> Trying Mistral for summary...');
                const mistral = new OpenAI({ apiKey: mistralKey, baseURL: 'https://api.mistral.ai/v1', timeout: 10000 });
                const response = await mistral.chat.completions.create({
                    model: 'mistral-small-latest',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 256,
                });
                aiResponse = response.choices[0]?.message?.content || '';
                if (aiResponse) console.log('-> SUCCESS: Mistral');
            } catch (err: any) {
                console.warn('Mistral failed for summary:', err?.message || err);
            }
        }

        if (!aiResponse) {
            console.error('!!! All AI providers failed for summary generation !!!');
            return {
                statusCode: 503,
                body: JSON.stringify({ error: 'All AI providers failed to generate a summary.' })
            };
        }

        // Safe JSON parse — will not crash even if AI returns malformed output
        const result = parseSummaryResponse(aiResponse, filename || 'Document');

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        };

    } catch (err: any) {
        console.error('[CRITICAL] generate-summary error:', err?.message || err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || 'Internal Server Error' })
        };
    }
};

export { handler };
