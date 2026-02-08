const socket = io();

let students = {};
let votes = {};
let session = {};
let seatElements = {};

const GROUPS = {
  EPP:    { name: 'EPP',      color: '#003399' },
  SD:     { name: 'S&D',      color: '#CC0000' },
  RE:     { name: 'Renew',    color: '#FFD700' },
  GREENS: { name: 'Gröna',    color: '#009933' },
  ECR:    { name: 'ECR',      color: '#0054A5' },
  ID:     { name: 'ID',       color: '#2B3856' },
  GUE:    { name: 'GUE/NGL',  color: '#8B0000' },
  NI:     { name: 'Grupplösa', color: '#999999' }
};

const VOTE_COLORS = {
  JA:     '#00C853',
  NEJ:    '#FF1744',
  'AVSTÅR': '#FFAB00',
  none:   '#2a2a4a',
  empty:  '#1a1a3a'
};

// ─── Clock ───────────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  document.getElementById('monitor-clock').textContent =
    now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ─── Hemicycle rendering ─────────────────────────────────────────────────────

function buildHemicycle(totalSeats) {
  const svg = document.getElementById('hemicycle');
  svg.innerHTML = '';
  seatElements = {};

  const cx = 400;
  const cy = 420;
  const rows = getRowDistribution(totalSeats);
  const seatRadius = Math.min(14, Math.max(8, 200 / totalSeats * 4));

  let seatIndex = 1;

  rows.forEach((seatsInRow, rowIdx) => {
    const rInner = 120 + rowIdx * (seatRadius * 2.6);
    const angleStart = Math.PI * 0.08;
    const angleEnd = Math.PI * 0.92;

    for (let i = 0; i < seatsInRow; i++) {
      const angle = angleStart + (angleEnd - angleStart) * (i / (seatsInRow - 1 || 1));
      const x = cx - rInner * Math.cos(angle);
      const y = cy - rInner * Math.sin(angle);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'seat-group');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', seatRadius);
      circle.setAttribute('fill', VOTE_COLORS.empty);
      circle.setAttribute('stroke', '#333355');
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('class', 'seat');
      circle.dataset.seat = seatIndex;

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y + 1);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('fill', '#667');
      text.setAttribute('font-size', Math.min(10, seatRadius * 0.9));
      text.setAttribute('font-family', 'monospace');
      text.setAttribute('pointer-events', 'none');
      text.textContent = seatIndex;

      // Tooltip
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `Plats ${seatIndex} - Tom`;
      circle.appendChild(title);

      g.appendChild(circle);
      g.appendChild(text);
      svg.appendChild(g);

      seatElements[seatIndex] = { circle, text, title };
      seatIndex++;
    }
  });
}

function getRowDistribution(total) {
  // Distribute seats across rows in a hemicycle pattern
  if (total <= 10) return [total];
  if (total <= 20) return [Math.floor(total * 0.4), Math.ceil(total * 0.6)];
  if (total <= 35) return [
    Math.floor(total * 0.25),
    Math.floor(total * 0.35),
    Math.ceil(total * 0.40)
  ];
  if (total <= 60) return [
    Math.floor(total * 0.15),
    Math.floor(total * 0.22),
    Math.floor(total * 0.28),
    Math.ceil(total * 0.35)
  ];
  // 60+
  return [
    Math.floor(total * 0.10),
    Math.floor(total * 0.17),
    Math.floor(total * 0.22),
    Math.floor(total * 0.25),
    Math.ceil(total * 0.26)
  ];
}

// ─── Update seats ────────────────────────────────────────────────────────────

function updateSeats() {
  for (const [seat, el] of Object.entries(seatElements)) {
    const student = students[seat];
    const vote = votes[seat];

    if (!student) {
      el.circle.setAttribute('fill', VOTE_COLORS.empty);
      el.circle.setAttribute('stroke', '#333355');
      el.text.setAttribute('fill', '#445');
      el.title.textContent = `Plats ${seat} - Tom`;
      el.circle.classList.remove('seat-voted', 'seat-active');
      continue;
    }

    if (vote) {
      el.circle.setAttribute('fill', VOTE_COLORS[vote]);
      el.circle.setAttribute('stroke', vote === 'JA' ? '#00E676' : vote === 'NEJ' ? '#FF5252' : '#FFD740');
      el.text.setAttribute('fill', '#fff');
      el.title.textContent = `Plats ${seat} - ${student.name} (${student.country}, ${student.group}) - ${vote}`;
      el.circle.classList.add('seat-voted');
      el.circle.classList.remove('seat-active');
    } else {
      el.circle.setAttribute('fill', VOTE_COLORS.none);
      el.circle.setAttribute('stroke', GROUPS[student.group]?.color || '#666');
      el.circle.setAttribute('stroke-width', '2');
      el.text.setAttribute('fill', '#aab');
      el.title.textContent = `Plats ${seat} - ${student.name} (${student.country}, ${student.group})`;
      el.circle.classList.add('seat-active');
      el.circle.classList.remove('seat-voted');
    }
  }
}

// ─── Totals ──────────────────────────────────────────────────────────────────

function updateTotals() {
  const vals = Object.values(votes);
  const ja = vals.filter(v => v === 'JA').length;
  const nej = vals.filter(v => v === 'NEJ').length;
  const avstar = vals.filter(v => v === 'AVSTÅR').length;
  const total = Object.keys(students).length;
  const notVoted = total - vals.length;

  animateNumber('total-ja', ja);
  animateNumber('total-nej', nej);
  animateNumber('total-avstar', avstar);
  animateNumber('total-notvoted', Math.max(0, notVoted));
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  el.textContent = target;
  el.classList.add('number-flash');
  setTimeout(() => el.classList.remove('number-flash'), 400);
}

