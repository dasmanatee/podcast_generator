# Checkride — Pre-Launch Test Suite

Full deterministic test coverage for the Podcast Research Studio application.
Run every test below and confirm PASS before launch.

> **Convention**: Each test has an ID, the function/area it covers, exact steps, and the expected result. Tests are grouped by the source file and functional area they exercise. Every branch, error path, and UI state transition in the codebase is represented.

---

## 0. Environment & Setup

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| ENV-01 | Static file serving | Start Express server, navigate to `http://localhost:3000` | `index.html` loads, styles.css applied (dark background `#0f1117`), app.js executes without console errors |
| ENV-02 | Asset loading | Open DevTools Network tab, reload page | All 3 files load 200 OK: `index.html`, `styles.css`, `app.js` |
| ENV-03 | No external dependencies | Disconnect from internet, reload page | App loads fully from local files, no broken CDN requests |

---

## 1. Input Validation (`app.js` lines 64–96)

### 1.1 Character counter (lines 64–74)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| INP-01 | Counter updates on keypress | Type "abc" into subject input | `char-count` reads `3 / 500` |
| INP-02 | Counter at zero | Clear input field | `char-count` reads `0 / 500` |
| INP-03 | Counter at max | Paste a 500-character string | `char-count` reads `500 / 500` |
| INP-04 | Error shown for 1–2 chars | Type "ab" | `input-error` reads "Subject must be at least 3 characters.", input has class `invalid` |
| INP-05 | Error clears at 3 chars | Type "abc" | `input-error` is empty string, input does NOT have class `invalid` |
| INP-06 | Error clears at 0 chars | Type "a" then delete all | `input-error` is empty string (only shows for `len > 0 && len < 3`) |

### 1.2 Form submission (lines 77–96)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| INP-07 | Reject < 3 chars on submit | Set input to "ab", submit form | `input-error` shows "Subject must be at least 3 characters.", input gets class `invalid`, input receives focus, generation does NOT start |
| INP-08 | Reject > 500 chars on submit | Set input to 501-char string, submit form | `input-error` shows "Subject must be under 500 characters.", input gets class `invalid` |
| INP-09 | Whitespace trimming | Set input to "   ab   " (2 real chars), submit | Rejected — trimmed length is 2 |
| INP-10 | Valid submission at 3 chars | Set input to "abc", submit | `input-error` cleared, `invalid` class removed, `startGeneration("abc")` called |
| INP-11 | Valid submission at 500 chars | Set input to exactly 500 chars, submit | Accepted, generation starts |
| INP-12 | Prevent default | Submit form | Page does NOT reload (e.preventDefault called) |

---

## 2. Generation Pipeline (`app.js` lines 99–131)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| GEN-01 | Timer starts | Trigger `startGeneration("test")` | `generationStartTime` is set to a value near `Date.now()` |
| GEN-02 | UI reset on start | Trigger generation | `resetUI()` is called — all output sections hidden, feed cleared, steps reset to default |
| GEN-03 | Progress section shown | Trigger generation | `progress-section` has class `hidden` removed |
| GEN-04 | Button disabled during gen | Trigger generation | `generate-btn` has `disabled = true` and class `loading` |
| GEN-05 | Research step activation | Trigger generation, observe before research resolves | `step-research` has class `active`, status reads "Researching..." |
| GEN-06 | Research step completion | Mock `/api/research` success | `step-research` has class `complete` (not `active`), status reads "Done" |
| GEN-07 | Script step activation | After research completes | `step-script` has class `active`, status reads "Writing script..." |
| GEN-08 | Script step completion | Mock `/api/script` success | `step-script` has class `complete`, status reads "Done" |
| GEN-09 | Script display on success | Mock both APIs to succeed | `displayScript()` called, `scriptSection` shown |
| GEN-10 | Sources display — from scriptData | Mock `/api/script` returns `{ script: "...", sources: [...] }` | Sources rendered from `scriptData.sources` |
| GEN-11 | Sources fallback — from researchData | Mock `/api/script` returns `{ script: "..." }` (no sources), research had sources | Sources rendered from `researchData.sources` |
| GEN-12 | Sources fallback — empty | Both return no sources | `displaySources([])` called, sources section stays hidden |
| GEN-13 | Error path — research fails | Mock `/api/research` to reject | `showError()` called with error message |
| GEN-14 | Error path — script fails | Mock research success, `/api/script` reject | `showError()` called with error message |
| GEN-15 | Error path — no message | Reject with `new Error()` (no message) | Fallback: "An error occurred during generation." displayed |
| GEN-16 | Button re-enabled after success | Generation completes | `generate-btn` has `disabled = false`, class `loading` removed |
| GEN-17 | Button re-enabled after error | Generation fails | Same as GEN-16: button re-enabled in `finally` block |

---

## 3. API Calls (`app.js` lines 134–256)

### 3.1 fetchResearch (lines 134–152)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| API-01 | Correct request shape | Intercept `/api/research` call | Method: POST, Content-Type: application/json, body: `{"subject":"..."}` |
| API-02 | HTTP error → throw | Mock 500 response with `{"error":"server down"}` | Throws Error("server down") |
| API-03 | HTTP error → JSON parse fail | Mock 500 response with non-JSON body | Throws Error("Research failed") — fallback message |
| API-04 | SSE response detected | Mock 200 with content-type `text/event-stream` | Calls `handleResearchStream()` instead of `res.json()` |
| API-05 | JSON response detected | Mock 200 with content-type `application/json` | Calls `res.json()` and returns parsed data |

