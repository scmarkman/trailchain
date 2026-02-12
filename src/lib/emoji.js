const BARS = ["▁","▂","▃","▄","▅","▆","▇","█"];

export function emojiBar(value, maxValue = 1) {
  const t = Math.max(0, Math.min(1, maxValue ? value / maxValue : 0));
  const idx = Math.min(BARS.length - 1, Math.floor(t * (BARS.length - 1)));
  return BARS[idx];
}

export function makeShareText({ completed, score, chainCount, secs, mode }) {
  const title = completed ? "I extended the TRAILCHAIN 🐍" : "TRAILCHAIN wiped me out 💥";
  const bar = Array.from({ length: 10 }, (_, i) => emojiBar((i + 1) / 10, 1)).join("");
  const line1 = `${title}`;
  const line2 = `Score: ${score} • Survived: ${secs.toFixed(1)}s`;
  const line3 = Number.isFinite(chainCount) ? `Chain length: ${chainCount}` : "";
  const line4 = mode ? `Mode: ${mode}` : "";
  const line5 = bar;
  return [line1, line2, line3, line4, line5].filter(Boolean).join("\n");
}
