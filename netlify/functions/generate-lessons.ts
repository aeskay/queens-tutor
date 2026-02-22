import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Fallback generator that doesn't use AI.
 * It simply divides the syllabus text into the requested number of days.
 */
function generateGenericLessons(text: string, total: number) {
    const lines = text.split('\n').filter(l => l.trim().length > 10).map(l => l.trim());
    const lessons = [];

    for (let i = 1; i <= total; i++) {
        // Pick a line from the syllabus based on progress
        const textIndex = Math.min(Math.floor(((i - 1) / total) * lines.length), lines.length - 1);
        const sourceLine = lines[textIndex] || "Curriculum Introduction";

        lessons.push({
            dayNumber: i,
            topic: sourceLine.length > 50 ? sourceLine.substring(0, 47) + "..." : sourceLine,
            description: `A comprehensive session focusing on: ${sourceLine}. Students will engage in practical exercises and theoretical review.`,
            objective: `Master the core concepts of ${sourceLine.substring(0, 30)} as outlined in the syllabus.`,
            activities: [
                "Detailed syllabus review and discussion",
                "Practical application and group workshops",
                "Progress check and Q&A session"
            ]
        });
    }
    return lessons;
}

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

        // --- 3. TRY GEMINI (FREE TIER) ---
        if (geminiKey) {
            console.log("-> Trying Gemini Fallback...");
            const genAI = new GoogleGenerativeAI(geminiKey);
            const geminiModels = ['gemini-1.5-flash', 'gemini-1.5-pro'];

            for (const modelName of geminiModels) {
                try {
                    console.log(`   - Testing ${modelName}...`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(`Output only a JSON array of exactly ${totalLessons} lesson objects based on this syllabus. Syllabus: ${text.substring(0, 20000)}`);
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
        }

        // --- 4. ULTIMATE FALLBACK: NON-AI TEMPLATE ---
        console.warn("!!! ALL AI PROVIDERS FAILED. USING NON-AI TEMPLATE FALLBACK !!!");
        const fallbackLessons = generateGenericLessons(text, totalLessons);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackLessons)
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
