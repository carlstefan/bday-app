/**
 * Thin fetch wrapper — always uses relative URLs, always sends cookies.
 */

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function request(method, path, options = {}) {
  const { body, json, signal } = options

  const headers = {}
  let requestBody = body

  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(json)
  }

  const res = await fetch(path, {
    method,
    headers,
    body: requestBody,
    credentials: 'include',
    signal,
  })

  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const data = await res.json()
      message = data.error || message
    } catch {
      // ignore parse failure
    }
    throw new ApiError(res.status, message)
  }

  // Return null for 204 No Content
  if (res.status === 204) return null

  return res.json()
}

export const api = {
  get:    (path, options)  => request('GET',    path, options),
  post:   (path, options)  => request('POST',   path, options),
  patch:  (path, options)  => request('PATCH',  path, options),
  delete: (path, options)  => request('DELETE', path, options),
}
