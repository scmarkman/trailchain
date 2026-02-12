// ============================================================
// DETERMINISTIC PRNG (Mulberry32)
// ============================================================
export function mulberry32(seed) {
  let s = seed | 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ============================================================
// CONSTANTS
// ============================================================
export const GRID = 28
export const TICK_BASE = 10
export const TICK_MAX = 16
export const SEGMENT_DURATION = 20
export const SPARK_SCORE = 10
export const COMPLETION_BONUS = 200
export const MIN_SPARK_DIST = 4
export const MAX_SOLID_SEGMENTS = 6
export const OCCUPANCY_CAP = 0.35
export const MIN_FREE_CELLS = 100

export const DIR_VECS = [
  { x: 0, y: -1 },  // UP
  { x: 1, y: 0 },   // RIGHT
  { x: 0, y: 1 },   // DOWN
  { x: -1, y: 0 },  // LEFT
]

export function oppositeDir(i) {
  return (i + 2) % 4
}

// ============================================================
// BOARD BUILDING
// ============================================================
export function buildWalls(segments, K) {
  const walls = new Set()
  for (let x = 0; x < GRID; x++) {
    walls.add(`${x},0`)
    walls.add(`${x},${GRID - 1}`)
  }
  for (let y = 0; y < GRID; y++) {
    walls.add(`0,${y}`)
    walls.add(`${GRID - 1},${y}`)
  }
  const solidSegs = segments.slice(-K)
  solidSegs.forEach((seg) => {
    if (seg.trail) {
      seg.trail.forEach((c) => walls.add(c))
    }
  })
  return walls
}

export function floodFill(startKey, walls) {
  const visited = new Set()
  const queue = [startKey]
  visited.add(startKey)
  while (queue.length > 0) {
    const cur = queue.shift()
    const [cx, cy] = cur.split(',').map(Number)
    for (const d of DIR_VECS) {
      const nx = cx + d.x, ny = cy + d.y
      const nk = `${nx},${ny}`
      if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID && !walls.has(nk) && !visited.has(nk)) {
        visited.add(nk)
        queue.push(nk)
      }
    }
  }
  return visited.size
}

export function findSpawn(walls, rng) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = 2 + Math.floor(rng() * (GRID - 4))
    const y = 2 + Math.floor(rng() * (GRID - 4))
    const key = `${x},${y}`
    if (walls.has(key)) continue
    let freeNeighbors = 0
    for (const d of DIR_VECS) {
      if (!walls.has(`${x + d.x},${y + d.y}`)) freeNeighbors++
    }
    if (freeNeighbors < 2) continue
    const dirIdx = Math.floor(rng() * 4)
    const dv = DIR_VECS[dirIdx]
    let ahead = true
    for (let s = 1; s <= 2; s++) {
      if (walls.has(`${x + dv.x * s},${y + dv.y * s}`)) { ahead = false; break }
    }
    if (!ahead) continue
    const reachable = floodFill(key, walls)
    if (reachable >= MIN_FREE_CELLS) return { x, y, dirIdx }
  }
  return { x: Math.floor(GRID / 2), y: Math.floor(GRID / 2), dirIdx: 1 }
}

export function spawnSpark(walls, bodySet, headX, headY, rng) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = 1 + Math.floor(rng() * (GRID - 2))
    const y = 1 + Math.floor(rng() * (GRID - 2))
    const key = `${x},${y}`
    if (walls.has(key) || bodySet.has(key)) continue
    const dist = Math.abs(x - headX) + Math.abs(y - headY)
    if (dist < MIN_SPARK_DIST) continue
    return { x, y }
  }
  return null
}

// ============================================================
// INITIALIZE GAME STATE
// ============================================================
export function initGame(chain) {
  const segIndex = chain.segments.length
  const seed = chain.seed * 1000 + segIndex
  const rng = mulberry32(seed)

  let walls = buildWalls(chain.segments, MAX_SOLID_SEGMENTS)
  const totalCells = GRID * GRID
  let blockedRatio = walls.size / totalCells
  let K = MAX_SOLID_SEGMENTS
  while (blockedRatio > OCCUPANCY_CAP && K > 0) {
    K--
    walls = buildWalls(chain.segments, K)
    blockedRatio = walls.size / totalCells
  }

  const spawn = findSpawn(walls, rng)
  const sparkPos = spawnSpark(walls, new Set([`${spawn.x},${spawn.y}`]), spawn.x, spawn.y, rng)

  return {
    walls,
    snake: [{ x: spawn.x, y: spawn.y }],
    dirIdx: spawn.dirIdx,
    nextDirIdx: spawn.dirIdx,
    spark: sparkPos,
    score: 0,
    sparks: 0,
    grow: 0,
    alive: true,
    completed: false,
    startTime: performance.now(),
    lastTick: performance.now(),
    tickInterval: 1000 / TICK_BASE,
    trail: [],
    segIndex,
    rng,
    K,
    tickCount: 0,
  }
}

// ============================================================
// GAME TICK
// ============================================================
export function gameTick(game, input) {
  // Apply input
  if (input === 'L') {
    game.nextDirIdx = (game.dirIdx + 3) % 4
  } else if (input === 'R') {
    game.nextDirIdx = (game.dirIdx + 1) % 4
  }
  if (game.nextDirIdx !== oppositeDir(game.dirIdx)) {
    game.dirIdx = game.nextDirIdx
  }

  const head = game.snake[0]
  const dv = DIR_VECS[game.dirIdx]
  const nx = head.x + dv.x
  const ny = head.y + dv.y
  const nk = `${nx},${ny}`

  // Collision
  const bodySet = new Set(game.snake.map((s) => `${s.x},${s.y}`))
  if (game.walls.has(nk) || bodySet.has(nk)) {
    game.alive = false
    game.completed = false
    return 'crash'
  }

  // Move
  game.snake.unshift({ x: nx, y: ny })
  game.trail.push(nk)
  if (game.grow > 0) {
    game.grow--
  } else {
    game.snake.pop()
  }

  // Spark
  if (game.spark && nx === game.spark.x && ny === game.spark.y) {
    game.score += SPARK_SCORE
    game.sparks++
    game.grow++
    const newBodySet = new Set(game.snake.map((s) => `${s.x},${s.y}`))
    game.trail.forEach((t) => newBodySet.add(t))
    game.spark = spawnSpark(game.walls, newBodySet, nx, ny, game.rng)
    return 'spark'
  }

  return 'move'
}
