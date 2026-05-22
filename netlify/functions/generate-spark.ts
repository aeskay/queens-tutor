import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';

// ─── JSON extraction utility ─────────────────────────────────────────────────
function extractSpark(raw: string): any {
    const cleaned = raw.replace(/\`\`\`json\s*/gi, '').replace(/\`\`\`\s*/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.title && parsed.theHook && parsed.theCoreContent) {
            return parsed;
        }
    } catch {
        // Fall through
    }

    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        try {
            const obj = JSON.parse(objectMatch[0]);
            if (obj.title && obj.theHook) return obj;
        } catch { /* ignore */ }
    }

    return null;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert educator, a master of classroom engagement, and incredibly charismatic.
You create short, punchy, 5-minute "Sparks" designed to capture students' attention instantly.
You ALWAYS output ONLY valid JSON — no markdown fences, no explanatory text, just the raw JSON.`;

const SPARK_SCHEMA = `The output MUST be a single JSON object with this exact structure:
{
  "category": "string (the category of the spark)",
  "title": "string (A catchy, click-baity title for the lesson)",
  "theHook": "string (A surprising question or statement to grab their attention instantly. 1-2 sentences.)",
  "theCoreContent": "string (The actual lesson, explanation, or instructions. 3-4 sentences max. Keep it incredibly punchy.)",
  "interactiveElement": "string (An action for the students to do right NOW. E.g., 'Turn to your neighbor and...', or 'Stand up if...')",
  "funFact": "string (A bizarre or interesting related fun fact)"
}`;

function buildPrompt(category: string, ageGroup: string): string {
    const topicInstruction = category.toLowerCase() === 'random' 
        ? "Choose a completely random, incredibly fun and surprising topic (it could be a weird etiquette rule, a strange pronunciation, a quick game, or a mind-bending idiom)."
        : `The topic must strictly be about: "${category}".`;

    return `Create a highly engaging 5-minute classroom "Spark" for students in/aged "${ageGroup}".
${topicInstruction}

${SPARK_SCHEMA}

Return ONLY the JSON object.`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const errors: string[] = [];

    try {
        const { category, ageGroup } = JSON.parse(event.body || '{}');

        if (!category || !ageGroup) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing category or ageGroup.' }) };
        }

        const groqKey = process.env.GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const mistralKey = process.env.MISTRAL_API_KEY;

        const userPrompt = buildPrompt(category, ageGroup);
        console.log(`[START] Generating Daily Spark: ${category} (${ageGroup})`);

        let aiResponse: any = null;

        // 1. GROQ
        if (!aiResponse && groqKey && groqKey.startsWith('gsk_')) {
            const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
            for (const model of groqModels) {
                if (aiResponse) break;
                try {
                    console.log(`-> Trying Groq (${model}) for generate-spark...`);
                    const groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 8000 });
                    const response = await groq.chat.completions.create({
                        model,
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: userPrompt },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.9,
                    });
                    const content = response.choices[0].message.content || '';
                    const parsed = extractSpark(content);
                    if (parsed) {
                        aiResponse = parsed;
                        console.log(`-> SUCCESS: Groq/${model}`);
                        break;
                    }
                    errors.push(`Groq/${model}: returned invalid format`);
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
                console.log('-> Trying Gemini for generate-spark...');
                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.9 } as any,
                });
                const result = await model.generateContent(SYSTEM_PROMPT + '\\n\\n' + userPrompt);
                const content = result.response.text();
                const parsed = extractSpark(content);
                if (parsed) {
                    aiResponse = parsed;
                    console.log('-> SUCCESS: Gemini');
                } else {
                    errors.push('Gemini: returned invalid format');
                }
            } catch (err: any) {
                console.error(`-> Gemini failed: ${err.message}`);
                errors.push(`Gemini: ${err.message}`);
            }
        }

        // 3. OPENAI
        if (!aiResponse && openaiKey && openaiKey.startsWith('sk-')) {
            try {
                console.log('-> Trying OpenAI for generate-spark...');
                const openai = new OpenAI({ apiKey: openaiKey, timeout: 8000 });
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.9,
                });
                const content = response.choices[0].message.content || '';
                const parsed = extractSpark(content);
                if (parsed) {
                    aiResponse = parsed;
                    console.log('-> SUCCESS: OpenAI');
                } else {
                    errors.push('OpenAI: returned invalid format');
                }
            } catch (err: any) {
                console.error(`-> OpenAI failed: ${err.message}`);
                errors.push(`OpenAI: ${err.message}`);
            }
        }

        // 4. MISTRAL
        if (!aiResponse && mistralKey) {
            try {
                console.log('-> Trying Mistral for generate-spark...');
                const mistral = new OpenAI({ apiKey: mistralKey, baseURL: 'https://api.mistral.ai/v1', timeout: 10000 });
                const response = await mistral.chat.completions.create({
                    model: 'mistral-small-latest',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.9,
                });
                const content = response.choices[0].message.content || '';
                const parsed = extractSpark(content);
                if (parsed) {
                    aiResponse = parsed;
                    console.log('-> SUCCESS: Mistral');
                } else {
                    errors.push('Mistral: returned invalid format');
                }
            } catch (err: any) {
                console.error(`-> Mistral failed: ${err.message}`);
                errors.push(`Mistral: ${err.message}`);
            }
        }

        if (!aiResponse) {
            console.error('!!! All AI providers failed for generate-spark !!!');
            return {
                statusCode: 503,
                body: JSON.stringify({ error: 'All AI providers failed to generate spark.', details: errors })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiResponse)
        };

    } catch (err: any) {
        console.error('[CRITICAL] generate-spark error:', err?.message || err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || 'Internal Server Error' })
        };
    }
};

export { handler };
