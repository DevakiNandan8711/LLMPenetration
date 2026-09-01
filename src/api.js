const RAW = import.meta.env.VITE_API_URL

/**
 * API base for fetch: with Vite dev proxy use `/api` prefix; or absolute URL from env.
 * @param {string} path e.g. `/health` or `health`
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = (RAW || '').replace(/\/$/, '')
  if (base) return `${base}${p}`
  return `/api${p}`
}

export async function fetchHealth() {
  const r = await fetch(apiUrl('/health'))
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function fetchChallenges() {
  const r = await fetch(apiUrl('/challenges'))
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function createChallenge(challenge) {
  const r = await fetch(apiUrl('/challenges'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(challenge),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function executeCommand(command, challengeId) {
  const r = await fetch(apiUrl('/executor'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, challenge_id: challengeId || null }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