### 3.2 handleResearchStream (lines 154–183)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| SSE-01 | Finding event | Stream line: `data: {"type":"finding","text":"Romans used concrete"}` | `addFinding("Romans used concrete")` called |
| SSE-02 | Status event | Stream line: `data: {"type":"status","text":"Searching history..."}` | `updateStepStatus('research', 'Searching history...')` called |
| SSE-03 | Complete event | Stream line: `data: {"type":"complete","result":{"facts":[...]}}` | `result` variable set, function returns the result object |
| SSE-04 | Malformed JSON line | Stream line: `data: {broken json` | No error thrown, line silently skipped, processing continues |
| SSE-05 | Non-data line | Stream line: `event: message` (no "data: " prefix) | Line ignored, no processing |
| SSE-06 | Multiple events in one chunk | Stream contains finding + status + complete in one read | All three processed in order |
| SSE-07 | Stream ends | Reader returns `done: true` | Loop exits, returns accumulated result |
| SSE-08 | Empty stream | Reader immediately returns done | Returns empty object `{}` |

### 3.3 fetchScript (lines 185–198)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| API-06 | Correct request shape | Intercept `/api/script` call | Body: `{"subject":"...","research":{...}}` |
| API-07 | HTTP error with message | Mock 400 `{"error":"bad topic"}` | Throws Error("bad topic") |
| API-08 | HTTP error without JSON | Mock 500 with no body | Throws Error("Script generation failed") |
| API-09 | Success | Mock 200 `{"script":"...","sources":[...]}` | Returns parsed object |

### 3.4 generateAudio (lines 200–223)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| API-10 | Progress UI initialized | Call `generateAudio(script, voice)` | `audio-gen-progress` unhidden, bar at 0%, text "Starting audio generation..." |
| API-11 | Correct request shape | Intercept `/api/audio` | Body: `{"script":"...","voice":"adam"}` |
| API-12 | HTTP error | Mock 500 `{"error":"TTS quota exceeded"}` | Throws Error("TTS quota exceeded") |
| API-13 | HTTP error no JSON | Mock 500 non-JSON | Throws Error("Audio generation failed") |
| API-14 | SSE response | Mock content-type `text/event-stream` | Calls `handleAudioStream()` |
| API-15 | Blob response | Mock 200 with audio/mpeg blob | Creates object URL, returns it |

### 3.5 handleAudioStream (lines 225–256)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| SSE-09 | Progress event | `data: {"type":"progress","chunk":2,"total":5}` | Bar at 40%, text "Generating audio 2/5..." |
| SSE-10 | Complete event | `data: {"type":"complete","url":"/audio/xyz.mp3"}` | Bar at 100%, text "Audio ready!", returns URL |
| SSE-11 | Malformed line | `data: not-json` | Silently skipped |
| SSE-12 | Stream end | Reader done | Returns accumulated audioUrl |

---

## 4. Display Functions (`app.js` lines 259–309)

### 4.1 displayScript (lines 259–279)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DSP-01 | Script from `data.script` | Call with `{script: "Hello world test content here"}` | `currentScript` set to that string |
| DSP-02 | Script from `data.text` fallback | Call with `{text: "fallback"}` (no script field) | `currentScript` set to "fallback" |
| DSP-03 | Script empty fallback | Call with `{}` | `currentScript` set to empty string |
| DSP-04 | Word count calculation | Script with 150 words | `script-meta` reads "150 words ~ 1 min read" |
| DSP-05 | Reading time rounding | Script with 225 words (225/150 = 1.5) | Rounds to "2 min read" |
| DSP-06 | Script displayed | Any valid script | `script-content.textContent` matches script text |
| DSP-07 | Sections shown | Call displayScript | `script-section` and `voice-section` have `hidden` removed |
| DSP-08 | Character estimate | Script is 1500 chars | `char-estimate` reads "1,500", `audio-estimate` unhidden |
| DSP-09 | Generation stats | generationStartTime set 5s ago | `stat-time` reads "Generated in 5.0s", `stat-chars` shows char count |
| DSP-10 | Stats section shown | Call displayScript | `generation-stats` has `hidden` removed |

### 4.2 displaySources (lines 281–302)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DSP-11 | Empty sources array | Call `displaySources([])` | Function returns early, sources section stays hidden |
| DSP-12 | Null sources | Call `displaySources(null)` | Function returns early |
| DSP-13 | Single source rendered | `[{title:"Wiki", url:"https://en.wikipedia.org"}]` | One `<a>` element, class `source-item`, href matches, index shows "1", title and URL displayed |
| DSP-14 | Multiple sources | Array of 3 sources | 3 `<a>` elements, indices 1/2/3 |
| DSP-15 | Source without title | `{url: "https://example.com"}` | Falls back to "Source 1" |
| DSP-16 | Source without URL | `{title: "Test"}` | href defaults to "#" |
| DSP-17 | XSS prevention in sources | `{title: "<script>alert(1)</script>"}` | Title HTML-escaped, no script execution |
| DSP-18 | Security attributes | Check rendered `<a>` tag | `target="_blank"`, `rel="noopener noreferrer"` |
| DSP-19 | Sources list cleared | Call displaySources twice | `sourcesList.innerHTML` cleared before re-rendering |
| DSP-20 | Sources section shown | Valid sources array | `sources-section` has `hidden` removed |

