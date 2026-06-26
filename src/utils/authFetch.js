// Authenticated fetch for plain (non-React) API modules.
//
// Attaches the current access token as a Bearer header and, on a 401,
// transparently refreshes the token once (single-flight) and retries the
// request. Mirrors the refresh logic in UserContext so the segmentation /
// inpainting API clients can call protected backend endpoints.

import { API_BASE as BASE_URL } from './config';

let refreshPromise = null;

function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return false;

      const res = await fetch(`${BASE_URL}/auth/generate_new_access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return false;
      const data = await res.json();
      sessionStorage.setItem('access_token', data.access_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function authFetch(url, options = {}) {
  const withAuth = (token) => {
    const headers = new Headers(options.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return { ...options, headers };
  };

  let token = sessionStorage.getItem('access_token');
  let response = await fetch(url, withAuth(token));

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      token = sessionStorage.getItem('access_token');
      response = await fetch(url, withAuth(token));
    }
  }

  return response;
}

export default authFetch;
