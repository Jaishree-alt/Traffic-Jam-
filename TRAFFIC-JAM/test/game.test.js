import test from 'node:test';
import assert from 'node:assert/strict';
import { canMove, makeSetup, sameCell } from '../game.js';

test('allows one orthogonal step inside an open grid cell', () => {
  assert.equal(canMove({ from: { row: 1, col: 1 }, to: { row: 1, col: 2 }, occupied: new Set() }), true);
});
test('rejects diagonal, multi-cell, off-grid and occupied moves', () => {
  assert.equal(canMove({ from: { row: 1, col: 1 }, to: { row: 2, col: 2 }, occupied: new Set() }), false);
  assert.equal(canMove({ from: { row: 0, col: 0 }, to: { row: -1, col: 0 }, occupied: new Set() }), false);
  assert.equal(canMove({ from: { row: 1, col: 1 }, to: { row: 1, col: 2 }, occupied: new Set(['1,2']) }), false);
});
test('setup gives every player different start and destination cells', () => {
  const setup = makeSetup(4, 4, () => 0);
  const cells = setup.flatMap(({ start, destination }) => [start, destination]);
  assert.equal(new Set(cells.map(c => `${c.row},${c.col}`)).size, 16);
  assert.equal(sameCell(setup[0].start, setup[0].destination), false);
});
