/**
 * sketchfab-auth.js: the Sketchfab login decisions (OAuth 2.0). PURE functions, tested under plain
 * Node (tests/sketchfab-auth.test.mjs). The input/output (login window, token requests, encrypted
 * storage) lives in sketchfab-session.js. See docs/en/asset-store.md, "Signing in to Sketchfab".
 *
 * The application is registered with Sketchfab as a PUBLIC client using the Authorization Code grant:
 *   1. the user approves Storyboarder BD on the authorization page (`response_type=code`, `state`);
 *   2. Sketchfab redirects to REDIRECT_URI with `?code=…&state=…`;
 *   3. the code is exchanged for a token at TOKEN_URL, WITHOUT a client secret (public client).
 * Sketchfab does not support PKCE. The redirect is caught inside the login window before it loads,
 * so no local port is ever opened and no other program can intercept the code; `state` ties the
 * redirect to the request that started it.
 *
 * The client secret Sketchfab issued is never used and must never appear in this repository: a desktop
 * application with public source code cannot keep it confidential.
 */
'use strict';

/** Public by design: an OAuth client ID identifies the application, it grants nothing on its own. */
const CLIENT_ID = 'FmtWpvo9sYSn6gEsDuDj9EeoHzwjskYoGwOGbSnE';
/** Registered with Sketchfab: must match exactly. */
const REDIRECT_URI = 'http://127.0.0.1:53682/sketchfab/retour';
const AUTHORIZE_URL = 'https://sketchfab.com/oauth2/authorize/';
const TOKEN_URL = 'https://sketchfab.com/oauth2/token/';
const ME_URL = 'https://api.sketchfab.com/v3/me';
/** A token is refreshed this long before it expires. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** A random `state`, from bytes supplied by the caller (crypto in the app, fixed bytes in tests). */
function newState(randomBytes){
  return Buffer.from(randomBytes).toString('hex');
}

/** The authorization page address. */
function authorizeUrl(state){
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', CLIENT_ID);
  u.searchParams.set('redirect_uri', REDIRECT_URI);
  u.searchParams.set('state', state);
  return u.toString();
}

/** Is this address the redirect (whatever its query)? */
function isRedirect(url){
  try {
    const u = new URL(url), r = new URL(REDIRECT_URI);
    return u.protocol === r.protocol && u.host === r.host && u.pathname === r.pathname;
  } catch (e) {
    return false;
  }
}

/**
 * What the redirect says: `{ code }`, or `{ error }` among 'denied' (the user cancelled), 'state'
 * (the redirect does not answer our request), 'invalid' (no code, or not the redirect at all).
 */
function parseRedirect(url, expectedState){
  if (!isRedirect(url)) return { error: 'invalid' };
  const q = new URL(url).searchParams;
  if (q.get('error')) return { error: q.get('error') === 'access_denied' ? 'denied' : 'invalid', detail: q.get('error') };
  if (!expectedState || q.get('state') !== expectedState) return { error: 'state' };
  const code = q.get('code');
  return code ? { code } : { error: 'invalid' };
}

/** The form body exchanging a code for a token. No client secret: the client is public. */
function codeRequestBody(code){
  return new URLSearchParams({ grant_type: 'authorization_code', code, client_id: CLIENT_ID, redirect_uri: REDIRECT_URI }).toString();
}

/** The form body refreshing a token. */
function refreshRequestBody(refreshToken){
  return new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: CLIENT_ID }).toString();
}

/**
 * The session kept from a token response, or null if it is unusable. `now` in ms. Without
 * `expires_in`, the token is treated as never expiring (Sketchfab gives one; this is a safety net).
 */
function sessionFromTokenResponse(json, now){
  if (!json || typeof json !== 'object' || typeof json.access_token !== 'string' || !json.access_token) return null;
  const ttl = Number(json.expires_in);
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === 'string' && json.refresh_token ? json.refresh_token : null,
    expiresAt: Number.isFinite(ttl) && ttl > 0 ? now + ttl * 1000 : null,
    scope: typeof json.scope === 'string' ? json.scope : null,
  };
}

/** A stored session read back: null if anything essential is missing (it is then forgotten). */
function readSession(raw){
  if (!raw || typeof raw !== 'object' || typeof raw.accessToken !== 'string' || !raw.accessToken) return null;
  return {
    accessToken: raw.accessToken,
    refreshToken: typeof raw.refreshToken === 'string' && raw.refreshToken ? raw.refreshToken : null,
    expiresAt: Number.isFinite(raw.expiresAt) ? raw.expiresAt : null,
    scope: typeof raw.scope === 'string' ? raw.scope : null,
    user: raw.user && typeof raw.user.name === 'string' ? { name: raw.user.name, url: typeof raw.user.url === 'string' ? raw.user.url : null } : null,
  };
}

/** Does the session need a refresh (or a new login) before use? */
function needsRefresh(session, now){
  return !!(session && session.expiresAt !== null && session.expiresAt - now < REFRESH_MARGIN_MS);
}

/** The user shown in the store, from /v3/me. */
function userFromMe(json){
  if (!json || typeof json !== 'object') return null;
  const name = json.displayName || json.username;
  return typeof name === 'string' && name ? { name, url: typeof json.profileUrl === 'string' ? json.profileUrl : null } : null;
}

/** What the interface may know: never the token. */
function publicStatus(session){
  return session ? { connected: true, user: session.user || null } : { connected: false, user: null };
}

module.exports = {
  CLIENT_ID, REDIRECT_URI, AUTHORIZE_URL, TOKEN_URL, ME_URL, REFRESH_MARGIN_MS,
  newState, authorizeUrl, isRedirect, parseRedirect, codeRequestBody, refreshRequestBody,
  sessionFromTokenResponse, readSession, needsRefresh, userFromMe, publicStatus,
};
