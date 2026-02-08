const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── State ───────────────────────────────────────────────────────────────────

const EU_COUNTRIES = [
  { id: 'DE', name: 'Tyskland', seats: 96 },
  { id: 'FR', name: 'Frankrike', seats: 79 },
  { id: 'IT', name: 'Italien', seats: 76 },
  { id: 'ES', name: 'Spanien', seats: 61 },
  { id: 'PL', name: 'Polen', seats: 52 },
  { id: 'RO', name: 'Rumänien', seats: 33 },
  { id: 'NL', name: 'Nederländerna', seats: 31 },
  { id: 'BE', name: 'Belgien', seats: 22 },
  { id: 'CZ', name: 'Tjeckien', seats: 21 },
  { id: 'GR', name: 'Grekland', seats: 21 },
  { id: 'HU', name: 'Ungern', seats: 21 },
  { id: 'PT', name: 'Portugal', seats: 21 },
  { id: 'SE', name: 'Sverige', seats: 21 },
  { id: 'AT', name: 'Österrike', seats: 20 },
  { id: 'BG', name: 'Bulgarien', seats: 17 },
  { id: 'DK', name: 'Danmark', seats: 15 },
  { id: 'FI', name: 'Finland', seats: 15 },
  { id: 'SK', name: 'Slovakien', seats: 15 },
  { id: 'IE', name: 'Irland', seats: 14 },
  { id: 'HR', name: 'Kroatien', seats: 12 },
  { id: 'LT', name: 'Litauen', seats: 11 },
  { id: 'LV', name: 'Lettland', seats: 9 },
  { id: 'SI', name: 'Slovenien', seats: 9 },
  { id: 'EE', name: 'Estland', seats: 7 },
  { id: 'CY', name: 'Cypern', seats: 6 },
  { id: 'LU', name: 'Luxemburg', seats: 6 },
  { id: 'MT', name: 'Malta', seats: 6 }
];

// Political groups in the EU Parliament
const POLITICAL_GROUPS = [
  { id: 'EPP', name: 'EPP - Europeiska folkpartiet', color: '#003399' },
  { id: 'SD', name: 'S&D - Socialdemokraterna', color: '#CC0000' },
  { id: 'RE', name: 'Renew Europe', color: '#FFD700' },
  { id: 'GREENS', name: 'Gröna/EFA', color: '#009933' },
  { id: 'ECR', name: 'ECR - Konservativa', color: '#0054A5' },
  { id: 'ID', name: 'ID - Identitet och Demokrati', color: '#2B3856' },
  { id: 'GUE', name: 'GUE/NGL - Vänsterpartiet', color: '#8B0000' },
  { id: 'NI', name: 'Grupplösa', color: '#999999' }
];

let students = {};       // { seatNumber: { name, country, group, seatNumber } }
let votes = {};          // { seatNumber: 'JA' | 'NEJ' | 'AVSTÅR' }
let currentSession = {
  active: false,
  topic: '',
  votingOpen: false,
  totalSeats: 58
};
let sessionHistory = []; // past voting results
let adminPassword = 'eu2026';

// ─── REST API ────────────────────────────────────────────────────────────────

app.get('/api/countries', (req, res) => {
  res.json(EU_COUNTRIES);
});

app.get('/api/groups', (req, res) => {
  res.json(POLITICAL_GROUPS);
});

app.get('/api/session', (req, res) => {
  res.json(currentSession);
});

app.get('/api/students', (req, res) => {
  res.json(students);
});

app.get('/api/history', (req, res) => {
  res.json(sessionHistory);
});

