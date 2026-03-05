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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, research, lang, styleGuide } = req.body || {};
  const isThai = lang === 'th';

  if (!subject) {
    return res.status(400).json({ error: 'Subject is required.' });
  }

  if (!research) {
    return res.status(400).json({ error: 'Research data is required.' });
  }

  const researchText = research.research || JSON.stringify(research);

  const langInstruction = isThai
    ? `\n\nIMPORTANT: Write the ENTIRE script in Thai (ภาษาไทย). The narrator speaks Thai. All prose, rhetorical questions, and conclusions must be in natural, fluent Thai. Do not mix in English unless quoting a proper noun.`
    : '';

  try {
    const response = await withRetry(() =>
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: `You are a world-class podcast script writer.

Write a ~1,500 word podcast script (~10 minutes spoken) about: "${subject}"

Use this research as your factual foundation:

${researchText}

${styleGuide ? `STYLE GUIDELINES (from uploaded style guide):\n${styleGuide}` : `STYLE GUIDELINES:
- Open with a surprising, counterintuitive hook that reframes how the listener thinks about the topic
- Zoom out to the grand sweep of human history, then zoom back in to the specific
- Make unexpected cross-disciplinary connections (biology + economics, psychology + technology, etc.)
- Ask provocative rhetorical questions that challenge the listener's assumptions
- Use concrete, vivid examples and specific numbers/dates — never be vague
- Explain complex ideas with simple, memorable analogies
- Build a clear narrative arc: hook → exploration → surprising twist → reframing conclusion
- End by leaving the listener with a thought they can't shake`}

FORMATTING:
- Write as natural spoken text — this will be read aloud by a narrator
- Use [pause] for dramatic pauses (will become audio breaks)
- Use *emphasis* for words the narrator should stress
- Do NOT use headers, bullet points, or markdown structure — just flowing prose paragraphs
- Do NOT include "[Podcast title]" or "[Music plays]" or stage directions — just the narrator's words

The script should feel like listening to a brilliant friend explain something fascinating over coffee. Intellectual but never academic. Profound but never pretentious.${langInstruction}`
        }]
      })
    );

    const script = response.content[0].text;

    res.json({
      script,
      sources: research.sources || [],
      wordCount: script.split(/\s+/).length,
      charCount: script.length
    });
  } catch (err) {
    console.error('Script generation error:', err);
    res.status(500).json({ error: err.message || 'Script generation failed' });
  }
}
