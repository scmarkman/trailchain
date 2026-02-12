import { supabase } from './supabase.js'

// Generate a short chain ID
function genId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

// Get today's seed for daily chain
function getDailySeed() {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

// Create a new chain
export async function createChain(isDaily = false) {
  const id = isDaily ? `DAILY-${getDailySeed()}` : genId()
  const seed = isDaily ? getDailySeed() : Math.floor(Math.random() * 999999)

  // For daily chains, check if it already exists
  if (isDaily) {
    const { data: existing } = await supabase
      .from('chains')
      .select('*')
      .eq('id', id)
      .single()
    if (existing) {
      // Load its segments
      const { data: segs } = await supabase
        .from('segments')
        .select('*')
        .eq('chain_id', id)
        .eq('completed', true)
        .order('index', { ascending: true })
      return {
        ...existing,
        segments: (segs || []).map(s => ({
          trail: s.trail_cells,
          score: s.score,
          sparks: s.sparks_collected,
          completed: s.completed,
          duration: s.duration_ms,
        }))
      }
    }
  }

  const { data, error } = await supabase
    .from('chains')
    .insert({ id, seed, is_daily: isDaily })
    .select()
    .single()

  if (error) {
    console.error('Error creating chain:', error)
    return null
  }
  return { ...data, segments: [] }
}

// Load a chain by ID
export async function loadChain(chainId) {
  const { data: chain, error } = await supabase
    .from('chains')
    .select('*')
    .eq('id', chainId)
    .single()

  if (error || !chain) return null

  const { data: segs } = await supabase
    .from('segments')
    .select('*')
    .eq('chain_id', chainId)
    .eq('completed', true)
    .order('index', { ascending: true })

  return {
    ...chain,
    segments: (segs || []).map(s => ({
      trail: s.trail_cells,
      score: s.score,
      sparks: s.sparks_collected,
      completed: s.completed,
      duration: s.duration_ms,
    }))
  }
}

// Save a completed segment
export async function saveSegment(chainId, segmentIndex, result) {
  // Insert the segment
  const { error: segError } = await supabase
    .from('segments')
    .insert({
      chain_id: chainId,
      index: segmentIndex,
      completed: result.completed,
      duration_ms: result.completed ? 20000 : Math.floor(result.surviveTime),
      score: result.score,
      sparks_collected: result.sparks,
      trail_cells: result.trail,
    })

  if (segError) {
    console.error('Error saving segment:', segError)
    return false
  }

  // Update chain stats
  if (result.completed) {
    const { data: chain } = await supabase
      .from('chains')
      .select('segment_count, best_score')
      .eq('id', chainId)
      .single()

    if (chain) {
      await supabase
        .from('chains')
        .update({
          segment_count: (chain.segment_count || 0) + 1,
          best_score: Math.max(chain.best_score || 0, result.score),
        })
        .eq('id', chainId)
    }
  }

  return true
}

// Get recent chains (for the home screen list)
export async function getRecentChains(limit = 10) {
  const { data, error } = await supabase
    .from('chains')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data
}

// Get a chain's share URL
export function getShareUrl(chainId) {
  const base = window.location.origin
  return `${base}?chain=${chainId}`
}
