import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./ScreenShell.jsx";
import { buildShareUrl } from "../lib/url.js";
import { makeShareText } from "../lib/emoji.js";
import { updateDailyStreak } from "../lib/storage.js";

function fmtMs(ms) {
  return (ms / 1000).toFixed(1) + "s";
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function makeShareCardPng({ completed, score, chainCount, dailyKey, mode }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");

  // background
  const grad = ctx.createLinearGradient(0, 0, 0, 630);
  grad.addColorStop(0, "#0a0a0f");
  grad.addColorStop(1, "#151527");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 630);

  // decorative dots
  ctx.fillStyle = "rgba(255,255,255,.12)";
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 1200;
    const y = Math.random() * 630;
    const s = 2 + Math.random() * 4;
    ctx.globalAlpha = 0.05 + Math.random() * 0.12;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;

  // title
  ctx.fillStyle = "white";
  ctx.font = "800 84px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  ctx.fillText("TRAILCHAIN", 80, 190);

  ctx.font = "600 36px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  ctx.globalAlpha = 0.9;
  ctx.fillText(completed ? "Chain extended." : "Chain challenge.", 80, 245);
  ctx.globalAlpha = 1;

  // stats
  ctx.font = "800 56px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  ctx.fillText(String(score), 80, 350);

  ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  ctx.globalAlpha = 0.8;
  ctx.fillText("SCORE", 80, 390);

  ctx.globalAlpha = 1;
  ctx.font = "700 36px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  if (Number.isFinite(chainCount)) ctx.fillText(`Chain: ${chainCount}`, 80, 455);
  if (dailyKey) ctx.fillText(`Daily: ${dailyKey}`, 80, 505);
  if (mode) ctx.fillText(`Mode: ${mode}`, 80, 555);

  // tiny CTA
  ctx.globalAlpha = 0.8;
  ctx.font = "600 24px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  ctx.fillText("Tap left/right • Survive 20s • Share the link", 80, 600);
  ctx.globalAlpha = 1;

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob;
}

export default function EndScreen({ result, onPlayAgain, onHome }) {
  const [copied, setCopied] = useState("");
  const [streakInfo, setStreakInfo] = useState(null);

  const shareUrl = useMemo(() => buildShareUrl({
    chainId: result.chainId,
    dailyKey: result.dailyKey || null,
    mode: result.mode,
  }), [result]);

  const shareText = useMemo(() => makeShareText({
    completed: result.completed,
    score: result.score,
    chainCount: result.chainCountAtStart + (result.completed ? 1 : 0),
    secs: result.durationMs / 1000,
    mode: result.mode,
  }), [result]);

  useEffect(() => {
    if (result.dailyKey && result.completed) {
      const info = updateDailyStreak(result.dailyKey);
      setStreakInfo(info);
    }
  }, [result]);

  async function shareNative() {
    const text = shareText + "\n" + shareUrl;

    // Try share with image card if supported
    try {
      const blob = await makeShareCardPng({
        completed: result.completed,
        score: result.score,
        chainCount: result.chainCountAtStart + (result.completed ? 1 : 0),
        dailyKey: result.dailyKey,
        mode: result.mode,
      });
      const file = new File([blob], "trailchain.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({ title: "TRAILCHAIN", text, url: shareUrl, files: [file] });
        return;
      }
    } catch {
      // ignore
    }

    // fallback: normal share or copy
    if (navigator.share) {
      try {
        await navigator.share({ title: "TRAILCHAIN", text, url: shareUrl });
        return;
      } catch {
        // ignore
      }
    }

    const ok = await copy(text);
    setCopied(ok ? "Copied share text + link." : "Could not copy.");
    setTimeout(() => setCopied(""), 1600);
  }

  async function copyLink() {
    const ok = await copy(shareUrl);
    setCopied(ok ? "Copied link." : "Could not copy.");
    setTimeout(() => setCopied(""), 1200);
  }

  async function copyText() {
    const ok = await copy(shareText + "\n" + shareUrl);
    setCopied(ok ? "Copied text." : "Could not copy.");
    setTimeout(() => setCopied(""), 1200);
  }

  return (
    <ScreenShell>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 900 }}>
              {result.completed ? "CHAIN EXTENDED ✅" : "YOU CRASHED 💥"}
            </div>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Score <b>{result.score}</b> • Sparks <b>{result.sparks}</b> • Survived <b>{fmtMs(result.durationMs)}</b><br/>
              Chain length {result.chainCountAtStart}{result.completed ? " → " + (result.chainCountAtStart + 1) : ""}
              {result.usedK ? ` • Walls used: ${result.usedK}` : ""}
            </div>
            {streakInfo && (
              <div className="muted" style={{ marginTop: 8 }}>
                Daily streak: <b>{streakInfo.streak} 🔥</b>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onPlayAgain} style={{ fontWeight: 800 }}>Play Again</button>
            <button onClick={onHome}>Home</button>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Make it viral</div>
          <div className="muted" style={{ lineHeight: 1.55, marginBottom: 12 }}>
            This game spreads when you send a link and dare someone to survive your maze. Do it now while your run is fresh.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <button onClick={shareNative} style={{ fontWeight: 900 }}>Share</button>
            <button onClick={copyLink}>Copy Link</button>
            <button onClick={copyText}>Copy Text + Link</button>
            <a href={shareUrl} target="_blank" rel="noreferrer">
              <button style={{ width: "100%" }}>Open Link</button>
            </a>
          </div>

          <div className="small muted2" style={{ marginTop: 10, wordBreak: "break-all" }}>
            {shareUrl}
          </div>

          {copied && (
            <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
              {copied}
            </div>
          )}
        </div>

        <div style={{ height: 14 }} />

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Sticky loop</div>
          <div className="muted" style={{ lineHeight: 1.55 }}>
            • Chase multipliers: sparks collected quickly stack combo scoring.<br/>
            • Daily relay: keep your streak alive (UTC).<br/>
            • The maze evolves as more people survive — which makes every link different.
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
