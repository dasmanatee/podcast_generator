const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

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

const CHUNK_SIZE = 4500; // chars per TTS request (under 5000 limit)

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
  // Strip markdown emphasis markers
  let text = script.replace(/\*([^*]+)\*/g, '$1');

  // Convert [pause] markers to SSML breaks
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

    // Find the last sentence boundary within maxLen
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

// Concatenate MP3 buffers (simple concat — works for same-codec MP3s)
function concatMp3Buffers(buffers) {
  return Buffer.concat(buffers);
}

router.post('/', async (req, res) => {
  const { script, voice, lang } = req.body;
  const isThai = lang === 'th';

  if (!script) {
    return res.status(400).json({ error: 'Script is required.' });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured.' });
  }

  const voiceId = VOICE_MAP[voice] || VOICE_MAP.adam;
  // Use multilingual model for Thai, monolingual for English
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
    // Preprocess and chunk the script
    const processed = preprocessScript(script);
    const chunks = chunkText(processed, CHUNK_SIZE);

    sendEvent({ type: 'progress', chunk: 0, total: chunks.length, text: 'Starting audio generation...' });

    // Generate audio for each chunk sequentially
    const audioBuffers = [];
    for (let i = 0; i < chunks.length; i++) {
      sendEvent({ type: 'progress', chunk: i + 1, total: chunks.length });

      const buffer = await generateChunkAudio(chunks[i], voiceId, modelId);
      audioBuffers.push(buffer);
    }

    // Concatenate into a single MP3
    const finalAudio = concatMp3Buffers(audioBuffers);

    // Save to disk
    const filename = `podcast-${Date.now()}.mp3`;
    const outputDir = path.join(__dirname, '..', '..', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, finalAudio);

    sendEvent({ type: 'complete', url: `/output/${filename}` });
    res.end();
  } catch (err) {
    console.error('Audio generation error:', err);
    sendEvent({ type: 'error', text: err.message || 'Audio generation failed' });
    res.end();
  }
});

module.exports = router;
