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

export function render(ctx, state, blockedSet, effects) {
  const { w, h, body, sparkCells, phaseMs } = state;
  const { cell, ox, oy } = computeLayout(ctx, w, h);

  const shake = effects?.getShakeOffset ? effects.getShakeOffset() : { x: 0, y: 0 };
  const sx = shake.x;
  const sy = shake.y;

  // background
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // board panel
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(ox + sx - cell, oy + sy - cell, cell * (w + 2), cell * (h + 2));
  ctx.globalAlpha = 1;

  // subtle grid
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "white";
  for (let x = 0; x <= w; x++) {
    ctx.beginPath();
    ctx.moveTo(ox + sx + x * cell, oy + sy);
    ctx.lineTo(ox + sx + x * cell, oy + sy + h * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y++) {
    ctx.beginPath();
    ctx.moveTo(ox + sx, oy + sy + y * cell);
    ctx.lineTo(ox + sx + w * cell, oy + sy + y * cell);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // walls / solid cells
  if (blockedSet && blockedSet.size) {
    ctx.fillStyle = "rgba(255,255,255,.18)";
    blockedSet.forEach((cellId) => {
      const { x, y } = fromCell(cellId, w);
      ctx.fillRect(ox + sx + x * cell, oy + sy + y * cell, cell, cell);
    });
  }

  // sparks
  ctx.fillStyle = "rgba(255,255,255,.92)";
  for (const c of sparkCells) {
    const { x, y } = fromCell(c, w);
    const cx = ox + sx + (x + 0.5) * cell;
    const cy = oy + sy + (y + 0.5) * cell;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  // snake
  for (let i = body.length - 1; i >= 0; i--) {
    const c = body[i];
    const { x, y } = fromCell(c, w);
    const px = ox + sx + x * cell;
    const py = oy + sy + y * cell;

    if (i === 0) {
      // head
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,.98)";
      ctx.fillRect(px, py, cell, cell);

      // phase aura
      if (phaseMs > 0) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "white";
        ctx.lineWidth = Math.max(2, cell * 0.12);
        ctx.strokeRect(px - 1, py - 1, cell + 2, cell + 2);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
      }
    } else {
      const t = 1 - i / body.length;
      ctx.globalAlpha = 0.22 + 0.65 * t;
      ctx.fillStyle = "white";
      ctx.fillRect(px, py, cell, cell);
    }
  }
  ctx.globalAlpha = 1;

  // particles / effects
  if (effects?.draw) {
    effects.draw(ctx, { cell, ox: ox + sx, oy: oy + sy }, state);
  }
}
