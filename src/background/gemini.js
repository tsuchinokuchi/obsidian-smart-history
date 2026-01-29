export class GeminiClient {
    constructor() { }

    async generateSummary(content, apiKey, modelName = 'gemini-1.5-pro', length = 'short') {
        if (!apiKey) {
            console.warn("Gemini API Key not found.");
            return "No API Key provided.";
        }

        // Sanitize model name (remove 'models/' prefix if present to avoid duplication)
        const cleanModelName = modelName.replace(/^models\//, '');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${apiKey}`;
        console.log("Gemini URL:", url);

        // Truncate content if too long (approx token limit safety)
        const truncatedContent = content.substring(0, 30000);

        let promptInstruction = "この記事の核心となる結論や最も重要な洞察（インサイト）を、1〜2文で鋭くまとめてください。「〜について書かれています」といった説明調は避け、内容そのものを記述してください。";
        if (length === 'medium') {
            promptInstruction = "記事の重要なポイント、論理展開、および独自の視点を3〜5文で抽出してください。単なる概要ではなく、記事のエッセンス（本質）が伝わるようにまとめてください。";
        } else if (length === 'long') {
            promptInstruction = "記事の詳細な要約を作成してください。著者の中心的な主張、それを支える主要な論拠、具体的な事例、および結論を網羅し、読者が元記事を読まなくても本質を深く理解できるようにしてください。";
        }

        const payload = {
            contents: [{
                parts: [{
                    text: `以下のWebページの内容を、日本語で簡潔に要約してください。${promptInstruction}\n\nContent:\n${truncatedContent}`
                }]
            }]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API Error: ${response.status} ${errorText}`);
            }

            const data = await response.json();

            // Extract text from response
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text;
            } else {
                return "No summary generated.";
            }

        } catch (error) {
            console.error("Gemini Request Failed:", error);
            return `Error generating summary: ${error.message}`;
        }
    }
}
