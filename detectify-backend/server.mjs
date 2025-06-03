// server.mjs
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

// Railway will set process.env.PORT; default to 4000 when running locally
const PORT = process.env.PORT || 4000;

// 🔒 Do NOT hard-code your OpenAI key in source. In production, set OPENAI_API_KEY in Railway’s environment variables.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 1) Enable CORS for your Chrome extension origin (and preflight OPTIONS)
app.use(
  cors({
    origin: "chrome-extension://jknhfkdpccpfhdbpkpbmimaampjkdpli",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// 2) Parse JSON bodies
app.use(express.json());

// 3) Handle preflight OPTIONS for all routes:
app.options("*", cors());

// 4) POST /api/factcheck route
app.post("/api/factcheck", async (req, res) => {
  try {
    // If the key is missing, return an error
    if (!OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: "OPENAI_API_KEY environment variable is not set." });
    }

    const { prompt } = req.body;
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "Missing or invalid prompt." });
    }

    // Forward to OpenAI’s chat completion endpoint
    const aiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      }
    );

    const data = await aiResponse.json();
    if (data.error) {
      // If OpenAI returns an error, pass it back
      return res.status(500).json({ error: data.error.message });
    }

    // 5) Ensure the CORS header is set on the JSON response
    res.setHeader(
      "Access-Control-Allow-Origin",
      "chrome-extension://jknhfkdpccpfhdbpkpbmimaampjkdpli"
    );
    return res.json({
      reply: data.choices[0]?.message?.content || "No response.",
    });
  } catch (err) {
    console.error("❌ Server error:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

// 6) Start listening
app.listen(PORT, () => {
  console.log(`✅ Detectify server running on port ${PORT}`);
});
