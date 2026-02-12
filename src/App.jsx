import { useState, useEffect, useRef, useCallback } from 'react'
import { COLORS } from './colors.js'
import {
  GRID, TICK_BASE, TICK_MAX, SEGMENT_DURATION, COMPLETION_BONUS,
  initGame, gameTick, oppositeDir
} from './engine.js'
import { renderGame, renderMiniMap } from './renderer.js'
import { createChain, loadChain, saveSegment, getRecentChains, getShareUrl } from './db.js'

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [screen, setScreen] = useState('home')
  const [chain, setChain] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [recentChains, setRecentChains] = useState([])
  const [loading, setLoading] = useState(false)
  const [joinCode, setJoinCode] = useState('')

  // Check URL for shared chain on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const chainId = params.get('chain')
    if (chainId) {
      setLoading(true)
      loadChain(chainId).then((c) => {
        if (c) {
          setChain(c)
          setScreen('preview')
        }
        setLoading(false)
      })
    }
  }, [])

  // Load recent chains for home screen
  useEffect(() => {
    if (screen === 'home') {
      getRecentChains(10).then(setRecentChains)
    }
  }, [screen])

  const handleNewChain = async () => {
    setLoading(true)
    const c = await createChain(false)
    if (c) { setChain(c); setScreen('preview') }
    setLoading(false)
  }

  const handleDailyChain = async () => {
    setLoading(true)
    const c = await createChain(true)
    if (c) { setChain(c); setScreen('preview') }
    setLoading(false)
  }

  const handleJoinChain = async () => {
    if (!joinCode.trim()) return
    setLoading(true)
    const c = await loadChain(joinCode.trim().toUpperCase())
    if (c) { setChain(c); setScreen('preview') }
    else { alert('Chain not found. Check the code and try again.') }
    setLoading(false)
  }

  const handleOpenChain = async (chainId) => {
    setLoading(true)
    const c = await loadChain(chainId)
    if (c) { setChain(c); setScreen('preview') }
    setLoading(false)
  }

  const handleGameEnd = async (result) => {
    setGameResult(result)
    if (result.completed && chain) {
      await saveSegment(chain.id, chain.segments.length, result)
      // Reload chain to get updated data
      const updated = await loadChain(chain.id)
      if (updated) setChain(updated)
    }
    setScreen('end')
  }

  const handleShare = () => {
    if (!chain) return
    const url = getShareUrl(chain.id)
    const text = `Chain ${chain.id} is at segment ${chain.segments.length}. Don't end the chain! ${url}`
    if (navigator.share) {
      navigator.share({ title: 'TRAILCHAIN', text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  // ============================================================
  // GAME SCREEN
  // ============================================================
  if (screen === 'game' && chain) {
    return <GameScreen chain={chain} onEnd={handleGameEnd} />
  }

  // ============================================================
  // PREVIEW SCREEN
  // ============================================================
  if (screen === 'preview' && chain) {
    return (
      <div style={S.container}>
        <div style={S.inner}>
          <button onClick={() => setScreen('home')} style={S.backBtn}>← BACK</button>
          <div style={S.previewHeader}>
            <div style={S.chainBadge}>CHAIN {chain.id}</div>
            <div style={S.statsRow}>
              <div style={S.statBox}>
                <div style={S.statVal}>{chain.segments?.length || 0}</div>
                <div style={S.statLbl}>Segments</div>
              </div>
              <div style={S.statBox}>
                <div style={S.statVal}>{chain.best_score || 0}</div>
                <div style={S.statLbl}>Best Score</div>
              </div>
            </div>
          </div>
          <MiniMapView chain={chain} />
          <div style={S.previewMsg}>
            {(chain.segments?.length || 0) === 0
              ? "You're the first. Set the trail."
              : `Segment ${chain.segments.length + 1} — Don't end the chain.`}
          </div>
          <button onClick={() => setScreen('game')} style={S.playBtn}>▶ PLAY SEGMENT</button>
          <button onClick={handleShare} style={S.shareBtn}>
            {copied ? '✓ COPIED!' : 'SHARE CHAIN'}
          </button>
        </div>
      </div>
    )
  }

  // ============================================================
  // END SCREEN
  // ============================================================
  if (screen === 'end') {
    const won = gameResult?.completed
    return (
      <div style={S.container}>
        <div style={S.inner}>
          <div style={{ ...S.endTitle, color: won ? COLORS.success : COLORS.danger }}>
            {won ? 'CHAIN CONTINUES' : 'CHAIN ENDED'}
          </div>
          <div style={S.endIcon}>{won ? '🔗' : '💥'}</div>
          <div style={S.endStats}>
            <div style={S.endRow}>
              <span style={S.endLbl}>Score</span>
              <span style={S.endVal}>{gameResult?.score || 0}</span>
            </div>
            <div style={S.endRow}>
              <span style={S.endLbl}>Sparks</span>
              <span style={S.endVal}>{gameResult?.sparks || 0}</span>
            </div>
            {won && chain && (
              <div style={S.endRow}>
                <span style={S.endLbl}>Chain Length</span>
                <span style={{ ...S.endVal, color: COLORS.accent }}>{chain.segments?.length || 0}</span>
              </div>
            )}
            {!won && (
              <div style={S.endRow}>
                <span style={S.endLbl}>Survived</span>
                <span style={S.endVal}>{((gameResult?.surviveTime || 0) / 1000).toFixed(1)}s</span>
              </div>
            )}
          </div>
          <button onClick={() => setScreen('game')} style={S.playBtn}>
            {won ? 'PLAY NEXT' : '↻ RETRY'}
          </button>
          <button onClick={handleShare} style={S.shareBtn}>
            {copied ? '✓ COPIED!' : won ? 'SHARE YOUR TRAIL' : 'DARE A FRIEND'}
          </button>
          <button onClick={() => setScreen('home')} style={S.secBtn}>HOME</button>
        </div>
      </div>
    )
  }

  // ============================================================
  // HOME SCREEN
  // ============================================================
  return (
    <div style={S.container}>
      <div style={S.inner}>
        <div style={S.logoWrap}>
          <div style={S.logo1}>TRAIL</div>
          <div style={S.logo2}>CHAIN</div>
          <div style={S.tagline}>Your run becomes their maze</div>
        </div>

        <button onClick={handleDailyChain} disabled={loading} style={S.playBtn}>
          {loading ? '...' : '⚡ DAILY CHAIN'}
        </button>
        <button onClick={handleNewChain} disabled={loading} style={S.shareBtn}>
          + NEW CHAIN
        </button>

        {/* Join by code */}
        <div style={S.joinRow}>
          <input
            type="text"
            placeholder="Enter chain code..."
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinChain()}
            style={S.joinInput}
            maxLength={12}
          />
          <button onClick={handleJoinChain} disabled={loading} style={S.joinBtn}>GO</button>
        </div>

        <div style={S.howTo}>
          <div style={S.howToTitle}>HOW TO PLAY</div>
          <div style={S.rule}><span style={S.dot}>◈</span> Tap left/right to turn. Collect sparks.</div>
          <div style={S.rule}><span style={S.dot}>◈</span> Survive 20 seconds. Don't crash.</div>
          <div style={S.rule}><span style={S.dot}>◈</span> Your trail becomes the next player's walls.</div>
        </div>

        {recentChains.length > 0 && (
          <div style={S.chainList}>
            <div style={S.chainListTitle}>RECENT CHAINS</div>
            {recentChains.map((c) => (
              <button key={c.id} onClick={() => handleOpenChain(c.id)} style={S.chainItem}>
                <span style={S.chainItemId}>{c.id}</span>
                <span style={S.chainItemSeg}>
                  {c.segment_count || 0} seg{(c.segment_count || 0) !== 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// MINI MAP COMPONENT
// ============================================================
function MiniMapView({ chain }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const size = Math.min(280, window.innerWidth - 60)
    canvas.width = size
    canvas.height = size
    renderMiniMap(canvas, chain)
  }, [chain])
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
      <canvas ref={canvasRef} style={{ borderRadius: 8, border: `1px solid ${COLORS.gridLine}` }} />
    </div>
  )
}

// ============================================================
// GAME SCREEN COMPONENT
// ============================================================
function GameScreen({ chain, onEnd }) {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const inputRef = useRef(null)
  const animRef = useRef(null)
  const containerRef = useRef(null)
  const [score, setScore] = useState(0)
  const [timer, setTimer] = useState(SEGMENT_DURATION)
  const [sparks, setSparks] = useState(0)

  // Init game
  useEffect(() => {
    gameRef.current = initGame(chain)
    inputRef.current = null
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [chain])

  // Input
  useEffect(() => {
    const getInput = (clientX) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      inputRef.current = clientX < rect.left + rect.width / 2 ? 'L' : 'R'
    }
    const onTouch = (e) => {
      if (!gameRef.current?.alive) return
      e.preventDefault()
      getInput(e.touches[0].clientX)
    }
    const onClick = (e) => {
      if (!gameRef.current?.alive) return
      getInput(e.clientX)
    }
    const onKey = (e) => {
      if (!gameRef.current?.alive) return
      if (e.key === 'ArrowLeft' || e.key === 'a') inputRef.current = 'L'
      if (e.key === 'ArrowRight' || e.key === 'd') inputRef.current = 'R'
    }
    document.addEventListener('touchstart', onTouch, { passive: false })
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('touchstart', onTouch)
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const c = containerRef.current
      if (!c) return
      const maxW = Math.min(c.clientWidth - 16, 560)
      const maxH = window.innerHeight - 140
      const size = Math.min(maxW, maxH)
      canvas.width = size
      canvas.height = size
    }
    resize()
    window.addEventListener('resize', resize)

    const loop = (now) => {
      animRef.current = requestAnimationFrame(loop)
      const game = gameRef.current
      if (!game) return

      const speedTps = Math.min(TICK_BASE + game.sparks * 0.15 + game.segIndex * 0.1, TICK_MAX)
      game.tickInterval = 1000 / speedTps

      if (game.alive && now - game.lastTick >= game.tickInterval) {
        game.lastTick = now
        game.tickCount++
        const result = gameTick(game, inputRef.current)
        inputRef.current = null

        if (result === 'crash') {
          const elapsed = now - game.startTime
          setTimeout(() => onEnd({
            completed: false, score: game.score, sparks: game.sparks,
            trail: game.trail, surviveTime: elapsed,
          }), 800)
          return
        }
        if (result === 'spark') {
          setScore(game.score)
          setSparks(game.sparks)
        }
      }

      if (game.alive) {
        const elapsed = (now - game.startTime) / 1000
        const remaining = Math.max(0, SEGMENT_DURATION - elapsed)
        setTimer(remaining)
        if (remaining <= 0) {
          game.alive = false
          game.completed = true
          game.score += COMPLETION_BONUS + chain.segments.length * 20
          setScore(game.score)
          setTimeout(() => onEnd({
            completed: true, score: game.score, sparks: game.sparks,
            trail: game.trail, surviveTime: SEGMENT_DURATION * 1000,
          }), 800)
          return
        }
      }

      renderGame(canvas.getContext('2d'), canvas, game, chain, now)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('resize', resize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [chain, onEnd])

  return (
    <div ref={containerRef} style={S.gameContainer}>
      <div style={S.hud}>
        <div>
          <span style={{ fontSize: 28, fontWeight: 700, color: timer < 5 ? COLORS.danger : COLORS.accent, fontVariantNumeric: 'tabular-nums' }}>
            {timer.toFixed(1)}
          </span>
          <span style={{ fontSize: 14, color: '#555' }}>s</span>
        </div>
        <span style={{ fontSize: 11, color: '#555', letterSpacing: '0.15em' }}>
          SEG {chain.segments.length + 1}
        </span>
        <div>
          <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.spark }}>{score}</span>
          <span style={{ fontSize: 11, color: '#555', marginLeft: 4 }}>pts</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <canvas ref={canvasRef} style={{ borderRadius: 4, touchAction: 'none' }} />
      </div>
      <div style={S.controlsHint}>
        <span style={{ fontSize: 11, color: '#333', letterSpacing: '0.1em' }}>◀ TAP LEFT</span>
        <span style={{ fontSize: 11, color: '#333', letterSpacing: '0.1em' }}>TAP RIGHT ▶</span>
      </div>
    </div>
  )
}

// ============================================================
// STYLES
// ============================================================
const font = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace"
const S = {
  container: {
    minHeight: '100vh', background: `linear-gradient(180deg, ${COLORS.bg} 0%, #0f0f18 100%)`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '20px 16px', fontFamily: font, color: COLORS.text, userSelect: 'none',
  },
  inner: {
    width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 12,
  },
  logoWrap: { textAlign: 'center', marginBottom: 16 },
  logo1: {
    fontSize: 52, fontWeight: 800, letterSpacing: '0.15em', color: COLORS.accent,
    lineHeight: 1, textShadow: `0 0 40px ${COLORS.accentDim}`,
  },
  logo2: { fontSize: 52, fontWeight: 800, letterSpacing: '0.15em', color: COLORS.text, lineHeight: 1, marginTop: -4 },
  tagline: { fontSize: 12, color: '#666', marginTop: 10, letterSpacing: '0.1em', textTransform: 'uppercase' },
  playBtn: {
    width: '100%', padding: '16px 24px', background: COLORS.accent, color: COLORS.bg,
    border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, fontFamily: font,
    cursor: 'pointer', letterSpacing: '0.05em', boxShadow: `0 0 20px ${COLORS.accentDim}`,
  },
  shareBtn: {
    width: '100%', padding: '14px 24px', background: 'transparent', color: COLORS.accent,
    border: `1.5px solid ${COLORS.accentDim}`, borderRadius: 8, fontSize: 14, fontWeight: 600,
    fontFamily: font, cursor: 'pointer', letterSpacing: '0.05em',
  },
  secBtn: {
    width: '100%', padding: '12px 24px', background: 'transparent', color: '#666',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: font, cursor: 'pointer',
  },
  joinRow: { width: '100%', display: 'flex', gap: 8, marginTop: 4 },
  joinInput: {
    flex: 1, padding: '12px 14px', background: '#13131d', border: `1px solid ${COLORS.gridLine}`,
    borderRadius: 8, color: COLORS.text, fontFamily: font, fontSize: 14, outline: 'none',
    letterSpacing: '0.1em',
  },
  joinBtn: {
    padding: '12px 20px', background: COLORS.accentDim, color: COLORS.accent, border: 'none',
    borderRadius: 8, fontFamily: font, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  howTo: { width: '100%', padding: '16px 0', marginTop: 8 },
  howToTitle: { fontSize: 11, color: '#555', letterSpacing: '0.15em', marginBottom: 10 },
  rule: { fontSize: 13, color: '#888', marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 8 },
  dot: { color: COLORS.accent, fontSize: 10, marginTop: 2 },
  chainList: { width: '100%', marginTop: 8 },
  chainListTitle: { fontSize: 11, color: '#555', letterSpacing: '0.15em', marginBottom: 8 },
  chainItem: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', background: '#13131d', border: `1px solid ${COLORS.gridLine}`,
    borderRadius: 6, marginBottom: 6, cursor: 'pointer', fontFamily: font, color: COLORS.text, fontSize: 13,
  },
  chainItemId: { fontWeight: 600, color: COLORS.accent },
  chainItemSeg: { color: '#666', fontSize: 12 },
  backBtn: {
    alignSelf: 'flex-start', background: 'none', border: 'none', color: '#555',
    fontFamily: font, fontSize: 12, cursor: 'pointer', letterSpacing: '0.1em', padding: '4px 0', marginBottom: 8,
  },
  previewHeader: { textAlign: 'center', width: '100%' },
  chainBadge: { fontSize: 20, fontWeight: 700, color: COLORS.accent, letterSpacing: '0.1em', marginBottom: 12 },
  statsRow: { display: 'flex', justifyContent: 'center', gap: 32 },
  statBox: { textAlign: 'center' },
  statVal: { fontSize: 28, fontWeight: 700, color: COLORS.text },
  statLbl: { fontSize: 10, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' },
  previewMsg: { fontSize: 13, color: '#666', textAlign: 'center', padding: '4px 0' },
  endTitle: { fontSize: 28, fontWeight: 800, letterSpacing: '0.08em', textAlign: 'center' },
  endIcon: { fontSize: 48, textAlign: 'center', margin: '8px 0' },
  endStats: { width: '100%', background: '#13131d', borderRadius: 10, padding: 16, marginBottom: 8 },
  endRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0' },
  endLbl: { color: '#666', fontSize: 13 },
  endVal: { fontWeight: 700, fontSize: 16, color: COLORS.text },
  gameContainer: {
    width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: COLORS.bg,
    fontFamily: font, color: COLORS.text, userSelect: 'none', overflow: 'hidden',
    padding: 8, boxSizing: 'border-box',
  },
  hud: {
    width: '100%', maxWidth: 560, display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '8px 12px', marginBottom: 6,
  },
  controlsHint: {
    display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 560,
    padding: '10px 16px', marginTop: 6,
  },
}
