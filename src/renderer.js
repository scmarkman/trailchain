import { GRID, MAX_SOLID_SEGMENTS } from './engine.js'
import { COLORS } from './colors.js'

export function renderGame(ctx, canvas, game, chain, now) {
  const size = canvas.width
  const cellSize = size / GRID

  ctx.clearRect(0, 0, size, size)

  // Background
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, size, size)

  // Grid lines
  ctx.strokeStyle = COLORS.gridLine
  ctx.lineWidth = 0.5
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * cellSize); ctx.lineTo(size, i * cellSize); ctx.stroke()
  }

  // Boundary walls
  ctx.fillStyle = COLORS.wall
  for (let x = 0; x < GRID; x++) {
    ctx.fillRect(x * cellSize, 0, cellSize, cellSize)
    ctx.fillRect(x * cellSize, (GRID - 1) * cellSize, cellSize, cellSize)
  }
  for (let y = 1; y < GRID - 1; y++) {
    ctx.fillRect(0, y * cellSize, cellSize, cellSize)
    ctx.fillRect((GRID - 1) * cellSize, y * cellSize, cellSize, cellSize)
  }

  // Previous segment trails
  const solidSegs = chain.segments.slice(-game.K)
  solidSegs.forEach((seg, i) => {
    if (!seg.trail) return
    const colorIdx = i % COLORS.trailStrokes.length
    ctx.fillStyle = COLORS.trailFills[colorIdx]
    ctx.strokeStyle = COLORS.trailStrokes[colorIdx] + '40'
    seg.trail.forEach((c) => {
      const [cx, cy] = c.split(',').map(Number)
      ctx.fillRect(cx * cellSize, cy * cellSize, cellSize, cellSize)
      ctx.strokeRect(cx * cellSize + 0.5, cy * cellSize + 0.5, cellSize - 1, cellSize - 1)
    })
  })

  // Current trail
  game.trail.forEach((c, i) => {
    const [cx, cy] = c.split(',').map(Number)
    const alpha = 0.15 + (i / Math.max(game.trail.length, 1)) * 0.35
    ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`
    ctx.fillRect(cx * cellSize, cy * cellSize, cellSize, cellSize)
  })

  // Snake body
  game.snake.forEach((s, i) => {
    if (i === 0) return
    const alpha = 0.5 + (1 - i / game.snake.length) * 0.5
    ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`
    ctx.fillRect(s.x * cellSize + 1, s.y * cellSize + 1, cellSize - 2, cellSize - 2)
  })

  // Snake head
  if (game.snake.length > 0) {
    const head = game.snake[0]
    ctx.shadowColor = COLORS.snakeGlow
    ctx.shadowBlur = 12
    ctx.fillStyle = game.alive ? COLORS.snakeHead : COLORS.danger
    ctx.fillRect(head.x * cellSize, head.y * cellSize, cellSize, cellSize)
    ctx.shadowBlur = 0
  }

  // Spark
  if (game.spark && game.alive) {
    const sparkPhase = (now % 1000) / 1000
    const sparkScale = 0.7 + Math.sin(sparkPhase * Math.PI * 2) * 0.15
    const sx = game.spark.x * cellSize + cellSize / 2
    const sy = game.spark.y * cellSize + cellSize / 2
    const sr = (cellSize / 2) * sparkScale
    ctx.shadowColor = COLORS.sparkGlow
    ctx.shadowBlur = 10
    ctx.fillStyle = COLORS.spark
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(sx, sy, sr * 0.4, 0, Math.PI * 2); ctx.fill()
  }

  // Death flash
  if (!game.alive && !game.completed) {
    const flashAlpha = Math.max(0, 0.4 - (now - game.lastTick) / 800)
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 68, 68, ${flashAlpha})`
      ctx.fillRect(0, 0, size, size)
    }
  }
}

// Mini map for chain preview
export function renderMiniMap(canvas, chain) {
  const size = canvas.width
  const ctx = canvas.getContext('2d')
  const cellSize = size / GRID

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, size, size)

  // Boundary
  ctx.fillStyle = COLORS.wall
  for (let x = 0; x < GRID; x++) {
    ctx.fillRect(x * cellSize, 0, cellSize, cellSize)
    ctx.fillRect(x * cellSize, (GRID - 1) * cellSize, cellSize, cellSize)
  }
  for (let y = 0; y < GRID; y++) {
    ctx.fillRect(0, y * cellSize, cellSize, cellSize)
    ctx.fillRect((GRID - 1) * cellSize, y * cellSize, cellSize, cellSize)
  }

  // Trails
  const segs = chain.segments.slice(-MAX_SOLID_SEGMENTS)
  segs.forEach((seg, i) => {
    if (!seg.trail) return
    const alpha = 0.3 + (i / Math.max(segs.length, 1)) * 0.5
    const colorIdx = i % COLORS.trailStrokes.length
    const hex = Math.floor(alpha * 255).toString(16).padStart(2, '0')
    ctx.fillStyle = COLORS.trailStrokes[colorIdx] + hex
    seg.trail.forEach((c) => {
      const [cx, cy] = c.split(',').map(Number)
      ctx.fillRect(cx * cellSize + 0.5, cy * cellSize + 0.5, cellSize - 1, cellSize - 1)
    })
  })
}
