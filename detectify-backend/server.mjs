import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 4000;

// 🔒 In production, set OPENAI_API_KEY via environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


// 1) Apply CORS so that only your extension ID can call the endpoint:
app.use(
  cors({
    origin: 'chrome-extension://jknhfkdpccpfhdbpkpbmimaampjkdpli',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);

app.use(express.json());

// 2) Preflight OPTIONS handler for any route (named wildcard):
app.options('/*', cors());


// 3) Fact-check route:
app.post('/api/factcheck', async (req, res) => {
  const { prompt } = req.body;

  try {
    // Call OpenAI’s Chat Completions API
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const data = await aiResponse.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    // 4) Double-check: Re-add CORS header on the actual response
    //    (some hosting platforms strip default headers)
    res.setHeader(
      'Access-Control-Allow-Origin',
      'chrome-extension://jknhfkdpccpfhdbpkpbmimaampjkdpli'
    );

    return res.json({
      reply: data.choices?.[0]?.message?.content || 'No response.'
    });
  } catch (err) {
    console.error('❌ Server error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Detectify server running on port ${PORT}`);
});
