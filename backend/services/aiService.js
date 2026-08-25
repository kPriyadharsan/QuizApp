import { GoogleGenerativeAI } from '@google/generative-ai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Main entry point to extract ambiguous question text blocks using the configured AI provider.
 */
export const extractAmbiguousSectionsWithAI = async (text, provider, apiKey, modelName) => {
    if (!apiKey) {
        throw new Error('AI API key is missing. Please define AI_API_KEY in your environment.');
    }

    const aiProvider = (provider || 'gemini').toLowerCase();
    const model = modelName || (aiProvider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');

    console.log(`🤖 Dispatching ambiguous text to AI fallback (Provider: ${aiProvider}, Model: ${model})`);

    const prompt = `You are an expert document parser and data-extraction system.
Your task is to parse unstructured or poorly formatted MCQ question blocks into a strict JSON format.

Return ONLY a valid JSON object matching this schema:
{
  "questions": [
    {
      "sourceNumber": number or null,
      "questionText": "string",
      "options": {
        "A": "string",
        "B": "string",
        "C": "string",
        "D": "string"
      },
      "confidence": number (float between 0.0 and 1.0),
      "warnings": ["string"]
    }
  ]
}

Strict Rules:
1. Never invent or generate a question that is not present in the input text.
2. Never invent or add options that do not exist in the source text.
3. Never invent or guess correct answers.
4. Preserve original wording as closely as possible.
5. Preserve the original question numbering index.
6. Preserve A/B/C/D option assignments exactly.
7. Do not paraphrase questions or options.
8. Do not correct grammar or spelling.
9. Do not solve the questions or try to answer them.
10. Do not infer missing content unless explicitly marked as uncertain in the source text.
11. If the input text is unreadable or gibberish, return it with a warning in the warning array.
12. If an option is missing (e.g. only options A, B, C are provided), do not invent option D. Leave it blank and add a warning.

Ambiguous document sections to parse:
--- START BLOCK ---
${text}
--- END BLOCK ---`;

    if (aiProvider === 'gemini') {
        return callGemini(prompt, apiKey, model);
    } else if (aiProvider === 'openai') {
        return callOpenAI(prompt, apiKey, model);
    } else {
        throw new Error(`Unsupported AI provider: ${aiProvider}`);
    }
};

/**
 * Invokes Google Gemini API
 */
const callGemini = async (prompt, apiKey, modelName) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            responseMimeType: 'application/json'
        }
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    try {
        return JSON.parse(text);
    } catch (parseError) {
        console.error('❌ Failed to parse Gemini response as JSON:', text);
        throw new Error('AI response did not match valid JSON schema format.');
    }
};

/**
 * Invokes OpenAI API (lazily loaded)
 */
const callOpenAI = async (prompt, apiKey, modelName) => {
    let OpenAI;
    try {
        OpenAI = require('openai');
    } catch (err) {
        throw new Error('OpenAI client library is missing. To use OpenAI fallback, please run "npm install openai --save" in the backend directory.');
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
    });

    const text = response.choices[0].message.content;
    try {
        return JSON.parse(text);
    } catch (parseError) {
        console.error('❌ Failed to parse OpenAI response as JSON:', text);
        throw new Error('AI response did not match valid JSON schema format.');
    }
};
