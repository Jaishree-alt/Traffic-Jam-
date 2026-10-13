const GRID_SIZE = 4;

export const key = ({ row, col }) => `${row},${col}`;
export const sameCell = (a, b) => a.row === b.row && a.col === b.col;
export const inBounds = ({ row, col }) => row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
export const isOrthogonalStep = (from, to) => Math.abs(from.row - to.row) + Math.abs(from.col - to.col) === 1;

export function canMove({ from, to, occupied }) {
  return inBounds(to) && isOrthogonalStep(from, to) && !occupied.has(key(to));
}

export function makeSetup(humanCount, botCount, rng = Math.random) {
  const cells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => ({ row: Math.floor(i / GRID_SIZE), col: i % GRID_SIZE }));
  const take = () => cells.splice(Math.floor(rng() * cells.length), 1)[0];
  return Array.from({ length: humanCount + botCount }, () => ({ start: take(), destination: take() }));
}

export function chooseBotMove(player, players) {
  const occupied = new Set(players.filter(p => p.id !== player.id && !p.finished).map(p => key(p.position)));
  const candidates = [
    { row: player.position.row - 1, col: player.position.col }, { row: player.position.row + 1, col: player.position.col },
    { row: player.position.row, col: player.position.col - 1 }, { row: player.position.row, col: player.position.col + 1 }
  ].filter(to => canMove({ from: player.position, to, occupied }));
  candidates.sort((a, b) => (Math.abs(a.row - player.destination.row) + Math.abs(a.col - player.destination.col)) - (Math.abs(b.row - player.destination.row) + Math.abs(b.col - player.destination.col)));
  return candidates[0] || null;
}
