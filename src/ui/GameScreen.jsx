import React, { useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./ScreenShell.jsx";
import { createEngine, fromCell } from "../game/engine.js";
import { render } from "../game/render.js";
import { createEffects } from "../game/effects.js";
import { SEGMENT_MS } from "../game/constants.js";
import { loadChainStats, loadSolidCells, submitSegment } from "../services/chain.js";

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export default function GameScreen({ session, onFinished, onAbort }) {
  const { chainId, dailyKey, seed, mode, loadout } = session;

  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const effectsRef = useRef(createEffects());
  const rafRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ chainCount: 0, bestScore: 0, recent: [] });
  const [solid, setSolid] = useState(new Set());
  const [usedK, setUsedK] = useState(0);

  const [hud, setHud] = useState({
    score: 0,
    sparks: 0,
    combo: 0,
    tps: 0,
    phaseCharges: 0,
    phaseMs: 0,
    alive: true,
    elapsedMs: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [st, solidRes] = await Promise.all([
          loadChainStats(chainId),
          loadSolidCells(chainId),
        ]);
        if (cancelled) return;
        setStats(st);
        setSolid(solidRes.solid);
        setUsedK(solidRes.usedK);
      } catch (e) {
        console.error(e);
        alert("Failed to load chain data.");
        onAbort?.();
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [chainId, onAbort]);

  // Setup engine + loop
  useEffect(() => {
    if (loading) return;

    const canvas = canvasRef.current;
    const ctx = fitCanvas(canvas);

    const chainCount = stats.chainCount || 0;

    // run seed: chain seed + (chainCount*somePrime) so each run differs but deterministic-ish
    const runSeed = (seed + (chainCount + 1) * 2654435761) >>> 0;

    const engine = createEngine({
      seed: runSeed,
      blocked: solid,
      chainCount,
      mode,
      loadout,
    });
    engineRef.current = engine;

    const effects = effectsRef.current;

    let last = performance.now();
    let acc = 0;
    let elapsed = 0;

    let prevSparks = 0;
    let prevAlive = true;

    function step(now) {
      const dt = now - last;
      last = now;

      elapsed += dt;

      effects.update(dt);

      const tps = engine.getTicksPerSecond();
      const stepMs = 1000 / tps;
      acc += dt;

      while (acc >= stepMs) {
        engine.step(stepMs);
        acc -= stepMs;
      }

      const st = engine.getState();

      // detect events for effects
      if (st.sparks > prevSparks) {
        // spark burst at head
        const head = fromCell(st.body[0], st.w);
        effects.spark(head);
        prevSparks = st.sparks;
      }

      if (prevAlive && !st.alive) {
        const head = fromCell(st.body[0], st.w);
        effects.crash(head);
        prevAlive = false;
      }

      // render
      render(ctx, st, solid, effects);

      // HUD
      setHud({
        score: st.score,
        sparks: st.sparks,
        combo: st.combo,
        tps: st.tps,
        phaseCharges: st.phaseCharges,
        phaseMs: st.phaseMs,
        alive: st.alive,
        elapsedMs: elapsed,
      });

      // finish conditions
      const targetMs = Math.max(6000, SEGMENT_MS + (loadout?.buffs?.timeBonusMs || 0));
      const completed = elapsed >= targetMs && st.alive;
      const crashed = !st.alive;

      if (completed || crashed) {
        cancelAnimationFrame(rafRef.current);

        const result = {
          runId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          chainId,
          dailyKey,
          mode,
          completed,
          crashed,
          score: st.score,
          sparks: st.sparks,
          durationMs: Math.min(elapsed, Math.max(6000, SEGMENT_MS + (loadout?.buffs?.timeBonusMs || 0))),
          chainCountAtStart: chainCount,
          usedK,
          trail: engine.getTrail(),
          inputLog: engine.getInputLog(),
        };

        // submit attempt (store failures too; only completed are used for walls)
        submitSegment({
          chainId,
          completed,
          score: st.score,
          sparks: st.sparks,
          durationMs: result.durationMs,
          mode,
          trail: result.trail,
        }).catch((e) => console.warn("submitSegment failed", e));

        onFinished(result);
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);

    // inputs: canvas taps
    function onPointer(e) {
      const rect = canvas.getBoundingClientRect();
      const x = ("touches" in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      if (x < rect.width / 2) engine.setTurn(-1);
      else engine.setTurn(1);
    }

    let lastInputTs = 0;

    function onKey(e) {
      const reactionMs = loadout?.buffs?.reactionMs ?? 110;
      const now = performance.now();
      if (now - lastInputTs < reactionMs && e.key !== " " && e.key !== "Shift") return;
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") { engine.setDirection(0); lastInputTs = now; }
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") { engine.setDirection(1); lastInputTs = now; }
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") { engine.setDirection(2); lastInputTs = now; }
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") { engine.setDirection(3); lastInputTs = now; }
      if (e.key === " " || e.key === "Shift") engine.activatePhase();
    }

    canvas.addEventListener("click", onPointer);
    canvas.addEventListener("touchstart", onPointer, { passive: true });
    window.addEventListener("keydown", onKey);

    const onResize = () => fitCanvas(canvas);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("click", onPointer);
      canvas.removeEventListener("touchstart", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [loading, chainId, seed, mode, solid, stats.chainCount, usedK, onFinished, dailyKey, loadout]);

  const targetMs = Math.max(6000, SEGMENT_MS + (loadout?.buffs?.timeBonusMs || 0));
  const secsLeft = Math.max(0, (targetMs - hud.elapsedMs) / 1000);

  return (
    <ScreenShell>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 0.4 }}>TRAILCHAIN</div>
            <div className="small muted2">
              {dailyKey ? `Daily ${dailyKey}` : "Custom chain"} • {loadout?.name || "Neon Block"} • Walls from last {usedK} runs
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div className="small muted2">Chain</div>
              <div style={{ fontWeight: 800 }}>{stats.chainCount}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="small muted2">Best</div>
              <div style={{ fontWeight: 800 }}>{stats.bestScore}</div>
            </div>
            <button onClick={onAbort}>Quit</button>
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div className="small muted2">Time left</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{secsLeft.toFixed(1)}s</div>
              </div>

              <div>
                <div className="small muted2">Score</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{hud.score}</div>
              </div>

              <div>
                <div className="small muted2">Combo</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{hud.combo ? `x${hud.combo}` : "—"}</div>
              </div>

              <div>
                <div className="small muted2">Speed</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{hud.tps.toFixed(1)} tps</div>
              </div>

              {mode === "phase" && (
                <div>
                  <div className="small muted2">Phase</div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>
                    {hud.phaseCharges > 0 ? `${hud.phaseCharges}⚡` : (hud.phaseMs > 0 ? "ACTIVE" : "—")}
                  </div>
                </div>
              )}
            </div>

            {mode === "phase" && (
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div className="small muted2">
                  Press <b>Space</b> / <b>Shift</b> or tap the button for a short ghost pass.
                </div>
                <button
                  onClick={() => engineRef.current?.activatePhase()}
                  disabled={hud.phaseCharges <= 0 || hud.phaseMs > 0}
                  style={{ fontWeight: 800 }}
                >
                  PHASE
                </button>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ aspectRatio: "1 / 1", width: "100%" }}>
              <canvas ref={canvasRef} style={{ width: "100%", height: "100%", borderRadius: 14 }} />
            </div>
            <div className="small muted2" style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span>Tap left/right or use ↑ ↓ ← → to steer.</span>
              <span>Goal: survive {(targetMs / 1000).toFixed(1)}s.</span>
            </div>
          </div>

          {stats.recent?.length > 0 && (
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Recent builders</div>
              <div className="muted" style={{ display: "grid", gap: 6 }}>
                {stats.recent.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>{r.nickname || "Anon"} <span className="muted2">({r.mode || "classic"})</span></span>
                    <span style={{ fontWeight: 700 }}>{r.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ marginTop: 12 }} className="small muted2">
            Loading…
          </div>
        )}
      </div>
    </ScreenShell>
  );
}
