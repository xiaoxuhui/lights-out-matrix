/* Pure GF(2) operations. Shared by the offline page and Node tests. */
(function (root) {
  'use strict';
  const MAX_SIZE = 20;
  function validateSize(value) {
    const n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
    if (value == null || !Number.isInteger(n) || n < 1 || n > MAX_SIZE) {
      throw new RangeError('请输入 1 到 20 之间的整数。');
    }
    return n;
  }
  function validateBits(bits, length) {
    if (!bits || bits.length !== length) throw new RangeError('棋盘或向量长度不正确。');
    if (Array.from(bits).some(bit => bit !== 0 && bit !== 1)) throw new TypeError('数值只能为 0 或 1。');
  }
  function neighbors(n, index) {
    const row = Math.floor(index / n), col = index % n, list = [index];
    if (row > 0) list.push(index - n);
    if (row < n - 1) list.push(index + n);
    if (col > 0) list.push(index - 1);
    if (col < n - 1) list.push(index + 1);
    return list;
  }
  function createOperationMatrix(value) {
    const n = validateSize(value), m = n * n;
    const matrix = Array.from({ length: m }, () => new Uint8Array(m));
    for (let column = 0; column < m; column++) {
      for (const row of neighbors(n, column)) matrix[row][column] = 1;
    }
    return matrix;
  }
  function solveGF2(matrix, board, options = {}) {
    const m = matrix.length;
    if (!m || matrix.some(row => row.length !== m)) throw new RangeError('系数矩阵必须是非空方阵。');
    validateBits(board, m);
    const words = Math.ceil((m + 1) / 32);
    const rows = matrix.map((row, i) => {
      validateBits(row, m);
      const packed = new Uint32Array(words);
      for (let j = 0; j < m; j++) if (row[j]) packed[j >>> 5] |= 1 << (j & 31);
      if (board[i]) packed[m >>> 5] |= 1 << (m & 31);
      return packed;
    });
    const bit = (row, column) => row[column >>> 5] >>> (column & 31) & 1;
    const pivots = [];
    const steps = options.recordSteps ? [] : null;
    let rank = 0;
    for (let col = 0; col < m && rank < m; col++) {
      let pivot = rank;
      while (pivot < m && !bit(rows[pivot], col)) pivot++;
      if (pivot === m) {
        if (steps) steps.push({ type: 'free', column: col });
        continue;
      }
      if (steps && pivot !== rank) steps.push({ type: 'swap', source: pivot, target: rank, column: col });
      [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
      if (steps) steps.push({ type: 'pivot', row: rank, column: col });
      for (let row = 0; row < m; row++) {
        if (row !== rank && bit(rows[row], col)) {
          if (steps) steps.push({ type: 'xor', source: rank, target: row, column: col });
          for (let w = col >>> 5; w < words; w++) rows[row][w] ^= rows[rank][w];
        }
      }
      pivots.push(col);
      rank++;
    }
    const metadata = { rank, nullity: m - rank, pivots, ...(steps ? { steps } : {}) };
    for (let row = rank; row < m; row++) {
      if (bit(rows[row], m)) return { ...metadata, solvable: false, solution: null, contradictionRow: row };
    }
    const solution = new Uint8Array(m); // Free variables are chosen as zero.
    pivots.forEach((column, row) => { solution[column] = bit(rows[row], m); });
    return { ...metadata, solvable: true, solution };
  }
  function createAugmentedMatrix(matrix, board) {
    validateBits(board, matrix.length);
    return matrix.map((row, i) => Uint8Array.from([...row, board[i]]));
  }
  function applyEliminationStep(rows, step) {
    if (step.type === 'swap') {
      [rows[step.source], rows[step.target]] = [rows[step.target], rows[step.source]];
    } else if (step.type === 'xor') {
      for (let col = 0; col < rows[step.target].length; col++) rows[step.target][col] ^= rows[step.source][col];
    }
    return rows;
  }
  function solveLights(value, board) {
    const n = validateSize(value);
    return solveGF2(createOperationMatrix(n), board);
  }
  function applyClicks(value, board, clicks) {
    const n = validateSize(value), m = n * n;
    validateBits(board, m);
    validateBits(clicks, m);
    const result = Uint8Array.from(board);
    for (let i = 0; i < m; i++) if (clicks[i]) {
      for (const j of neighbors(n, i)) result[j] ^= 1;
    }
    return result;
  }
  const api = { MAX_SIZE, validateSize, createOperationMatrix, solveGF2, solveLights, applyClicks, createAugmentedMatrix, applyEliminationStep };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LightsCore = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
