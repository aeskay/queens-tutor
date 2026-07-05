import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';

// ─── JSON extraction utility ─────────────────────────────────────────────────
function extractTextbooks(raw: string): any[] | null {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) return parsed;
        if (parsed.textbooks && Array.isArray(parsed.textbooks)) return parsed.textbooks;
    } catch { /* fall through */ }

    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
        try {
            const arr = JSON.parse(arrMatch[0]);
            if (Array.isArray(arr) && arr[0]?.title) return arr;
        } catch { /* ignore */ }
    }

    return null;
}

// ─── Grade label helper ───────────────────────────────────────────────────────
function getGradeLingo(country: string): string {
    const c = country.toLowerCase();
    if (['united kingdom', 'uk', 'england', 'wales', 'scotland', 'nigeria', 'ghana', 'kenya', 'australia', 'new zealand', 'south africa', 'ireland'].some(x => c.includes(x))) {
        return 'Year';
    }
    if (['india', 'pakistan', 'bangladesh'].some(x => c.includes(x))) {
        return 'Class';
    }
    if (['france'].some(x => c.includes(x))) {
        return 'Classe';
    }
    // Default: Grade (US, Canada, etc.)
    return 'Grade';
}

// ─── Prompts ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert educational curriculum advisor with deep knowledge of internationally recognized school textbooks.
Your task is to recommend REAL, EXISTING textbooks that are freely available online (Open Library, archive.org, OpenStax, publisher free editions).
You MUST output ONLY valid JSON — no markdown fences, no explanatory text, just the raw JSON.
CRITICAL RULES:
- Only suggest textbooks that GENUINELY EXIST and can be found online. Do NOT invent titles, authors, or ISBNs.
- STRONGLY PREFER internationally recognized books: Cambridge, Oxford, OpenStax, Pearson, McGraw-Hill, CK-12, or books on archive.org with real records.
- The student's country tells you their GRADE LEVEL SYSTEM only (e.g. "Year 9" in Nigeria = roughly US Grade 8). Use globally available books appropriate for that grade equivalence.
- Do NOT limit yourself to books published or sold only in the student's country — those are rarely findable online.`;

const SCHEMA = `Return a JSON array of exactly 5 objects:
[
  {
    "title": "Exact textbook title",
    "authors": "Author name(s)",
    "edition": "Edition if known, e.g. '3rd Edition' or 'N/A'",
    "description": "2-3 sentences: what the book covers and why it suits this grade level",
    "curriculumNote": "Why this is appropriate for the grade equivalence (e.g. 'Covers core algebra and geometry suitable for Year 9 / US Grade 8 level')",
    "pdfSearchQuery": "A precise Google search query to find this book as a free PDF or on archive.org, e.g. 'OpenStax Algebra 1 filetype:pdf site:openstax.org'",
    "openLibraryUrl": "Full URL to the book on archive.org or openlibrary.org or openstax.org if you know it exists there, otherwise empty string"
  }
]`;

