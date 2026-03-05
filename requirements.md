# Requirements - Podcast Research Application

## Project Overview

A web application that takes a user-provided subject, researches it across the internet using LLMs, and generates a podcast script in the narrative style of Yuval Noah Harari (author of *Sapiens*). Built to demonstrate AI capabilities for Ritta Construction board members.

## Target Audience

- Ritta Construction board members (demo audience)
- General users interested in AI-generated podcast content

---

## Functional Requirements

### FR-1: Subject Input

- User provides a topic/subject via a text input field
- Support for both broad topics ("the history of concrete") and narrow ones ("how Roman aqueducts influenced modern plumbing")
- Input validation: minimum 3 characters, maximum 500 characters

### FR-2: Internet Research Pipeline

- System accepts the subject and dispatches LLM-powered research agents to gather facts
- Research must pull from multiple angles: historical context, scientific data, cultural significance, surprising connections, and counterintuitive insights
- Sources should be tracked and cited
- Research phase should produce a structured research document before script generation begins
- Target: 15-30 distinct facts/insights per subject

### FR-3: Podcast Script Generation

- Generate a podcast script in the style of Yuval Noah Harari:
  - **Big-picture framing**: connect specific topics to grand narratives about humanity
  - **Cross-disciplinary connections**: link biology, history, economics, psychology
  - **Provocative questions**: challenge assumptions the listener holds
  - **Narrative arc**: clear beginning (hook), middle (exploration), end (reframe/conclusion)
  - **Accessible tone**: complex ideas explained simply, no jargon without explanation
  - **Time perspective**: zoom out to thousands of years, then zoom back in
- Script length: configurable, default ~10 minutes of spoken content (~1,500 words)
- Include natural speech markers (pauses, emphasis cues, transitions)

### FR-4: Audio Generation (ElevenLabs)

- Convert the finished podcast script into spoken audio using the ElevenLabs Text-to-Speech API
- **Voice selection**: use a single narrator voice that fits the Harari style — thoughtful, measured, authoritative but warm. Pre-select a suitable ElevenLabs voice (e.g., "Adam" or a custom cloned voice if available). Allow the user to pick from a short curated list.
- **Script-to-speech preprocessing**:
  - Strip markdown formatting before sending to ElevenLabs
  - Convert emphasis cues (e.g., `*pause*`, `[beat]`) into SSML-compatible pauses (`<break time="0.8s"/>`)
  - Split the script into chunks under ElevenLabs' character limit per request (~5,000 chars) to handle long scripts
  - Maintain consistent voice settings across chunks (stability, similarity boost, style)
- **Audio assembly**:
  - Generate audio for each chunk sequentially to preserve narrator continuity
  - Concatenate chunks into a single MP3 file server-side (using ffmpeg or similar)
  - Target output: a single downloadable MP3, ~10 minutes at default script length
- **Streaming playback**:
  - Stream audio chunks to the client as they're generated so the user hears the podcast beginning before the full file is ready
  - Display an inline audio player with play/pause, scrub bar, and download button
  - Show waveform or progress visualization during playback
- **Voice settings** (configurable, sensible defaults):
  - Stability: 0.5 (balanced naturalness)
  - Similarity Boost: 0.75 (stay close to selected voice)
  - Style: 0.3 (subtle expressiveness)
  - Speaker Boost: enabled
- **Cost awareness**: ElevenLabs charges per character. Display estimated character count to the user before generating audio. Allow the user to generate the script first and review it before committing to audio generation.

### FR-5: Output Delivery

- Display the final podcast script in a readable, scrollable format
- Inline audio player for the generated podcast (see FR-4)
- Option to copy script to clipboard
- Option to download script as markdown file
- Option to download audio as MP3
- Display the research sources used with links
- Show total generation time and character count

### FR-7: Thai Language Support

**UI Toggle:**
- Toggle button in the header switches all UI text between English and Thai
- Language preference persists in localStorage across sessions
- All text elements use `data-i18n` attributes for translation lookup
- Translatable elements: header, tagline, section titles, button labels, placeholder text, status messages, voice descriptions, footer, error messages

