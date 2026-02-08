const socket = io();

let currentSession = {};
let allStudents = {};
let allVotes = {};

// ─── Auth ────────────────────────────────────────────────────────────────────

const authScreen = document.getElementById('auth-screen');
const adminPanel = document.getElementById('admin-panel');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');

authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  socket.emit('admin:auth', document.getElementById('admin-password').value);
});

socket.on('admin:authenticated', () => {
  authScreen.classList.add('hidden');
  adminPanel.classList.remove('hidden');
});

// ─── Controls ────────────────────────────────────────────────────────────────

const btnSetTopic = document.getElementById('btn-set-topic');
const btnOpenVote = document.getElementById('btn-open-vote');
const btnCloseVote = document.getElementById('btn-close-vote');
const btnResetSession = document.getElementById('btn-reset-session');
const btnResetAll = document.getElementById('btn-reset-all');
const btnSetSeats = document.getElementById('btn-set-seats');
const btnSetPassword = document.getElementById('btn-set-password');
const topicInput = document.getElementById('topic-input');

btnSetTopic.addEventListener('click', () => {
  const topic = topicInput.value.trim();
  if (!topic) return;
  socket.emit('admin:setTopic', topic);
  btnOpenVote.disabled = false;
});

btnOpenVote.addEventListener('click', () => {
  socket.emit('admin:openVoting');
});

btnCloseVote.addEventListener('click', () => {
  socket.emit('admin:closeVoting');
});

btnResetSession.addEventListener('click', () => {
  if (confirm('Nollställ aktuell omröstning?')) {
    socket.emit('admin:resetSession');
    btnOpenVote.disabled = true;
    btnCloseVote.disabled = true;
    topicInput.value = '';
    updateLiveBars({});
  }
});

btnResetAll.addEventListener('click', () => {
  if (confirm('VARNING: Detta raderar alla data inklusive inloggade elever. Fortsätt?')) {
    socket.emit('admin:resetAll');
    topicInput.value = '';
    btnOpenVote.disabled = true;
    btnCloseVote.disabled = true;
  }
});

btnSetSeats.addEventListener('click', () => {
  const count = document.getElementById('seats-input').value;
  socket.emit('admin:setSeats', parseInt(count));
});

btnSetPassword.addEventListener('click', () => {
  const pw = document.getElementById('new-password').value;
  if (pw.length < 3) { alert('Lösenordet måste vara minst 3 tecken'); return; }
  socket.emit('admin:setPassword', pw);
  document.getElementById('new-password').value = '';
  alert('Lösenord uppdaterat');
});

// ─── Session updates ─────────────────────────────────────────────────────────

socket.on('session:update', (session) => {
  currentSession = session;
  updateStatusUI();
});

socket.on('students:update', (students) => {
  allStudents = students;
  updateStudentList();
  updateStats();
});

socket.on('votes:update', (data) => {
  allVotes = data.votes || {};
  updateLiveBars(allVotes);
  document.getElementById('vote-progress').style.width =
    data.totalStudents ? (data.voteCount / data.totalStudents * 100) + '%' : '0%';
  document.getElementById('progress-text').textContent =
    `${data.voteCount} / ${data.totalStudents} har röstat`;
  document.getElementById('stat-votes').textContent = data.voteCount;
});

socket.on('voting:opened', () => {
  btnOpenVote.disabled = true;
  btnCloseVote.disabled = false;
  updateLiveBars({});
});

socket.on('voting:closed', (results) => {
  btnCloseVote.disabled = true;
  btnOpenVote.disabled = false;
  addHistoryItem(results);
});

socket.on('state', (state) => {
  currentSession = state.session;
  allStudents = state.students;
  allVotes = state.votes || {};
  updateStatusUI();
  updateStudentList();
  updateStats();
  updateLiveBars(allVotes);

  if (state.history) {
    state.history.forEach(h => addHistoryItem(h.results || h));
  }
});

