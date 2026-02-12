import React, { useEffect, useMemo, useState } from "react";
import HomeScreen from "./ui/HomeScreen.jsx";
import GameScreen from "./ui/GameScreen.jsx";
import EndScreen from "./ui/EndScreen.jsx";
import { readQuery, setQuery } from "./lib/url.js";
import { getOrCreateDailyChain, loadChain, todayKeyUTC } from "./services/chain.js";

export default function App() {
  const initialQuery = useMemo(() => readQuery(), []);
  const [screen, setScreen] = useState("boot"); // boot | home | play | end
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [runKey, setRunKey] = useState(0);

  // Deep-link bootstrap
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const { chainId, dailyKey, mode } = initialQuery;

      if (!chainId && !dailyKey) {
        setScreen("home");
        return;
      }

      try {
        if (dailyKey) {
          const key = dailyKey === "today" ? todayKeyUTC() : dailyKey;
          const chain = await getOrCreateDailyChain(key);
          if (cancelled) return;
          setQuery({ d: key, c: null, m: mode || "classic" });
          setSession({ chainId: chain.id, dailyKey: key, seed: chain.seed, mode: mode || "classic" });
          setScreen("play");
          return;
        }

        if (chainId) {
          const chain = await loadChain(chainId);
          if (cancelled) return;
          setQuery({ c: chainId, d: null, m: mode || "classic" });
          setSession({ chainId: chainId, dailyKey: null, seed: chain.seed, mode: mode || "classic" });
          setScreen("play");
          return;
        }

        setScreen("home");
      } catch (e) {
        console.error(e);
        setScreen("home");
      }
    }

    boot();
    return () => { cancelled = true; };
  }, [initialQuery]);

  function handleStart(sess) {
    setSession(sess);
    setResult(null);
    setRunKey((k) => k + 1);
    setScreen("play");
  }

  function handleFinished(res) {
    setResult(res);
    setScreen("end");
  }

  function goHome() {
    setQuery({ c: null, d: null });
    setSession(null);
    setResult(null);
    setScreen("home");
  }

  function playAgain() {
    setResult(null);
    setRunKey((k) => k + 1);
    setScreen("play");
  }

  if (screen === "boot") {
    return (
      <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
        <div className="muted">Loading…</div>
      </div>
    );
  }

  if (screen === "home") return <HomeScreen onStart={handleStart} />;

  if (screen === "play" && session) {
    return (
      <GameScreen
        key={runKey}
        session={session}
        onFinished={handleFinished}
        onAbort={goHome}
      />
    );
  }

  if (screen === "end" && result) {
    return <EndScreen result={result} onPlayAgain={playAgain} onHome={goHome} />;
  }

  return <HomeScreen onStart={handleStart} />;
}
