import {
  BOARD_W,
  BOARD_H,
  BASE_TPS,
  TPS_PER_SPARK,
  TPS_PER_CHAIN,
  MAX_TPS,
  SPARK_POINTS,
  START_LEN,
  SPARKS_ON_BOARD,
  PHASE_CHARGE,
  PHASE_MS,
} from "./constants.js";
import { mulberry32 } from "./prng.js";

const DIRS = [
  { x: 0, y: -1 }, // up
  { x: 1, y: 0 },  // right
  { x: 0, y: 1 },  // down
  { x: -1, y: 0 }, // left
];

export function toCell(x, y, w = BOARD_W) {
  return y * w + x;
}

export function fromCell(cell, w = BOARD_W) {
  const x = cell % w;
  const y = Math.floor(cell / w);
  return { x, y };
}

export function inBounds(x, y, w = BOARD_W, h = BOARD_H) {
  return x >= 0 && y >= 0 && x < w && y < h;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function createEngine({ seed, blocked = new Set(), chainCount = 0, mode = "classic" }) {
  const w = BOARD_W;
  const h = BOARD_H;
  const rand = mulberry32(seed);

  let dir = 1; // right
  let alive = true;
  let score = 0;
  let sparks = 0;

  // combo mechanic (tiny but sticky)
  let combo = 0;
  let comboMs = 0;

  // phase ability (optional mode)
  const phaseEnabled = mode === "phase";
  let phaseCharges = phaseEnabled ? PHASE_CHARGE : 0;
  let phaseMs = 0;

  const inputs = []; // for analytics/replay: {t, turn}
  let tick = 0;
  let pendingTurn = 0;

  // snake
  let body = [];          // cell ids, head at index 0
  const bodySet = new Set();

  // sparks on board
  const sparkCells = new Set();

  // spawn a safe snake
  function trySpawnSnake() {
    for (let tries = 0; tries < 200; tries++) {
      const x = Math.floor(rand() * w);
      const y = Math.floor(rand() * h);
      if (!inBounds(x, y, w, h)) continue;
      const headCell = toCell(x, y, w);
      if (blocked.has(headCell)) continue;

      // pick a direction that allows room for start_len
      const dirTry = Math.floor(rand() * 4);
      const d = DIRS[dirTry];

      const temp = [];
      let ok = true;
      for (let i = 0; i < START_LEN; i++) {
        const cx = x - d.x * i;
        const cy = y - d.y * i;
        if (!inBounds(cx, cy, w, h)) { ok = false; break; }
        const c = toCell(cx, cy, w);
        if (blocked.has(c)) { ok = false; break; }
        temp.push(c);
      }
      if (!ok) continue;

      dir = dirTry;
      body = temp;
      bodySet.clear();
      temp.forEach(c => bodySet.add(c));
      return true;
    }
    return false;
  }

  if (!trySpawnSnake()) {
    // fallback: center spawn
    const x = Math.floor(w / 2);
    const y = Math.floor(h / 2);
    dir = 1;
    body = [toCell(x, y, w)];
    bodySet.add(body[0]);
  }

  function spawnSpark() {
    // keep sparks somewhat away from head to avoid free points
    const head = fromCell(body[0], w);
    for (let tries = 0; tries < 500; tries++) {
      const x = Math.floor(rand() * w);
      const y = Math.floor(rand() * h);
      if (!inBounds(x, y, w, h)) continue;
      const c = toCell(x, y, w);
      if (blocked.has(c)) continue;
      if (bodySet.has(c)) continue;
      if (sparkCells.has(c)) continue;
      if (manhattan(head, { x, y }) < 4) continue;
      sparkCells.add(c);
      return;
    }
  }

  while (sparkCells.size < SPARKS_ON_BOARD) spawnSpark();

  function setTurn(turn) {
    if (!alive) return;
    if (turn !== -1 && turn !== 1) return;
    pendingTurn = turn;
    inputs.push({ t: tick, turn });
  }

  function activatePhase() {
    if (!alive) return;
    if (!phaseEnabled) return;
    if (phaseCharges <= 0) return;
    if (phaseMs > 0) return;
    phaseCharges -= 1;
    phaseMs = PHASE_MS;
  }

  function getTicksPerSecond() {
    const tps = BASE_TPS + sparks * TPS_PER_SPARK + chainCount * TPS_PER_CHAIN;
    return Math.min(MAX_TPS, Math.max(8, tps));
  }

  let grow = 0;

  function step(dtMs) {
    if (!alive) return;

    tick += 1;

    // phase timer
    if (phaseMs > 0) {
      phaseMs = Math.max(0, phaseMs - dtMs);
    }

    // combo timer
    if (comboMs > 0) {
      comboMs = Math.max(0, comboMs - dtMs);
      if (comboMs === 0) combo = 0;
    }

    // apply pending turn once per tick
    if (pendingTurn !== 0) {
      const nextDir = (dir + pendingTurn + 4) % 4;
      // prevent instant 180 reversal when length > 1
      const backDir = (dir + 2) % 4;
      if (!(body.length > 1 && nextDir === backDir)) {
        dir = nextDir;
      }
      pendingTurn = 0;
    }

    const head = fromCell(body[0], w);
    const d = DIRS[dir];
    const nx = head.x + d.x;
    const ny = head.y + d.y;

    if (!inBounds(nx, ny, w, h)) {
      alive = false;
      return;
    }

    const nextCell = toCell(nx, ny, w);

    const phasing = phaseMs > 0;

    // collisions (unless phasing)
    if (!phasing) {
      if (blocked.has(nextCell)) { alive = false; return; }
      // self collision (tail may move; handle by checking after pop if not growing)
      // self collision: moving into the current tail is allowed if the tail will move this tick
      if (bodySet.has(nextCell)) {
        const tail = body[body.length - 1];
        const movingIntoTail = (grow === 0 && nextCell === tail);
        if (!movingIntoTail) { alive = false; return; }
      }
    }

    // move
    body.unshift(nextCell);
    bodySet.add(nextCell);

    // spark pickup
    if (sparkCells.has(nextCell)) {
      sparkCells.delete(nextCell);
      sparks += 1;
      grow += 1;

      // combo scoring
      combo = comboMs > 0 ? combo + 1 : 1;
      comboMs = 1200;
      score += SPARK_POINTS * combo;

      spawnSpark();
    }

    // trim tail unless growing
    if (grow > 0) {
      grow -= 1;
    } else {
      const tail = body.pop();
      bodySet.delete(tail);
    }
  }

  function getState() {
    return {
      w, h,
      tick,
      alive,
      dir,
      body,
      blockedCount: blocked.size,
      sparkCells: Array.from(sparkCells),
      score,
      sparks,
      combo,
      comboMs,
      phaseEnabled,
      phaseCharges,
      phaseMs,
      tps: getTicksPerSecond(),
    };
  }

  function getTrail() {
    // What becomes walls for others: final body
    return body.slice();
  }

  function getInputLog() {
    return inputs.slice();
  }

  return {
    step,
    setTurn,
    activatePhase,
    getTicksPerSecond,
    getState,
    getTrail,
    getInputLog,
  };
}
