import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';

// ─── JSON extraction utility ─────────────────────────────────────────────────
function extractStory(raw: string): any {
    const cleaned = raw.replace(/\`\`\`json\s*/gi, '').replace(/\`\`\`\s*/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.title && Array.isArray(parsed.paragraphs) && parsed.paragraphs.length > 0) {
            return parsed;
        }
    } catch {
        // Fall through
    }

    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        try {
            const obj = JSON.parse(objectMatch[0]);
            if (obj.title && Array.isArray(obj.paragraphs)) return obj;
        } catch { /* ignore */ }
    }

    return null;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert children's book author and educator creating immersive, fun, and educational stories.
You ALWAYS output ONLY valid JSON — no markdown fences, no explanatory text, just the raw JSON.`;

const STORY_SCHEMA = `The output MUST be a single JSON object with this exact structure:
{
  "title": "string (A creative and catchy title for the story)",
  "topic": "string (the educational topic covered)",
  "paragraphs": ["string", "string", "string"], // An array of strings. Each string is a paragraph. Generate 4 to 6 paragraphs.
  "moralOrFact": "string (A key takeaway, fun fact, or moral of the story, 1-2 sentences)",
  "questions": [ // Generate exactly 3 multiple-choice comprehension questions testing BOTH story comprehension AND the specific lesson focus. Only include this field if lessonFocus was provided.
    {
      "question": "string (The question)",
      "options": ["string", "string", "string", "string"], // Exactly 4 choices
      "correctAnswer": "string (The exact correct option)",
      "explanation": "string (A child-friendly explanation of why this answer is correct, referencing the lesson focus or story)"
    }
  ]
}`;

function buildPrompt(topic: string, studentName: string, ageGroup: string, setting?: string, lessonFocus?: string): string {
    const settingText = setting ? `The story MUST take place in the setting: "${setting}".` : `You may choose a creative setting suitable for the topic.`;
    const focusText = lessonFocus 
        ? `Additionally, you MUST use the story to teach a specific lesson: "${lessonFocus}" (e.g. metaphors, hyperbole, a grammatical rule, or vocabulary).
           Insert examples of this lesson creatively and naturally into the story paragraphs. Do not oversaturate, but make sure they are clear.
           Also, you MUST generate the "questions" array in the schema containing exactly 3 comprehension questions testing this lesson concept as taught in the story.`
        : `Do not include the "questions" field in your JSON output.`;

    return `Write an engaging and educational short story about "${topic}" for a reader in/aged "${ageGroup}".
The main character of the story MUST be named "${studentName}".
${settingText}
${focusText}
The story should be 4 to 6 paragraphs long, fun, imaginative, and subtly educational without being boring.

${STORY_SCHEMA}

Return ONLY the JSON object.`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const errors: string[] = [];

    try {
        const { topic, studentName, ageGroup, setting, lessonFocus } = JSON.parse(event.body || '{}');

        if (!topic || !studentName || !ageGroup) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing topic, studentName, or ageGroup.' }) };
        }

        const groqKey = process.env.GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const mistralKey = process.env.MISTRAL_API_KEY;

        const userPrompt = buildPrompt(topic, studentName, ageGroup, setting, lessonFocus);
        console.log(`[START] Generating story for: ${studentName} about ${topic} (${ageGroup})`);

        let aiResponse: any = null;

        // 1. GROQ
        if (!aiResponse && groqKey && groqKey.startsWith('gsk_')) {
            const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
            for (const model of groqModels) {
                if (aiResponse) break;
                try {
                    console.log(`-> Trying Groq (${model}) for generate-story...`);
                    const groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 10000 });
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
                    const parsed = extractStory(content);
                    if (parsed) {
                        aiResponse = parsed;
                        console.log(`-> SUCCESS: Groq/${model}`);
                        break;
                    }
                    errors.push(`Groq/${model}: returned invalid story format`);
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
                console.log('-> Trying Gemini for generate-story...');
                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.8 } as any,
                });
                const result = await model.generateContent(SYSTEM_PROMPT + '\\n\\n' + userPrompt);
                const content = result.response.text();
                const parsed = extractStory(content);
                if (parsed) {
                    aiResponse = parsed;
                    console.log('-> SUCCESS: Gemini');
                } else {
                    errors.push('Gemini: returned invalid story format');
                }
            } catch (err: any) {
                console.error(`-> Gemini failed: ${err.message}`);
                errors.push(`Gemini: ${err.message}`);
            }
        }

        // 3. OPENAI
        if (!aiResponse && openaiKey && openaiKey.startsWith('sk-')) {
            try {
                console.log('-> Trying OpenAI for generate-story...');
                const openai = new OpenAI({ apiKey: openaiKey, timeout: 10000 });
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
                const parsed = extractStory(content);
                if (parsed) {
                    aiResponse = parsed;
                    console.log('-> SUCCESS: OpenAI');
                } else {
                    errors.push('OpenAI: returned invalid story format');
                }
            } catch (err: any) {
                console.error(`-> OpenAI failed: ${err.message}`);
                errors.push(`OpenAI: ${err.message}`);
            }
        }

        // 4. MISTRAL
        if (!aiResponse && mistralKey) {
            try {
                console.log('-> Trying Mistral for generate-story...');
                const mistral = new OpenAI({ apiKey: mistralKey, baseURL: 'https://api.mistral.ai/v1', timeout: 12000 });
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
                const parsed = extractStory(content);
                if (parsed) {
                    aiResponse = parsed;
                    console.log('-> SUCCESS: Mistral');
                } else {
                    errors.push('Mistral: returned invalid story format');
                }
            } catch (err: any) {
                console.error(`-> Mistral failed: ${err.message}`);
                errors.push(`Mistral: ${err.message}`);
            }
        }

        if (!aiResponse) {
            console.error('!!! All AI providers failed for generate-story !!!');
            return {
                statusCode: 503,
                body: JSON.stringify({ error: 'All AI providers failed to generate story.', details: errors })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiResponse)
        };

    } catch (err: any) {
        console.error('[CRITICAL] generate-story error:', err?.message || err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || 'Internal Server Error' })
        };
    }
};

export { handler };
