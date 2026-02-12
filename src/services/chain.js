import { supabase, supabaseConfigured } from "../lib/supabase.js";
import { getNickname } from "../lib/storage.js";
import { BOARD_W, BOARD_H, KEEP_SOLID, OCCUPANCY_CAP } from "../game/constants.js";
import { hashStringToSeed } from "../game/prng.js";

export function todayKeyUTC() {
  return new Date().toISOString().slice(0, 10);
}

function randSeed() {
  return Math.floor(Math.random() * 2 ** 31) >>> 0;
}


export async function getOrCreateDailyChain(dailyKey = todayKeyUTC()) {
  if (!supabaseConfigured) {
    // local fallback
    return { id: "local-daily", seed: hashStringToSeed("trailchain:" + dailyKey), daily_key: dailyKey };
  }

  const seed = hashStringToSeed("trailchain:" + dailyKey);

  // Insert-first (no UPDATE permission needed). If it already exists, load it.
  const inserted = await supabase
    .from("chains")
    .insert({ daily_key: dailyKey, seed })
    .select("id, seed, daily_key")
    .single();

  if (!inserted.error) return inserted.data;

  // Unique violation => row already exists
  if (inserted.error.code !== "23505") throw inserted.error;

  const existing = await supabase
    .from("chains")
    .select("id, seed, daily_key")
    .eq("daily_key", dailyKey)
    .single();

  if (existing.error) throw existing.error;
  return existing.data;
}
export async function createCustomChain() {
  if (!supabaseConfigured) {
    return { id: "local-" + String(Date.now()), seed: randSeed() };
  }
  const seed = randSeed();
  const { data, error } = await supabase
    .from("chains")
    .insert({ seed })
    .select("id, seed")
    .single();
  if (error) throw error;
  return data;
}

export async function loadChain(chainId) {
  if (!supabaseConfigured) {
    return { id: chainId, seed: randSeed() };
  }
  const { data, error } = await supabase
    .from("chains")
    .select("id, seed, daily_key, created_at")
    .eq("id", chainId)
    .single();
  if (error) throw error;
  return data;
}

export async function loadChainStats(chainId) {
  if (!supabaseConfigured) {
    return { chainCount: 0, bestScore: 0, recent: [] };
  }

  const [{ count }, best, recent] = await Promise.all([
    supabase
      .from("segments")
      .select("id", { count: "exact", head: true })
      .eq("chain_id", chainId)
      .eq("completed", true),
    supabase
      .from("segments")
      .select("score")
      .eq("chain_id", chainId)
      .eq("completed", true)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("segments")
      .select("nickname, score, created_at, mode")
      .eq("chain_id", chainId)
      .eq("completed", true)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  return {
    chainCount: count ?? 0,
    bestScore: best?.data?.score ?? 0,
    recent: recent?.data ?? [],
  };
}

export async function loadSolidCells(chainId, maxK = KEEP_SOLID) {
  // Returns { solid:Set<int>, usedK:int }
  if (!supabaseConfigured) {
    return { solid: new Set(), usedK: 0 };
  }

  // Fetch up to maxK most recent successful segments
  const { data, error } = await supabase
    .from("segments")
    .select("trail")
    .eq("chain_id", chainId)
    .eq("completed", true)
    .order("created_at", { ascending: false })
    .limit(maxK);

  if (error) throw error;

  const trails = (data || []).map((r) => Array.isArray(r.trail) ? r.trail : []);

  // Reduce K if too dense
  for (let k = trails.length; k >= 1; k--) {
    const solid = new Set();
    for (let i = 0; i < k; i++) {
      for (const c of trails[i]) solid.add(c);
    }
    const ratio = solid.size / (BOARD_W * BOARD_H);
    if (ratio <= OCCUPANCY_CAP) return { solid, usedK: k };
  }

  // If still too dense, return empty (always playable)
  return { solid: new Set(), usedK: 0 };
}

export async function submitSegment({
  chainId,
  completed,
  score,
  sparks,
  durationMs,
  mode,
  trail,
}) {
  const nickname = getNickname() || "Anon";

  if (!supabaseConfigured) {
    // local no-op
    return { id: "local-seg-" + String(Date.now()), nickname };
  }

  const payload = {
    chain_id: chainId,
    completed,
    score,
    sparks,
    duration_ms: Math.round(durationMs),
    mode,
    nickname,
    trail,
  };

  const { data, error } = await supabase
    .from("segments")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