// ─── Socket.IO ───────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current state on connect
  socket.emit('state', {
    session: currentSession,
    students,
    votes: currentSession.votingOpen ? votes : {},
    results: !currentSession.votingOpen ? getResults() : null,
    history: sessionHistory
  });

  // ── Student actions ──────────────────────────────────────────────────────

  socket.on('student:join', (data) => {
    const { seatNumber, name, country, group } = data;
    if (seatNumber < 1 || seatNumber > currentSession.totalSeats) {
      socket.emit('error', { message: 'Ogiltigt platsnummer' });
      return;
    }
    if (students[seatNumber] && students[seatNumber].socketId !== socket.id) {
      // Allow reconnection to same seat
      if (students[seatNumber].name !== name) {
        socket.emit('error', { message: `Plats ${seatNumber} är redan upptagen av ${students[seatNumber].name}` });
        return;
      }
    }
    students[seatNumber] = { name, country, group, seatNumber, socketId: socket.id };
    socket.seatNumber = seatNumber;
    socket.emit('joined', { seatNumber, student: students[seatNumber] });
    io.emit('students:update', students);
    console.log(`Student joined: ${name} (seat ${seatNumber}, ${country}, ${group})`);
  });

  socket.on('student:vote', (data) => {
    const { seatNumber, vote } = data;
    if (!currentSession.votingOpen) {
      socket.emit('error', { message: 'Omröstningen är inte öppen' });
      return;
    }
    if (!students[seatNumber]) {
      socket.emit('error', { message: 'Du måste vara inloggad för att rösta' });
      return;
    }
    if (!['JA', 'NEJ', 'AVSTÅR'].includes(vote)) {
      socket.emit('error', { message: 'Ogiltig röst' });
      return;
    }
    votes[seatNumber] = vote;
    socket.emit('vote:confirmed', { vote });
    io.emit('votes:update', {
      votes,
      voteCount: Object.keys(votes).length,
      totalStudents: Object.keys(students).length
    });
    console.log(`Vote: seat ${seatNumber} voted ${vote}`);
  });

  // ── Admin actions ────────────────────────────────────────────────────────

  socket.on('admin:auth', (password) => {
    if (password === adminPassword) {
      socket.isAdmin = true;
      socket.emit('admin:authenticated');
    } else {
      socket.emit('error', { message: 'Fel lösenord' });
    }
  });

  socket.on('admin:setTopic', (topic) => {
    if (!socket.isAdmin) return;
    currentSession.topic = topic;
    currentSession.active = true;
    io.emit('session:update', currentSession);
  });

  socket.on('admin:openVoting', () => {
    if (!socket.isAdmin) return;
    votes = {};
    currentSession.votingOpen = true;
    io.emit('session:update', currentSession);
    io.emit('voting:opened', { topic: currentSession.topic });
    console.log('Voting opened:', currentSession.topic);
  });

  socket.on('admin:closeVoting', () => {
    if (!socket.isAdmin) return;
    currentSession.votingOpen = false;
    const results = getResults();
    sessionHistory.push({
      topic: currentSession.topic,
      results,
      votes: { ...votes },
      students: { ...students },
      timestamp: new Date().toISOString()
    });
    io.emit('session:update', currentSession);
    io.emit('voting:closed', results);
    console.log('Voting closed. Results:', results.summary);
  });

  socket.on('admin:resetSession', () => {
    if (!socket.isAdmin) return;
    votes = {};
    currentSession.topic = '';
    currentSession.votingOpen = false;
    io.emit('session:update', currentSession);
    io.emit('votes:update', { votes: {}, voteCount: 0, totalStudents: Object.keys(students).length });
  });

  socket.on('admin:resetAll', () => {
    if (!socket.isAdmin) return;
    students = {};
    votes = {};
    currentSession = { active: false, topic: '', votingOpen: false, totalSeats: 58 };
    sessionHistory = [];
    io.emit('state', { session: currentSession, students: {}, votes: {}, results: null, history: [] });
  });

  socket.on('admin:removeStudent', (seatNumber) => {
    if (!socket.isAdmin) return;
    delete students[seatNumber];
    delete votes[seatNumber];
    io.emit('students:update', students);
  });

  socket.on('admin:setPassword', (newPassword) => {
    if (!socket.isAdmin) return;
    adminPassword = newPassword;
    socket.emit('admin:passwordChanged');
  });

  socket.on('admin:setSeats', (count) => {
    if (!socket.isAdmin) return;
    currentSession.totalSeats = parseInt(count) || 58;
    io.emit('session:update', currentSession);
  });

  // ── Disconnect ───────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Don't remove student on disconnect — they may reconnect
  });
});

function getResults() {
  const ja = Object.values(votes).filter(v => v === 'JA').length;
  const nej = Object.values(votes).filter(v => v === 'NEJ').length;
  const avstar = Object.values(votes).filter(v => v === 'AVSTÅR').length;
  const total = Object.keys(students).length;
  const voted = Object.keys(votes).length;
  const notVoted = total - voted;

  // Build per-group breakdown
  const groupBreakdown = {};
  for (const [seat, student] of Object.entries(students)) {
    const group = student.group || 'NI';
    if (!groupBreakdown[group]) {
      groupBreakdown[group] = { ja: 0, nej: 0, avstar: 0, notVoted: 0, total: 0 };
    }
    groupBreakdown[group].total++;
    if (votes[seat] === 'JA') groupBreakdown[group].ja++;
    else if (votes[seat] === 'NEJ') groupBreakdown[group].nej++;
    else if (votes[seat] === 'AVSTÅR') groupBreakdown[group].avstar++;
    else groupBreakdown[group].notVoted++;
  }

  // Build per-country breakdown
  const countryBreakdown = {};
  for (const [seat, student] of Object.entries(students)) {
    const country = student.country || '??';
    if (!countryBreakdown[country]) {
      countryBreakdown[country] = { ja: 0, nej: 0, avstar: 0, notVoted: 0, total: 0 };
    }
    countryBreakdown[country].total++;
    if (votes[seat] === 'JA') countryBreakdown[country].ja++;
    else if (votes[seat] === 'NEJ') countryBreakdown[country].nej++;
    else if (votes[seat] === 'AVSTÅR') countryBreakdown[country].avstar++;
    else countryBreakdown[country].notVoted++;
  }

  // Per-seat vote details
  const seatDetails = {};
  for (const [seat, student] of Object.entries(students)) {
    seatDetails[seat] = {
      ...student,
      vote: votes[seat] || null
    };
  }

  const passed = ja > nej;

  return {
    summary: { ja, nej, avstar, notVoted, total, voted },
    passed,
    groupBreakdown,
    countryBreakdown,
    seatDetails,
    topic: currentSession.topic
  };
}

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🇪🇺  EU Parliament Voting App`);
  console.log(`   Server running on http://localhost:${PORT}`);
  console.log(`   Admin panel:  http://localhost:${PORT}/admin.html`);
  console.log(`   Vote monitor: http://localhost:${PORT}/monitor.html`);
  console.log(`   Student login: http://localhost:${PORT}\n`);
});
