import { fromCell } from "./engine.js";

export function computeLayout(ctx, w, h) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  const cell = Math.floor(Math.min(cw / (w + 2), ch / (h + 2)));
  const gridW = cell * w;
  const gridH = cell * h;

  const ox = Math.floor((cw - gridW) / 2);
  const oy = Math.floor((ch - gridH) / 2);

  return { cell, ox, oy, gridW, gridH };
}

function drawSnakeCell(ctx, shape, px, py, size) {
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(px + size / 2, py + size / 2, size * 0.46, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(px + size / 2, py + size * 0.05);
    ctx.lineTo(px + size * 0.95, py + size / 2);
    ctx.lineTo(px + size / 2, py + size * 0.95);
    ctx.lineTo(px + size * 0.05, py + size / 2);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.fillRect(px, py, size, size);
}

export function render(ctx, state, blockedSet, effects) {
  const { w, h, body, sparkCells, phaseMs, snakeShape, snakeColor, snakeHeadColor } = state;
  const { cell, ox, oy } = computeLayout(ctx, w, h);

  const shake = effects?.getShakeOffset ? effects.getShakeOffset() : { x: 0, y: 0 };
  const sx = shake.x;
  const sy = shake.y;

  const boardX = ox + sx;
  const boardY = oy + sy;
  const boardW = w * cell;
  const boardH = h * cell;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const bgGrad = ctx.createLinearGradient(boardX - cell, boardY - cell, boardX + boardW + cell, boardY + boardH + cell);
  bgGrad.addColorStop(0, "rgba(126,34,206,0.40)");
  bgGrad.addColorStop(0.5, "rgba(14,165,233,0.35)");
  bgGrad.addColorStop(1, "rgba(16,185,129,0.35)");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(boardX - cell, boardY - cell, boardW + cell * 2, boardH + cell * 2);

  const boardGrad = ctx.createRadialGradient(
    boardX + boardW * 0.5,
    boardY + boardH * 0.45,
    cell,
    boardX + boardW * 0.5,
    boardY + boardH * 0.45,
    Math.max(boardW, boardH)
  );
  boardGrad.addColorStop(0, "rgba(16,24,56,.96)");
  boardGrad.addColorStop(1, "rgba(10,10,24,.97)");
  ctx.fillStyle = boardGrad;
  ctx.fillRect(boardX, boardY, boardW, boardH);

  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x++) {
    ctx.globalAlpha = 0.1 + (x % 4 === 0 ? 0.1 : 0);
    ctx.strokeStyle = x % 2 === 0 ? "#38bdf8" : "#a78bfa";
    ctx.beginPath();
    ctx.moveTo(boardX + x * cell, boardY);
    ctx.lineTo(boardX + x * cell, boardY + boardH);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y++) {
    ctx.globalAlpha = 0.1 + (y % 4 === 0 ? 0.1 : 0);
    ctx.strokeStyle = y % 2 === 0 ? "#22d3ee" : "#34d399";
    ctx.beginPath();
    ctx.moveTo(boardX, boardY + y * cell);
    ctx.lineTo(boardX + boardW, boardY + y * cell);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (blockedSet && blockedSet.size) {
    blockedSet.forEach((cellId) => {
      const { x, y } = fromCell(cellId, w);
      const px = boardX + x * cell;
      const py = boardY + y * cell;
      const wallGrad = ctx.createLinearGradient(px, py, px + cell, py + cell);
      wallGrad.addColorStop(0, "rgba(244,114,182,.45)");
      wallGrad.addColorStop(1, "rgba(129,140,248,.42)");
      ctx.fillStyle = wallGrad;
      ctx.fillRect(px, py, cell, cell);
    });
  }

  for (const c of sparkCells) {
    const { x, y } = fromCell(c, w);
    const cx = boardX + (x + 0.5) * cell;
    const cy = boardY + (y + 0.5) * cell;

    const sparkGrad = ctx.createRadialGradient(cx, cy, cell * 0.08, cx, cy, cell * 0.36);
    sparkGrad.addColorStop(0, "rgba(255,255,255,.98)");
    sparkGrad.addColorStop(0.65, "rgba(250,204,21,.95)");
    sparkGrad.addColorStop(1, "rgba(251,146,60,.15)");
    ctx.fillStyle = sparkGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = body.length - 1; i >= 0; i--) {
    const c = body[i];
    const { x, y } = fromCell(c, w);
    const px = boardX + x * cell;
    const py = boardY + y * cell;

    if (i === 0) {
      const headGrad = ctx.createLinearGradient(px, py, px + cell, py + cell);
      headGrad.addColorStop(0, snakeHeadColor || "#86efac");
      headGrad.addColorStop(1, snakeColor || "#22d3ee");
      ctx.fillStyle = headGrad;
      drawSnakeCell(ctx, snakeShape, px, py, cell);

      if (phaseMs > 0) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = "#fde68a";
        ctx.lineWidth = Math.max(2, cell * 0.12);
        ctx.strokeRect(px - 1, py - 1, cell + 2, cell + 2);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
      }
    } else {
      const t = 1 - i / body.length;
      const segGrad = ctx.createLinearGradient(px, py, px + cell, py + cell);
      segGrad.addColorStop(0, `${snakeColor || "#38bdf8"}F2`);
      segGrad.addColorStop(1, "rgba(196,181,253,.95)");
      ctx.fillStyle = segGrad;
      ctx.globalAlpha = 0.28 + 0.62 * t;
      drawSnakeCell(ctx, snakeShape, px, py, cell);
    }
  }
  ctx.globalAlpha = 1;

  if (effects?.draw) {
    effects.draw(ctx, { cell, ox: boardX, oy: boardY }, state);
  }
}
