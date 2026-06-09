import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';

// ─── JSON extraction utility ─────────────────────────────────────────────────
function extractSpark(raw: string): any {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
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
const SYSTEM_PROMPT = `You are a brilliant English Language teacher writing 5-minute "Daily Sparks" — punchy, engaging warm-up activities for an English teacher's morning assembly.

Every single spark MUST teach students something about the English language itself: words, grammar, pronunciation, idioms, etymology, writing, literary devices, spelling, punctuation, or language trivia.

STRICT RULES:
1. Titles must be DIRECT and CLEAR. Good examples: "3 Words Everyone Spells Wrong", "What Does 'Literally' Actually Mean?", "The Oxford Comma: Who Cares?". BANNED: "Unraveling the Mystery of...", "Exploring the Fascinating World of...", "A Journey Into..." — no poetic waffle.
2. If your hook says "3 things", your core content MUST cover ALL 3 things. Never promise items you don't deliver.
3. theCoreContent MUST be bullet-pointed with "•" — not a paragraph. Each bullet is one standalone fact, example, or item.
4. Make examples feel local and relatable to the country specified (e.g. for Nigeria, reference things Nigerian students actually encounter).
5. You ALWAYS output ONLY valid JSON — no markdown fences, no explanatory text.`;

const SPARK_SCHEMA = `The output MUST be a single JSON object with this exact structure:
{
  "category": "string (the category of the spark)",
  "title": "string (Direct, punchy title. No poetic filler. e.g. '3 English Words That Trick Everyone')",
  "theHook": "string (One punchy question or wild fact about English language. MAX 2 sentences. No waffle.)",
  "theCoreContent": "string (Bullet points starting with '• '. If you say '3 words', list ALL 3 words with examples. If you say '5 facts', give ALL 5 facts. No half measures.)",
  "interactiveElement": "string (One specific action students do RIGHT NOW related to the language lesson. Start with an action verb. e.g. 'Turn to your partner and use this word in a sentence.', 'Write down 3 synonyms for...', 'Stand up if you know the difference between...')",
  "funFact": "string (One genuinely surprising English language fact — etymology, grammar trivia, word history. One sentence.)"
}`;

// Topic pools per category (English Language focused)
const TOPIC_POOLS: Record<string, string[]> = {
    'Pronunciation Challenge': [
        'words ending in -ough (though, through, tough, cough)',
        'silent letters: knife, psychology, gnome, wreck',
        'words most people mispronounce: February, espresso, nuclear, quinoa',
        'commonly confused homophones: there/their/they\'re, to/too/two',
        'stress patterns that change meaning: REcord vs reCORD, PREsent vs preSENT',
        'words borrowed from French that English kept: ballet, café, cliché',
        'letters that sound nothing like their name: W, Y, H'
    ],
    'Word of the Day': [
        'a word with a bizarre etymology (e.g. "salary" comes from salt)',
        'a word that is its own opposite — contronyms: sanction, cleave, left',
        'a word with no English equivalent borrowed from another language',
        'a word whose meaning flipped completely over time: awful, nice, silly',
        'a word that entered English from Africa or a Nigerian language',
        'the most commonly misspelled word in the English language',
        'a word that describes a specific feeling (e.g. sonder, petrichor, hiraeth)'
    ],
    'Idioms & Phrases': [
        'idioms about body parts: cold feet, bite your tongue, cost an arm and a leg',
        'idioms about animals: let the cat out of the bag, raining cats and dogs',
        'idioms people use completely wrong: begging the question, for all intents and purposes',
        'where the phrase "break a leg" actually comes from',
        'Nigerian English expressions that surprise British/American speakers',
        'idioms that make no literal sense but everyone understands',
        'phrases that started as Shakespeare quotes we still use today'
    ],
    'Grammar Myth Busted': [
        'never end a sentence with a preposition — is it really a rule?',
        'never split an infinitive: "to boldly go" — right or wrong?',
        'you can start a sentence with But or And — here is why',
        'the Oxford comma debate: why a comma can change a will',
        'singular "they" — is it grammatically correct?',
        'double negatives — when are they correct?',
        'passive voice: when it is the right choice, not just lazy writing'
    ],
    'Spelling Challenge': [
        '5 words that trick even fluent English speakers: necessary, accommodate, occurrence',
        'words where British and American spelling differ: colour/color, travelled/traveled',
        'words with silent letters people forget: Wednesday, receipt, island',
        'the i-before-e rule — and why it fails more than it works',
        'commonly confused spellings: stationary vs stationery, principal vs principle',
        'words with double letters that surprise people: millennium, withhold, Caribbean',
        'words everyone shortens wrong in text: definitely (not definately), separate (not seperate)'
    ],
    'Figures of Speech': [
        'the difference between a simile and a metaphor — with vivid examples',
        'personification in everyday language: "The wind whispered..."',
        'oxymorons people use without realising: deafening silence, bittersweet, living dead',
        'alliteration: why advertisers and politicians love it',
        'irony vs sarcasm — they are NOT the same thing',
        'hyperbole in everyday speech: "I have told you a million times"',
        'onomatopoeia in English: buzz, sizzle, crash — why these words sound like what they mean'
    ],
    'Vocabulary Builder': [
        '5 powerful alternatives to the word "said" in writing',
        '5 alternatives to "very" that make writing stronger',
        'formal vs informal register: the same idea, two different voices',
        'words that sound smart but are overused: utilize, leverage, paradigm',
        'collocations — words that always go together: heavy rain (not strong rain), make a decision',
        'phrasal verbs that change meaning completely: put up with, give up, look after',
        'academic vocabulary every student should know: analyse, evaluate, justify, infer'
    ],
    'Punctuation Spotlight': [
        'the semicolon: the most misunderstood punctuation mark',
        'the apostrophe: three rules, one mark — its vs it\'s explained simply',
        'em dash vs en dash vs hyphen — they are not the same thing',
        'the colon: how to use it and when NOT to',
        'quotation marks: the difference between British and American usage',
        'ellipsis: what three dots actually mean in formal writing',
        'the exclamation mark: why overusing it weakens your writing'
    ],
    'Word Origins (Etymology)': [
        'why the word "muscle" comes from the Latin for little mouse',
        'English words that come from Arabic: algebra, alcohol, sofa, safari',
        'how the word "sandwich" got its name from a gambling Earl',
        'why days of the week are named after Norse gods',
        'English words rooted in Greek mythology we use every day',
        'how "goodbye" evolved from "God be with ye"',
        'the origin of swear words — why they are considered taboo'
    ],
    'Tongue Twister': [
        'the world\'s hardest tongue twister: "pad kid poured curd pulled cod"',
        'classic English tongue twisters and what sounds they train',
        'tongue twisters used by BBC presenters to warm up',
        'how tongue twisters improve articulation and public speaking',
        'creating your own tongue twister — the rules of alliteration and repetition',
        'tongue twisters that specifically target sounds non-native speakers struggle with'
    ],
    '5-Minute Word Game': [
        'a synonym chain game: how many words for "happy" can the class find?',
        'two truths and a lie — language edition: three word definitions, one is made up',
        'a word association speed round: English collocations',
        'a spelling bee with the 10 most commonly misspelled English words',
        'a "finish the idiom" relay — first team to complete 5 wins',
        'back-of-the-book index game: find a word from a definition in 30 seconds',
        'the last-letter game: each student says a word starting with the last letter of the previous word'
    ],
    'Random English Fun': [
        'the longest word in the English language — and what it means',
        'why English has no official regulating body like French does',
        'the difference between a dialect and an accent',
        'how many words are in the English language — and why nobody agrees',
        'words that Shakespeare invented that we still use today',
        'the history of the letter W — why it is called "double U"',
        'why English spelling is so chaotic — the Great Vowel Shift explained simply'
    ],
    "Don't Say This, Say This": [
        '5 common errors involving direct translations from local languages to English',
        '5 common errors with verbs and actions (e.g., using "off/on" instead of "turn off/turn on")',
        '5 common errors involving prepositions (e.g., "congratulations for" instead of "congratulations on")',
        '5 common vocabulary mix-ups (e.g., "borrow" instead of "lend")',
        '5 common redundant phrases people say (e.g., "return back", "repeat again")',
        '5 common misuses of idioms or polite phrases (e.g., "more grease to your elbow")',
        '5 general everyday phrases people say wrong and their correct alternatives'
    ]
};


function pickTopic(category: string, seed: number): string {
    const pool = TOPIC_POOLS[category] || TOPIC_POOLS['Random English Fun'];
    return pool[seed % pool.length];
}

function buildPrompt(category: string, ageGroup: string, country: string, seed: number): string {
    const effectiveCategory = category.toLowerCase() === 'random english fun'
        ? Object.keys(TOPIC_POOLS)[seed % (Object.keys(TOPIC_POOLS).length - 1)]
        : category;

    const topic = pickTopic(effectiveCategory, seed);
    const countryContext = country
        ? `The students are from ${country}. Use examples, words, and references that are relevant and familiar to people from ${country}. Do NOT use examples that are irrelevant or unknown there.`
        : 'Use universally relatable examples.';

    const isDontSay = effectiveCategory === "Don't Say This, Say This";

    const categoryInstructions = isDontSay
        ? `SPECIAL INSTRUCTIONS FOR THIS CATEGORY:
This spark is about common English mistakes people make — especially in everyday Nigerian/African speech — and the correct alternatives.

- The title MUST follow this format: e.g. "5 Things You're Saying Wrong (And What to Say Instead)"
- theHook: Start with a relatable, punchy observation about how even fluent English speakers say certain things wrong every day.
- theCoreContent: Give EXACTLY 5 examples. Format EACH bullet point exactly like this:
  • ❌ Don't say: "[wrong phrase]" → ✅ Say: "[correct phrase]" — [one-sentence explanation of why]
- interactiveElement: Ask students to recall one phrase they (or family members) say wrong and share it with the class.
- funFact: Share a brief, interesting fact about why these errors happen (e.g. influence of local languages, direct translation habits).

The topic gives you a THEME to find examples from — do NOT just use the theme words verbatim. Generate 5 real, specific, everyday examples that fit the theme.`
        : `IMPORTANT: Cover the topic COMPLETELY. If you mention a number (e.g., "3 words"), list ALL of them in bullet points.`;

    return `Create a 5-minute classroom "Spark" for students aged/in: "${ageGroup}".
Category: "${effectiveCategory}"
Specific topic to cover: "${topic}"

${countryContext}

${categoryInstructions}

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
        const { category, ageGroup, country } = JSON.parse(event.body || '{}');

        if (!category || !ageGroup) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing category or ageGroup.' }) };
        }

        const groqKey = process.env.GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const mistralKey = process.env.MISTRAL_API_KEY;

        // Seed based on current time so repeated calls get different topics
        const seed = Math.floor(Date.now() / 1000) % 100;
        const userPrompt = buildPrompt(category, ageGroup, country || '', seed);
        console.log(`[START] Generating Daily Spark: ${category} (${ageGroup}) Country: ${country || 'none'} Seed: ${seed}`);

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
                        temperature: 0.85,
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
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.85 } as any,
                });
                const result = await model.generateContent(SYSTEM_PROMPT + '\n\n' + userPrompt);
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
                    temperature: 0.85,
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
                    temperature: 0.85,
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