### 4.3 addFinding (lines 304–309)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DSP-21 | Finding element created | Call `addFinding("Fact 1")` | New `<div>` with class `feed-item`, textContent "Fact 1" |
| DSP-22 | Prepended (newest first) | Add "Fact 1" then "Fact 2" | "Fact 2" appears as first child of feed-list |
| DSP-23 | Text content (not HTML) | `addFinding("<b>bold</b>")` | Rendered as literal text, not HTML (uses textContent) |

---

## 5. Pipeline Step Helpers (`app.js` lines 312–339)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| STEP-01 | setStepActive | Call `setStepActive('research')` | `step-research` has class `active`, no `complete` or `error` |
| STEP-02 | setStepComplete | Call `setStepComplete('research')` | `step-research` has class `complete`, no `active` or `error` |
| STEP-03 | setStepError | Call `setStepError('research')` | `step-research` has class `error`, no `active` or `complete` |
| STEP-04 | Active removes prior state | Set to complete, then active | Only `active` class present |
| STEP-05 | Invalid step name | Call `setStepActive('nonexistent')` | No error thrown (null-check: `if (el)`) |
| STEP-06 | updateStepStatus | Call `updateStepStatus('research', 'Working...')` | `research-status` textContent is "Working..." |
| STEP-07 | updateStepStatus invalid | Call `updateStepStatus('fake', 'test')` | No error thrown |

---

## 6. Audio Player Controls (`app.js` lines 342–391)

### 6.1 Play/Pause toggle (lines 342–365)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| AUD-01 | Click play when paused | Set audio src, click play-pause-btn | `audioElement.play()` called |
| AUD-02 | Click pause when playing | Audio is playing, click play-pause-btn | `audioElement.pause()` called |
| AUD-03 | Play event — icon swap | Dispatch `play` event on audioElement | `play-icon` gets class `hidden`, `pause-icon` loses class `hidden` |
| AUD-04 | Play event — waveform | Dispatch `play` event | `startWaveform()` called |
| AUD-05 | Pause event — icon swap | Dispatch `pause` event | `play-icon` loses `hidden`, `pause-icon` gets `hidden` |
| AUD-06 | Ended event — icon reset | Dispatch `ended` event | Play icon shown, pause icon hidden |
| AUD-07 | Ended event — waveform stopped | Dispatch `ended` event | `stopWaveform()` called (animFrameId set to null) |

### 6.2 Time tracking (lines 367–378)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| AUD-08 | Progress bar updates | Set currentTime=30, duration=60, fire `timeupdate` | `progress-bar` width = "50%", `progress-handle` left = "50%" |
| AUD-09 | Current time display | currentTime=65 | `current-time` reads "1:05" |
| AUD-10 | No duration guard | Duration is NaN/0, fire `timeupdate` | No calculation performed (guard: `if (audioElement.duration)`) |
| AUD-11 | Metadata loaded | Set duration=600, fire `loadedmetadata` | `total-time` reads "10:00" |

### 6.3 Scrub & Volume (lines 380–391)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| AUD-12 | Scrub bar click | Click at 75% of progress-bar-wrapper width, duration=100 | `audioElement.currentTime` set to 75 |
| AUD-13 | Scrub with no duration | Click scrub bar when duration is falsy | Early return, no error |
| AUD-14 | Volume slider | Set volume slider to 0.5 | `audioElement.volume` equals 0.5 |

---

## 7. Waveform Visualization (`app.js` lines 394–439)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WAV-01 | AudioContext created first time | Call `startWaveform()` when audioContext is null | `audioContext` created, `analyser` created with fftSize=256, source connected |
| WAV-02 | AudioContext reused | Call `startWaveform()` when audioContext already exists | No new AudioContext created |
| WAV-03 | drawWaveform runs | Call after startWaveform | `requestAnimationFrame` called, animFrameId set |
| WAV-04 | drawWaveform null guard | Call `drawWaveform()` when analyser is null | Returns immediately, no error |
| WAV-05 | Canvas rendering | During animation frame | Canvas cleared, frequency bars drawn with HSL gradient colors |
| WAV-06 | stopWaveform | Call `stopWaveform()` when animFrameId is set | `cancelAnimationFrame` called, `animFrameId` set to null |
| WAV-07 | stopWaveform no-op | Call `stopWaveform()` when animFrameId is null | No error, no action |

---

## 8. Voice Selection (`app.js` lines 442–450)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| VOC-01 | Default voice | Page loads | Adam card has class `selected`, Adam radio checked |
| VOC-02 | Select different voice | Click Antoni card | Antoni has `selected`, Adam loses `selected`, Antoni radio checked |
| VOC-03 | Click non-card area | Click empty space in voice-grid | No card selected/deselected (null guard: `if (!card) return`) |
| VOC-04 | All voices available | Inspect voice grid | 4 radio buttons: adam, antoni, josh, arnold |

