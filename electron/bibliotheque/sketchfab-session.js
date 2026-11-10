/**
 * sketchfab-session.js: the Sketchfab session, input/output side. The decisions are in
 * sketchfab-auth.js (pure, tested); this file opens the browser on the authorization page, catches the redirect, requests tokens and keeps the
 * session encrypted on disk. See docs/en/asset-store.md, "Signing in to Sketchfab".
 *
 * The token never leaves the main process: the interface only learns `{ connected, user }`.
 */
'use strict';
const { shell, net, safeStorage, app } = require('electron');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const auth = require('./sketchfab-auth');

const TIMEOUT_MS = 15000;
const sessionFile = () => path.join(app.getPath('userData'), 'sketchfab-session.bin');

let current;        // the session, once read (undefined: not read yet)
let pending = null; // the sign-in in progress: { cancel }
/** How long the browser has to come back. */
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

function load(){
  if (current !== undefined) return current;
  current = null;
  try {
    if (safeStorage.isEncryptionAvailable() && fs.existsSync(sessionFile())) {
      current = auth.readSession(JSON.parse(safeStorage.decryptString(fs.readFileSync(sessionFile()))));
    }
  } catch (e) {
    current = null;   // unreadable: forgotten, the user signs in again
  }
  return current;
}

function save(session){
  current = session;
  try {
    if (!session) { fs.rmSync(sessionFile(), { force: true }); return; }
    // Without OS encryption, the session lives in memory only: never written in clear.
    if (safeStorage.isEncryptionAvailable()) fs.writeFileSync(sessionFile(), safeStorage.encryptString(JSON.stringify(session)));
  } catch (e) {
    /* kept in memory for this run */
  }
}

async function postForm(url, body){
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await net.fetch(url, {
      method: 'POST', body, signal: abort.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    });
    const json = await res.json().catch(() => null);
    return res.ok ? { json } : { error: 'response', status: res.status, json };
  } catch (e) {
    return { error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUser(accessToken){
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await net.fetch(auth.ME_URL, { signal: abort.signal, headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
    return res.ok ? auth.userFromMe(await res.json()) : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Opens the authorization page in the user's browser and waits for the redirect on a one-shot server
 * bound to 127.0.0.1 only: `{ code }` or `{ error }` ('busy', 'port', 'timeout', 'cancelled', or a
 * parseRedirect error). The server answers with a page in the design system, then closes.
 */
function askForCode(lang){
  return new Promise((resolve) => {
    if (pending) { resolve({ error: 'busy' }); return; }
    const state = auth.newState(crypto.randomBytes(16));
    const redirect = new URL(auth.REDIRECT_URI);
    let timer = null;
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `${redirect.protocol}//${redirect.host}`).toString();
      if (!auth.isRedirect(url)) { res.writeHead(404); res.end(); return; }
      const result = auth.parseRedirect(url, state);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(auth.callbackPage(result.code ? 'ok' : result.error, lang));
      finish(result);
    });
    const finish = (result) => {
      if (!pending) return;
      pending = null;
      clearTimeout(timer);
      server.close();
      resolve(result);
    };
    pending = { cancel: () => finish({ error: 'cancelled' }) };
    server.on('error', () => finish({ error: 'port' }));
    server.listen(Number(redirect.port), redirect.hostname, () => {
      timer = setTimeout(() => finish({ error: 'timeout' }), LOGIN_TIMEOUT_MS);
      shell.openExternal(auth.authorizeUrl(state)).catch(() => finish({ error: 'browser' }));
    });
  });
}

/** Stops a sign-in in progress (the user gave up in the browser). */
function cancelLogin(){
  if (pending) pending.cancel();
  return auth.publicStatus(load());
}

/** Signs in: `{ connected, user }`, or `{ connected: false, error }`. */
async function login(lang){
  const r = await askForCode(lang);
  if (r.error) return { ...auth.publicStatus(load()), error: r.error };
  const t = await postForm(auth.TOKEN_URL, auth.codeRequestBody(r.code));
  const session = t.json && !t.error ? auth.sessionFromTokenResponse(t.json, Date.now()) : null;
  if (!session) return { connected: false, user: null, error: t.error === 'network' ? 'network' : 'token', status: t.status };
  session.user = await fetchUser(session.accessToken);
  save(session);
  return auth.publicStatus(session);
}

function logout(){
  save(null);
  return auth.publicStatus(null);
}

/** The public status; an access token due for renewal is renewed first, so a lost session shows as expired. */
async function status(){
  const s = load();
  if (s && auth.needsRefresh(s, Date.now())) {
    await accessToken();
    if (!load()) return { ...auth.publicStatus(null), expired: true };
  }
  return auth.publicStatus(load());
}

/** A valid access token for the API, refreshed if needed; null if the user must sign in again. */
async function accessToken(){
  const s = load();
  if (!s) return null;
  if (!auth.needsRefresh(s, Date.now())) return s.accessToken;
  if (!s.refreshToken) { save(null); return null; }
  const t = await postForm(auth.TOKEN_URL, auth.refreshRequestBody(s.refreshToken));
  if (t.error === 'network') return null;   // temporary: keep the session, retry later
  const next = !t.error ? auth.sessionFromTokenResponse(t.json, Date.now()) : null;
  if (!next) { save(null); return null; }
  next.user = s.user;
  if (!next.refreshToken) next.refreshToken = s.refreshToken;
  save(next);
  return next.accessToken;
}

module.exports = { login, cancelLogin, logout, status, accessToken };
