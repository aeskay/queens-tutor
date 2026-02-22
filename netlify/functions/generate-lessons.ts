import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const errors: string[] = [];

    try {
        const { text, totalLessons = 20 } = JSON.parse(event.body || '{}');
        if (!text) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing text content' }) };
        }

        const openaiKey = process.env.OPENAI_API_KEY;
        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        console.log(`[START] Generating ${totalLessons} lessons. Text length: ${text.length}`);

        // --- 1. TRY OPENAI (PRIORITY) ---
        if (openaiKey && openaiKey.startsWith('sk-')) {
            try {
                console.log("-> Trying OpenAI (gpt-4o-mini)...");
                const openai = new OpenAI({ apiKey: openaiKey });
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are an expert UK English Teacher. Output only a JSON array of lesson objects.' },
                        { role: 'user', content: `Generate a JSON array of exactly ${totalLessons} lesson objects for this syllabus: ${text.substring(0, 30000)}` }
                    ],
                    response_format: { type: 'json_object' }
                });
                let content = response.choices[0].message.content || '[]';
                try {
                    const parsed = JSON.parse(content);
                    const keys = Object.keys(parsed);
                    if (!Array.isArray(parsed) && keys.length === 1 && Array.isArray(parsed[keys[0]])) {
                        content = JSON.stringify(parsed[keys[0]]);
                    }
                } catch (e) { }
                console.log("-> SUCCESS: OpenAI");
                return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: content };
            } catch (err: any) {
                console.error(`-> OpenAI Failed: ${err.message}`);
                errors.push(`OpenAI: ${err.message}`);
            }
        }

        // --- 2. TRY DEEPSEEK ---
        if (deepseekKey && deepseekKey.startsWith('sk-')) {
            try {
                console.log("-> Trying DeepSeek (deepseek-chat)...");
                const ds = new OpenAI({ apiKey: deepseekKey, baseURL: 'https://api.deepseek.com' });
                const response = await ds.chat.completions.create({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant that outputs only JSON.' },
                        { role: 'user', content: `Generate a ${totalLessons}-day lesson plan in JSON. Text: ${text.substring(0, 30000)}` }
                    ],
                    response_format: { type: 'json_object' }
                });
                const content = response.choices[0].message.content || '[]';
                console.log("-> SUCCESS: DeepSeek");
                return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: content };
            } catch (err: any) {
                console.error(`-> DeepSeek Failed: ${err.message}`);
                errors.push(`DeepSeek: ${err.message}`);
            }
        }

        // --- 3. TRY GEMINI (FREE TIER WORKAROUND) ---
        if (geminiKey) {
            console.log("-> Trying Gemini Fallback with verbose logging...");
            const genAI = new GoogleGenerativeAI(geminiKey);
            // These are the most stable "Free Tier" model IDs
            const geminiModels = [
                'gemini-1.5-flash',
                'gemini-1.5-flash-8b',
                'gemini-1.0-pro'
            ];

            for (const modelName of geminiModels) {
                try {
                    console.log(`   - Testing ${modelName}...`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(`Output only a JSON array of exactly ${totalLessons} lesson objects based on this syllabus. Topic and details must be included. Syllabus: ${text.substring(0, 20000)}`);
                    const response = await result.response;
                    const responseText = response.text();

                    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                    const cleanJson = jsonMatch ? jsonMatch[0] : responseText;

                    console.log(`-> SUCCESS: Gemini (${modelName})`);
                    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: cleanJson };
                } catch (geminiErr: any) {
                    console.error(`   - ${modelName} failed: ${geminiErr.message}`);
                    errors.push(`Gemini (${modelName}): ${geminiErr.message}`);
                }
            }
        } else {
            errors.push("Gemini: Key not found in .env");
        }

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'All AI providers failed. Your accounts may need billing setup or credits.',
                details: errors
            }),
        };

    } catch (error: any) {
        console.error('[CRITICAL ERROR]', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message, details: errors }),
        };
    }
};

export { handler };