---

## 9. Script Actions (`app.js` lines 453–505)

### 9.1 Copy to clipboard (lines 453–461)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| ACT-01 | Copy succeeds | Set currentScript, click copy button | `navigator.clipboard.writeText` called with script text, button text temporarily shows "Copied!" |
| ACT-02 | Copy with empty script | currentScript is empty, click copy | Early return (guard: `if (!currentScript)`), no clipboard call |
| ACT-03 | Copy fails | Mock clipboard to reject | Button shows "Copy failed" |
| ACT-04 | Feedback revert | After copy succeeds, wait 1.5s | Button innerHTML reverts to original |

### 9.2 Download script (lines 463–467)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| ACT-05 | Download as markdown | Set currentScript, click download button | Blob created with type `text/markdown`, file downloads as `podcast-script.md` |
| ACT-06 | Download empty guard | currentScript is empty | Early return, no download |

### 9.3 Generate audio (lines 469–497)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| ACT-07 | Empty script guard | currentScript is empty, click generate audio | Early return |
| ACT-08 | Default voice | No voice explicitly selected by user (Adam pre-checked) | Uses "adam" |
| ACT-09 | Custom voice | Select "josh", click generate audio | Passes "josh" to `generateAudio()` |
| ACT-10 | Fallback voice | No radio checked (edge case) | Falls back to "adam" via `|| 'adam'` |
| ACT-11 | Button disabled during gen | Click generate audio | Button disabled, has class `loading` |
| ACT-12 | Audio step active | Click generate audio | `step-audio` has class `active`, status "Generating audio..." |
| ACT-13 | Success path | Mock generateAudio resolves with URL | `step-audio` complete, status "Done", `audioElement.src` set, `audio-section` shown |
| ACT-14 | Stats updated | After audio success | `stat-time` shows total elapsed time |
| ACT-15 | Error path | Mock generateAudio rejects | `step-audio` has class `error`, status "Failed", error message shown |
| ACT-16 | Error no message | Reject with `new Error()` | Shows "Audio generation failed." |
| ACT-17 | Button re-enabled after success | Audio completes | Button enabled, `loading` removed |
| ACT-18 | Button re-enabled after error | Audio fails | Button enabled, `loading` removed (finally block) |

### 9.4 Download audio (lines 499–505)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| ACT-19 | Download MP3 | audioElement.src is set, click download | Creates `<a>` with href matching src, download attribute "podcast.mp3", click triggered |
| ACT-20 | Download empty guard | audioElement.src is empty | Early return |

---

## 10. Utility Functions (`app.js` lines 508–579)

### 10.1 showSection (line 508–510)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UTL-01 | Show hidden section | Pass element with class `hidden` | `hidden` class removed |

### 10.2 resetUI (lines 512–543)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UTL-02 | Sections hidden | Call resetUI | scriptSection, voiceSection, audioSection, sourcesSection, generationStats, audioGenProgress all have `hidden` class |
| UTL-03 | Audio estimate hidden | Call resetUI | `audio-estimate` has `hidden` class |
| UTL-04 | Feed cleared | Call resetUI | `feedList.innerHTML` is empty |
| UTL-05 | Script cleared | Call resetUI | `scriptContent.textContent` is empty |
| UTL-06 | Sources cleared | Call resetUI | `sourcesList.innerHTML` is empty |
| UTL-07 | State reset | Call resetUI | `currentScript` is "", `currentSources` is [] |
| UTL-08 | Pipeline steps reset | Call resetUI | All `.pipeline-step` elements have no `active`, `complete`, or `error` class |
| UTL-09 | Step statuses reset | Call resetUI | All three step statuses read "Waiting..." |
| UTL-10 | Audio player reset | Call resetUI | Audio paused, src empty, play icon shown, pause hidden, progress at 0%, times at "0:00" |
| UTL-11 | Waveform stopped | Call resetUI | `stopWaveform()` called |

### 10.3 showError (lines 545–547)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UTL-12 | Error displayed | Call `showError("Network error")` | `input-error` textContent is "Network error" |

### 10.4 formatTime (lines 549–554)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UTL-13 | Zero seconds | `formatTime(0)` | Returns "0:00" (falsy guard) |
| UTL-14 | NaN input | `formatTime(NaN)` | Returns "0:00" |
| UTL-15 | Undefined input | `formatTime(undefined)` | Returns "0:00" |
| UTL-16 | 65 seconds | `formatTime(65)` | Returns "1:05" |
| UTL-17 | 600 seconds | `formatTime(600)` | Returns "10:00" |
| UTL-18 | 9 seconds (pad) | `formatTime(9)` | Returns "0:09" |
| UTL-19 | Fractional seconds | `formatTime(65.7)` | Returns "1:05" (Math.floor) |

### 10.5 escapeHtml (lines 556–560)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UTL-20 | Normal string | `escapeHtml("hello")` | Returns "hello" |
| UTL-21 | Angle brackets | `escapeHtml("<script>")` | Returns `&lt;script&gt;` |
| UTL-22 | Ampersand | `escapeHtml("a&b")` | Returns `a&amp;b` |
| UTL-23 | Quotes | `escapeHtml('"test"')` | Returns `&quot;test&quot;` |
| UTL-24 | Combined | `escapeHtml('<img onerror="alert(1)">')` | All special chars escaped |

