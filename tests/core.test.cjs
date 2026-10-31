const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSize, createOperationMatrix, solveLights, applyClicks, solveGF2 } = require('../src/core.js');

// Independent direct board simulation, without the matrix builder or solver.
function reference(n, board, clicks) {
  const result = Array.from(board);
  for (let p = 0; p < n * n; p++) if (clicks[p]) {
    const row = Math.floor(p / n), col = p % n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (Math.abs(row - r) + Math.abs(col - c) <= 1) result[r * n + c] ^= 1;
    }
  }
  return result;
}

test('valid size: integer 1 through 20', () => {
  for (let n = 1; n <= 20; n++) assert.equal(validateSize(String(n)), n);
});
test('invalid size: empty, zero, negative, decimal, infinite, oversized', () => {
  for (const n of ['', ' ', null, undefined, 0, -1, 1.5, 'abc', Infinity, 21]) {
    assert.throws(() => validateSize(n), /1.*20/);
  }
});
test('n=1 exact matrix', () => assert.deepEqual(createOperationMatrix(1).map(row => Array.from(row)), [[1]]));
test('n=2 exact matrix', () => {
  assert.deepEqual(createOperationMatrix(2).map(row => Array.from(row)), [
    [1, 1, 1, 0], [1, 1, 0, 1], [1, 0, 1, 1], [0, 1, 1, 1]
  ]);
});
test('n=3 corner, edge and center have 3, 4, 5 neighbors', () => {
  const a = createOperationMatrix(3);
  assert.equal(a.reduce((s, row) => s + row[0], 0), 3);
  assert.equal(a.reduce((s, row) => s + row[1], 0), 4);
  assert.equal(a.reduce((s, row) => s + row[4], 0), 5);
});
test('no wrap at right edge or top edge', () => {
  const a = createOperationMatrix(5);
  assert.equal(a[4][5], 0);
  assert.equal(a[0][20], 0);
  assert.equal(a[0][4], 0);
});
test('all coefficients independently match Manhattan-distance rule for n=1…12', () => {
  for (let n = 1; n <= 12; n++) {
    const a = createOperationMatrix(n);
    for (let i = 0; i < n * n; i++) for (let j = 0; j < n * n; j++) {
      assert.equal(a[i][j], Number(Math.abs(Math.floor(i / n) - Math.floor(j / n)) + Math.abs(i % n - j % n) <= 1));
    }
  }
});
test('n=2 example gives only first click', () => {
  const result = solveLights(2, [1, 1, 1, 0]);
  assert.equal(result.solvable, true);
  assert.deepEqual(Array.from(result.solution), [1, 0, 0, 0]);
  assert.equal(result.rank, 4);
});
test('exhaustive all boards and click patterns for n=1,2,3', () => {
  for (let n = 1; n <= 3; n++) {
    const m = n * n, reachable = new Set();
    for (let mask = 0; mask < 2 ** m; mask++) {
      const clicks = Array.from({ length: m }, (_, i) => mask >> i & 1);
      reachable.add(reference(n, Array(m).fill(0), clicks).join(''));
    }
    for (let mask = 0; mask < 2 ** m; mask++) {
      const board = Array.from({ length: m }, (_, i) => mask >> i & 1);
      const result = solveLights(n, board);
      assert.equal(result.solvable, reachable.has(board.join('')));
      if (result.solvable) assert.deepEqual(reference(n, board, result.solution), Array(m).fill(0));
    }
  }
});
test('n=4 zero board has four free variables', () => {
  const result = solveLights(4, Array(16).fill(0));
  assert.equal(result.rank, 12);
  assert.equal(result.nullity, 4);
  assert.deepEqual(Array.from(result.solution), Array(16).fill(0));
});
test('n=4 isolated top-left light is unsolvable', () => {
  const result = solveLights(4, [1, ...Array(15).fill(0)]);
  assert.equal(result.solvable, false);
  assert.equal(result.solution, null);
});
test('deterministic reachable boards n=1…20 include packed-word boundaries', () => {
  for (let n = 1; n <= 20; n++) {
    const clicks = Array.from({ length: n * n }, (_, i) => Number((i * 7 + n) % 11 < 4));
    const board = reference(n, Array(n * n).fill(0), clicks);
    const original = board.slice(), result = solveLights(n, board);
    assert.equal(result.solvable, true, `n=${n}`);
    assert.deepEqual(reference(n, board, result.solution), Array(n * n).fill(0), `n=${n}`);
    assert.deepEqual(board, original, 'input must not mutate');
  }
});
test('clicking twice cancels and applyClicks agrees with independent simulation', () => {
  const board = [1, 0, 1, 0, 1, 0, 1, 1, 0], clicks = [0, 1, 0, 1, 0, 0, 1, 0, 1];
  assert.deepEqual(Array.from(applyClicks(3, board, clicks)), reference(3, board, clicks));
  assert.deepEqual(Array.from(applyClicks(3, applyClicks(3, board, clicks), clicks)), board);
});
test('Gaussian elimination swaps rows and detects a contradictory equation', () => {
  assert.deepEqual(Array.from(solveGF2([[0, 1], [1, 1]], [1, 0]).solution), [1, 1]);
  assert.equal(solveGF2([[1, 1], [1, 1]], [0, 1]).solvable, false);
});
test('invalid board and matrix values are rejected', () => {
  assert.throws(() => solveLights(2, [0, 1]), /长度/);
  assert.throws(() => solveLights(1, [2]), /0.*1/);
  assert.throws(() => solveGF2([[1], [1, 0]], [0, 0]), /方阵/);
});
