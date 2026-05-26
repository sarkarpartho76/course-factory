export default async function handler(req, res) {
  // Allow CORS from your own site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'No topic provided' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `You are an expert curriculum designer. Build a detailed free online course for: "${topic}"

Return ONLY valid JSON (no markdown fences, no preamble) with this exact schema:

{
  "description": "2-3 sentence overview of what learners will gain",
  "totalHours": "estimated hours e.g. '40-60 hours'",
  "sections": [
    {
      "id": "section-1",
      "level": "Beginner",
      "title": "Section title",
      "intro": "2-3 sentences describing this section and why it matters",
      "concepts": ["concept1","concept2","concept3","concept4","concept5"],
      "videos": [
        {
          "title": "Real well-known YouTube video title",
          "channel": "Channel name (freeCodeCamp, Traversy Media, Fireship, etc.)",
          "youtubeSearch": "exact search query to find this video on YouTube",
          "duration": "e.g. 1h 20min"
        }
      ],
      "resources": [
        {
          "name": "Resource name",
          "url": "real free URL (official docs, MDN, freeCodeCamp.org, developer docs, etc.)",
          "type": "Docs | Article | Course | Tool | Practice",
          "description": "one short sentence"
        }
      ]
    }
  ]
}

Rules:
- Exactly 3 sections: Beginner, Intermediate, Advanced
- Each section: 3-4 videos, 3-4 resources
- Videos must reference REAL well-known YouTube channels and accurate video titles
- Resources must be real, free, no paywall URLs
- Return only JSON, nothing else`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    const textBlock = data.content?.find(b => b.type === 'text');
    if (!textBlock) return res.status(500).json({ error: 'No response from AI' });

    let raw = textBlock.text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return res.status(500).json({ error: 'Could not parse AI response' });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
