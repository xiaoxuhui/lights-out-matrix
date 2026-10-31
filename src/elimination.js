(function () {
  'use strict';
  const { solveGF2, createAugmentedMatrix, applyEliminationStep } = window.LightsCore;
  window.createEliminationViewer = function () {
    const $ = id => document.getElementById(id);
    const panel = $('elimination-panel'), canvas = $('trace-canvas');
    let matrix, board, result, rows, cursor = 0, cell = 22, timer = null, selectedRow = 0, selectedCol = 0;
    function pause() {
      clearInterval(timer); timer = null;
      $('trace-play').textContent = '自动播放'; $('trace-play').setAttribute('aria-pressed', 'false');
    }
    function describe(step) {
      if (step.type === 'phase') return {
        title: '左下消元完成，开始消右上部分',
        description: '所有系数列已检查完毕，各主元下方已经是 0。现在从最后一个主元向前，逐个消掉主元上方的 1；不再进行前向换行。'
      };
      if (step.type === 'swap') return {
        title: `R${step.target + 1} ↔ R${step.source + 1}`,
        description: `第 ${step.column + 1} 列需要一个值为 1 的主元。交换第 ${step.target + 1} 行和第 ${step.source + 1} 行，整行连同常数列一起交换。`
      };
      if (step.type === 'pivot') return {
        title: `${step.phase === 'upper' ? '反向处理主元' : '选主元'}：第 ${step.row + 1} 行，第 ${step.column + 1} 列`,
        description: `这个位置的数值为 1。以 R${step.row + 1} 为主元行，${step.phase === 'upper' ? '只消去这一列主元上方的 1，从最后一个主元向前处理' : '只消去这一列主元下方的 1，上方保留到第二阶段处理'}。模 2 下不需要除法。`
      };
      if (step.type === 'free') return {
        title: `第 ${step.column + 1} 列无新主元，跳过本列`,
        description: `尚未使用的行在这一列都是 0。${step.column + 1 < board.length ? '这不代表消元结束：保持当前主元行位置，继续检查右边的列。' : '本列已是最后一个系数列，所有列检查完毕后再判定方程组。'}x${step.column + 1} 是自由变量；有解时本页选取它为 0。`
      };
      return {
        title: `R${step.target + 1} ← R${step.target + 1} ⊕ R${step.source + 1}`,
        description: `${step.phase === 'upper' ? '消右上部分' : '消左下部分'}：把第 ${step.source + 1} 行逐项异或到第 ${step.target + 1} 行，包含常数列。第 ${step.column + 1} 列原来的 1 变为 1 ⊕ 1 = 0。`
      };
    }
    function conclusion() {
      if (!result.solvable) return {
        title: '出现 0 = 1，因此无解',
        text: `第 ${result.contradictionRow + 1} 行的所有系数都为 0，但常数项为 1。这是矛盾方程，当前初始灯光无法全部熄灭。`, answer: ''
      };
      const free = Array.from({ length: board.length }, (_, i) => i).filter(i => !result.pivots.includes(i));
      const explanation = free.length
        ? `有 ${free.length} 个自由变量：${free.map(i => `x${i + 1}`).join('、')}。将它们取为 0 后，每个主元变量等于对应行最右侧的常数项。`
        : '每个变量都有主元，左侧已化为单位矩阵。最右侧的常数列就是唯一的解 x。';
      return { title: free.length ? '消元完成，读取一组可行解' : '消元完成，读取唯一解', text: explanation,
        answer: `x = (${Array.from(result.solution).join(', ')})。按从左到右、从上到下排回棋盘；1 按一次，0 不按。` };
    }
    function inspect(row, col) {
      if (!rows) return;
      selectedRow = Math.max(0, Math.min(rows.length - 1, row));
      selectedCol = Math.max(0, Math.min(rows.length, col));
      const isConstant = selectedCol === rows.length;
      $('trace-cell-value').textContent = `第 ${selectedRow + 1} 行，${isConstant ? '常数列' : `第 ${selectedCol + 1} 列`}：${rows[selectedRow][selectedCol]}${isConstant ? '（右侧 b）' : ''}。`;
    }
    function geometry() {
      return { left: cell >= 12 ? 42 : 8, top: cell >= 12 ? 29 : 16, divider: cell >= 6 ? 7 : 3 };
    }
    function draw() {
      const m = rows.length, { left, top, divider } = geometry();
      const xAt = col => left + col * cell + (col === m ? divider : 0);
      canvas.width = left + (m + 1) * cell + divider + 4; canvas.height = top + m * cell + 4;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fffef9'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const gap = cell >= 6 ? 1 : 0;
      for (let r = 0; r < m; r++) for (let c = 0; c <= m; c++) {
        ctx.fillStyle = rows[r][c] ? '#288b57' : '#d45147';
        ctx.fillRect(xAt(c), top + r * cell, cell - gap, cell - gap);
        if (cell >= 14) {
          ctx.fillStyle = '#fff'; ctx.font = `${Math.floor(cell * .57)}px Consolas,monospace`;
          ctx.fillText(rows[r][c], xAt(c) + cell / 2 - .5, top + (r + .5) * cell);
        }
      }
      ctx.fillStyle = '#737b71'; ctx.font = '10px Consolas,monospace';
      if (cell >= 14) {
        for (let c = 0; c < m; c++) ctx.fillText(`x${c + 1}`, xAt(c) + cell / 2, 12);
        for (let r = 0; r < m; r++) ctx.fillText(`R${r + 1}`, left / 2 - 2, top + (r + .5) * cell);
      }
      ctx.fillText('b', xAt(m) + cell / 2, cell >= 12 ? 12 : 7);
      ctx.fillStyle = '#23362f'; ctx.fillRect(left + m * cell + Math.floor(divider / 2) - 1, top - 2, 2, m * cell + 2);
      const step = cursor ? result.steps[cursor - 1] : null;
      if (step && step.type !== 'phase') {
        ctx.strokeStyle = '#e5b32d'; ctx.lineWidth = 2;
        ctx.strokeRect(xAt(step.column) + .5, top + .5, Math.max(1, cell - 2), Math.max(1, m * cell - 2));
        const activeRows = step.type === 'pivot' ? [step.row] : step.type === 'free' ? [] : [step.source, step.target];
        for (const r of activeRows) ctx.strokeRect(left + .5, top + r * cell + .5, (m + 1) * cell + divider - 2, Math.max(1, cell - 2));
      }
      if (cursor === result.steps.length && !result.solvable) {
        ctx.strokeStyle = '#23362f'; ctx.lineWidth = 3;
        ctx.strokeRect(left, top + result.contradictionRow * cell, (m + 1) * cell + divider, cell);
      }
      canvas.setAttribute('aria-label', `${m} 行 ${m + 1} 列的增广矩阵，第 ${cursor} 步；绿色 1，红色 0，最后一列为常数列`);
    }
    function render() {
      if (!result || !panel.open || panel.hidden) return;
      const total = result.steps.length, end = cursor === total;
      const current = cursor ? describe(result.steps[cursor - 1]) : {
        title: '初始增广矩阵 [A | b]',
        description: `左侧 ${board.length} 列是操作矩阵 A，右侧是初始灯光 b。先从左到右，只消主元下方的 1；完成左下消元后，再从最后一个主元向前消右上部分。`
      };
      $('trace-step-title').textContent = current.title;
      $('trace-step-description').textContent = current.description;
      const phase = cursor && result.steps[cursor - 1].phase === 'upper' ? 'upper' : 'lower';
      $('trace-phase').textContent = phase === 'upper' ? '第二阶段 · 消右上部分' : '第一阶段 · 消左下部分';
      $('trace-phase').dataset.phase = phase;
      $('trace-progress').textContent = `第 ${cursor} / ${total} 步`;
      $('trace-position').value = cursor;
      $('trace-first').disabled = cursor === 0; $('trace-prev').disabled = cursor === 0;
      $('trace-next').disabled = end; $('trace-last').disabled = end; $('trace-play').disabled = end;
      $('trace-finish').hidden = !end;
      if (end) {
        const finish = conclusion();
        $('trace-conclusion-title').textContent = finish.title;
        $('trace-conclusion').textContent = finish.text; $('trace-answer').textContent = finish.answer;
      }
      draw();
    }
    function ensureTrace() {
      if (result || !matrix || panel.hidden || !panel.open) return;
      result = solveGF2(matrix, board, { recordSteps: true });
      rows = createAugmentedMatrix(matrix, board); cursor = 0;
      $('trace-position').max = result.steps.length;
      $('trace-total').textContent = `${result.steps.length} 步`;
      $('trace-size').textContent = `[A | b] · ${board.length} × ${board.length + 1}`;
      render();
    }
    function seek(position) {
      ensureTrace();
      if (!result) return;
      const next = Math.max(0, Math.min(result.steps.length, position));
      while (cursor < next) applyEliminationStep(rows, result.steps[cursor++]);
      while (cursor > next) applyEliminationStep(rows, result.steps[--cursor]);
      if (cursor === result.steps.length) pause();
      render();
    }
    $('trace-first').addEventListener('click', () => { pause(); seek(0); });
    $('trace-prev').addEventListener('click', () => { pause(); seek(cursor - 1); });
    $('trace-next').addEventListener('click', () => { pause(); seek(cursor + 1); });
    $('trace-last').addEventListener('click', () => { pause(); ensureTrace(); seek(result.steps.length); });
    $('trace-position').addEventListener('input', () => { pause(); seek(Number($('trace-position').value)); });
    $('trace-play').addEventListener('click', () => {
      if (timer) { pause(); return; }
      ensureTrace();
      if (!result || cursor === result.steps.length) return;
      $('trace-play').textContent = '暂停'; $('trace-play').setAttribute('aria-pressed', 'true');
      timer = setInterval(() => seek(cursor + 1), 650);
    });
    $('trace-zoom').addEventListener('input', () => {
      cell = Number($('trace-zoom').value); $('trace-zoom-label').textContent = `${cell} px`; render();
    });
    panel.addEventListener('toggle', () => { if (panel.open) { ensureTrace(); render(); } else pause(); });
    $('trace-transcript').addEventListener('toggle', () => {
      if (!$('trace-transcript').open || !result) return;
      const lines = ['求解 A·x=b（模 2）。初始增广矩阵 [A | b]。', '顺序：先消左下部分，前向消元全部完成后，再消右上部分。', '异或规则：0⊕0=0；0⊕1=1；1⊕0=1；1⊕1=0。', ''];
      result.steps.forEach((step, i) => {
        const description = describe(step); lines.push(`${i + 1}. [${step.phase === 'upper' ? '第二阶段' : '第一阶段'}] ${description.title}\n   ${description.description}`);
      });
      const finish = conclusion();
      lines.push('', finish.title, finish.text, finish.answer);
      $('trace-text').textContent = lines.join('\n');
    });
    canvas.addEventListener('pointermove', event => {
      if (!rows) return;
      const rect = canvas.getBoundingClientRect(), { left, top, divider } = geometry();
      const x = event.clientX - rect.left - left, y = event.clientY - rect.top - top;
      if (x < 0 || y < 0) return;
      inspect(Math.floor(y / cell), x >= rows.length * cell ? rows.length : Math.floor(x / cell));
    });
    canvas.addEventListener('focus', () => inspect(selectedRow, selectedCol));
    canvas.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      inspect(selectedRow + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0), selectedCol + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0));
      const { left, top, divider } = geometry(), holder = $('trace-scroll');
      const x = left + selectedCol * cell + (selectedCol === rows.length ? divider : 0), y = top + selectedRow * cell;
      if (x < holder.scrollLeft || x + cell > holder.scrollLeft + holder.clientWidth - 30) holder.scrollLeft = x;
      if (y < holder.scrollTop || y + cell > holder.scrollTop + holder.clientHeight - 30) holder.scrollTop = y;
    });
    return {
      setInput(newMatrix, newBoard) {
        pause(); matrix = newMatrix; board = Uint8Array.from(newBoard); result = null; rows = null; cursor = 0;
        selectedRow = 0; selectedCol = 0;
        cell = Math.max(1, Math.min(22, Math.floor(640 / (board.length + 1))));
        $('trace-zoom').max = Math.min(28, Math.floor(4020 / (board.length + 1)));
        $('trace-zoom').value = cell; $('trace-zoom-label').textContent = `${cell} px`;
        $('trace-transcript').open = false; $('trace-text').textContent = '';
        $('trace-cell-value').textContent = '指向单元格查看数值，或聚焦后使用方向键。';
        ensureTrace();
      },
      setVisible(visible) {
        panel.hidden = !visible;
        if (visible) { ensureTrace(); render(); } else pause();
      }
    };
  };
})();
