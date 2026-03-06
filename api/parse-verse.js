const { GoogleGenAI } = require("@google/genai");

module.exports = async (req, res) => {
    // CORS 
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        let parsedBody = req.body;
        if (typeof req.body === 'string') {
            try {
                parsedBody = JSON.parse(req.body);
            } catch (e) {
                return res.status(400).json({ error: "Invalid JSON body format" });
            }
        }

        const { pastorMessage } = parsedBody || {};
        if (!pastorMessage) {
            return res.status(400).json({ error: "No message provided" });
        }

        const { GEMINI_API_KEY } = process.env;
        if (!GEMINI_API_KEY) {
            console.error("GEMINI_API_KEY is not defined in environment variables.");
            return res.status(500).json({ error: "Server Configuration Error: API key is not set." });
        }

        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        // Same prompt as server.js
        const prompt = `
You are an AI that extracts Bible verses from a pastor's message and outputs them strictly in JSON format.
The output MUST be a valid JSON object matching the exact format requested, with NO markdown formatting, NO backticks, and NO extra text.

Task:
1. Extract the main Bible verse reference and its Korean text from the provided message.
2. Find the English (NIV) translation for that exact verse.
3. Split BOTH the Korean and English texts into two logical parts (Part 1 and Part 2) according to the verse structure.
4. Replace any line breaks within the parts with the exact string "<br/>"

Expected Output Format:
{
  "ko": {
    "title": "📖 [Book Name in Korean] [Chapter]:[Verse]",
    "part1": "[First half of Korean text]",
    "part2": "[Second half of Korean text]"
  },
  "en": {
    "title": "📖 [Book Name in English] [Chapter]:[Verse]",
    "part1": "[First half of English text (NIV)]",
    "part2": "[Second half of English text (NIV)]"
  }
}

Pastor's Message:
"${pastorMessage}"
`;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        try {
            const jsonResponse = JSON.parse(result.text);
            res.json(jsonResponse);
        } catch (parseError) {
            console.error("Failed to parse AI response as JSON:", result.text);
            res.status(500).json({ error: "AI response formatting error", rawOutput: result.text });
        }

    } catch (error) {
        console.error("Error asking Gemini:", error);
        res.status(500).json({ error: error.message || "Failed to process verse" });
    }
};