### 10.6 downloadBlob (lines 562–571)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UTL-25 | Creates and cleans up | Call with blob and filename | Object URL created, `<a>` appended to body, clicked, removed from body, URL revoked |
| UTL-26 | Filename passed | `downloadBlob(blob, 'test.md')` | `a.download` equals "test.md" |

### 10.7 showButtonFeedback (lines 573–579)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UTL-27 | Text changes | Call `showButtonFeedback(btn, 'Done!')` | `btn.textContent` is "Done!" |
| UTL-28 | Text reverts | Wait 1500ms after call | `btn.innerHTML` matches original value |

---

## 11. HTML Structure & Accessibility (`index.html`)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| HTML-01 | Charset | Check `<meta charset>` | UTF-8 |
| HTML-02 | Viewport | Check viewport meta | `width=device-width, initial-scale=1.0` |
| HTML-03 | Title | Check `<title>` | "Podcast Research Studio" |
| HTML-04 | Input attributes | Inspect `#subject-input` | `minlength="3"`, `maxlength="500"`, `required`, `aria-label="Podcast subject"` |
| HTML-05 | Error role | Inspect `#input-error` | `role="alert"` for screen readers |
| HTML-06 | Volume aria-label | Inspect `#volume-slider` | `aria-label="Volume"` |
| HTML-07 | Play/Pause aria-label | Inspect `#play-pause-btn` | `aria-label="Play/Pause"` |
| HTML-08 | Hidden sections | On page load | progress-section, script-section, voice-section, audio-section, sources-section, generation-stats all have class `hidden` |
| HTML-09 | Voice radio group | Inspect voice inputs | 4 radios with `name="voice"`, values: adam, antoni, josh, arnold |
| HTML-10 | Default voice checked | On page load | Adam radio has `checked` attribute, Adam card has class `selected` |
| HTML-11 | Canvas dimensions | Inspect `#waveform-canvas` | `width="800"`, `height="60"` |
| HTML-12 | Audio preload | Inspect `#audio-element` | `preload="auto"` |

---

## 12. CSS & Responsive Design (`styles.css`)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| CSS-01 | Dark theme base | Inspect body | Background `#0a0e17` (--color-bg), surface panels `#0f141f` (--color-surface), text `#e4e6ef` |
| CSS-02 | Accent color (Ritta gold) | Inspect primary button | Background `#ffbe01` (--color-accent), dark text `#0f141f` |
| CSS-03 | Disabled button | Disable generate-btn | Opacity 0.5, cursor not-allowed |
| CSS-04 | Input focus state | Focus subject input | Border color changes to accent, box-shadow glow appears |
| CSS-05 | Invalid input state | Add class `invalid` to input | Border color changes to error color (`#f87171`) |
| CSS-06 | Mobile layout ≤ 640px | Resize viewport to 400px wide | Pipeline steps stack vertically, voice grid 2 columns, buttons full-width |
| CSS-07 | Pipeline step active | Add class `active` to step | Accent border/color, pulse-glow animation running |
| CSS-08 | Pipeline step complete | Add class `complete` to step | Green color (`#34d399`) |
| CSS-09 | Pipeline step error | Add class `error` to step | Red color (`#f87171`) |
| CSS-10 | Feed item animation | Add feed-item to feed-list | Slide-in animation plays |
| CSS-11 | Selected voice card | Add class `selected` to card | Accent border, glow effect |
| CSS-12 | Button loading spinner | Add class `loading` to button | Spinner animation visible |
| CSS-13 | Script container scroll | Set script-content taller than 500px | Container scrolls, content does not overflow |
| CSS-14 | Hidden class | Element with class `hidden` | `display: none` applied |

---

## 13. Backend API Endpoints (Server-Side)

### 13.1 POST /api/research

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| BE-01 | Valid request | POST `{"subject":"history of concrete"}` | 200 OK, returns research JSON or SSE stream |
| BE-02 | Missing subject | POST `{}` | 400 error with descriptive message |
| BE-03 | Empty subject | POST `{"subject":""}` | 400 error |
| BE-04 | Subject too short | POST `{"subject":"ab"}` | 400 error |
| BE-05 | Subject too long | POST subject > 500 chars | 400 error: "Subject must be under 500 characters." |
| BE-06 | SSE stream format | Response with event-stream | Lines formatted as `data: {JSON}\n\n` |
| BE-07 | Finding events | During research SSE | At least 1 finding event with `type: "finding"` |
| BE-08 | Complete event | End of SSE | Final event has `type: "complete"` with result object |
| BE-09 | Source tracking | Research completes | Result includes `sources` array with title and URL per source |
| BE-10 | External API failure | Tavily API down | Graceful fallback to LLM knowledge, no 500 crash |
| BE-11 | Retry logic | First API call fails, succeeds on retry | Retry wrapper fires up to 3 attempts with exponential backoff (1s, 2s, 4s). Request succeeds on second attempt. |

