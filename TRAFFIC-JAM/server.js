import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { canMove, chooseBotMove, key, makeSetup, sameCell } from './game.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.FACILITATOR_PASSWORD || 'Ervaring@26';
const rooms = new Map();
const COLORS = ['#ff5d73', '#665cff', '#00b8b0', '#ffb703', '#3698ff', '#8dce49', '#f17bc2', '#f47b35'];
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

app.use(express.static(publicDir));
app.get(['/', '/join', '/facilitator'], (_, res) => res.sendFile(path.join(publicDir, 'index.html')));

const roomCode = () => {
  let code;
  do code = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms.has(code));
  return code;
};
const error = (socket, message) => socket.emit('game:error', message);
const activePlayers = room => [...room.players.values()];
const publicPlayer = (player, viewer, isFacilitator) => ({
  id: player.id, name: player.name, color: player.color, position: player.position, start: player.start,
  destination: isFacilitator || viewer === player.id || player.finished ? player.destination : null,
  finished: player.finished, isBot: player.isBot, route: viewer === player.id || isFacilitator ? player.route : undefined
});
function snapshot(room, socketId) {
  const isFacilitator = room.facilitators.has(socketId);
  return { code: room.code, status: room.status, attempt: room.attempt, botCount: room.botCount, humanLimit: room.humanLimit,
    players: activePlayers(room).map(p => publicPlayer(p, socketId, isFacilitator)),
    humans: [...room.humans.values()].map(h => ({ id: h.id, name: h.name })), isFacilitator };
}
function emitRoom(room) { for (const id of new Set([...room.humans.keys(), ...room.facilitators])) io.to(id).emit('game:state', snapshot(room, id)); }
function resetForAttempt(room) {
  const humans = [...room.humans.values()];
  const setup = room.originalSetup || makeSetup(humans.length, room.botCount);
  if (!room.originalSetup) room.originalSetup = structuredClone(setup);
  room.players = new Map();
  [...humans, ...Array.from({ length: room.botCount }, (_, i) => ({ id: `bot-${i}`, name: ['Taxi Bot', 'Scooter Bot', 'Bus Bot', 'Van Bot'][i], isBot: true }))]
    .forEach((member, index) => {
      const { start, destination } = setup[index];
      room.players.set(member.id, { ...member, color: COLORS[index], start, destination, position: { ...start }, route: [{ ...start }], finished: false });
    });
  room.status = 'playing';
  clearInterval(room.botTimer);
  room.botTimer = setInterval(() => tickBots(room), 1200);
}
function move(room, player, to) {
  if (room.status !== 'playing' || player.finished) return false;
  const occupied = new Set(activePlayers(room).filter(p => p.id !== player.id && !p.finished).map(p => key(p.position)));
  if (!canMove({ from: player.position, to, occupied })) return false;
  player.position = { ...to }; player.route.push({ ...to });
  if (sameCell(player.position, player.destination)) player.finished = true;
  if (activePlayers(room).every(p => p.finished)) { room.status = 'complete'; clearInterval(room.botTimer); }
  return true;
}
function tickBots(room) {
  if (room.status !== 'playing') return;
  activePlayers(room).filter(p => p.isBot && !p.finished).forEach(bot => { const to = chooseBotMove(bot, activePlayers(room)); if (to) move(room, bot, to); });
  emitRoom(room);
}
function cleanRoom(room) { if (!room.humans.size && !room.facilitators.size) { clearInterval(room.botTimer); rooms.delete(room.code); } }

io.on('connection', socket => {
  socket.on('facilitator:create', ({ password, botCount = 3, humanLimit = 4 }, reply) => {
    if (password !== PASSWORD) return reply({ ok: false, message: 'That password is not correct.' });
    const limit = Math.max(1, Math.min(5, Number(humanLimit)));
    const bots = Math.max(0, Math.min(8 - limit, Number(botCount)));
    const code = roomCode();
    const room = { code, facilitators: new Set([socket.id]), humans: new Map(), players: new Map(), humanLimit: limit, botCount: bots, status: 'lobby', attempt: 0, originalSetup: null, botTimer: null };
    rooms.set(code, room); socket.data.room = code; socket.data.role = 'facilitator'; socket.join(code); reply({ ok: true, code }); emitRoom(room);
  });
  socket.on('facilitator:join', ({ code, password }, reply) => {
    const room = rooms.get(String(code).toUpperCase());
    if (!room || password !== PASSWORD) return reply({ ok: false, message: 'Unable to open this room.' });
    room.facilitators.add(socket.id); socket.data.room = room.code; socket.data.role = 'facilitator'; socket.join(room.code); reply({ ok: true, code: room.code }); emitRoom(room);
  });
  socket.on('player:join', ({ code, name }, reply) => {
    const room = rooms.get(String(code).toUpperCase()); const safeName = String(name || '').trim().slice(0, 20);
    if (!room) return reply({ ok: false, message: 'Room not found.' });
    if (room.status !== 'lobby') return reply({ ok: false, message: 'This game has already started.' });
    if (!safeName) return reply({ ok: false, message: 'Enter a display name.' });
    if (room.humans.size >= room.humanLimit) return reply({ ok: false, message: `This room is full (${room.humanLimit} players).` });
    const human = { id: socket.id, name: safeName, isBot: false }; room.humans.set(socket.id, human); socket.data.room = room.code; socket.data.role = 'player'; socket.join(room.code); reply({ ok: true, code: room.code }); emitRoom(room);
  });
  socket.on('game:start', () => { const room = rooms.get(socket.data.room); if (!room || !room.facilitators.has(socket.id) || !room.humans.size) return; room.attempt = room.attempt ? room.attempt + 1 : 1; resetForAttempt(room); emitRoom(room); });
  socket.on('game:replay', () => { const room = rooms.get(socket.data.room); if (!room || !room.facilitators.has(socket.id) || !room.originalSetup) return; room.attempt += 1; resetForAttempt(room); emitRoom(room); });
  socket.on('game:pause', () => { const room = rooms.get(socket.data.room); if (!room || !room.facilitators.has(socket.id)) return; room.status = room.status === 'paused' ? 'playing' : 'paused'; emitRoom(room); });
  socket.on('game:end', () => { const room = rooms.get(socket.data.room); if (!room || !room.facilitators.has(socket.id)) return; room.status = 'complete'; clearInterval(room.botTimer); emitRoom(room); });
  socket.on('room:close', () => { const room = rooms.get(socket.data.room); if (!room || !room.facilitators.has(socket.id)) return; clearInterval(room.botTimer); io.to(room.code).emit('room:closed'); rooms.delete(room.code); });
  socket.on('player:move', to => { const room = rooms.get(socket.data.room); const player = room?.players.get(socket.id); if (!room || !player || !move(room, player, to)) return error(socket, 'That lane is blocked — choose another open neighbouring square.'); emitRoom(room); });
  socket.on('disconnect', () => { const room = rooms.get(socket.data.room); if (!room) return; room.facilitators.delete(socket.id); room.humans.delete(socket.id); if (room.status === 'lobby') emitRoom(room); cleanRoom(room); });
});

httpServer.listen(PORT, () => console.log(`TRAFFIC JAM ready on http://localhost:${PORT}`));
