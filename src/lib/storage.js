const KEY = "trailchain:v1";

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

export function loadStore() {
  const raw = localStorage.getItem(KEY);
  const data = raw ? safeParse(raw) : null;
  return data && typeof data === "object" ? data : {};
}

export function saveStore(next) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function getNickname() {
  const s = loadStore();
  return typeof s.nickname === "string" ? s.nickname : "";
}

export function setNickname(nickname) {
  const s = loadStore();
  s.nickname = nickname.slice(0, 18);
  saveStore(s);
}

export function getDailyStreak() {
  const s = loadStore();
  return {
    streak: Number.isFinite(s.dailyStreak) ? s.dailyStreak : 0,
    lastWin: typeof s.dailyLastWin === "string" ? s.dailyLastWin : "",
  };
}

export function updateDailyStreak(todayKey) {
  const s = loadStore();
  const prev = typeof s.dailyLastWin === "string" ? s.dailyLastWin : "";
  const prevDate = prev ? new Date(prev + "T00:00:00Z") : null;
  const todayDate = new Date(todayKey + "T00:00:00Z");
  const diffDays = prevDate ? Math.round((todayDate - prevDate) / 86400000) : null;

  if (!prevDate) {
    s.dailyStreak = 1;
  } else if (diffDays === 1) {
    s.dailyStreak = (Number.isFinite(s.dailyStreak) ? s.dailyStreak : 0) + 1;
  } else if (diffDays === 0) {
    // already counted today
  } else {
    s.dailyStreak = 1;
  }
  s.dailyLastWin = todayKey;
  saveStore(s);
  return { streak: s.dailyStreak || 1, lastWin: todayKey };
}


export function getCoins() {
  const s = loadStore();
  return Number.isFinite(s.coins) ? Math.max(0, Math.floor(s.coins)) : 0;
}

export function addCoins(delta) {
  const s = loadStore();
  const current = Number.isFinite(s.coins) ? s.coins : 0;
  s.coins = Math.max(0, Math.floor(current + delta));
  saveStore(s);
  return s.coins;
}

export function getOwnedItems() {
  const s = loadStore();
  const owned = Array.isArray(s.ownedItems) ? s.ownedItems.filter((v) => typeof v === "string") : [];
  if (!owned.includes("neon-block")) owned.unshift("neon-block");
  return Array.from(new Set(owned));
}

export function ownItem(itemId) {
  const s = loadStore();
  const owned = Array.isArray(s.ownedItems) ? s.ownedItems.filter((v) => typeof v === "string") : [];
  if (!owned.includes("neon-block")) owned.unshift("neon-block");
  if (!owned.includes(itemId)) owned.push(itemId);
  s.ownedItems = Array.from(new Set(owned));
  saveStore(s);
  return s.ownedItems;
}

export function getEquippedItem() {
  const s = loadStore();
  return typeof s.equippedItem === "string" ? s.equippedItem : "neon-block";
}

export function setEquippedItem(itemId) {
  const s = loadStore();
  s.equippedItem = itemId;
  saveStore(s);
}
