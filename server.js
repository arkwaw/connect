const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Support simple team URL scheme: /:team/:player -> redirect to room.html with seed and player
// Support theme-aware team URL scheme: /:theme/:team/:player -> redirect to room.html with seed, player and theme
app.get('/:theme/:team/:player', (req, res) => {
  try {
    const theme = req.params.theme;
    const team = req.params.team;
    const player = req.params.player;
    if (!team) return res.status(400).send('Missing team');
    if (!(player === '1' || player === '2')) return res.status(404).send('Player must be 1 or 2');
    // compute a time-bucketed seed so visits within the same 3-minute window share the same seed
    const bucketMs = 3 * 60 * 1000; // 3 minutes in ms
    const startBucket = Math.floor(Date.now() / bucketMs);
    const seedRaw = `${team}:${startBucket}`;
    const hashed = crypto.createHash('sha256').update(seedRaw).digest('hex');
    const seed = encodeURIComponent(hashed);
    const playerParam = player === '1' ? 'player1' : 'player2';
    // Redirect to room with seed, player and theme param. Keep optional time or name query if present.
    const q = [];
    if (req.query.time) q.push('time=' + encodeURIComponent(req.query.time));
    if (req.query.name) q.push('name=' + encodeURIComponent(req.query.name));
    // include the start bucket so clients can optionally inspect the bucketed time
    q.push('start=' + encodeURIComponent(startBucket));
    q.push('theme=' + encodeURIComponent(theme));
    const qstr = q.length ? '&' + q.join('&') : '';
    return res.redirect(`/room.html?seed=${seed}&player=${playerParam}${qstr}`);
  } catch (err) {
    console.error('team route error', err);
    return res.status(500).send('Server error');
  }
});

// Backwards-compatible route: /:team/:player (no theme)
app.get('/:team/:player', (req, res) => {
  try {
    const team = req.params.team;
    const player = req.params.player;
    if (!team) return res.status(400).send('Missing team');
    if (!(player === '1' || player === '2')) return res.status(404).send('Player must be 1 or 2');
    // compute a time-bucketed seed so visits within the same 3-minute window share the same seed
    const bucketMs = 3 * 60 * 1000; // 3 minutes in ms
    const startBucket = Math.floor(Date.now() / bucketMs);
    const seedRaw = `${team}:${startBucket}`;
    const hashed = crypto.createHash('sha256').update(seedRaw).digest('hex');
    const seed = encodeURIComponent(hashed);
    const playerParam = player === '1' ? 'player1' : 'player2';
    // Redirect to room with seed and player param. Keep optional time or name query if present.
    const q = [];
    if (req.query.time) q.push('time=' + encodeURIComponent(req.query.time));
    if (req.query.name) q.push('name=' + encodeURIComponent(req.query.name));
    // include the start bucket so clients can optionally inspect the bucketed time
    q.push('start=' + encodeURIComponent(startBucket));
    const qstr = q.length ? '&' + q.join('&') : '';
    return res.redirect(`/room.html?seed=${seed}&player=${playerParam}${qstr}`);
  } catch (err) {
    console.error('team route error', err);
    return res.status(500).send('Server error');
  }
});

// rooms: roomId -> { createdAt, players: { socketId: { name, role } }, ready: Set(socketId), game: { started, seed, current, perPlayerSubmitted } }
const rooms = {};

function loadLevel(levelId) {
  const base = path.join(__dirname, 'public', 'levels', levelId);
  const p1 = JSON.parse(fs.readFileSync(path.join(base, 'player1.json'), 'utf8'));
  const p2 = JSON.parse(fs.readFileSync(path.join(base, 'player2.json'), 'utf8'));
  return { player1: p1, player2: p2 };
}

const LEVELS = {
  level1: loadLevel('level1')
};

