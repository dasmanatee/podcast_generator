import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

// ElevenLabs voice ID mapping
const VOICE_MAP = {
  adam: 'pNInz6obpgDQGcFmaJgB',
  antoni: 'ErXwobaYiN019PkySvjV',
  josh: 'TxGEqnHWrfWFTfGW9XjX',
  arnold: 'VR6AewLTigWG4xSOukaG'
};

const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true
};

const CHUNK_SIZE = 4500;

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

// Preprocess script for TTS
function preprocessScript(script) {
  let text = script.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/\[pause\]/gi, '<break time="0.8s"/>');
  text = text.replace(/\[long pause\]/gi, '<break time="1.5s"/>');
  text = text.replace(/\[beat\]/gi, '<break time="0.5s"/>');
  return text;
}

// Split text into chunks at sentence boundaries
function chunkText(text, maxLen) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let cutoff = maxLen;
    const lastPeriod = remaining.lastIndexOf('. ', cutoff);
    const lastQuestion = remaining.lastIndexOf('? ', cutoff);
    const lastExclaim = remaining.lastIndexOf('! ', cutoff);
    const bestBreak = Math.max(lastPeriod, lastQuestion, lastExclaim);

    if (bestBreak > maxLen * 0.3) {
      cutoff = bestBreak + 1;
    }

    chunks.push(remaining.slice(0, cutoff).trim());
    remaining = remaining.slice(cutoff).trim();
  }

  return chunks;
}

// Call ElevenLabs TTS for a single chunk (with retry)
async function generateChunkAudio(text, voiceId, modelId) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  return withRetry(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: VOICE_SETTINGS
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs API error: ${res.status} ${errText}`);
    }

    return Buffer.from(await res.arrayBuffer());
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { script, voice, lang } = req.body || {};
  const isThai = lang === 'th';

  if (!script) {
    return res.status(400).json({ error: 'Script is required.' });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured.' });
  }

  const voiceId = VOICE_MAP[voice] || VOICE_MAP.adam;
  const modelId = isThai ? 'eleven_multilingual_v2' : 'eleven_monolingual_v1';

  // Set up SSE for progress updates
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function sendEvent(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const processed = preprocessScript(script);
    const chunks = chunkText(processed, CHUNK_SIZE);

    sendEvent({ type: 'progress', chunk: 0, total: chunks.length, text: 'Starting audio generation...' });

    const audioBuffers = [];
    for (let i = 0; i < chunks.length; i++) {
      sendEvent({ type: 'progress', chunk: i + 1, total: chunks.length });
      const buffer = await generateChunkAudio(chunks[i], voiceId, modelId);
      audioBuffers.push(buffer);
    }

    // Concatenate into a single MP3
    const finalAudio = Buffer.concat(audioBuffers);

    // On Vercel, use /tmp for ephemeral storage
    const outputDir = '/tmp';
    const filename = `podcast-${Date.now()}.mp3`;
    const filepath = join(outputDir, filename);
    writeFileSync(filepath, finalAudio);

    // Send the audio as a base64 data URL so the client can play it directly
    // (Vercel /tmp files are not served statically)
    const base64Audio = finalAudio.toString('base64');
    sendEvent({
      type: 'complete',
      audioData: `data:audio/mpeg;base64,${base64Audio}`
    });

    // Clean up temp file
    try { unlinkSync(filepath); } catch (_) {}

    res.end();
  } catch (err) {
    console.error('Audio generation error:', err);
    sendEvent({ type: 'error', text: err.message || 'Audio generation failed' });
    res.end();
  }
}
