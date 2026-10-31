const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createOperationMatrix, solveGF2, createAugmentedMatrix, applyEliminationStep } = require('../src/core.js');
const plain = rows => rows.map(row => Array.from(row));

test('trace is optional and preserves the solver answer', () => {
  const a = createOperationMatrix(3), b = [1, 0, 1, 1, 0, 0, 1, 0, 1];
  const normal = solveGF2(a, b), traced = solveGF2(a, b, { recordSteps: true });
  assert.equal(normal.steps, undefined);
  assert.ok(traced.steps.length > 0);
  assert.deepEqual(traced.solution, normal.solution);
  assert.equal(traced.rank, normal.rank);
});
test('each recorded row operation is mathematically valid and yields RREF', () => {
  for (let n = 1; n <= 8; n++) {
    const a = createOperationMatrix(n), m = n * n;
    const b = Array.from({ length: m }, (_, i) => Number((i * 7 + n) % 5 === 0));
    const result = solveGF2(a, b, { recordSteps: true });
    const augmented = createAugmentedMatrix(a, b);
    for (const step of result.steps) {
      if (step.type === 'pivot') assert.equal(augmented[step.row][step.column], 1);
      if (step.type === 'xor') {
        assert.equal(augmented[step.source][step.column], 1);
        assert.equal(augmented[step.target][step.column], 1);
        const before = augmented[step.target].slice();
        applyEliminationStep(augmented, step);
        assert.deepEqual(Array.from(augmented[step.target]), Array.from(before, (bit, i) => bit ^ augmented[step.source][i]));
        assert.equal(augmented[step.target][step.column], 0);
      } else applyEliminationStep(augmented, step);
    }
    result.pivots.forEach((col, row) => {
      for (let r = 0; r < m; r++) assert.equal(augmented[r][col], Number(r === row));
    });
    if (result.solvable) {
      result.pivots.forEach((col, row) => assert.equal(result.solution[col], augmented[row][m]));
    } else {
      assert.ok(augmented[result.contradictionRow].slice(0, m).every(x => x === 0));
      assert.equal(augmented[result.contradictionRow][m], 1);
    }
  }
});
test('all steps are reversible and retain the original input', () => {
  const a = createOperationMatrix(5), b = Array(25).fill(1), originalA = plain(a), originalB = b.slice();
  const result = solveGF2(a, b, { recordSteps: true });
  const rows = createAugmentedMatrix(a, b), initial = plain(rows);
  for (const step of result.steps) applyEliminationStep(rows, step);
  for (const step of result.steps.toReversed()) applyEliminationStep(rows, step);
  assert.deepEqual(plain(rows), initial);
  assert.deepEqual(plain(a), originalA);
  assert.deepEqual(b, originalB);
});
test('trace explicitly records row swaps and free columns', () => {
  const swapped = solveGF2([[0, 1], [1, 1]], [1, 0], { recordSteps: true });
  assert.equal(swapped.steps[0].type, 'swap');
  const singular = solveGF2([[1, 1], [1, 1]], [0, 0], { recordSteps: true });
  assert.deepEqual(singular.steps.filter(step => step.type === 'free').map(step => step.column), [1]);
});
test('inconsistent trace identifies a real 0=1 row', () => {
  const a = createOperationMatrix(4), b = [1, ...Array(15).fill(0)];
  const result = solveGF2(a, b, { recordSteps: true }), rows = createAugmentedMatrix(a, b);
  result.steps.forEach(step => applyEliminationStep(rows, step));
  assert.equal(result.solvable, false);
  assert.deepEqual(Array.from(rows[result.contradictionRow]), [...Array(16).fill(0), 1]);
});
test('a missing pivot in a middle column does not stop later elimination', () => {
  const a = [[1, 0, 1], [0, 0, 1], [0, 0, 0]], b = [1, 1, 0];
  const result = solveGF2(a, b, { recordSteps: true });
  const freeAt = result.steps.findIndex(step => step.type === 'free' && step.column === 1);
  assert.ok(freeAt >= 0);
  assert.ok(result.steps.slice(freeAt + 1).some(step => step.type === 'pivot' && step.column === 2));
  assert.ok(result.steps.slice(freeAt + 1).some(step => step.type === 'xor' && step.column === 2));
  assert.equal(result.rank, 2);
  assert.deepEqual(Array.from(result.solution), [0, 0, 1]);
  const rows = createAugmentedMatrix(a, b);
  result.steps.forEach(step => applyEliminationStep(rows, step));
  assert.deepEqual(plain(rows), [[1, 0, 0, 0], [0, 0, 1, 1], [0, 0, 0, 0]]);
});
test('a zero first column still allows pivots in all later columns', () => {
  const result = solveGF2([[0, 1, 0], [0, 0, 1], [0, 1, 1]], [1, 1, 0], { recordSteps: true });
  assert.deepEqual(result.steps[0], { type: 'free', column: 0, phase: 'lower' });
  assert.deepEqual(result.pivots, [1, 2]);
  assert.deepEqual(Array.from(result.solution), [0, 1, 1]);
});
test('all lower-triangle elimination finishes before any upper-triangle operation', () => {
  for (let n = 1; n <= 9; n++) {
    const a = createOperationMatrix(n), b = Array(n * n).fill(1);
    const result = solveGF2(a, b, { recordSteps: true }), rows = createAugmentedMatrix(a, b);
    let upperStarted = false, boundaryCount = 0;
    for (const step of result.steps) {
      if (step.type === 'phase') {
        upperStarted = true; boundaryCount++;
        result.pivots.forEach((col, row) => {
          for (let r = row + 1; r < rows.length; r++) assert.equal(rows[r][col], 0, `n=${n}, forward phase unfinished`);
        });
      }
      assert.equal(step.phase, upperStarted ? 'upper' : 'lower');
      if (step.type === 'xor') assert.equal(step.target > step.source, !upperStarted);
      if (step.type === 'swap') assert.equal(upperStarted, false);
      applyEliminationStep(rows, step);
    }
    assert.equal(boundaryCount, 1);
    const backwardColumns = result.steps.filter(step => step.type === 'pivot' && step.phase === 'upper').map(step => step.column);
    assert.deepEqual(backwardColumns, result.pivots.toReversed());
  }
});
