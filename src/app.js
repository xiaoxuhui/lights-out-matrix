(function () {
  'use strict';
  const { validateSize, createOperationMatrix, solveGF2, applyClicks } = window.LightsCore;
  const $ = id => document.getElementById(id);
  const state = { n: 5, board: null, matrix: null, result: null, cellSize: 18, selectedRow: 0, selectedCol: 0 };
  const inputBoard = $('input-board'), outputBoard = $('output-board'), canvas = $('matrix-canvas');
  const eliminationViewer = window.createEliminationViewer();

  function boardClass(element) {
    element.style.setProperty('--n', state.n);
    element.classList.toggle('dense', state.n > 7);
    element.classList.toggle('tiny', state.n > 13);
  }
  function buildInput() {
    boardClass(inputBoard);
    const cells = document.createDocumentFragment();
    for (let i = 0; i < state.n ** 2; i++) {
      const cell = document.createElement('button');
      cell.type = 'button'; cell.className = 'cell'; cell.dataset.index = i;
      cell.tabIndex = i === 0 ? 0 : -1;
      cells.append(cell);
    }
    inputBoard.replaceChildren(cells);
  }
  function updateInput() {
    [...inputBoard.children].forEach((cell, i) => {
      const value = state.board[i];
      cell.dataset.value = value; cell.textContent = value;
      cell.setAttribute('aria-pressed', String(Boolean(value)));
      cell.setAttribute('aria-label', `第 ${Math.floor(i / state.n) + 1} 行，第 ${i % state.n + 1} 列：${value ? '亮' : '灭'}，点击${value ? '熄灭' : '点亮'}`);
    });
    $('on-count').textContent = `${state.board.reduce((a, b) => a + b, 0)} 盏亮灯`;
  }
  function updateOutput() {
    const { result, n } = state, m = n * n;
    boardClass(outputBoard);
    outputBoard.hidden = !result.solvable;
    $('no-solution').hidden = result.solvable;
    $('verify').disabled = !result.solvable;
    $('solution-badge').textContent = result.solvable ? '可解' : '无解';
    $('solution-badge').classList.toggle('error', !result.solvable);
    $('rank-stat').textContent = `${result.rank} / ${result.nullity}`;
    if (!result.solvable) {
      outputBoard.replaceChildren();
      $('solution-summary').textContent = '无法使当前棋盘全灭';
      $('solution-note').textContent = '模 2 方程组存在矛盾行，因此没有可行点击方案。';
      return;
    }
    const cells = document.createDocumentFragment();
    result.solution.forEach((value, i) => {
      const cell = document.createElement('span');
      cell.className = 'cell'; cell.dataset.value = value; cell.textContent = value;
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', `第 ${Math.floor(i / n) + 1} 行，第 ${i % n + 1} 列：${value ? '按一次' : '不按'}`);
      cells.append(cell);
    });
    outputBoard.replaceChildren(cells);
    const count = result.solution.reduce((sum, bit) => sum + bit, 0);
    $('solution-summary').replaceChildren();
    if (count === 0) $('solution-summary').textContent = '已经全灭，无需操作';
    else {
      const number = document.createElement('strong'); number.textContent = count;
      $('solution-summary').append('共需按 ', number, ' 个格子');
    }
    $('solution-note').textContent = result.nullity
      ? `有多组解 · ${result.nullity} 个自由变量。本页给出其中一组，不保证点击次数最少。`
      : `唯一解 · ${m} 个变量均已确定。每个绿色格子只按一次，顺序任意。`;
  }
  function solve() {
    state.result = solveGF2(state.matrix, state.board);
    $('verification').hidden = true;
    updateInput(); updateOutput();
    eliminationViewer.setInput(state.matrix, state.board);
  }
  function inspect(row, col) {
    const m = state.n ** 2;
    state.selectedRow = Math.max(0, Math.min(m - 1, row));
    state.selectedCol = Math.max(0, Math.min(m - 1, col));
    const i = state.selectedRow, j = state.selectedCol, value = state.matrix[i][j];
    $('matrix-inspect').textContent = `A[${i + 1}, ${j + 1}] = ${value} · 点击第 ${j + 1} 格${value ? '会翻转' : '不影响'}第 ${i + 1} 格（行 ${Math.floor(i / state.n) + 1}，列 ${i % state.n + 1}）。`;
  }
  function drawMatrix() {
    if ($('matrix-panel').hidden) return;
    const m = state.n ** 2, size = state.cellSize;
    canvas.width = m * size; canvas.height = m * size;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fffef9'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const gap = size >= 6 ? 1 : 0;
    for (let row = 0; row < m; row++) for (let col = 0; col < m; col++) {
      const value = state.matrix[row][col];
      ctx.fillStyle = value ? '#288b57' : '#d45147';
      ctx.fillRect(col * size, row * size, size - gap, size - gap);
      if (size >= 14) {
        ctx.fillStyle = '#fff'; ctx.font = `${Math.floor(size * .58)}px Consolas, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(value), (col + .5) * size - .5, (row + .5) * size);
      }
    }
    canvas.setAttribute('aria-label', `${m} 行 ${m} 列的操作矩阵，绿色为 1，红色为 0；可用方向键查询单元格`);
  }
  function setDisplay() {
    const mode = $('display-mode').value;
    $('result-panel').hidden = mode === 'matrix' || mode === 'none';
    $('matrix-panel').hidden = mode === 'result' || mode === 'none';
    $('workspace').classList.toggle('result-hidden', $('result-panel').hidden);
    eliminationViewer.setVisible(mode !== 'none');
    drawMatrix();
  }
  function generate(n) {
    state.n = n; state.board = new Uint8Array(n * n); state.matrix = createOperationMatrix(n);
    state.selectedRow = 0; state.selectedCol = 0;
    const m = n * n;
    state.cellSize = Math.max(1, Math.min(18, Math.floor(600 / m)));
    $('zoom').max = Math.min(28, Math.floor(4096 / m));
    $('zoom').value = state.cellSize; $('zoom-label').textContent = `${state.cellSize} px`;
    $('board-dimension').textContent = `${n} × ${n}`;
    $('matrix-dimension').textContent = `${m} × ${m}`;
    $('matrix-stat-size').textContent = `${m} × ${m}`;
    $('size-error').hidden = true; $('size').removeAttribute('aria-invalid');
    buildInput(); solve(); drawMatrix();
    $('matrix-scroll').scrollTo(0, 0);
    $('matrix-inspect').textContent = '指向矩阵查看数值；聚焦后可用方向键移动。';
  }
  function loadExample() {
    const clicks = new Uint8Array(state.n ** 2);
    clicks[0] = 1;
    if (clicks.length > 1) clicks[Math.floor(clicks.length / 2)] = 1;
    if (clicks.length > 4) clicks[clicks.length - 2] = 1;
    state.board = applyClicks(state.n, new Uint8Array(state.n ** 2), clicks);
    solve();
  }
  $('size-form').addEventListener('submit', event => {
    event.preventDefault();
    try { generate(validateSize($('size').value)); }
    catch (error) {
      $('size-error').textContent = error.message; $('size-error').hidden = false;
      $('size').setAttribute('aria-invalid', 'true'); $('size').focus();
    }
  });
  inputBoard.addEventListener('click', event => {
    const cell = event.target.closest('button.cell');
    if (!cell) return;
    [...inputBoard.children].forEach(item => { item.tabIndex = item === cell ? 0 : -1; });
    state.board[Number(cell.dataset.index)] ^= 1; solve();
  });
  inputBoard.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const cell = event.target.closest('button.cell');
    if (!cell) return;
    event.preventDefault();
    const index = Number(cell.dataset.index), row = Math.floor(index / state.n), col = index % state.n;
    const nextRow = Math.max(0, Math.min(state.n - 1, row + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)));
    const nextCol = Math.max(0, Math.min(state.n - 1, col + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
    const next = inputBoard.children[nextRow * state.n + nextCol];
    cell.tabIndex = -1; next.tabIndex = 0; next.focus();
  });
  $('all-on').addEventListener('click', () => { state.board.fill(1); solve(); });
  $('all-off').addEventListener('click', () => { state.board.fill(0); solve(); });
  $('example').addEventListener('click', loadExample);
  $('display-mode').addEventListener('change', setDisplay);
  $('zoom').addEventListener('input', () => {
    state.cellSize = Number($('zoom').value); $('zoom-label').textContent = `${state.cellSize} px`; drawMatrix();
  });
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    inspect(Math.floor((event.clientY - rect.top) / state.cellSize), Math.floor((event.clientX - rect.left) / state.cellSize));
  });
  canvas.addEventListener('focus', () => inspect(state.selectedRow, state.selectedCol));
  canvas.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    inspect(state.selectedRow + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0), state.selectedCol + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0));
    const x = state.selectedCol * state.cellSize, y = state.selectedRow * state.cellSize, holder = $('matrix-scroll');
    if (x < holder.scrollLeft || x + state.cellSize > holder.scrollLeft + holder.clientWidth - 30) holder.scrollLeft = x;
    if (y < holder.scrollTop || y + state.cellSize > holder.scrollTop + holder.clientHeight - 30) holder.scrollTop = y;
  });
  $('verify').addEventListener('click', () => {
    if (!state.result.solvable) return;
    const finalBoard = applyClicks(state.n, state.board, state.result.solution);
    const remaining = finalBoard.reduce((sum, value) => sum + value, 0), verified = remaining === 0;
    $('verification').classList.toggle('error', !verified);
    $('verification').textContent = verified
      ? `✓ 验证通过 · 将方案作用于初始棋盘后，${finalBoard.length} 个格子全部熄灭。`
      : `验证失败 · 仍有 ${remaining} 盏灯亮着。`;
    $('verification').hidden = false;
  });
  generate(5); loadExample(); setDisplay();
})();
