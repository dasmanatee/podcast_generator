require('dotenv').config();
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const researchRoute = require('./server/routes/research');
const scriptRoute = require('./server/routes/script');
const audioRoute = require('./server/routes/audio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting (NFR-4 / SEC-06)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a minute.' }
});
app.use('/api/', apiLimiter);

// Serve generated audio files
app.use('/output', express.static(path.join(__dirname, 'output')));

// API routes
app.use('/api/research', researchRoute);
app.use('/api/script', scriptRoute);
app.use('/api/audio', audioRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start
app.listen(PORT, () => {
  console.log(`Podcast Research Studio running at http://localhost:${PORT}`);
  console.log('');
  console.log('API keys configured:');
  console.log('  ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'yes' : 'MISSING');
  console.log('  TAVILY_API_KEY:   ', process.env.TAVILY_API_KEY ? 'yes' : 'MISSING');
  console.log('  ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? 'yes' : 'MISSING');
});
