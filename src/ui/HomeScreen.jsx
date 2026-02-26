import React, { useMemo, useState } from "react";
import ScreenShell from "./ScreenShell.jsx";
import { createCustomChain, getOrCreateDailyChain, todayKeyUTC } from "../services/chain.js";
import {
  addCoins,
  getCoins,
  getDailyStreak,
  getEquippedItem,
  getNickname,
  getOwnedItems,
  ownItem,
  setEquippedItem,
  setNickname,
} from "../lib/storage.js";
import { setQuery } from "../lib/url.js";
import { supabaseConfigured } from "../lib/supabase.js";
import { SHOP_ITEMS, getEffectiveLoadout } from "../game/shop.js";

function parseLink(input) {
  try {
    const u = new URL(input.trim());
    const q = new URLSearchParams(u.search);
    const chainId = q.get("c");
    const dailyKey = q.get("d");
    const mode = q.get("m");
    return { chainId, dailyKey, mode };
  } catch {
    return null;
  }
}

export default function HomeScreen({ onStart }) {
  const [busy, setBusy] = useState(false);
  const [nickname, setNick] = useState(getNickname());
  const [mode, setMode] = useState("classic");
  const [coins, setCoins] = useState(getCoins());
  const [owned, setOwned] = useState(new Set(getOwnedItems()));
  const [equipped, setEquipped] = useState(getEquippedItem());
  const streak = useMemo(() => getDailyStreak(), []);

  function buildSession(chain, dailyKey = null) {
    const loadout = getEffectiveLoadout(equipped);
    return {
      chainId: chain.id,
      dailyKey,
      seed: chain.seed,
      mode,
      loadout,
    };
  }

  async function startDaily() {
    setBusy(true);
    try {
      const key = todayKeyUTC();
      const chain = await getOrCreateDailyChain(key);
      setQuery({ d: key, c: null, m: mode });
      onStart(buildSession(chain, key));
    } catch (e) {
      console.error(e);
      alert("Failed to load daily chain.");
    } finally {
      setBusy(false);
    }
  }

  async function startNew() {
    setBusy(true);
    try {
      const chain = await createCustomChain();
      setQuery({ c: chain.id, d: null, m: mode });
      onStart(buildSession(chain, null));
    } catch (e) {
      console.error(e);
      alert("Failed to create chain.");
    } finally {
      setBusy(false);
    }
  }

  function saveNick(v) {
    setNick(v);
    setNickname(v);
  }

  function openLink() {
    const input = prompt("Paste a TRAILCHAIN link (or just the URL with ?c=...):");
    if (!input) return;
    const parsed = parseLink(input);
    if (!parsed) {
      alert("That link doesn't look right.");
      return;
    }
    setQuery({ c: parsed.chainId || null, d: parsed.dailyKey || null, m: parsed.mode || mode });
    window.location.reload();
  }

  function buyOrEquip(item) {
    if (owned.has(item.id)) {
      setEquipped(item.id);
      setEquippedItem(item.id);
      return;
    }
    if (coins < item.cost) {
      alert("Not enough sparks. Play more runs to earn currency.");
      return;
    }
    const nextCoins = addCoins(-item.cost);
    ownItem(item.id);
    setCoins(nextCoins);
    const nextOwned = new Set(getOwnedItems());
    setOwned(nextOwned);
    setEquipped(item.id);
    setEquippedItem(item.id);
  }

  return (
    <ScreenShell>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: 0.5 }}>TRAILCHAIN</div>
            <div className="muted" style={{ marginTop: 6 }}>
              20-second snake relay. Your run becomes their maze.
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="small muted2">Daily streak</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{streak.streak || 0} 🔥</div>
            <div className="small muted2" style={{ marginTop: 4 }}>Shop sparks: <b>{coins}</b></div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        {!supabaseConfigured && (
          <div className="card" style={{ padding: 12, background: "rgba(255,80,110,.10)" }}>
            <div style={{ fontWeight: 700 }}>Supabase not configured</div>
            <div className="muted" style={{ marginTop: 4 }}>
              The game will run locally, but chains won't persist or be shareable until you set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 14 }}>
          <div className="card" style={{ padding: 12 }}>
            <div className="small muted2">Nickname (optional)</div>
            <input
              value={nickname}
              onChange={(e) => saveNick(e.target.value)}
              placeholder="Anon"
              maxLength={18}
              style={{
                width: "100%",
                marginTop: 8,
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,.25)",
                color: "white",
                outline: "none",
                fontSize: 16,
              }}
            />
          </div>

          <div className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div className="small muted2">Mode</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>
                {mode === "classic" ? "Classic" : "Phase (1 ghost pass)"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button disabled={busy} onClick={() => setMode("classic")}>Classic</button>
              <button disabled={busy} onClick={() => setMode("phase")}>Phase</button>
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Snake Shop</div>
            <div className="small muted2" style={{ marginBottom: 10 }}>
              Buy colors + shapes with sparks. Buffs affect speed, reaction, movement, and survival time.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {SHOP_ITEMS.map((item) => {
                const isOwned = owned.has(item.id);
                const isEquipped = equipped === item.id;
                return (
                  <div key={item.id} className="card" style={{ padding: 10, border: isEquipped ? "1px solid #7dd3fc" : "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 800 }}>{item.name}</div>
                      <div className="small muted2">{item.cost === 0 ? "Free" : `${item.cost} sparks`}</div>
                    </div>
                    <div className="small muted2" style={{ marginTop: 4 }}>{item.description}</div>
                    <div className="small" style={{ marginTop: 8, lineHeight: 1.45 }}>
                      • Speed ×{item.buffs.speedMultiplier.toFixed(2)}<br />
                      • Reaction {item.buffs.reactionMs}ms<br />
                      • Movement {item.buffs.edgeWrap ? "Edge-wrap" : "Standard"}<br />
                      • Time {item.buffs.timeBonusMs >= 0 ? "+" : ""}{(item.buffs.timeBonusMs / 1000).toFixed(1)}s
                    </div>
                    <button
                      disabled={busy || (isOwned && isEquipped)}
                      onClick={() => buyOrEquip(item)}
                      style={{ width: "100%", marginTop: 10, fontWeight: 700 }}
                    >
                      {isOwned ? (isEquipped ? "Equipped" : "Equip") : `Buy (${item.cost})`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
            <button disabled={busy} onClick={startDaily} style={{ fontWeight: 700 }}>
              Play Daily Relay
              <div className="small muted2" style={{ marginTop: 4 }}>One chain per day (UTC)</div>
            </button>

            <button disabled={busy} onClick={startNew} style={{ fontWeight: 700 }}>
              Start New Chain
              <div className="small muted2" style={{ marginTop: 4 }}>Make your own link</div>
            </button>
          </div>

          <button disabled={busy} onClick={openLink}>
            Open Link
            <div className="small muted2" style={{ marginTop: 4 }}>Paste a shared URL</div>
          </button>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>How it works</div>
            <div className="muted" style={{ lineHeight: 1.5 }}>
              • Tap left/right to turn.<br/>
              • Survive 20 seconds.<br/>
              • If you survive, your snake body becomes walls for the next players in this chain.<br/>
              • Share the link. The chain gets harder (and funnier) as it grows.
            </div>
          </div>

          <div className="small muted2">
            Tip: The sticky part is the combo score. Grab sparks quickly to stack multipliers.
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