### 13.2 POST /api/script

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| BE-12 | Valid request | POST `{"subject":"...","research":{...}}` | 200 OK, returns `{"script":"...","sources":[...]}` |
| BE-13 | Missing fields | POST `{}` | 400 error |
| BE-14 | Script length | Successful generation | Script is approximately 1500 words |
| BE-15 | Harari style markers | Read generated script | Contains big-picture framing, cross-disciplinary connections, provocative questions |
| BE-16 | Claude API failure | Claude API returns error | Appropriate error response, no crash |

### 13.3 POST /api/audio

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| BE-17 | Valid request | POST `{"script":"...","voice":"adam"}` | 200 OK, returns audio blob or SSE stream |
| BE-18 | Missing script | POST `{"voice":"adam"}` | 400 error |
| BE-19 | Invalid voice | POST `{"script":"...","voice":"unknown"}` | 400 error or falls back to default |
| BE-20 | Chunk progress events | SSE stream during generation | Progress events with chunk/total counts |
| BE-21 | Complete event with URL | SSE stream ends | Complete event with URL to assembled MP3 |
| BE-22 | Script preprocessing | Long script with markdown | Markdown stripped, SSML pauses inserted, chunks ≤ 5000 chars |
| BE-23 | Audio concatenation | Multi-chunk generation | Single MP3 assembled via `Buffer.concat` (simple concat, not ffmpeg). Works for same-codec MP3 chunks |
| BE-24 | ElevenLabs API failure | TTS API returns error | Appropriate error, partial audio cleaned up |
| BE-25 | Voice settings | Check ElevenLabs call | stability=0.5, similarity_boost=0.75, style=0.3, speaker_boost=true |

---

## 14. Security (`app.js`, Backend)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| SEC-01 | XSS via subject input | Submit `<script>alert(1)</script>` | No script execution anywhere in the rendered output |
| SEC-02 | XSS via source title | API returns source with `<img onerror=alert(1)>` title | `escapeHtml()` neutralizes it |
| SEC-03 | XSS via source URL display | API returns source with malicious URL text | URL text escaped in display |
| SEC-04 | No API keys in client | Search all `public/` files for "key", "token", "secret" | No credentials found |
| SEC-05 | Input sanitization server | Submit `{"subject":"'; DROP TABLE;--"}` | Server sanitizes, no injection |
| SEC-06 | Rate limiting (Express) | Send 11 rapid requests to `/api/research` | 11th request returns 429 "Too many requests. Please wait a minute." via `express-rate-limit` middleware (10 req/min) |
| SEC-06b | Rate limiting (Vercel) | Send 11 rapid requests to `/api/research` on Vercel | 11th request returns 429 via in-memory rate limiter in serverless function |
| SEC-07 | CORS headers | Check response headers from API | Same-origin only (no CORS middleware needed — frontend and API on same domain) |

---

## 15. Server Infrastructure (`server.js`)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| SRV-01 | Server starts | Run `node server.js` | Console shows "Podcast Research Studio running at http://localhost:3000" |
| SRV-02 | API key status | Run server with all keys set | Console shows "ANTHROPIC_API_KEY: yes", "TAVILY_API_KEY: yes", "ELEVENLABS_API_KEY: yes" |
| SRV-03 | API key missing warning | Run server without TAVILY_API_KEY | Console shows "TAVILY_API_KEY: MISSING" |
| SRV-04 | Health endpoint | GET `/api/health` | 200 OK, returns `{"status":"ok"}` |
| SRV-05 | Static file serving | GET `/` | Serves `public/index.html` |
| SRV-06 | Output directory serving | GET `/output/test.mp3` (after file exists) | Serves the MP3 file from output directory |
| SRV-07 | JSON body parsing | POST `/api/research` with 500KB JSON body | Parses correctly (limit is 1mb) |
| SRV-08 | JSON body limit | POST `/api/research` with 2MB JSON body | 413 Payload Too Large |
| SRV-09 | Custom port | Set `PORT=4000` in .env, start server | Server runs on port 4000 |
| SRV-10 | dotenv loading | API keys in .env file only | Server reads them via `process.env` |

---

## 16. Backend Helper Functions (`audio.js`)

### 16.1 preprocessScript

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| PRE-01 | Strip emphasis markers | Input: `*important* text` | Output: `important text` |
| PRE-02 | Convert [pause] | Input: `text [pause] more` | Output: `text <break time="0.8s"/> more` |
| PRE-03 | Convert [long pause] | Input: `text [long pause] more` | Output: `text <break time="1.5s"/> more` |
| PRE-04 | Convert [beat] | Input: `text [beat] more` | Output: `text <break time="0.5s"/> more` |
| PRE-05 | Case insensitive pause | Input: `[PAUSE]` | Converted to `<break time="0.8s"/>` |
| PRE-06 | Combined | Input: `*bold* [pause] [beat]` | All markers processed |

### 16.2 chunkText

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| CHK-01 | Short text no split | Input under 4500 chars | Returns array with 1 chunk |
| CHK-02 | Split at sentence | 6000 char input with sentences | Splits at sentence boundary (`. `, `? `, `! `) |
| CHK-03 | Multiple chunks | 15000 char input | Returns 3-4 chunks, each ≤ 4500 chars |
| CHK-04 | No good break point | 5000 chars with no sentence boundaries | Falls back to splitting at maxLen |
| CHK-05 | All chunks non-empty | Any input | No empty strings in result array |

