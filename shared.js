/* ============================================================
   GRADE 7 SCIENCE — SHARED JAVASCRIPT MODULE
   ============================================================
   Used by landing page and all unit pages.
   Provides: theming, sign-in, quiz engine, activity helpers,
   grade recording, CSV/JSON export, navigation utilities.
   ============================================================ */

// ===== THEME =====
function toggleTheme() {
  document.body.classList.toggle('light');
  const light = document.body.classList.contains('light');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = light ? '🌙 Dark' : '☀️ Light';
  localStorage.setItem('g7-theme', light ? 'light' : 'dark');
}
function loadTheme() {
  if (localStorage.getItem('g7-theme') === 'light') document.body.classList.add('light');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
}

// ===== SIDEBAR =====
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  if (sb) sb.classList.toggle('open');
  if (ov) ov.classList.toggle('show');
}

// ===== EXPANDABLE SECTIONS =====
function toggleExpand(btn) {
  btn.classList.toggle('open');
  btn.nextElementSibling.classList.toggle('open');
}

// ===== SIGN-IN =====
function googleSignIn() {
  const name = prompt('Enter your full name (First Last):');
  if (!name || !name.trim()) return;
  const email = prompt('Enter your school email:');
  if (!email || !email.trim()) return;
  localStorage.setItem('g7-student-name', name.trim());
  localStorage.setItem('g7-student-email', email.trim());
  checkSignIn();
}
function checkSignIn() {
  const name = localStorage.getItem('g7-student-name');
  const email = localStorage.getItem('g7-student-email');
  const overlay = document.getElementById('signinOverlay');
  const display = document.getElementById('studentDisplay');
  if (name && email) {
    if (overlay) overlay.classList.add('hidden');
    if (display) display.textContent = '👤 ' + name;
  } else {
    if (overlay) overlay.classList.remove('hidden');
    if (display) display.textContent = '';
  }
}

// ===== GRADE RECORDING =====
function recordGrade(quizId, lessonTitle, score, total, passed) {
  const name = localStorage.getItem('g7-student-name') || 'Unknown';
  const email = localStorage.getItem('g7-student-email') || 'unknown';
  const pct = Math.round(score / total * 100);
  const record = { email, name, quizId, lessonTitle, score, total, percentage: pct, passed, attempts: 1, remediationUsed: false, timestamp: new Date().toISOString() };
  let grades = JSON.parse(localStorage.getItem('g7-grades') || '[]');
  const existing = grades.findIndex(g => g.email === email && g.quizId === quizId);
  if (existing >= 0) {
    record.attempts = (grades[existing].attempts || 1) + 1;
    if (pct > grades[existing].percentage) grades[existing] = record;
    else grades[existing].attempts = record.attempts;
  } else { grades.push(record); }
  localStorage.setItem('g7-grades', JSON.stringify(grades));
  const url = localStorage.getItem('g7-apps-script-url');
  if (url) {
    fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) }).catch(e => console.log('Apps Script sync:', e));
  }
}