function buildPrompt(country: string, grade: string, subject: string, extraInfo: string, gradeLingo: string, existingTitles?: string[], textbookName?: string): string {
    const hasExtra = extraInfo.trim().length > 0;
    const extraConstraint = hasExtra
        ? `\n- Specific requirement (MANDATORY — every book MUST address this): "${extraInfo.trim()}"\n  This is not optional background. Tailor ALL 5 recommendations to this constraint.`
        : '';
        
    const exclusionConstraint = existingTitles && existingTitles.length > 0
        ? `\n- DO NOT RECOMMEND any of the following books (the student already has them in their list):\n${existingTitles.map(t => `  * "${t}"`).join('\n')}`
        : '';

    const hasTextbook = textbookName && textbookName.trim().length > 0;
    const textbookConstraint = hasTextbook
        ? `\n- TARGET TEXTBOOK: "${textbookName.trim()}" (CRITICAL: The user is specifically looking for this book. Prioritize finding THIS exact book if it exists as a free PDF. If not, suggest the absolute closest free alternatives.)`
        : '';

    return `Suggest 5 real, freely available textbooks for this student:
- Country: ${country} (use this to understand the grade system only — e.g. "${gradeLingo} ${grade}" in ${country})
- ${gradeLingo}: ${grade}
- Subject: ${subject}${textbookConstraint}${extraConstraint}${exclusionConstraint}

IMPORTANT:
1. Recommend internationally recognized textbooks (Cambridge, Oxford, OpenStax, CK-12, etc.) that are genuinely findable as free PDFs online.
2. Do NOT recommend obscure local books that only exist in print in ${country} — they won't be findable online.
3. Think: what globally respected book covers this subject at this grade level? (e.g. a Nigerian SS2 student studying Physics is roughly equivalent to a 16-year-old — recommend Cambridge IGCSE Physics, OpenStax Physics, etc.)
4. Every book you recommend MUST actually exist. Do not hallucinate titles.
${hasExtra ? '5. CRITICAL: All 5 books MUST directly address the specific requirement stated above. Generic textbooks that do not match that requirement are NOT acceptable.' : ''}
${hasTextbook ? '6. CRITICAL: You must prioritize the Target Textbook provided above. Make it the #1 recommendation if it exists.' : ''}

${SCHEMA}

Return ONLY the JSON array.`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const errors: string[] = [];

    try {
        const { country, grade, subject, extraInfo, existingTitles, textbookName } = JSON.parse(event.body || '{}');

        if (!country || !grade || !subject) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing country, grade, or subject.' }) };
        }

        const gradeLingo = getGradeLingo(country);
        const groqKey = process.env.GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const mistralKey = process.env.MISTRAL_API_KEY;

        const userPrompt = buildPrompt(country, grade, subject, extraInfo || '', gradeLingo, existingTitles, textbookName);
        console.log(`[START] Generating textbook suggestions: ${country} / ${gradeLingo} ${grade} / ${subject}`);

        let aiResponse: any[] | null = null;

        // 1. GROQ
        if (!aiResponse && groqKey && groqKey.startsWith('gsk_')) {
            const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
            for (const model of groqModels) {
                if (aiResponse) break;
                try {
                    console.log(`-> Trying Groq (${model}) for suggest-textbook...`);
                    const groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 10000 });
                    const response = await groq.chat.completions.create({
                        model,
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: userPrompt },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.4,
                    });
                    const content = response.choices[0].message.content || '';
                    const parsed = extractTextbooks(content);
                    if (parsed) {
                        aiResponse = parsed;
                        console.log(`-> SUCCESS: Groq/${model}`);
                    } else {
                        errors.push(`Groq/${model}: returned invalid format`);
                    }
                } catch (err: any) {
                    console.error(`-> Groq/${model} failed: ${err.message}`);
                    errors.push(`Groq/${model}: ${err.message}`);
                }
            }
        }

        // 2. GEMINI
        if (!aiResponse && geminiKey) {
            try {
                console.log('-> Trying Gemini for suggest-textbook...');
                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } as any,
                });
                const result = await model.generateContent(SYSTEM_PROMPT + '\n\n' + userPrompt);
                const content = result.response.text();
                const parsed = extractTextbooks(content);
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
                console.log('-> Trying OpenAI for suggest-textbook...');
                const openai = new OpenAI({ apiKey: openaiKey, timeout: 10000 });
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.4,
                });
                const content = response.choices[0].message.content || '';
                const parsed = extractTextbooks(content);
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
                console.log('-> Trying Mistral for suggest-textbook...');
                const mistral = new OpenAI({ apiKey: mistralKey, baseURL: 'https://api.mistral.ai/v1', timeout: 12000 });
                const response = await mistral.chat.completions.create({
                    model: 'mistral-small-latest',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.4,
                });
                const content = response.choices[0].message.content || '';
                const parsed = extractTextbooks(content);
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
            console.error('!!! All AI providers failed for suggest-textbook !!!');
            return {
                statusCode: 503,
                body: JSON.stringify({ error: 'All AI providers failed to generate textbook suggestions.', details: errors })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ textbooks: aiResponse, gradeLingo })
        };

    } catch (err: any) {
        console.error('[CRITICAL] suggest-textbook error:', err?.message || err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || 'Internal Server Error' })
        };
    }
};

export { handler };
