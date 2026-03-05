import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Retry wrapper with exponential backoff
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Tavily search helper
async function tavilySearch(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: 8,
      include_answer: true
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily search failed: ${res.status} ${text}`);
  }

  return await res.json();
}

// Sanitize input: strip HTML tags, limit special chars
function sanitizeSubject(subject) {
  return subject
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s\-.,!?'"()&:;/\\@#$%+=\[\]{}~`]/gu, '')
    .trim();
}

// In-memory rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  let { subject, lang, styleGuide } = req.body || {};
  const isThai = lang === 'th';

  if (!subject || subject.length < 3) {
    return res.status(400).json({ error: 'Subject must be at least 3 characters.' });
  }

  if (subject.length > 500) {
    return res.status(400).json({ error: 'Subject must be under 500 characters.' });
  }

  // Sanitize input
  subject = sanitizeSubject(subject);
  if (subject.length < 3) {
    return res.status(400).json({ error: 'Subject must be at least 3 characters after sanitization.' });
  }

  // Set up SSE for live findings
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function sendEvent(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    // Step 1: Generate search queries
    sendEvent({ type: 'status', text: 'Planning research angles...' });

    const langInstruction = isThai
      ? `Generate the queries in Thai where appropriate for better Thai-language results. Return your response in Thai.`
      : '';

    const queryResponse = await withRetry(() =>
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `I need to research "${subject}" for a podcast. Generate 4 focused web search queries, one for each angle:
1. Historical context and origins
2. Scientific/technical facts and data
3. Cultural significance and human impact
4. Surprising connections and counterintuitive insights

${langInstruction}

Return ONLY a JSON array of 4 strings, no other text. Example: ["query1", "query2", "query3", "query4"]`
        }]
      })
    );

    let queries;
    try {
      const text = queryResponse.content[0].text.trim();
      const match = text.match(/\[[\s\S]*\]/);
      queries = JSON.parse(match ? match[0] : text);
    } catch (e) {
      queries = [
        `${subject} history origins`,
        `${subject} science facts data`,
        `${subject} cultural impact society`,
        `${subject} surprising facts counterintuitive`
      ];
    }

    const angleNames = [
      'Historical context',
      'Scientific & technical',
      'Cultural & human impact',
      'Surprising connections'
    ];

    // Step 2: Run all 4 Tavily searches in parallel (with retry)
    sendEvent({ type: 'status', text: 'Searching the web from 4 angles...' });

    const searchResults = await Promise.allSettled(
      queries.map(q => withRetry(() => tavilySearch(q)))
    );

    const allSources = [];
    const allContent = [];

    searchResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        sendEvent({ type: 'finding', text: `${angleNames[i]}: Found ${data.results?.length || 0} sources` });

        if (data.results) {
          data.results.forEach(r => {
            allSources.push({ title: r.title, url: r.url });
            allContent.push(`[${angleNames[i]}] ${r.title}: ${r.content}`);
          });
        }
        if (data.answer) {
          allContent.push(`[${angleNames[i]} summary] ${data.answer}`);
        }
      } else {
        sendEvent({ type: 'finding', text: `${angleNames[i]}: Search failed, will use AI knowledge` });
      }
    });

    // Step 3: Synthesize research with Claude (with retry)
    sendEvent({ type: 'status', text: 'Synthesizing research findings...' });

    const synthesisPrompt = allContent.length > 0
      ? `You are a research assistant preparing material for a podcast about "${subject}".

Here are raw findings from web research:

${allContent.join('\n\n')}

Synthesize these into a structured research document with 15-30 distinct facts/insights organized by:
1. **Historical Context** — origins, evolution, key dates and figures
2. **Scientific/Technical Facts** — data, mechanisms, how things work
3. **Cultural & Human Impact** — how this affects people, societies, economies
4. **Surprising Connections** — counterintuitive links, unexpected parallels, mind-blowing facts

For each fact, note which source it came from if known. Focus on the most interesting, podcast-worthy insights. Be specific with numbers, dates, and names.${styleGuide ? `\n\nADDITIONAL STYLE CONTEXT (shape research to support this writing style):\n${styleGuide}` : ''}${isThai ? '\n\nIMPORTANT: Write the entire research document in Thai (ภาษาไทย). All facts, insights, and analysis should be in Thai.' : ''}`
      : `You are a research assistant preparing material for a podcast about "${subject}".

No web sources were available, so use your own knowledge. Create a structured research document with 15-30 distinct facts/insights organized by:
1. **Historical Context** — origins, evolution, key dates and figures
2. **Scientific/Technical Facts** — data, mechanisms, how things work
3. **Cultural & Human Impact** — how this affects people, societies, economies
4. **Surprising Connections** — counterintuitive links, unexpected parallels, mind-blowing facts

Be specific with numbers, dates, and names. Focus on the most interesting, podcast-worthy insights.${styleGuide ? `\n\nADDITIONAL STYLE CONTEXT (shape research to support this writing style):\n${styleGuide}` : ''}${isThai ? '\n\nIMPORTANT: Write the entire research document in Thai (ภาษาไทย). All facts, insights, and analysis should be in Thai.' : ''}`;

    const synthesisResponse = await withRetry(() =>
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: synthesisPrompt }]
      })
    );

    const research = synthesisResponse.content[0].text;

    // Send individual findings to the feed
    const lines = research.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'));
    for (const line of lines.slice(0, 10)) {
      const clean = line.replace(/^[\s\-\*]+/, '').trim();
      if (clean.length > 10) {
        sendEvent({ type: 'finding', text: clean.slice(0, 150) });
      }
    }

    // Deduplicate sources
    const uniqueSources = [];
    const seenUrls = new Set();
    for (const s of allSources) {
      if (s.url && !seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        uniqueSources.push(s);
      }
    }

    sendEvent({
      type: 'complete',
      result: {
        research,
        sources: uniqueSources.slice(0, 15)
      }
    });

    res.end();
  } catch (err) {
    console.error('Research error:', err);
    sendEvent({ type: 'error', text: err.message || 'Research failed' });
    res.end();
  }
}
