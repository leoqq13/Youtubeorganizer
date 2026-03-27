// Direct REST API calls — bypasses Supabase JS client which hangs
const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST = `${URL}/rest/v1`

function getToken() {
  try {
    const raw = localStorage.getItem(`sb-${new window.URL(URL).hostname.split('.')[0]}-auth-token`)
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed?.access_token || KEY
    }
  } catch {}
  return KEY
}

function headers(extra = {}) {
  return {
    'apikey': KEY,
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...extra,
  }
}

async function api(path, opts = {}) {
  const res = await fetch(`${REST}${path}`, { headers: headers(), ...opts })
  if (!res.ok) {
    const err = await res.text()
    console.error('API error:', res.status, err)
    throw new Error(err)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ─── Channels ──────────────────────────────────────────────────────────────────

export async function getChannels() {
  return api('/channels?select=*&order=created_at.asc')
}

export async function addChannel(name, userId) {
  const rows = await api('/channels', {
    method: 'POST',
    body: JSON.stringify({ name, user_id: userId }),
  })
  return rows[0]
}

export async function editChannel(id, updates) {
  await api(`/channels?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function removeChannel(id) {
  await api(`/channels?id=eq.${id}`, { method: 'DELETE' })
}

// ─── Days ──────────────────────────────────────────────────────────────────────

export async function getDays(channelId) {
  return api(`/days?channel_id=eq.${channelId}&order=day_number.asc`)
}

export async function saveDay(day) {
  const res = await fetch(`${REST}/days?on_conflict=channel_id,day_number`, {
    method: 'POST',
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(day),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('saveDay error:', res.status, err)
    throw new Error(err)
  }
  const rows = await res.json()
  return rows[0]
}

// ─── Profiles ──────────────────────────────────────────────────────────────────

export async function getProfiles() {
  return api('/profiles?select=*&order=created_at.asc')
}

export async function editProfile(id, updates) {
  await api(`/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

// ─── Realtime (still uses supabase client — it works for subscriptions) ───────

import { supabase } from './supabase'

export function onChannelsChange(cb) {
  return supabase.channel('ch-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, cb)
    .subscribe()
}

export function onDaysChange(channelId, cb) {
  return supabase.channel(`days-${channelId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'days', filter: `channel_id=eq.${channelId}` }, cb)
    .subscribe()
}