socket.on('error', (data) => {
  authError.textContent = data.message;
  authError.classList.remove('hidden');
  setTimeout(() => authError.classList.add('hidden'), 4000);
});

// ─── UI helpers ──────────────────────────────────────────────────────────────

function updateStatusUI() {
  const indicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  indicator.classList.remove('status-idle', 'status-open', 'status-active');

  if (currentSession.votingOpen) {
    indicator.classList.add('status-open');
    statusText.textContent = `Omröstning pågår: ${currentSession.topic}`;
    btnOpenVote.disabled = true;
    btnCloseVote.disabled = false;
  } else if (currentSession.topic) {
    indicator.classList.add('status-active');
    statusText.textContent = `Ämne inställt: ${currentSession.topic}`;
    btnOpenVote.disabled = false;
    btnCloseVote.disabled = true;
  } else {
    indicator.classList.add('status-idle');
    statusText.textContent = 'Ingen aktiv omröstning';
    btnOpenVote.disabled = true;
    btnCloseVote.disabled = true;
  }

  document.getElementById('stat-seats').textContent = currentSession.totalSeats || 58;
}

function updateStats() {
  document.getElementById('stat-students').textContent = Object.keys(allStudents).length;
}

function updateStudentList() {
  const list = document.getElementById('student-list');
  const entries = Object.entries(allStudents);
  if (entries.length === 0) {
    list.innerHTML = '<p class="muted">Inga ledamöter inloggade ännu.</p>';
    return;
  }

  entries.sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  list.innerHTML = `
    <table class="student-table">
      <thead>
        <tr><th>Plats</th><th>Namn</th><th>Land</th><th>Grupp</th><th></th></tr>
      </thead>
      <tbody>
        ${entries.map(([seat, s]) => `
          <tr>
            <td>${seat}</td>
            <td>${s.name}</td>
            <td>${s.country}</td>
            <td><span class="group-tag" data-group="${s.group}">${s.group}</span></td>
            <td><button class="btn btn-sm btn-danger" onclick="removeStudent(${seat})">Ta bort</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function removeStudent(seat) {
  if (confirm(`Ta bort ledamot på plats ${seat}?`)) {
    socket.emit('admin:removeStudent', seat);
  }
}

function updateLiveBars(votes) {
  const vals = Object.values(votes);
  const ja = vals.filter(v => v === 'JA').length;
  const nej = vals.filter(v => v === 'NEJ').length;
  const avstar = vals.filter(v => v === 'AVSTÅR').length;
  const total = Object.keys(allStudents).length || 1;

  document.getElementById('live-ja').style.width = (ja / total * 100) + '%';
  document.getElementById('live-nej').style.width = (nej / total * 100) + '%';
  document.getElementById('live-avstar').style.width = (avstar / total * 100) + '%';
  document.getElementById('live-ja-num').textContent = ja;
  document.getElementById('live-nej-num').textContent = nej;
  document.getElementById('live-avstar-num').textContent = avstar;
}

let historyCount = 0;
function addHistoryItem(results) {
  const container = document.getElementById('history-list');
  if (historyCount === 0) container.innerHTML = '';
  historyCount++;

  const s = results.summary;
  const passed = results.passed;
  const div = document.createElement('div');
  div.className = 'history-item';
  div.innerHTML = `
    <div class="history-header">
      <span class="history-num">#${historyCount}</span>
      <span class="history-topic">${results.topic}</span>
      <span class="history-verdict ${passed ? 'verdict-passed' : 'verdict-rejected'}">${passed ? 'ANTAGEN' : 'AVSLAGEN'}</span>
    </div>
    <div class="history-stats">
      <span class="hs-ja">JA: ${s.ja}</span>
      <span class="hs-nej">NEJ: ${s.nej}</span>
      <span class="hs-avstar">AVSTÅR: ${s.avstar}</span>
      <span class="hs-total">(${s.voted}/${s.total} röstade)</span>
    </div>
  `;
  container.prepend(div);
}