### 16.3 Voice mapping

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| VOI-01 | Known voice "adam" | Lookup `VOICE_MAP.adam` | Returns `pNInz6obpgDQGcFmaJgB` |
| VOI-02 | Known voice "antoni" | Lookup `VOICE_MAP.antoni` | Returns `ErXwobaYiN019PkySvjV` |
| VOI-03 | Known voice "josh" | Lookup `VOICE_MAP.josh` | Returns `TxGEqnHWrfWFTfGW9XjX` |
| VOI-04 | Known voice "arnold" | Lookup `VOICE_MAP.arnold` | Returns `VR6AewLTigWG4xSOukaG` |
| VOI-05 | Unknown voice fallback | POST with `voice: "unknown"` | Falls back to adam's voice ID |

---

## 17. Backend Research Helpers (`research.js`)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| RES-01 | Tavily request shape | Intercept fetch to Tavily | Body includes `api_key`, `query`, `search_depth: "advanced"`, `max_results: 8`, `include_answer: true` |
| RES-02 | Query generation fallback | Claude returns non-JSON for queries | Falls back to 4 template queries using subject |
| RES-03 | Parallel search | Monitor Tavily calls | All 4 searches run via `Promise.allSettled` (not sequential) |
| RES-04 | Partial search failure | 2 of 4 Tavily calls fail | Succeeds with results from the 2 that worked + "will use AI knowledge" finding events |
| RES-05 | Source deduplication | Tavily returns duplicate URLs | `uniqueSources` array has no duplicate URLs |
| RES-06 | Source cap at 15 | Tavily returns 30+ sources | Only first 15 unique sources included in result |
| RES-07 | Findings cap at 10 | Synthesis has 20 bullet points | Only first 10 sent as finding events |
| RES-08 | Finding minimum length | Synthesis bullet is "Yes" (< 10 chars) | Skipped, not sent as finding event |
| RES-09 | Finding truncation | Synthesis bullet is 200+ chars | Truncated to 150 chars in finding event |
| RES-10 | Empty subject body | POST `{"subject":""}` | 400 error (falsy check catches empty string) |
| RES-11 | Missing API key | No ANTHROPIC_API_KEY set | Claude SDK throws, error event sent, SSE stream ends gracefully |
| RES-12 | Missing Tavily key | No TAVILY_API_KEY set | Tavily calls fail, fallback synthesis prompt used ("No web sources were available") |

---

## 18. Backend Script Route (`script.js`)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| SCR-01 | Response shape | Successful generation | JSON with `script`, `sources`, `wordCount`, `charCount` fields |
| SCR-02 | Missing research.research | POST `{"subject":"test","research":{}}` | Falls back to `JSON.stringify(research)` — does not 400. Generates script from whatever data is available |
| SCR-03 | Word count accuracy | Script with known word count | `wordCount` matches `script.split(/\s+/).length` |
| SCR-04 | Sources passthrough | Research has sources array | Response `sources` matches `research.sources` |
| SCR-05 | Missing research sources | Research has no sources field | Response `sources` is `[]` |

---

## 19. Language Toggle (FR-7)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| LANG-01 | Toggle button exists | Inspect header | `#lang-toggle` button visible with "EN | TH" text |
| LANG-02 | Default language | Page loads fresh (no localStorage) | English text displayed, EN option has class `active` |
| LANG-03 | Switch to Thai | Click language toggle | All `data-i18n` elements switch to Thai text, TH option has class `active` |
| LANG-04 | Switch back to English | Click toggle again | All text reverts to English |
| LANG-05 | Persistence | Switch to Thai, reload page | Thai text persists (read from `localStorage.getItem('lang')`) |
| LANG-06 | HTML lang attribute | Switch to Thai | `<html>` element `lang` attribute changes to "th" |
| LANG-07 | Placeholder translation | Switch to Thai | Subject input placeholder shows Thai text |
| LANG-08 | Dynamic strings | Switch to Thai, trigger validation error | Error message shown in Thai |
| LANG-09 | Status messages | Switch to Thai, start generation | Pipeline status messages show Thai text (e.g., researching, writing script) |
| LANG-10 | Button feedback | Switch to Thai, copy script | "Copied!" feedback shows Thai text |
| LANG-11 | Footer translation | Switch to Thai | Footer text shows Thai version |
| LANG-12 | Voice descriptions | Switch to Thai | Voice card descriptions show Thai text, voice names stay English |
| LANG-13 | Thai lang param in research | Switch to Thai, submit topic, inspect network request | POST `/api/research` body includes `lang: "th"` |
| LANG-14 | Thai lang param in script | Complete research in Thai, inspect script request | POST `/api/script` body includes `lang: "th"` |
| LANG-15 | Thai lang param in audio | Complete script in Thai, inspect audio request | POST `/api/audio` body includes `lang: "th"` |
| LANG-16 | Thai research output | Submit Thai topic with Thai selected | Research findings returned in Thai language |
| LANG-17 | Thai script output | Generate script with Thai selected | Full podcast script written in Thai |
| LANG-18 | Thai audio model | Inspect ElevenLabs API call when Thai is selected | Uses `eleven_multilingual_v2` model (not `eleven_monolingual_v1`) |
| LANG-19 | English audio model | Generate audio with English selected | Uses `eleven_monolingual_v1` model |
| LANG-20 | Thai character sanitization | Submit Thai characters in subject | Thai characters pass through sanitization (Unicode `\p{L}` support) |
| LANG-21 | Thai audio playback | Generate full Thai podcast | Audio plays correctly with Thai speech |