// ===== CSV EXPORT =====
function exportCSV() {
  const grades = JSON.parse(localStorage.getItem('g7-grades') || '[]');
  if (!grades.length) { alert('No grade data to export.'); return; }
  let csv = 'Name,Email,Quiz,Lesson,Score,Total,Percentage,Passed,Attempts,Timestamp\n';
  grades.forEach(g => { csv += `"${g.name}","${g.email}","${g.quizId}","${g.lessonTitle || ''}",${g.score},${g.total},${g.percentage}%,${g.passed ? 'Yes' : 'No'},${g.attempts},"${g.timestamp}"\n`; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'G7Science_Grades_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

// ===== JSON EXPORT =====
function exportJSON() {
  const grades = JSON.parse(localStorage.getItem('g7-grades') || '[]');
  if (!grades.length) { alert('No grade data to export.'); return; }
  const blob = new Blob([JSON.stringify(grades, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'G7Science_Grades_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}

// ===== CLEAR GRADES =====
function clearGrades() {
  if (!confirm('Delete ALL stored grade data? This cannot be undone.')) return;
  localStorage.removeItem('g7-grades');
  if (typeof renderTeacherDashboard === 'function') renderTeacherDashboard();
}

// ===== TEACHER DASHBOARD =====
function renderTeacherDashboard() {
  const grades = JSON.parse(localStorage.getItem('g7-grades') || '[]');
  const el = document.getElementById('teacherGrades');
  if (!el) return;
  if (!grades.length) { el.innerHTML = '<p style="color:var(--text3)">No grade data recorded yet.</p>'; return; }
  let html = '<table class="grade-table"><thead><tr><th>Student</th><th>Email</th><th>Quiz</th><th>Score</th><th>%</th><th>Passed</th><th>Attempts</th><th>Date</th></tr></thead><tbody>';
  grades.forEach(g => { html += `<tr><td>${g.name}</td><td>${g.email}</td><td>${g.quizId}</td><td>${g.score}/${g.total}</td><td>${g.percentage}%</td><td>${g.passed ? '✅' : '❌'}</td><td>${g.attempts}</td><td>${g.timestamp ? g.timestamp.slice(0, 10) : ''}</td></tr>`; });
  html += '</tbody></table>';
  el.innerHTML = html;
  const urlInput = document.getElementById('appsScriptUrl');
  if (urlInput) urlInput.value = localStorage.getItem('g7-apps-script-url') || '';
}

// ===== ADAPTIVE QUIZ ENGINE =====
// Each unit page creates its own quizBanks object and calls initQuiz().
// quizState is kept global so the engine works across pages.
const quizState = {};

/** Initialize a quiz with given bank ID and quiz banks object */
function initQuiz(qid, quizBanks) {
  const bank = quizBanks[qid];
  if (!bank) { console.error('Quiz bank not found:', qid); return; }
  quizState[qid] = {
    currentQ: 0,
    questions: bank.primary.map((q, i) => ({ ...q, idx: i, isReplacement: false, strikes: 0 })),
    score: 0, answered: 0, total: bank.primary.length,
    inRemediation: false, remOutcome: null, remQuestions: [], remIdx: 0, remCorrect: 0,
    banks: quizBanks
  };
  renderAQ(qid);
}

/** Render adaptive quiz question */
function renderAQ(qid) {
  const s = quizState[qid];
  const area = document.getElementById(qid.replace('quiz', 'quiz') + '-area');
  if (!area) return;
  if (s.inRemediation) { renderRem(qid); return; }
  if (s.currentQ >= s.total) { showResults(qid); return; }
  const q = s.questions[s.currentQ];
  const letters = ['A', 'B', 'C', 'D'];
  const pct = Math.round(s.currentQ / s.total * 100);
  area.innerHTML = `<div class="quiz-view active"><div class="quiz-progress"><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><div class="quiz-progress-text">Question ${s.currentQ + 1} of ${s.total}</div></div><div class="quiz-question-wrap"><div class="question-card"><div class="q-outcome">${q.outcome}</div><div class="q-text">${q.q}</div><div class="options">${q.opts.map((o, j) => `<button class="option-btn" onclick="pickAns('${qid}',${j})"><span class="option-letter">${letters[j]}</span>${o}</button>`).join('')}</div><div class="feedback-box" id="${qid}-fb"></div><div class="quiz-nav"><button class="quiz-next-btn" id="${qid}-next" onclick="nextQ('${qid}')">Next →</button></div></div></div></div>`;
}

/** Handle answer selection */
function pickAns(qid, oi) {
  const s = quizState[qid], q = s.questions[s.currentQ];
  const area = document.getElementById(qid + '-area');
  const btns = area.querySelectorAll('.option-btn');
  if (btns[0].classList.contains('disabled')) return;
  btns.forEach(b => b.classList.add('disabled'));
  const fb = document.getElementById(qid + '-fb'), nb = document.getElementById(qid + '-next');
  if (oi === q.ans) {
    btns[oi].classList.add('correct-answer');
    fb.className = 'feedback-box show correct';
    fb.textContent = '✅ Correct! ' + q.explain;
    s.score++; s.answered++;
    nb.classList.add('show');
  } else {
    btns[oi].classList.add('wrong-answer');
    btns[q.ans].classList.add('correct-answer');
    q.strikes++; s.answered++;
    if (q.strikes === 1 && !q.isReplacement) {
      const rep = s.banks[qid].replacement[q.idx];
      if (rep) {
        fb.className = 'feedback-box show wrong';
        fb.innerHTML = '❌ ' + q.explain + '<br><br>⚡ <strong>Let\'s try a similar question…</strong>';
        s.questions[s.currentQ] = { ...rep, idx: q.idx, isReplacement: true, strikes: 0 };
        s.answered--;
        setTimeout(() => renderAQ(qid), 2200);
        return;
      }
    } else if ((q.strikes >= 1 && q.isReplacement) || q.strikes >= 2) {
      const oc = q.outcome, bk = s.banks[qid].remediation[oc];
      if (bk) {
        fb.className = 'feedback-box show wrong';
        fb.innerHTML = '❌ ' + q.explain + '<br><br>📖 <strong>Time for a mini-lesson! Watch a video and answer 3 questions.</strong>';
        setTimeout(() => { s.inRemediation = true; s.remOutcome = oc; s.remCorrect = 0; pickRemQ(qid); renderAQ(qid); }, 2800);
        return;
      }
    }
    fb.className = 'feedback-box show wrong';
    fb.textContent = '❌ ' + q.explain;
    nb.classList.add('show');
  }
}

/** Pick remediation questions */
function pickRemQ(qid) {
  const s = quizState[qid], pool = s.banks[qid].remediation[s.remOutcome].questions;
  s.remQuestions = [...pool].sort(() => Math.random() - .5).slice(0, 3);
  s.remIdx = 0; s.remCorrect = 0;
}

/** Render remediation view */
function renderRem(qid) {
  const s = quizState[qid], area = document.getElementById(qid + '-area');
  const bk = s.banks[qid].remediation[s.remOutcome];
  const videoSrc = bk.video || bk.videoUrl || '';
  if (s.remIdx === 0) {
    area.innerHTML = `<div class="remediation-view active"><div class="remediation-header"><h2>📖 Mini-Lesson: ${s.remOutcome}</h2><p>Watch this video, then answer 3 questions correctly to continue.</p></div><div class="glass-card"><div class="video-wrap"><iframe src="${videoSrc}" title="Remediation" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div></div><div style="text-align:center;margin-top:20px"><button class="nav-btn primary" onclick="startRemQ('${qid}')">I've Watched — Start Questions →</button></div></div>`;
    return;
  }
  renderRemQ(qid);
}

function startRemQ(qid) { quizState[qid].remIdx = 1; renderRemQ(qid); }

/** Render a remediation question */
function renderRemQ(qid) {
  const s = quizState[qid], q = s.remQuestions[s.remCorrect];
  if (!q) { pickRemQ(qid); renderRemQ(qid); return; }
  const area = document.getElementById(qid + '-area'), letters = ['A', 'B', 'C', 'D'];
  area.innerHTML = `<div class="remediation-view active"><div class="remediation-header"><h2>📖 Mini-Lesson: ${s.remOutcome}</h2><p>Get all 3 correct to return! (${s.remCorrect}/3)</p></div><div class="question-card"><div class="q-outcome">${s.remOutcome} — Remediation</div><div class="q-text">${q.q}</div><div class="options">${q.opts.map((o, j) => `<button class="option-btn" onclick="pickRemAns('${qid}',${j})"><span class="option-letter">${letters[j]}</span>${o}</button>`).join('')}</div><div class="feedback-box" id="${qid}-rfb"></div><div class="quiz-nav"><button class="quiz-next-btn" id="${qid}-rnxt" onclick="nextRemQ('${qid}')">Next →</button></div></div></div>`;
}

/** Handle remediation answer */
function pickRemAns(qid, oi) {
  const s = quizState[qid], q = s.remQuestions[s.remCorrect];
  const area = document.getElementById(qid + '-area');
  const btns = area.querySelectorAll('.option-btn');
  if (btns[0].classList.contains('disabled')) return;
  btns.forEach(b => b.classList.add('disabled'));
  const fb = document.getElementById(qid + '-rfb'), nb = document.getElementById(qid + '-rnxt');
  if (oi === q.ans) {
    btns[oi].classList.add('correct-answer');
    fb.className = 'feedback-box show correct';
    fb.textContent = '✅ ' + q.explain;
    s.remCorrect++;
    nb.classList.add('show');
    if (s.remCorrect >= 3) nb.textContent = 'Return to Quiz ✓';
  } else {
    btns[oi].classList.add('wrong-answer');
    btns[q.ans].classList.add('correct-answer');
    fb.className = 'feedback-box show wrong';
    fb.innerHTML = '❌ ' + q.explain + '<br><br>🔄 <strong>Let\'s try again from the start…</strong>';
    setTimeout(() => { s.remCorrect = 0; pickRemQ(qid); s.remIdx = 1; renderRemQ(qid); }, 2200);
  }
}

/** Advance remediation or return to quiz */
function nextRemQ(qid) {
  const s = quizState[qid];
  if (s.remCorrect >= 3) {
    s.inRemediation = false; s.remOutcome = null;
    s.currentQ = 0; s.score = 0; s.answered = 0;
    s.questions = s.banks[qid].primary.map((q, i) => ({ ...q, idx: i, isReplacement: false, strikes: 0 }));
    renderAQ(qid);
    return;
  }
  renderRemQ(qid);
}

/** Advance to next question */
function nextQ(qid) { quizState[qid].currentQ++; renderAQ(qid); }

/** Show quiz results */
function showResults(qid) {
  const s = quizState[qid];
  const pct = Math.round(s.score / s.total * 100);
  const pass = pct >= 80;
  const area = document.getElementById(qid + '-area');
  // Extract lesson number from qid (e.g. "quiz1" → 1)
  const ln = parseInt(qid.replace(/\D/g, ''), 10) || 1;
  const unitKey = document.body.dataset.unitKey || 'a';
  if (pass) {
    localStorage.setItem(`g7-unit${unitKey}-lesson${ln}-passed`, 'true');
    localStorage.setItem(`g7-unit${unitKey}-lesson${ln}-pct`, pct);
    if (typeof updateLock === 'function') updateLock();
    if (typeof updateProgress === 'function') updateProgress();
  }
  recordGrade(qid, `Unit ${unitKey.toUpperCase()} Lesson ${ln}`, s.score, s.total, pass);
  let bh = '';
  if (pass) {
    bh = `<button class="results-btn primary" onclick="goTo('home')">Continue →</button><button class="results-btn" onclick="initQuiz('${qid}', quizState['${qid}'].banks)">🔄 Retake</button>`;
  } else {
    bh = `<button class="results-btn primary" onclick="goTo('lesson${ln}')">📖 Review Lesson</button><button class="results-btn" onclick="initQuiz('${qid}', quizState['${qid}'].banks)">🔄 Retry</button>`;
  }
  area.innerHTML = `<div class="quiz-results-view active"><div class="score-circle ${pass ? 'pass' : 'fail'}">${pct}%</div><p class="quiz-msg">${pass ? '🎉 Excellent! You\'ve mastered this lesson!' : '📖 You need 80% to unlock the next lesson.'}</p><p class="quiz-msg-sub">${s.score}/${s.total} (${pct}%)${pass ? '' : ' — Need ' + Math.ceil(s.total * .8)}</p><div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap">${bh}</div></div>`;
}

// ===== ACTIVITY GATE SYSTEM =====
// Each unit page defines its own actComplete map and calls these helpers.
let actComplete = {};

/** Mark an activity as complete and check the gate */
function markActivityDone(lesson, actName, score, total) {
  const key = 'l' + lesson;
  if (!actComplete[key]) actComplete[key] = {};
  actComplete[key][actName] = true;
  const unitKey = document.body.dataset.unitKey || 'a';
  recordGrade(`${unitKey}-l${lesson}-${actName}`, `Unit ${unitKey.toUpperCase()} Lesson ${lesson} Activity: ${actName}`, score, total, true);
  checkGate(lesson);
}

/** Check if all activities for a lesson are complete; unlock quiz button */
function checkGate(lesson) {
  const acts = actComplete['l' + lesson];
  if (!acts) return;
  const allDone = Object.values(acts).every(v => v);
  const btn = document.getElementById('l' + lesson + '-quiz-btn');
  const msg = document.getElementById('l' + lesson + '-gate-msg');
  if (btn && allDone) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    if (msg) { msg.innerHTML = '✅ All activities complete! You may now take the quiz.'; msg.style.color = 'var(--accent)'; }
  }
}

// ===== PAGE NAVIGATION (within a unit) =====
function goTo(page) {
  // Check locks
  const unitKey = document.body.dataset.unitKey || 'a';
  if (typeof lockMap !== 'undefined' && lockMap[page]) {
    if (!localStorage.getItem(lockMap[page])) return;
  }
  document.querySelectorAll('.lesson-page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    if (n.dataset.page === page) n.classList.add('active');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.innerWidth <= 900) { const sb = document.getElementById('sidebar'); const ov = document.getElementById('overlay'); if (sb) sb.classList.remove('open'); if (ov) ov.classList.remove('show'); }
  // Fire page-specific init via custom callback
  if (typeof onPageLoad === 'function') onPageLoad(page);
}

// ===== PAUSE-AND-CHECK REVEAL =====
function revealAnswer(btn) {
  const panel = btn.nextElementSibling;
  const isOpen = panel.classList.toggle('open');
  btn.textContent = isOpen ? '🙈 Hide Answers' : '👀 Reveal Answers';
}

// ===== CONSTRUCTED RESPONSE & REFLECTION =====
function saveCR() {
  const unitKey = document.body.dataset.unitKey || 'a';
  const el = document.getElementById('crResponse');
  if (el) localStorage.setItem(`g7-unit${unitKey}-l1-cr`, el.value);
}
function saveReflection() {
  const unitKey = document.body.dataset.unitKey || 'a';
  const el = document.getElementById('reflectionText');
  if (el) localStorage.setItem(`g7-unit${unitKey}-l1-reflect`, el.value);
}
function loadSavedText() {
  const unitKey = document.body.dataset.unitKey || 'a';
  const cr = document.getElementById('crResponse');
  const rf = document.getElementById('reflectionText');
  if (cr) cr.value = localStorage.getItem(`g7-unit${unitKey}-l1-cr`) || '';
  if (rf) rf.value = localStorage.getItem(`g7-unit${unitKey}-l1-reflect`) || '';
}

// ===== READ TO ME — TEXT-TO-SPEECH =====
const ttsState = { speaking: false, paused: false, sections: [], currentIdx: 0, rate: 1.0 };

function initReadToMe() {
  if (!('speechSynthesis' in window)) return; // Browser doesn't support TTS
  const toolbar = document.createElement('div');
  toolbar.className = 'tts-toolbar';
  toolbar.id = 'ttsToolbar';
  toolbar.innerHTML = `
    <button class="tts-toggle" id="ttsMainBtn" onclick="toggleTTS()" title="Read to Me">🔊</button>
    <span class="tts-toggle-label">Read to Me</span>
    <div class="tts-controls" id="ttsControls" style="display:none">
      <button class="tts-btn" onclick="ttsBack()" title="Previous section">⏮</button>
      <button class="tts-btn" id="ttsPauseBtn" onclick="ttsPause()" title="Pause">⏸</button>
      <button class="tts-btn" onclick="ttsForward()" title="Next section">⏭</button>
      <button class="tts-btn" onclick="ttsStop()" title="Stop" style="color:var(--danger)">⏹</button>
      <select class="tts-rate" id="ttsRate" onchange="ttsChangeRate(this.value)" title="Reading speed">
        <option value="0.8">0.8×</option>
        <option value="0.9">0.9×</option>
        <option value="1" selected>1.0×</option>
        <option value="1.1">1.1×</option>
        <option value="1.2">1.2×</option>
        <option value="1.5">1.5×</option>
      </select>
    </div>`;
  document.body.appendChild(toolbar);
}

function toggleTTS() {
  if (ttsState.speaking) { ttsStop(); return; }
  // Gather all visible content sections on the active page
  const activePage = document.querySelector('.lesson-page.active');
  if (!activePage) return;
  const sections = activePage.querySelectorAll('.glass-card.content, .key-point, .pause-check, .constructed-response, .reflection-box');
  if (!sections.length) return;
  ttsState.sections = Array.from(sections);
  ttsState.currentIdx = 0;
  ttsState.speaking = true;
  ttsState.paused = false;
  document.getElementById('ttsControls').style.display = 'flex';
  document.getElementById('ttsMainBtn').classList.add('playing');
  document.getElementById('ttsMainBtn').innerHTML = '🔇';
  document.querySelector('.tts-toggle-label').textContent = 'Reading…';
  readCurrentSection();
}

function readCurrentSection() {
  if (!ttsState.speaking || ttsState.currentIdx >= ttsState.sections.length) { ttsStop(); return; }
  // Remove previous highlight
  document.querySelectorAll('.tts-reading').forEach(el => el.classList.remove('tts-reading'));
  const section = ttsState.sections[ttsState.currentIdx];
  section.classList.add('tts-reading');
  section.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Get clean text content (skip buttons, inputs, iframes)
  const text = getReadableText(section);
  if (!text.trim()) { ttsState.currentIdx++; readCurrentSection(); return; }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = ttsState.rate;
  utterance.pitch = 1.0;
  utterance.lang = 'en-CA';

  utterance.onend = () => {
    section.classList.remove('tts-reading');
    ttsState.currentIdx++;
    if (ttsState.speaking && ttsState.currentIdx < ttsState.sections.length) {
      readCurrentSection();
    } else {
      ttsStop();
    }
  };
  utterance.onerror = () => { ttsStop(); };

  speechSynthesis.cancel(); // Clear any queued speech
  speechSynthesis.speak(utterance);
}

function getReadableText(el) {
  const clone = el.cloneNode(true);
  // Remove elements that shouldn't be read
  clone.querySelectorAll('button, input, textarea, select, iframe, .vocab-def, .reveal-answer, script, style').forEach(e => e.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

function ttsPause() {
  if (!ttsState.speaking) return;
  if (ttsState.paused) {
    speechSynthesis.resume();
    ttsState.paused = false;
    document.getElementById('ttsPauseBtn').innerHTML = '⏸';
    document.getElementById('ttsPauseBtn').title = 'Pause';
  } else {
    speechSynthesis.pause();
    ttsState.paused = true;
    document.getElementById('ttsPauseBtn').innerHTML = '▶';
    document.getElementById('ttsPauseBtn').title = 'Resume';
  }
}

function ttsStop() {
  speechSynthesis.cancel();
  ttsState.speaking = false;
  ttsState.paused = false;
  ttsState.currentIdx = 0;
  document.querySelectorAll('.tts-reading').forEach(el => el.classList.remove('tts-reading'));
  document.getElementById('ttsControls').style.display = 'none';
  document.getElementById('ttsMainBtn').classList.remove('playing');
  document.getElementById('ttsMainBtn').innerHTML = '🔊';
  document.querySelector('.tts-toggle-label').textContent = 'Read to Me';
}

function ttsBack() {
  if (!ttsState.speaking) return;
  speechSynthesis.cancel();
  ttsState.currentIdx = Math.max(0, ttsState.currentIdx - 1);
  readCurrentSection();
}

function ttsForward() {
  if (!ttsState.speaking) return;
  speechSynthesis.cancel();
  ttsState.currentIdx = Math.min(ttsState.sections.length - 1, ttsState.currentIdx + 1);
  readCurrentSection();
}

function ttsChangeRate(val) {
  ttsState.rate = parseFloat(val);
  if (ttsState.speaking && !ttsState.paused) {
    speechSynthesis.cancel();
    readCurrentSection();
  }
}

// ===== INIT ON LOAD =====
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  checkSignIn();
  loadSavedText();
  initReadToMe();
  // Shift+T reveals teacher nav
  document.addEventListener('keydown', e => {
    if (e.shiftKey && e.key === 'T') {
      const tn = document.getElementById('teacherNav');
      if (tn) tn.style.display = tn.style.display === 'none' ? '' : 'none';
    }
  });
});
