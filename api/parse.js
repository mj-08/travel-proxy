// /api/parse.js
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  try {
    const { prompt } = req.body;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "너는 여행 비서야. 입력된 요청을 JSON으로 변환해." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "TravelRequest",
          schema: {
            type: "object",
            properties: {
              origin: { type: "string" },
              destination: { type: "string" },
              departDate: { type: "string", description: "YYYY-MM-DD" },
              returnDate: { type: "string", description: "YYYY-MM-DD" },
              nights: { type: "integer" },
              adults: { type: "integer" }
            },
            required: ["origin", "destination", "departDate", "returnDate", "adults"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    res.status(200).json(parsed);
  } catch (err) {
    console.error("AI parse error:", err);
    res.status(500).json({ error: "AI 파싱 실패" });
  }
}
