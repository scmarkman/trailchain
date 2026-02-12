export function createEffects() {
  const particles = [];
  let shakeMs = 0;
  let shakeAmp = 0;

  function burst({ x, y }, strength = 1) {
    const count = Math.round(10 * strength);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 0.2,
        y: y + (Math.random() - 0.5) * 0.2,
        vx: (Math.random() - 0.5) * 2.2 * strength,
        vy: (Math.random() - 0.5) * 2.2 * strength,
        life: 500 + Math.random() * 350,
        age: 0,
        size: 0.10 + Math.random() * 0.18,
      });
    }
  }

  function spark(cellPos) {
    burst(cellPos, 0.9);
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function crash(cellPos) {
    burst(cellPos, 2.2);
    shakeMs = 260;
    shakeAmp = 8;
    if (navigator.vibrate) navigator.vibrate([20, 12, 30]);
  }

  function update(dt) {
    if (shakeMs > 0) shakeMs = Math.max(0, shakeMs - dt);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      const t = p.age / p.life;
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      // drag
      p.vx *= 0.98;
      p.vy *= 0.98;
      // slight upward drift
      p.vy -= 0.25 * (dt / 1000);
      p.alpha = 1 - t;
    }
  }

  function getShakeOffset() {
    if (shakeMs <= 0) return { x: 0, y: 0 };
    const t = shakeMs / 260;
    const amp = shakeAmp * t;
    return {
      x: (Math.random() - 0.5) * amp,
      y: (Math.random() - 0.5) * amp,
    };
  }

  function draw(ctx, layout) {
    const { cell, ox, oy } = layout;
    ctx.save();
    ctx.fillStyle = "white";
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * 0.9));
      const px = ox + (p.x + 0.5) * cell;
      const py = oy + (p.y + 0.5) * cell;
      const s = cell * p.size;
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  return { spark, crash, update, draw, getShakeOffset };
}