// seeded PRNG (mulberry32) helpers
function hashStringToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function seededShuffle(array, rand) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);

  socket.on('join', ({ roomId, name, timeLimitSeconds }) => {
    if (!roomId || !name) return;
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        createdAt: Date.now(),
        players: {},
        ready: new Set(),
        game: { started: false, seed: null, level: 'level1', current: 0, perPlayerSubmitted: {}, timeLimitSeconds: 180, timerId: null, timerEndAt: null }
      };
    }

    const r = rooms[roomId];
    // accept optional timeLimit param (seconds) from join payload
    if (typeof timeLimitSeconds === 'number' && !isNaN(timeLimitSeconds) && timeLimitSeconds > 0) {
      r.game.timeLimitSeconds = Math.floor(timeLimitSeconds);
    }
    // assign role
    const existingRoles = Object.values(r.players).map(p => p.role);
    let role = 'spectator';
    if (!existingRoles.includes('player1')) role = 'player1';
    else if (!existingRoles.includes('player2')) role = 'player2';

    r.players[socket.id] = { name, role };

    socket.emit('joined', { role, roomCreatedAt: r.createdAt, level: r.game.level });
    io.in(roomId).emit('players-updated', { players: Object.values(r.players).map(p=>({name:p.name,role:p.role})) });

    console.log(`${socket.id} joined ${roomId} as ${role} (${name})`);

    socket.on('ready', () => {
      // only allow ready within 3 minutes of room creation
      const now = Date.now();
      if (now - r.createdAt > 3 * 60 * 1000) {
        socket.emit('ready-denied', { reason: 'timeout' });
        return;
      }
      r.ready.add(socket.id);
      io.in(roomId).emit('ready-updated', { count: r.ready.size });
      // if both players ready, start
      const rolesPresent = Object.values(r.players).map(p=>p.role);
      const bothPresent = rolesPresent.includes('player1') && rolesPresent.includes('player2');
      if (bothPresent && r.ready.size >= 2 && !r.game.started) {
        // create seed from createdAt and player names
        const namesConcat = Object.values(r.players).map(p=>p.name).join('|');
        r.game.seed = `${r.createdAt}-${namesConcat}`;
        r.game.started = true;
        r.game.current = 0;
        r.game.perPlayerSubmitted = {};
        // deterministically generate expected sequences per-riddle based on seed
        r.game.expectedSequences = [];
        const baseSeed = hashStringToSeed(r.game.seed);
        const levelData = LEVELS[r.game.level];
        for (let ri = 0; ri < levelData.player1.length; ri++) {
          const riddle = levelData.player1[ri];
          const runeCount = (riddle.runes && riddle.runes.length) || 0;
          const seqLen = riddle.sequenceLength || Math.min(4, runeCount);
          const prng = mulberry32((baseSeed + ri) >>> 0);
          const indices = Array.from({length: runeCount}, (_,i)=>i);
          const shuffled = seededShuffle(indices, prng);
          const expected = shuffled.slice(0, seqLen);
          r.game.expectedSequences[ri] = expected;
        }
        // send game-start with seed and first riddle content per-role
        const level = LEVELS[r.game.level];
        io.in(roomId).emit('game-start', { seed: r.game.seed, level: r.game.level, riddleIndex: 0 });
        // send per-player content
        for (const sid of Object.keys(r.players)) {
          const role = r.players[sid].role;
          if (role === 'player1') {
            const content = level.player1[0];
            io.to(sid).emit('riddle-content', { riddleIndex: 0, content });
          } else if (role === 'player2') {
            // craft dynamic hint for player2 based on expected sequence
            const expected = r.game.expectedSequences[0] || [];
            const runeLabels = (level.player1[0].runes || []).map(r=>r.label);
            const parts = expected.map((idx, i) => `#${i+1}=${runeLabels[idx] || ('rune'+idx)}`);
            const hintText = `Sequence hint: ${parts.join(' -> ')}`;
            const content = Object.assign({}, level.player2[0], { hint: hintText });
            io.to(sid).emit('riddle-content', { riddleIndex: 0, content });
          } else {
            io.to(sid).emit('riddle-content', { riddleIndex: 0, content: null });
          }
        }
        // start per-riddle timer
        startRiddleTimer(roomId);
      }
    });

    function startRiddleTimer(roomId) {
      const room = rooms[roomId];
      if (!room) return;
      // clear existing if any
      if (room.game.timerId) clearTimeout(room.game.timerId);
      const duration = room.game.timeLimitSeconds || 180;
      const endAt = Date.now() + duration * 1000;
      room.game.timerEndAt = endAt;
      room.game.timerId = setTimeout(() => {
        // timeout occurred: check whether both players submitted correct; if not, game over
        const players = Object.keys(room.players).filter(sid => room.players[sid].role === 'player1' || room.players[sid].role === 'player2');
        const bothCorrect = players.length === 2 && players.every(sid => room.game.perPlayerSubmitted[sid]);
        if (!bothCorrect) {
          room.game.started = false;
          io.in(roomId).emit('game-over', { reason: 'timeout' });
          // clear timer state
          if (room.game.timerId) { clearTimeout(room.game.timerId); room.game.timerId = null; room.game.timerEndAt = null; }
        }
      }, duration * 1000);
      // notify clients about timer start (send duration and server endAt for more accurate countdown)
      io.in(roomId).emit('riddle-timer', { duration, endAt });
    }

    function clearRiddleTimer(roomId) {
      const room = rooms[roomId];
      if (!room) return;
      if (room.game.timerId) {
        clearTimeout(room.game.timerId);
        room.game.timerId = null;
        room.game.timerEndAt = null;
      }
    }

    socket.on('rune-click', ({ riddleIndex, sequence }) => {
      const room = rooms[roomId];
      if (!room || !room.game.started) return;
      const expected = (room.game.expectedSequences && room.game.expectedSequences[riddleIndex]) || [];
      const correct = Array.isArray(sequence) && sequence.join(',') === expected.join(',');
      if (correct) {
        io.in(roomId).emit('riddle-solved', { riddleIndex });
      } else {
        socket.emit('rune-wrong', { riddleIndex });
      }
    });

    socket.on('submit-answer', ({ riddleIndex, answer }) => {
      const room = rooms[roomId];
      if (!room || !room.game.started) return;
      const level = LEVELS[room.game.level];
      const expectedAnswer = (level.player1[riddleIndex].answer || '').toLowerCase();
      const given = (answer || '').trim().toLowerCase();
      // special debug password 'test' always valid
      const correct = (given === 'test') || (given === expectedAnswer);
      room.game.perPlayerSubmitted[socket.id] = !!correct;
      socket.emit('answer-result', { riddleIndex, correct });
      const players = Object.keys(room.players).filter(sid => room.players[sid].role === 'player1' || room.players[sid].role === 'player2');
      const bothCorrect = players.length === 2 && players.every(sid => room.game.perPlayerSubmitted[sid]);
      if (bothCorrect) {
        // clear timer for this riddle
        clearRiddleTimer(roomId);
        room.game.current = room.game.current + 1;
        room.game.perPlayerSubmitted = {};
        io.in(roomId).emit('advance', { nextIndex: room.game.current });
        const nextIdx = room.game.current;
        const p1Content = level.player1[nextIdx];
        const p2Content = level.player2[nextIdx];
        if (typeof nextIdx === 'number' && (p1Content || p2Content)) {
          for (const sid of players) {
            const role = room.players[sid].role;
            const content = role === 'player1' ? p1Content : role === 'player2' ? p2Content : null;
            io.to(sid).emit('riddle-content', { riddleIndex: nextIdx, content });
          }
          // start timer for next riddle
          startRiddleTimer(roomId);
        } else {
          // no more riddles -> game finished
          room.game.started = false;
          io.in(roomId).emit('game-finished', {});
        }
      }
    });

    socket.on('disconnect', () => {
      const room = rooms[roomId];
      if (room) {
        delete room.players[socket.id];
        room.ready.delete(socket.id);
        delete room.game.perPlayerSubmitted[socket.id];
        io.in(roomId).emit('players-updated', { players: Object.values(room.players).map(p=>({name:p.name,role:p.role})) });
      }
      console.log('socket disconnected:', socket.id);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
