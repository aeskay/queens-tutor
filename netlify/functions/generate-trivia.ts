import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';

// ─── JSON extraction utility ─────────────────────────────────────────────────
function extractTrivia(raw: string): any {
    const cleaned = raw.replace(/\`\`\`json\s*/gi, '').replace(/\`\`\`\s*/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.topic && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            return parsed;
        }
    } catch {
        // Fall through
    }

    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        try {
            const obj = JSON.parse(objectMatch[0]);
            if (obj.topic && Array.isArray(obj.questions)) return obj;
        } catch { /* ignore */ }
    }

    return null;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert game show host and educator creating engaging trivia games for students.
You ALWAYS output ONLY valid JSON — no markdown fences, no explanatory text, just the raw JSON.`;

const TRIVIA_SCHEMA = `The output MUST be a single JSON object with this exact structure:
{
  "topic": "string (the topic being tested)",
  "questions": [
    {
      "question": "string (the trivia question)",
      "options": ["string", "string", "string", "string"], // Exactly 4 options
      "correctAnswer": "string (must exactly match one of the options)",
      "funFact": "string (a fun, short 1-2 sentence fact about the answer)"
    }
  ]
}`;

function buildPrompt(topic: string, ageGroup: string): string {
    return `Generate an interactive trivia game about "${topic}" for students in/aged "${ageGroup}".
Generate exactly 10 questions. Make them engaging, age-appropriate, and not boring.

${TRIVIA_SCHEMA}

Return ONLY the JSON object.`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const errors: string[] = [];

    try {
        const { topic, ageGroup } = JSON.parse(event.body || '{}');

        if (!topic || !ageGroup) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing topic or ageGroup.' }) };
        }

        const groqKey = process.env.GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const mistralKey = process.env.MISTRAL_API_KEY;

        const userPrompt = buildPrompt(topic, ageGroup);
        console.log(`[START] Generating trivia for: ${topic} (${ageGroup})`);

        let aiResponse: any = null;

        // 1. GROQ
        if (!aiResponse && groqKey && groqKey.startsWith('gsk_')) {
            const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
            for (const model of groqModels) {
                if (aiResponse) break;
                try {
                    console.log(`-> Trying Groq (${model}) for generate-trivia...`);
                    const groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 8000 });
                    const response = await groq.chat.completions.create({
                        model,
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: userPrompt },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.8,
                    });
                    const content = response.choices[0].message.content || '';
                    const parsed = extractTrivia(content);
                    if (parsed) {
                        aiResponse = parsed;
                        console.log(`-> SUCCESS: Groq/${model}`);
                        break;
                    }
                    errors.push(`Groq/${model}: returned invalid trivia format`);
                } catch (err: any) {
                    console.error(`-> Groq/${model} failed: ${err.message}`);
                    if (err.message.includes('decommissioned')) continue;
                    errors.push(`Groq/${model}: ${err.message}`);
                }
            }
        }

        // 2. GEMINI
        if (!aiResponse && geminiKey) {
            try {
                console.log('-> Trying Gemini for generate-trivia...');
                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.8 } as any,
                });
                const result = await model.generateContent(SYSTEM_PROMPT + '\\n\\n' + userPrompt);
                const content = result.response.text();
                const parsed = extractTrivia(content);
                if (parsed) {
                    aiResponse = parsed;
                    console.log('-> SUCCESS: Gemini');
                } else {
                    errors.push('Gemini: returned invalid trivia format');
                }
            } catch (err: any) {
                console.error(`-> Gemini failed: ${err.message}`);
                errors.push(`Gemini: ${err.message}`);
            }
        }

        // 3. OPENAI
        if (!aiResponse && openaiKey && openaiKey.startsWith('sk-')) {
            try {
                console.log('-> Trying OpenAI for generate-trivia...');
                const openai = new OpenAI({ apiKey: openaiKey, timeout: 8000 });
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.8,
                });
                const content = response.choices[0].message.content || '';
                const parsed = extractTrivia(content);
                if (parsed) {
                    aiResponse = parsed;
                    console.log('-> SUCCESS: OpenAI');
                } else {
                    errors.push('OpenAI: returned invalid trivia format');
                }
            } catch (err: any) {
                console.error(`-> OpenAI failed: ${err.message}`);
                errors.push(`OpenAI: ${err.message}`);
            }
        }

        // 4. MISTRAL
        if (!aiResponse && mistralKey) {
            try {
                console.log('-> Trying Mistral for generate-trivia...');
                const mistral = new OpenAI({ apiKey: mistralKey, baseURL: 'https://api.mistral.ai/v1', timeout: 10000 });
                const response = await mistral.chat.completions.create({
                    model: 'mistral-small-latest',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.8,
                });
                const content = response.choices[0].message.content || '';
                const parsed = extractTrivia(content);
                if (parsed) {
                    aiResponse = parsed;
                    console.log('-> SUCCESS: Mistral');
                } else {
                    errors.push('Mistral: returned invalid trivia format');
                }
            } catch (err: any) {
                console.error(`-> Mistral failed: ${err.message}`);
                errors.push(`Mistral: ${err.message}`);
            }
        }

        if (!aiResponse) {
            console.error('!!! All AI providers failed for generate-trivia !!!');
            return {
                statusCode: 503,
                body: JSON.stringify({ error: 'All AI providers failed to generate trivia.', details: errors })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiResponse)
        };

    } catch (err: any) {
        console.error('[CRITICAL] generate-trivia error:', err?.message || err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || 'Internal Server Error' })
        };
    }
};

export { handler };