---

## 20. Vercel Serverless Deployment

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| VCL-01 | vercel.json exists | Check project root | Valid `vercel.json` with builds, routes, and function maxDuration configs |
| VCL-02 | Health endpoint | GET `/api/health` on Vercel | Returns `{"status":"ok"}` |
| VCL-03 | Research endpoint | POST `/api/research` on Vercel | SSE stream works, returns research data |
| VCL-04 | Script endpoint | POST `/api/script` on Vercel | Returns script JSON |
| VCL-05 | Audio endpoint | POST `/api/audio` on Vercel | SSE stream with progress, final event contains base64 audio data |
| VCL-06 | Audio playback (Vercel) | Generate audio on Vercel deployment | Audio plays via base64 data URL in browser |
| VCL-07 | Static files | Navigate to Vercel URL | `index.html`, `styles.css`, `app.js` all load correctly |
| VCL-08 | Environment variables | Check Vercel dashboard | ANTHROPIC_API_KEY, TAVILY_API_KEY, ELEVENLABS_API_KEY all configured |
| VCL-09 | Local dev still works | Run `node server.js` locally | Full app works with file-based audio output |

---

## 21. Retry Logic & Input Sanitization

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| RTY-01 | Retry on Claude failure | Mock first Claude call to fail | Second attempt succeeds, no error shown to user |
| RTY-02 | Retry on Tavily failure | Mock first Tavily call to fail | Second attempt succeeds |
| RTY-03 | Retry on ElevenLabs failure | Mock first ElevenLabs call to fail | Second attempt succeeds |
| RTY-04 | Max retries exhausted | Mock all 3 attempts to fail | Error propagated to user after 3 attempts |
| RTY-05 | Exponential backoff timing | Monitor retry delays | Delays follow pattern: ~1s, ~2s, ~4s (capped at 8s) |
| RTY-06 | HTML tag sanitization | Submit `<script>alert(1)</script>test` as subject | HTML tags stripped, "test" passes through |
| RTY-07 | Special char sanitization | Submit subject with unusual unicode | Non-standard chars removed, alphanumeric and common punctuation preserved |

---

## 22. End-to-End Integration

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| E2E-01 | Full pipeline — happy path | Enter "the history of concrete", submit | Research findings appear live → script displayed with word count → voice selectable → audio plays → sources listed → stats shown |
| E2E-02 | Full pipeline timing | Time E2E-01 from submit to audio ready | Total < 3 minutes |
| E2E-03 | Research timing | Time research phase only | < 60 seconds |
| E2E-04 | Script timing | Time script phase only | < 30 seconds |
| E2E-05 | Audio first chunk | Time from "Generate Audio" click to first audio data | < 10 seconds |
| E2E-06 | Copy and verify | Generate script, click copy, paste into text editor | Pasted text matches displayed script |
| E2E-07 | Download script | Generate script, download .md | File downloads, content matches displayed script |
| E2E-08 | Download audio | Generate audio, download MP3 | Valid MP3 file downloads, plays in external player |
| E2E-09 | Audio playback controls | Play, pause, scrub to middle, adjust volume | All controls work as expected |
| E2E-10 | Multiple generations | Complete one generation, then start another | UI fully resets, second generation succeeds independently |
| E2E-11 | Error recovery | Disconnect network mid-research, reconnect, try again | Error shown, UI re-enables, retry succeeds |
| E2E-12 | Mobile walkthrough | Run E2E-01 on 375px viewport | All sections visible and usable, pipeline vertical, voice grid 2-col |

---

## Summary

| Area | Test Count |
|------|-----------|
| Environment & Setup | 3 |
| Input Validation | 12 |
| Generation Pipeline | 17 |
| API Calls (Research) | 5 |
| SSE — Research Stream | 8 |
| API Calls (Script) | 4 |
| API Calls (Audio) | 6 |
| SSE — Audio Stream | 4 |
| Display Functions | 23 |
| Pipeline Step Helpers | 7 |
| Audio Player Controls | 14 |
| Waveform Visualization | 7 |
| Voice Selection | 4 |
| Script Actions | 20 |
| Utility Functions | 28 |
| HTML Structure | 12 |
| CSS & Responsive | 14 |
| Backend API Endpoints | 25 |
| Server Infrastructure | 10 |
| Backend Audio Helpers | 11 |
| Backend Research Helpers | 12 |
| Backend Script Route | 5 |
| Security | 8 |
| Language Toggle & Thai Pipeline (FR-7) | 21 |
| Vercel Serverless | 9 |
| Retry Logic & Sanitization | 7 |
| End-to-End Integration | 12 |
| **Total** | **310** |

All M5 polish items (retry logic, rate limiting, input sanitization) are now implemented.
