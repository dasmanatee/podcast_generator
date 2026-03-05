/* ========================================
   Podcast Research Studio - Client App
   Vanilla JS, no dependencies
   ======================================== */

(function () {
  'use strict';

  // --- DOM refs ---
  const subjectForm = document.getElementById('subject-form');
  const subjectInput = document.getElementById('subject-input');
  const charCount = document.getElementById('char-count');
  const inputError = document.getElementById('input-error');
  const generateBtn = document.getElementById('generate-btn');

  const progressSection = document.getElementById('progress-section');
  const feedList = document.getElementById('feed-list');

  const scriptSection = document.getElementById('script-section');
  const scriptContent = document.getElementById('script-content');
  const scriptMeta = document.getElementById('script-meta');
  const copyScriptBtn = document.getElementById('copy-script-btn');
  const downloadScriptBtn = document.getElementById('download-script-btn');
  const generateAudioBtn = document.getElementById('generate-audio-btn');
  const audioEstimate = document.getElementById('audio-estimate');
  const charEstimate = document.getElementById('char-estimate');

  const voiceSection = document.getElementById('voice-section');
  const voiceGrid = document.getElementById('voice-grid');

  const audioSection = document.getElementById('audio-section');
  const audioElement = document.getElementById('audio-element');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const currentTimeEl = document.getElementById('current-time');
  const totalTimeEl = document.getElementById('total-time');
  const progressBarWrapper = document.getElementById('progress-bar-wrapper');
  const progressBar = document.getElementById('progress-bar');
  const progressHandle = document.getElementById('progress-handle');
  const volumeSlider = document.getElementById('volume-slider');
  const waveformCanvas = document.getElementById('waveform-canvas');
  const downloadAudioBtn = document.getElementById('download-audio-btn');
  const audioGenProgress = document.getElementById('audio-gen-progress');
  const audioProgressBar = document.getElementById('audio-progress-bar');
  const audioProgressText = document.getElementById('audio-progress-text');

  const sourcesSection = document.getElementById('sources-section');
  const sourcesList = document.getElementById('sources-list');

  const generationStats = document.getElementById('generation-stats');
  const statTime = document.getElementById('stat-time');
  const statChars = document.getElementById('stat-chars');

  const langToggle = document.getElementById('lang-toggle');

  // --- State ---
  let currentScript = '';
  let currentSources = [];
  let generationStartTime = null;
  let audioContext = null;
  let analyser = null;
  let animFrameId = null;
  let currentLang = localStorage.getItem('lang') || 'en';
  let customStyleGuide = null;

  // --- Translation map (FR-7) ---
  var translations = {
    en: {
      title: 'Podcast Research Studio',
      tagline: 'AI-powered podcast generation',
      inputTitle: 'What should your podcast be about?',
      inputSubtitle: 'Enter any topic \u2014 from broad themes like "the history of concrete" to specific questions like "how Roman aqueducts influenced modern plumbing."',
      inputPlaceholder: 'Enter a subject to research...',
      generateBtn: 'Generate Podcast',
      progressTitle: 'Generation Progress',
      stepResearch: 'Research',
      stepScript: 'Script',
      stepAudio: 'Audio',
      waiting: 'Waiting...',
      liveFindings: 'Live Findings',
      scriptTitle: 'Podcast Script',
      copyScript: 'Copy Script',
      downloadMd: 'Download .md',
      generateAudio: 'Generate Audio',
      estimatedChars: 'Estimated characters:',
      estimateNote: 'Review the script above before generating audio. ElevenLabs charges per character.',
      voiceTitle: 'Select Narrator Voice',
      voiceAdam: 'Deep, authoritative, warm',
      voiceAntoni: 'Measured, thoughtful, clear',
      voiceJosh: 'Calm, articulate, engaging',
      voiceArnold: 'Confident, rich, narrative',
      audioTitle: 'Your Podcast',
      downloadMp3: 'Download MP3',
      generatingAudio: 'Generating audio...',
      sourcesTitle: 'Research Sources',
      footer: 'Podcast Research Studio',
      styleUploadBtn: 'Override Style Guide',
      styleClear: 'Clear',
      styleLoaded: 'Style loaded:',
      // Dynamic strings
      researching: 'Researching...',
      writingScript: 'Writing script...',
      done: 'Done',
      generatingAudioStatus: 'Generating audio...',
      failed: 'Failed',
      copied: 'Copied!',
      copyFailed: 'Copy failed',
      errorMin3: 'Subject must be at least 3 characters.',
      errorMax500: 'Subject must be under 500 characters.',
      errorGeneric: 'An error occurred during generation.',
      audioFailed: 'Audio generation failed.',
      startingAudio: 'Starting audio generation...',
      audioReady: 'Audio ready!',
      generatedIn: 'Generated in',
      totalTime: 'Total time:',
      characters: 'characters',
      words: 'words',
      minRead: 'min read'
    },
    th: {
      title: '\u0e2a\u0e15\u0e39\u0e14\u0e34\u0e42\u0e2d\u0e27\u0e34\u0e08\u0e31\u0e22\u0e1e\u0e2d\u0e14\u0e41\u0e04\u0e2a\u0e15\u0e4c',
      tagline: '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e1e\u0e2d\u0e14\u0e41\u0e04\u0e2a\u0e15\u0e4c\u0e14\u0e49\u0e27\u0e22 AI',
      inputTitle: '\u0e1e\u0e2d\u0e14\u0e41\u0e04\u0e2a\u0e15\u0e4c\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13\u0e04\u0e27\u0e23\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e01\u0e31\u0e1a\u0e2d\u0e30\u0e44\u0e23?',
      inputSubtitle: '\u0e1b\u0e49\u0e2d\u0e19\u0e2b\u0e31\u0e27\u0e02\u0e49\u0e2d\u0e43\u0e14\u0e01\u0e47\u0e44\u0e14\u0e49 \u2014 \u0e15\u0e31\u0e49\u0e07\u0e41\u0e15\u0e48\u0e2b\u0e31\u0e27\u0e02\u0e49\u0e2d\u0e01\u0e27\u0e49\u0e32\u0e07\u0e46 \u0e40\u0e0a\u0e48\u0e19 "\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e28\u0e32\u0e2a\u0e15\u0e23\u0e4c\u0e02\u0e2d\u0e07\u0e04\u0e2d\u0e19\u0e01\u0e23\u0e35\u0e15" \u0e44\u0e1b\u0e08\u0e19\u0e16\u0e36\u0e07\u0e04\u0e33\u0e16\u0e32\u0e21\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e40\u0e08\u0e32\u0e30\u0e08\u0e07',
      inputPlaceholder: '\u0e1b\u0e49\u0e2d\u0e19\u0e2b\u0e31\u0e27\u0e02\u0e49\u0e2d\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e04\u0e49\u0e19\u0e04\u0e27\u0e49\u0e32...',
      generateBtn: '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e1e\u0e2d\u0e14\u0e41\u0e04\u0e2a\u0e15\u0e4c',
      progressTitle: '\u0e04\u0e27\u0e32\u0e21\u0e04\u0e37\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e01\u0e32\u0e23\u0e2a\u0e23\u0e49\u0e32\u0e07',
      stepResearch: '\u0e27\u0e34\u0e08\u0e31\u0e22',
      stepScript: '\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c',
      stepAudio: '\u0e40\u0e2a\u0e35\u0e22\u0e07',
      waiting: '\u0e23\u0e2d...',
      liveFindings: '\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2a\u0e14',
      scriptTitle: '\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c\u0e1e\u0e2d\u0e14\u0e41\u0e04\u0e2a\u0e15\u0e4c',
      copyScript: '\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c',
      downloadMd: '\u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14 .md',
      generateAudio: '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e2a\u0e35\u0e22\u0e07',
      estimatedChars: '\u0e08\u0e33\u0e19\u0e27\u0e19\u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23\u0e42\u0e14\u0e22\u0e1b\u0e23\u0e30\u0e21\u0e32\u0e13:',
      estimateNote: '\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c\u0e01\u0e48\u0e2d\u0e19\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e2a\u0e35\u0e22\u0e07 ElevenLabs \u0e04\u0e34\u0e14\u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e15\u0e32\u0e21\u0e08\u0e33\u0e19\u0e27\u0e19\u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23',
      voiceTitle: '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e40\u0e2a\u0e35\u0e22\u0e07\u0e1c\u0e39\u0e49\u0e1a\u0e23\u0e23\u0e22\u0e32\u0e22',
      voiceAdam: '\u0e17\u0e38\u0e49\u0e21\u0e15\u0e48\u0e33, \u0e19\u0e48\u0e32\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e16\u0e37\u0e2d, \u0e2d\u0e1a\u0e2d\u0e38\u0e48\u0e19',
      voiceAntoni: '\u0e2a\u0e38\u0e02\u0e38\u0e21, \u0e23\u0e2d\u0e1a\u0e04\u0e2d\u0e1a, \u0e0a\u0e31\u0e14\u0e40\u0e08\u0e19',
      voiceJosh: '\u0e2a\u0e07\u0e1a, \u0e0a\u0e31\u0e14\u0e40\u0e08\u0e19, \u0e19\u0e48\u0e32\u0e2a\u0e19\u0e43\u0e08',
      voiceArnold: '\u0e21\u0e31\u0e48\u0e19\u0e43\u0e08, \u0e17\u0e23\u0e07\u0e1e\u0e25\u0e31\u0e07, \u0e40\u0e25\u0e48\u0e32\u0e40\u0e23\u0e37\u0e48\u0e2d\u0e07',
      audioTitle: '\u0e1e\u0e2d\u0e14\u0e41\u0e04\u0e2a\u0e15\u0e4c\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13',
      downloadMp3: '\u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14 MP3',
      generatingAudio: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e2a\u0e35\u0e22\u0e07...',
      sourcesTitle: '\u0e41\u0e2b\u0e25\u0e48\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e07\u0e32\u0e19\u0e27\u0e34\u0e08\u0e31\u0e22',
      footer: '\u0e2a\u0e15\u0e39\u0e14\u0e34\u0e42\u0e2d\u0e27\u0e34\u0e08\u0e31\u0e22\u0e1e\u0e2d\u0e14\u0e41\u0e04\u0e2a\u0e15\u0e4c',
      styleUploadBtn: '\u0e41\u0e17\u0e19\u0e17\u0e35\u0e48\u0e04\u0e39\u0e48\u0e21\u0e37\u0e2d\u0e2a\u0e44\u0e15\u0e25\u0e4c',
      styleClear: '\u0e25\u0e49\u0e32\u0e07',
      styleLoaded: '\u0e42\u0e2b\u0e25\u0e14\u0e2a\u0e44\u0e15\u0e25\u0e4c\u0e41\u0e25\u0e49\u0e27:',
      // Dynamic strings
      researching: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e04\u0e49\u0e19\u0e04\u0e27\u0e49\u0e32...',
      writingScript: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e02\u0e35\u0e22\u0e19\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c...',
      done: '\u0e40\u0e2a\u0e23\u0e47\u0e08\u0e2a\u0e34\u0e49\u0e19',
      generatingAudioStatus: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e2a\u0e35\u0e22\u0e07...',
      failed: '\u0e25\u0e49\u0e21\u0e40\u0e2b\u0e25\u0e27',
      copied: '\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27!',
      copyFailed: '\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08',
      errorMin3: '\u0e2b\u0e31\u0e27\u0e02\u0e49\u0e2d\u0e15\u0e49\u0e2d\u0e07\u0e21\u0e35\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 3 \u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23',
      errorMax500: '\u0e2b\u0e31\u0e27\u0e02\u0e49\u0e2d\u0e15\u0e49\u0e2d\u0e07\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 500 \u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23',
      errorGeneric: '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14\u0e23\u0e30\u0e2b\u0e27\u0e48\u0e32\u0e07\u0e01\u0e32\u0e23\u0e2a\u0e23\u0e49\u0e32\u0e07',
      audioFailed: '\u0e01\u0e32\u0e23\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e2a\u0e35\u0e22\u0e07\u0e25\u0e49\u0e21\u0e40\u0e2b\u0e25\u0e27',
      startingAudio: '\u0e40\u0e23\u0e34\u0e48\u0e21\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e2a\u0e35\u0e22\u0e07...',
      audioReady: '\u0e40\u0e2a\u0e35\u0e22\u0e07\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e41\u0e25\u0e49\u0e27!',
      generatedIn: '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e43\u0e19',
      totalTime: '\u0e40\u0e27\u0e25\u0e32\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14:',
      characters: '\u0e15\u0e31\u0e27\u0e2d\u0e31\u0e01\u0e29\u0e23',
      words: '\u0e04\u0e33',
      minRead: '\u0e19\u0e32\u0e17\u0e35\u0e2d\u0e48\u0e32\u0e19'
    }
  };

  // --- i18n helper ---
  function t(key) {
    return (translations[currentLang] && translations[currentLang][key]) || translations.en[key] || key;
  }

  function applyTranslations() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (translations[currentLang] && translations[currentLang][key]) {
        el.textContent = translations[currentLang][key];
      }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (translations[currentLang] && translations[currentLang][key]) {
        el.placeholder = translations[currentLang][key];
      }
    });

    // Update html lang attribute
    document.documentElement.lang = currentLang === 'th' ? 'th' : 'en';

    // Update toggle button active state
    document.querySelectorAll('.lang-option').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-lang') === currentLang);
    });
  }

  // --- Language toggle ---
  langToggle.addEventListener('click', function () {
    currentLang = currentLang === 'en' ? 'th' : 'en';
    localStorage.setItem('lang', currentLang);
    applyTranslations();
  });

  // Apply saved language on load
  applyTranslations();

  // --- Style guide override ---
  var styleUploadBtn = document.getElementById('style-upload-btn');
  var styleFileInput = document.getElementById('style-file-input');
  var styleStatus = document.getElementById('style-status');
  var styleFilename = document.getElementById('style-filename');
  var styleClearBtn = document.getElementById('style-clear-btn');

  styleUploadBtn.addEventListener('click', function () {
    styleFileInput.click();
  });

  styleFileInput.addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      customStyleGuide = e.target.result;
      styleFilename.textContent = t('styleLoaded') + ' ' + file.name;
      styleStatus.classList.remove('hidden');
      styleUploadBtn.classList.add('hidden');
    };
    reader.readAsText(file);
  });

  styleClearBtn.addEventListener('click', function () {
    customStyleGuide = null;
    styleFileInput.value = '';
    styleStatus.classList.add('hidden');
    styleUploadBtn.classList.remove('hidden');
  });

  // --- Input validation (FR-1) ---
  subjectInput.addEventListener('input', function () {
    var len = this.value.length;
    charCount.textContent = len + ' / 500';
    if (len > 0 && len < 3) {
      inputError.textContent = t('errorMin3');
      this.classList.add('invalid');
    } else {
      inputError.textContent = '';
      this.classList.remove('invalid');
    }
  });

  // --- Form submission ---
  subjectForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var subject = subjectInput.value.trim();

    if (subject.length < 3) {
      inputError.textContent = t('errorMin3');
      subjectInput.classList.add('invalid');
      subjectInput.focus();
      return;
    }
    if (subject.length > 500) {
      inputError.textContent = t('errorMax500');
      subjectInput.classList.add('invalid');
      return;
    }

    inputError.textContent = '';
    subjectInput.classList.remove('invalid');
    startGeneration(subject);
  });

  // --- Generation pipeline ---
  async function startGeneration(subject) {
    generationStartTime = Date.now();
    resetUI();
    showSection(progressSection);
    generateBtn.disabled = true;
    generateBtn.classList.add('loading');

    try {
      // Phase 1: Research
      setStepActive('research');
      updateStepStatus('research', t('researching'));
      var researchData = await fetchResearch(subject);
      setStepComplete('research');
      updateStepStatus('research', t('done'));

      // Phase 2: Script
      setStepActive('script');
      updateStepStatus('script', t('writingScript'));
      var scriptData = await fetchScript(subject, researchData);
      setStepComplete('script');
      updateStepStatus('script', t('done'));

      // Show script
      displayScript(scriptData);
      displaySources(scriptData.sources || researchData.sources || []);

    } catch (err) {
      showError(err.message || t('errorGeneric'));
    } finally {
      generateBtn.disabled = false;
      generateBtn.classList.remove('loading');
    }
  }

  // --- API calls ---
  async function fetchResearch(subject) {
    var res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject, lang: currentLang, styleGuide: customStyleGuide })
    });

    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Research failed');
    }

    // Handle streaming responses for live findings
    if (res.headers.get('content-type')?.includes('text/event-stream')) {
      return await handleResearchStream(res);
    }

    return await res.json();
  }

  async function handleResearchStream(res) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var result = {};
    var buffer = '';

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });

      // Process complete SSE messages (separated by double newline)
      var parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (var p = 0; p < parts.length; p++) {
        var msgLines = parts[p].split('\n');
        for (var i = 0; i < msgLines.length; i++) {
          var line = msgLines[i];
          if (line.startsWith('data: ')) {
            try {
              var data = JSON.parse(line.slice(6));
              if (data.type === 'finding') {
                addFinding(data.text);
              } else if (data.type === 'status') {
                updateStepStatus('research', data.text);
              } else if (data.type === 'complete') {
                result = data.result;
              }
            } catch (_) { /* skip malformed lines */ }
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      var remaining = buffer.split('\n');
      for (var j = 0; j < remaining.length; j++) {
        if (remaining[j].startsWith('data: ')) {
          try {
            var finalData = JSON.parse(remaining[j].slice(6));
            if (finalData.type === 'complete') {
              result = finalData.result;
            }
          } catch (_) { /* skip */ }
        }
      }
    }

    return result;
  }

  async function fetchScript(subject, researchData) {
    var res = await fetch('/api/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject, research: researchData, lang: currentLang, styleGuide: customStyleGuide })
    });

    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Script generation failed');
    }

    return await res.json();
  }

  async function generateAudio(script, voice) {
    audioGenProgress.classList.remove('hidden');
    audioProgressBar.style.width = '0%';
    audioProgressText.textContent = t('startingAudio');

    var res = await fetch('/api/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: script, voice: voice, lang: currentLang })
    });

    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Audio generation failed');
    }

    // Handle streaming audio chunks
    if (res.headers.get('content-type')?.includes('text/event-stream')) {
      return await handleAudioStream(res);
    }

    var blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  async function handleAudioStream(res) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var audioUrl = '';
    var buffer = '';

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });

      // Process complete SSE messages (separated by double newline)
      var parts = buffer.split('\n\n');
      // Last part may be incomplete — keep it in the buffer
      buffer = parts.pop() || '';

      for (var p = 0; p < parts.length; p++) {
        var msgLines = parts[p].split('\n');
        for (var i = 0; i < msgLines.length; i++) {
          var line = msgLines[i];
          if (line.startsWith('data: ')) {
            try {
              var data = JSON.parse(line.slice(6));
              if (data.type === 'progress') {
                var pct = Math.round((data.chunk / data.total) * 100);
                audioProgressBar.style.width = pct + '%';
                audioProgressText.textContent = t('generatingAudioStatus').replace('...', ' ' + data.chunk + '/' + data.total + '...');
              } else if (data.type === 'complete') {
                // Handle both URL-based (local server) and base64 data (Vercel)
                audioUrl = data.audioData || data.url;
                audioProgressBar.style.width = '100%';
                audioProgressText.textContent = t('audioReady');
              }
            } catch (_) { /* skip */ }
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      var remaining = buffer.split('\n');
      for (var j = 0; j < remaining.length; j++) {
        if (remaining[j].startsWith('data: ')) {
          try {
            var finalData = JSON.parse(remaining[j].slice(6));
            if (finalData.type === 'complete') {
              audioUrl = finalData.audioData || finalData.url;
            }
          } catch (_) { /* skip */ }
        }
      }
    }

    return audioUrl;
  }

  // --- Display functions ---
  function displayScript(data) {
    currentScript = data.script || data.text || '';
    var wordCount = currentScript.split(/\s+/).length;
    var readingMinutes = Math.round(wordCount / 150);

    scriptContent.textContent = currentScript;
    scriptMeta.textContent = wordCount.toLocaleString() + ' ' + t('words') + ' ~ ' + readingMinutes + ' ' + t('minRead');

    showSection(scriptSection);
    showSection(voiceSection);

    // Show character estimate for audio
    charEstimate.textContent = currentScript.length.toLocaleString();
    audioEstimate.classList.remove('hidden');

    // Show stats
    var elapsed = ((Date.now() - generationStartTime) / 1000).toFixed(1);
    statTime.textContent = t('generatedIn') + ' ' + elapsed + 's';
    statChars.textContent = currentScript.length.toLocaleString() + ' ' + t('characters');
    generationStats.classList.remove('hidden');
  }

  function displaySources(sources) {
    currentSources = sources;
    if (!sources || sources.length === 0) return;

    sourcesList.innerHTML = '';
    sources.forEach(function (source, i) {
      var el = document.createElement('a');
      el.className = 'source-item';
      var safeUrl = source.url || '#';
      if (safeUrl !== '#' && !/^https?:\/\//i.test(safeUrl)) safeUrl = '#';
      el.href = safeUrl;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
      el.innerHTML =
        '<span class="source-index">' + (i + 1) + '</span>' +
        '<div class="source-details">' +
          '<div class="source-title">' + escapeHtml(source.title || 'Source ' + (i + 1)) + '</div>' +
          '<div class="source-url">' + escapeHtml(source.url || '') + '</div>' +
        '</div>';
      sourcesList.appendChild(el);
    });

    showSection(sourcesSection);
  }

  function addFinding(text) {
    var el = document.createElement('div');
    el.className = 'feed-item';
    el.textContent = text;
    feedList.prepend(el);
  }

  // --- Pipeline step helpers ---
  function setStepActive(stepName) {
    var el = document.getElementById('step-' + stepName);
    if (el) {
      el.classList.remove('complete', 'error');
      el.classList.add('active');
    }
  }

  function setStepComplete(stepName) {
    var el = document.getElementById('step-' + stepName);
    if (el) {
      el.classList.remove('active', 'error');
      el.classList.add('complete');
    }
  }

  function setStepError(stepName) {
    var el = document.getElementById('step-' + stepName);
    if (el) {
      el.classList.remove('active', 'complete');
      el.classList.add('error');
    }
  }

  function updateStepStatus(stepName, text) {
    var el = document.getElementById(stepName + '-status');
    if (el) el.textContent = text;
  }

  // --- Audio player controls ---
  playPauseBtn.addEventListener('click', function () {
    if (audioElement.paused) {
      audioElement.play();
    } else {
      audioElement.pause();
    }
  });

  audioElement.addEventListener('play', function () {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    startWaveform();
  });

  audioElement.addEventListener('pause', function () {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  });

  audioElement.addEventListener('ended', function () {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    stopWaveform();
  });

  audioElement.addEventListener('timeupdate', function () {
    if (audioElement.duration) {
      var pct = (audioElement.currentTime / audioElement.duration) * 100;
      progressBar.style.width = pct + '%';
      progressHandle.style.left = pct + '%';
      currentTimeEl.textContent = formatTime(audioElement.currentTime);
    }
  });

  audioElement.addEventListener('loadedmetadata', function () {
    totalTimeEl.textContent = formatTime(audioElement.duration);
  });

  // Scrub bar click
  progressBarWrapper.addEventListener('click', function (e) {
    if (!audioElement.duration) return;
    var rect = this.getBoundingClientRect();
    var pct = (e.clientX - rect.left) / rect.width;
    audioElement.currentTime = pct * audioElement.duration;
  });

  // Volume
  volumeSlider.addEventListener('input', function () {
    audioElement.volume = this.value;
  });

  // --- Waveform visualization ---
  function startWaveform() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      var source = audioContext.createMediaElementSource(audioElement);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
    }
    drawWaveform();
  }

  function drawWaveform() {
    if (!analyser) return;
    var ctx = waveformCanvas.getContext('2d');
    var bufferLength = analyser.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);

    function draw() {
      animFrameId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      var w = waveformCanvas.width;
      var h = waveformCanvas.height;
      ctx.clearRect(0, 0, w, h);

      var barWidth = (w / bufferLength) * 2;
      var x = 0;

      for (var i = 0; i < bufferLength; i++) {
        var barHeight = (dataArray[i] / 255) * h;
        var hue = 250 + (dataArray[i] / 255) * 30;
        ctx.fillStyle = 'hsla(' + hue + ', 70%, 65%, 0.8)';
        ctx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    }
    draw();
  }

  function stopWaveform() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  // --- Voice selection ---
  voiceGrid.addEventListener('click', function (e) {
    var card = e.target.closest('.voice-card');
    if (!card) return;
    voiceGrid.querySelectorAll('.voice-card').forEach(function (c) {
      c.classList.remove('selected');
    });
    card.classList.add('selected');
    card.querySelector('input').checked = true;
  });

  // --- Script actions ---
  copyScriptBtn.addEventListener('click', async function () {
    if (!currentScript) return;
    try {
      await navigator.clipboard.writeText(currentScript);
      showButtonFeedback(this, t('copied'));
    } catch (_) {
      showButtonFeedback(this, t('copyFailed'));
    }
  });

  downloadScriptBtn.addEventListener('click', function () {
    if (!currentScript) return;
    var blob = new Blob([currentScript], { type: 'text/markdown' });
    downloadBlob(blob, 'podcast-script.md');
  });

  generateAudioBtn.addEventListener('click', async function () {
    if (!currentScript) return;
    var selectedVoice = document.querySelector('input[name="voice"]:checked')?.value || 'adam';

    this.disabled = true;
    this.classList.add('loading');
    setStepActive('audio');
    updateStepStatus('audio', t('generatingAudioStatus'));

    try {
      var audioUrl = await generateAudio(currentScript, selectedVoice);
      setStepComplete('audio');
      updateStepStatus('audio', t('done'));

      audioElement.src = audioUrl;
      showSection(audioSection);

      // Update total time stats
      var elapsed = ((Date.now() - generationStartTime) / 1000).toFixed(1);
      statTime.textContent = t('totalTime') + ' ' + elapsed + 's';
    } catch (err) {
      setStepError('audio');
      updateStepStatus('audio', t('failed'));
      showError(err.message || t('audioFailed'));
    } finally {
      this.disabled = false;
      this.classList.remove('loading');
    }
  });

  downloadAudioBtn.addEventListener('click', function () {
    if (!audioElement.src) return;
    var a = document.createElement('a');
    a.href = audioElement.src;
    a.download = 'podcast.mp3';
    a.click();
  });

  // --- Utility ---
  function showSection(el) {
    el.classList.remove('hidden');
  }

  function resetUI() {
    // Hide output sections
    [scriptSection, voiceSection, audioSection, sourcesSection, generationStats, audioGenProgress].forEach(function (el) {
      el.classList.add('hidden');
    });
    audioEstimate.classList.add('hidden');
    feedList.innerHTML = '';
    scriptContent.textContent = '';
    sourcesList.innerHTML = '';
    currentScript = '';
    currentSources = [];

    // Reset pipeline steps
    document.querySelectorAll('.pipeline-step').forEach(function (step) {
      step.classList.remove('active', 'complete', 'error');
    });
    updateStepStatus('research', t('waiting'));
    updateStepStatus('script', t('waiting'));
    updateStepStatus('audio', t('waiting'));

    // Reset audio
    audioElement.pause();
    audioElement.src = '';
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    progressBar.style.width = '0%';
    progressHandle.style.left = '0%';
    currentTimeEl.textContent = '0:00';
    totalTimeEl.textContent = '0:00';

    stopWaveform();
  }

  function showError(msg) {
    inputError.textContent = msg;
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showButtonFeedback(btn, text) {
    var original = btn.innerHTML;
    btn.textContent = text;
    setTimeout(function () {
      btn.innerHTML = original;
    }, 1500);
  }

})();
