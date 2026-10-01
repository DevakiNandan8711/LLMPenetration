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

/**
 * Parse response errors cleanly so HTML error pages (e.g. 502 Bad Gateway from Render)
 * don't dump raw HTML and base64 fonts into UI messages.
 */
export async function parseErrorResponse(r) {
  const status = r.status
  const statusText = r.statusText || 'Error'

  // Try parsing JSON error (e.g. FastAPI HTTPException { detail: ... })
  const contentType = r.headers?.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const data = await r.json()
      if (data?.detail) {
        if (typeof data.detail === 'string') return data.detail
        if (Array.isArray(data.detail)) {
          return data.detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
        }
        return JSON.stringify(data.detail)
      }
      if (data?.message) return data.message
      if (data?.error) return data.error
    } catch {
      // Fall through to text parsing
    }
  }

  // Handle HTML or text error pages (e.g. 502/503/504 from Render, Nginx, or Cloudflare)
  try {
    const text = await r.text()
    if (text.includes('<html') || text.includes('<!DOCTYPE') || contentType.includes('text/html')) {
      if (status === 502) {
        return 'HTTP 502 Bad Gateway: The backend API is offline, restarting, or spinning up (Render free tier cold start). Please wait 30–60 seconds and try again.'
      }
      if (status === 503) {
        return 'HTTP 503 Service Unavailable: The backend service is temporarily unavailable.'
      }
      if (status === 504) {
        return 'HTTP 504 Gateway Timeout: The request to the backend service timed out.'
      }
      const titleMatch = text.match(/<title>(.*?)<\/title>/i)
      if (titleMatch && titleMatch[1]) {
        return `HTTP ${status}: ${titleMatch[1].trim()}`
      }
      return `HTTP ${status} ${statusText}: The server returned an HTML error page.`
    }
    if (text.trim()) {
      return text.length > 250 ? `${text.slice(0, 250)}...` : text.trim()
    }
  } catch {
    // Ignore read errors
  }

  if (status === 502) {
    return 'HTTP 502 Bad Gateway: Backend server is unreachable or offline.'
  }
  return `HTTP ${status} ${statusText}`
}

export async function fetchHealth() {
  const r = await fetch(apiUrl('/health'))
  if (!r.ok) throw new Error(await parseErrorResponse(r))
  return r.json()
}

export async function fetchChallenges() {
  const r = await fetch(apiUrl('/challenges'))
  if (!r.ok) throw new Error(await parseErrorResponse(r))
  return r.json()
}

export async function createChallenge(challenge) {
  const r = await fetch(apiUrl('/challenges'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(challenge),
  })
  if (!r.ok) throw new Error(await parseErrorResponse(r))
  return r.json()
}

export async function executeCommand(command, challengeId) {
  const r = await fetch(apiUrl('/executor'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, challenge_id: challengeId || null }),
  })
  if (!r.ok) throw new Error(await parseErrorResponse(r))
  return r.json()
}
