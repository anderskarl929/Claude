const socket = io();

let mySeat = null;
let myVote = null;

// ─── Elements ────────────────────────────────────────────────────────────────

const loginScreen = document.getElementById('login-screen');
const votingScreen = document.getElementById('voting-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const seatInput = document.getElementById('seat-number');
const nameInput = document.getElementById('student-name');
const countrySelect = document.getElementById('country-select');
const groupSelect = document.getElementById('group-select');

const waitingCard = document.getElementById('waiting-card');
const voteCard = document.getElementById('vote-card');
const resultCard = document.getElementById('result-card');
const voteTopic = document.getElementById('vote-topic');
const voteStatus = document.getElementById('vote-status');
const resultSummary = document.getElementById('result-summary');

const badgeName = document.getElementById('badge-name');
const badgeCountry = document.getElementById('badge-country');
const badgeGroup = document.getElementById('badge-group');
const badgeSeat = document.getElementById('badge-seat');
const memberBadge = document.getElementById('member-badge');

// ─── Populate dropdowns ──────────────────────────────────────────────────────

fetch('/api/countries')
  .then(r => r.json())
  .then(countries => {
    countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.id})`;
      countrySelect.appendChild(opt);
    });
  });

fetch('/api/groups')
  .then(r => r.json())
  .then(groups => {
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      groupSelect.appendChild(opt);
    });
  });

// ─── Login ───────────────────────────────────────────────────────────────────

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const seatNumber = parseInt(seatInput.value);
  const name = nameInput.value.trim();
  const country = countrySelect.value;
  const group = groupSelect.value;

  if (!name || !country || !group) {
    showError('Fyll i alla fält');
    return;
  }

  socket.emit('student:join', { seatNumber, name, country, group });
});

socket.on('joined', (data) => {
  mySeat = data.seatNumber;
  const s = data.student;
  badgeName.textContent = s.name;
  badgeCountry.textContent = s.country;
  badgeGroup.textContent = s.group;
  badgeSeat.textContent = s.seatNumber;

  // Apply group color
  fetch('/api/groups').then(r => r.json()).then(groups => {
    const g = groups.find(g => g.id === s.group);
    if (g) memberBadge.style.borderLeftColor = g.color;
  });

  loginScreen.classList.add('hidden');
  votingScreen.classList.remove('hidden');
});

// ─── Voting ──────────────────────────────────────────────────────────────────

document.querySelectorAll('.vote-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!mySeat) return;
    const vote = btn.dataset.vote;
    socket.emit('student:vote', { seatNumber: mySeat, vote });

    // Visual feedback
    document.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

socket.on('vote:confirmed', (data) => {
  myVote = data.vote;
  voteStatus.textContent = `Din röst: ${data.vote} har registrerats`;
  voteStatus.classList.remove('hidden');
  voteStatus.className = `vote-status vote-status-${data.vote.toLowerCase()}`;
});

// ─── Session updates ─────────────────────────────────────────────────────────

socket.on('voting:opened', (data) => {
  myVote = null;
  voteTopic.textContent = data.topic;
  waitingCard.classList.add('hidden');
  resultCard.classList.add('hidden');
  voteCard.classList.remove('hidden');
  voteStatus.classList.add('hidden');
  document.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('selected'));
});

socket.on('voting:closed', (results) => {
  voteCard.classList.add('hidden');
  waitingCard.classList.add('hidden');
  resultCard.classList.remove('hidden');

  const s = results.summary;
  const passedClass = results.passed ? 'result-passed' : 'result-rejected';
  const passedText = results.passed ? 'ANTAGEN' : 'AVSLAGEN';

  resultSummary.innerHTML = `
    <div class="result-verdict ${passedClass}">${passedText}</div>
    <h3>${results.topic}</h3>
    <div class="result-bars">
      <div class="result-bar-row">
        <span class="result-label">JA</span>
        <div class="result-bar"><div class="result-bar-fill bar-ja" style="width:${s.total ? (s.ja/s.total*100) : 0}%"></div></div>
        <span class="result-number">${s.ja}</span>
      </div>
      <div class="result-bar-row">
        <span class="result-label">NEJ</span>
        <div class="result-bar"><div class="result-bar-fill bar-nej" style="width:${s.total ? (s.nej/s.total*100) : 0}%"></div></div>
        <span class="result-number">${s.nej}</span>
      </div>
      <div class="result-bar-row">
        <span class="result-label">AVSTÅR</span>
        <div class="result-bar"><div class="result-bar-fill bar-avstar" style="width:${s.total ? (s.avstar/s.total*100) : 0}%"></div></div>
        <span class="result-number">${s.avstar}</span>
      </div>
    </div>
    <p class="result-detail">${s.voted} av ${s.total} ledamöter röstade</p>
  `;
});

socket.on('session:update', (session) => {
  if (!mySeat) return;
  if (!session.votingOpen && !resultCard.classList.contains('hidden')) return;
  if (!session.votingOpen) {
    voteCard.classList.add('hidden');
    resultCard.classList.add('hidden');
    waitingCard.classList.remove('hidden');
  }
});

socket.on('state', (state) => {
  // Handle reconnect state
  if (mySeat && state.session.votingOpen) {
    voteTopic.textContent = state.session.topic;
    waitingCard.classList.add('hidden');
    resultCard.classList.add('hidden');
    voteCard.classList.remove('hidden');
  }
});

// ─── Errors ──────────────────────────────────────────────────────────────────

socket.on('error', (data) => {
  showError(data.message);
});

function showError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
  setTimeout(() => loginError.classList.add('hidden'), 4000);
}
