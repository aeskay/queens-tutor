import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Enhanced Fallback generator that doesn't use AI but is "smarter".
 * Matches syllabus text to pedagogical categories.
 */
function generateGenericLessons(text: string, total: number) {
    const lines = text.split('\n').filter(l => l.trim().length > 10).map(l => l.trim());
    const lessons = [];

    // Simple category detector
    const categories: Record<string, string[]> = {
        grammar: ["Tense Review", "Sentence Structure", "Punctuation Mastery", "Grammatical Accuracy"],
        vocabulary: ["Expanding Lexicon", "Idiomatic Expressions", "Contextual Meaning", "Word Choice"],
        business: ["Formal Communication", "Professional Email Writing", "Presentation Skills", "Meeting Etiquette"],
        phonics: ["Vowel Sounds", "Consonant Blends", "Pronunciation Workshop", "Intonation & Rhythm"]
    };

    for (let i = 1; i <= total; i++) {
        const textIndex = Math.min(Math.floor(((i - 1) / total) * lines.length), lines.length - 1);
        const sourceLine = lines[textIndex] || "English Language Proficiency";

        // Detect category or default to 'General'
        let categoryKey = 'grammar';
        const lowerLine = sourceLine.toLowerCase();
        if (lowerLine.includes('business') || lowerLine.includes('work')) categoryKey = 'business';
        else if (lowerLine.includes('sound') || lowerLine.includes('speak')) categoryKey = 'phonics';
        else if (lowerLine.includes('word') || lowerLine.includes('vocab')) categoryKey = 'vocabulary';

        const categoryWorkshops = categories[categoryKey] || categories.grammar;
        const workshop = categoryWorkshops[(i - 1) % categoryWorkshops.length];

        lessons.push({
            dayNumber: i,
            topicTitle: sourceLine.length > 50 ? sourceLine.substring(0, 47) + "..." : sourceLine,
            fiveMinuteSummary: `A comprehensive session focusing on ${sourceLine}. This module bridges the gap between theoretical knowledge and practical application using the ${workshop} framework.`,
            kidFriendlyExamples: [
                `${workshop}: Hands-on workshop focusing on practical usage.`,
                "Interactive peer-review and feedback sessions.",
                "Real-world application exercises based on syllabus requirements."
            ],
            quiz: {
                questions: [
                    {
                        question: `Which core aspect of ${sourceLine.substring(0, 20)} was emphasized today?`,
                        options: [workshop, "General Overview", "Casual Conversation", "Theoretical History"],
                        correctAnswer: workshop
                    }
                ]
            }
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
        const groqKey = process.env.GROQ_API_KEY;
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

        // --- 2. TRY GROQ (HIGH-SPEED FALLBACK) ---
        if (groqKey) {
            try {
                console.log("-> Trying Groq (llama-3.3-70b-versatile)...");
                const groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
                const response = await groq.chat.completions.create({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: 'You are an expert UK English Teacher. Output ONLY valid JSON.' },
                        { role: 'user', content: `Generate a ${totalLessons}-day lesson plan in JSON array format for: ${text.substring(0, 15000)}` }
                    ],
                    response_format: { type: 'json_object' }
                });
                const content = response.choices[0].message.content || '[]';
                console.log("-> SUCCESS: Groq");
                return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: content };
            } catch (err: any) {
                console.error(`-> Groq Failed: ${err.message}`);
                errors.push(`Groq: ${err.message}`);
            }
        }

        // --- 3. TRY DEEPSEEK ---
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

        // --- 4. TRY GEMINI (REFINED MODEL STRINGS) ---
        if (geminiKey) {
            console.log("-> Trying Gemini Fallback (Standardized)...");
            const genAI = new GoogleGenerativeAI(geminiKey);
            // Using -latest and standard identifiers to avoid 404s
            const geminiModels = ['gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-1.5-pro-latest'];

            for (const modelName of geminiModels) {
                try {
                    console.log(`   - Testing ${modelName}...`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(`Output only a JSON array of exactly ${totalLessons} lesson objects based on this syllabus. Each object must have: topicTitle, fiveMinuteSummary, kidFriendlyExamples, and quiz. Syllabus: ${text.substring(0, 20000)}`);
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

        // --- 5. ULTIMATE FALLBACK: IMPROVED NON-AI TEMPLATE ---
        console.warn("!!! ALL AI PROVIDERS FAILED. USING SMART TEMPLATE FALLBACK !!!");
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
