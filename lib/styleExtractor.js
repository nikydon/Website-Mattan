const Anthropic = require('@anthropic-ai/sdk').default;

const client = new Anthropic();

const DESIGN_TOKEN_PROMPT = `You are a web design analyst. Analyze the HTML/CSS of this website and extract its design tokens as a JSON object.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "surface": "#hex",
    "text": "#hex",
    "textMuted": "#hex",
    "border": "#hex"
  },
  "typography": {
    "headingFont": "font-family string",
    "bodyFont": "font-family string",
    "headingWeight": "400|500|600|700|800",
    "baseSize": "16px",
    "lineHeight": "1.5",
    "letterSpacing": "0px",
    "headingLetterSpacing": "0px"
  },
  "spacing": {
    "sectionPadding": "80px",
    "contentMaxWidth": "1200px",
    "elementGap": "24px"
  },
  "style": {
    "borderRadius": "0px",
    "shadowStyle": "none|subtle|medium|dramatic",
    "aesthetic": "one-word descriptor like: minimal, luxurious, bold, playful, elegant, industrial, organic"
  }
}

Extract actual values you see in the CSS/HTML. If you can't determine a value, use reasonable defaults based on the site's overall aesthetic.`;

/**
 * Fetch a URL and return its HTML content (truncated for Claude context).
 */
async function fetchSiteHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MattanStyleBot/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    // Truncate to ~80k chars to fit in Claude context
    return html.slice(0, 80000);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Use Claude to extract design tokens from a website's HTML.
 * Returns parsed design token object.
 */
async function extractDesignTokens(url) {
  const html = await fetchSiteHtml(url);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: DESIGN_TOKEN_PROMPT + '\n\nHere is the website HTML from ' + url + ':\n\n' + html,
      },
    ],
  });

  const text = message.content[0].text.trim();

  // Parse JSON from response (handle potential markdown wrapping)
  let json = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) json = jsonMatch[1].trim();

  return JSON.parse(json);
}

module.exports = { extractDesignTokens, fetchSiteHtml };