// ─── Group breakdown ─────────────────────────────────────────────────────────

function updateGroupBreakdown() {
  const container = document.getElementById('group-breakdown');
  const groupData = {};

  for (const [seat, student] of Object.entries(students)) {
    const g = student.group || 'NI';
    if (!groupData[g]) groupData[g] = { ja: 0, nej: 0, avstar: 0, noVote: 0, total: 0 };
    groupData[g].total++;
    if (votes[seat] === 'JA') groupData[g].ja++;
    else if (votes[seat] === 'NEJ') groupData[g].nej++;
    else if (votes[seat] === 'AVSTÅR') groupData[g].avstar++;
    else groupData[g].noVote++;
  }

  const groupOrder = ['EPP', 'SD', 'RE', 'GREENS', 'ECR', 'ID', 'GUE', 'NI'];
  const activeGroups = groupOrder.filter(g => groupData[g]);

  if (activeGroups.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = activeGroups.map(gId => {
    const g = groupData[gId];
    const info = GROUPS[gId];
    return `
      <div class="gb-group" style="border-color:${info.color}">
        <div class="gb-name" style="color:${info.color}">${info.name}</div>
        <div class="gb-count">${g.total} ledamöter</div>
        <div class="gb-votes">
          <span class="gb-ja">${g.ja}</span> /
          <span class="gb-nej">${g.nej}</span> /
          <span class="gb-avstar">${g.avstar}</span>
        </div>
        <div class="gb-labels">JA / NEJ / AVST</div>
      </div>
    `;
  }).join('');
}

// ─── Result overlay ──────────────────────────────────────────────────────────

function showResults(results) {
  const overlay = document.getElementById('result-overlay');
  const s = results.summary;
  const total = s.total || 1;

  document.getElementById('result-verdict-big').textContent = results.passed ? 'ANTAGEN' : 'AVSLAGEN';
  document.getElementById('result-verdict-big').className = 'result-verdict-big ' + (results.passed ? 'verdict-passed' : 'verdict-rejected');

  document.getElementById('ro-ja').style.width = (s.ja / total * 100) + '%';
  document.getElementById('ro-nej').style.width = (s.nej / total * 100) + '%';
  document.getElementById('ro-avstar').style.width = (s.avstar / total * 100) + '%';
  document.getElementById('ro-ja-num').textContent = s.ja;
  document.getElementById('ro-nej-num').textContent = s.nej;
  document.getElementById('ro-avstar-num').textContent = s.avstar;

  overlay.classList.remove('hidden');
  overlay.classList.add('fade-in');
}

function hideResults() {
  const overlay = document.getElementById('result-overlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('fade-in');
}

// ─── Socket events ───────────────────────────────────────────────────────────

socket.on('state', (state) => {
  session = state.session;
  students = state.students;
  votes = state.votes || {};

  buildHemicycle(session.totalSeats || 58);
  updateSeats();
  updateTotals();
  updateGroupBreakdown();
  updateTopicBar();

  if (state.results && !session.votingOpen) {
    showResults(state.results);
  }
});

socket.on('session:update', (s) => {
  session = s;
  buildHemicycle(s.totalSeats || 58);
  updateSeats();
  updateTotals();
  updateTopicBar();
});

socket.on('students:update', (s) => {
  students = s;
  updateSeats();
  updateTotals();
  updateGroupBreakdown();
});

socket.on('votes:update', (data) => {
  votes = data.votes;
  updateSeats();
  updateTotals();
  updateGroupBreakdown();
});

socket.on('voting:opened', (data) => {
  votes = {};
  hideResults();
  updateSeats();
  updateTotals();
  updateGroupBreakdown();

  document.getElementById('monitor-topic').textContent = data.topic;
  document.getElementById('monitor-status-badge').textContent = 'PÅGÅR';
  document.getElementById('monitor-status-badge').className = 'monitor-status-badge status-open';
});

socket.on('voting:closed', (results) => {
  // Final update of seats with vote data
  if (results.seatDetails) {
    for (const [seat, detail] of Object.entries(results.seatDetails)) {
      if (detail.vote) votes[seat] = detail.vote;
    }
  }
  updateSeats();
  updateTotals();
  updateGroupBreakdown();
  showResults(results);

  document.getElementById('monitor-status-badge').textContent = results.passed ? 'ANTAGEN' : 'AVSLAGEN';
  document.getElementById('monitor-status-badge').className = 'monitor-status-badge ' + (results.passed ? 'status-passed' : 'status-rejected');
});

function updateTopicBar() {
  const topicEl = document.getElementById('monitor-topic');
  const badge = document.getElementById('monitor-status-badge');

  if (session.votingOpen) {
    topicEl.textContent = session.topic;
    badge.textContent = 'PÅGÅR';
    badge.className = 'monitor-status-badge status-open';
  } else if (session.topic) {
    topicEl.textContent = session.topic;
    badge.textContent = 'VÄNTAR';
    badge.className = 'monitor-status-badge status-waiting';
  } else {
    topicEl.textContent = 'Väntar på omröstning...';
    badge.textContent = 'VÄNTAR';
    badge.className = 'monitor-status-badge status-waiting';
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

buildHemicycle(58);
