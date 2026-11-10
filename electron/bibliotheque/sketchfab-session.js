/**
 * sketchfab-session.js: the Sketchfab session, input/output side. The decisions are in
 * sketchfab-auth.js (pure, tested); this file opens the login window, requests tokens and keeps the
 * session encrypted on disk. See docs/en/asset-store.md, "Signing in to Sketchfab".
 *
 * The token never leaves the main process: the interface only learns `{ connected, user }`.
 */
'use strict';
const { BrowserWindow, net, safeStorage, app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const auth = require('./sketchfab-auth');

const TIMEOUT_MS = 15000;
const sessionFile = () => path.join(app.getPath('userData'), 'sketchfab-session.bin');

let current;        // the session, once read (undefined: not read yet)
let loginWindow = null;

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

/** Opens the login window and waits for the redirect: `{ code, state }` or `{ error }`. */
function askForCode(parent){
  return new Promise((resolve) => {
    if (loginWindow) { loginWindow.focus(); resolve({ error: 'busy' }); return; }
    const state = auth.newState(crypto.randomBytes(16));
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
      loginWindow = null;
      resolve(result);
    };
    loginWindow = new BrowserWindow({
      parent, modal: !!parent, width: 520, height: 760, autoHideMenuBar: true,
      title: 'Sketchfab',
      // Its own session: Sketchfab's cookies stay apart from the application's.
      webPreferences: { partition: 'persist:sketchfab-login', nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    // The redirect is caught BEFORE any request leaves: nothing listens on 127.0.0.1, and nothing
    // else can see the code.
    const filter = { urls: [new URL('/*', auth.REDIRECT_URI).toString()] };
    loginWindow.webContents.session.webRequest.onBeforeRequest(filter, (details, callback) => {
      callback({ cancel: true });
      finish(auth.parseRedirect(details.url, state));
    });
    loginWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    loginWindow.on('closed', () => { loginWindow = null; finish({ error: 'cancelled' }); });
    loginWindow.loadURL(auth.authorizeUrl(state));
  });
}

/** Signs in: `{ connected, user }`, or `{ connected: false, error }`. */
async function login(parent){
  const r = await askForCode(parent);
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

function status(){
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

module.exports = { login, logout, status, accessToken };