**Full Thai Pipeline:**
- When Thai is selected, the `lang` parameter is passed to all API endpoints (research, script, audio)
- Research: Claude generates Thai search queries and synthesizes findings in Thai
- Script: Claude writes the entire podcast script in natural, fluent Thai
- Audio: ElevenLabs uses `eleven_multilingual_v2` model for Thai TTS (vs `eleven_monolingual_v1` for English)
- Input sanitization supports Thai characters via Unicode property escapes (`\p{L}\p{N}`)

### FR-6: Progress Visibility

- Show real-time progress of the research, script, and audio generation pipeline
- Display which phase is active (e.g., "Researching historical context...", "Writing script...", "Generating audio 3/7...")
- Show intermediate findings as they arrive
- Show audio generation progress as chunk-by-chunk percentage

---

## Non-Functional Requirements

### NFR-1: Performance

- Research phase: complete within 60 seconds
- Script generation: complete within 30 seconds
- Audio generation: first audio chunk streaming to client within 10 seconds of starting TTS; full MP3 assembled within 90 seconds
- Total end-to-end (research + script + audio): under 3 minutes
- User should hear the podcast beginning within ~2 minutes of submitting their topic

### NFR-2: Reliability

- Graceful error handling if web research returns sparse results
- Fallback to LLM knowledge if internet sources are unavailable
- Retry logic for failed API calls (max 3 retries)

### NFR-3: User Experience

- Clean, professional UI suitable for a board-level demo
- Built with plain HTML/CSS/JS — no build step, no framework, just open `index.html` or run the Express server
- Mobile-responsive design
- No login required for demo purposes

### NFR-4: Security

- API keys stored server-side only, never exposed to client
- Input sanitization on all user-provided text
- Rate limiting to prevent abuse

---

## Technical Stack (Proposed)

| Layer            | Technology                       |
| ---------------- | -------------------------------- |
| Frontend         | Plain HTML / CSS / vanilla JS    |
| Backend          | Node.js with Express             |
| LLM Provider     | Anthropic Claude API             |
| Web Research     | Tavily API or similar search API |
| Text-to-Speech   | ElevenLabs API                   |
| Audio Processing | ffmpeg (server-side chunk concat) |
| Deployment       | Vercel (serverless) + local dev  |

---

## Pipeline Architecture

```
User Input (subject)
    |
    v
[Research Orchestrator Agent]
    |
    +---> [Historical Research Agent]
    +---> [Scientific/Technical Research Agent]
    +---> [Cultural & Human Impact Agent]
    +---> [Surprising Connections Agent]
    |
    v
[Research Synthesizer]
    |
    v
[Podcast Script Writer Agent] (Harari style)
    |
    v
[Script Review & Approval] <--- User reviews script, approves audio generation
    |
    v
[Script Preprocessor] (strip markdown, insert SSML pauses, chunk splitting)
    |
    v
[ElevenLabs TTS Engine] (chunk-by-chunk generation, streaming to client)
    |
    v
[Audio Assembler] (ffmpeg concatenation into single MP3)
    |
    v
[Podcast Player + Download] (inline player, MP3 download, script + sources)
```

---

## Milestones

1. **M1 - Foundation**: Project setup, basic UI with input field, backend API skeleton
2. **M2 - Research Pipeline**: LLM-powered research agents with web search integration
3. **M3 - Script Generation**: Harari-style script generation from research output
4. **M4 - Audio Pipeline**: ElevenLabs integration, chunked TTS, audio assembly, inline player with streaming playback
5. **M5 - Polish**: Progress indicators across all phases, error handling, UI refinement
6. **M6 - Demo Ready**: End-to-end testing, deployment, demo walkthrough prepared

---

## What's Needed to Run

Before starting the app, the following must be provided by the developer:

### API Keys (add to `.env` file — copy from `.env.example`)

| Key | Where to get it | Required for |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | Research + script generation (Claude) |
| `TAVILY_API_KEY` | [app.tavily.com](https://app.tavily.com) (free tier: 1,000 searches/month) | Web research |
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) (free tier: 10,000 chars/month) | Audio generation |

### System Dependencies

| Dependency | Install command | Required for |
| --- | --- | --- |
| Node.js 18+ | [nodejs.org](https://nodejs.org) | Running the server |
| npm packages | `npm install` | Express, Anthropic SDK, etc. |

### Quick Start

```bash
cp .env.example .env        # then fill in your API keys
npm install                  # install dependencies
node server.js               # start the server
# open http://localhost:3000
```
