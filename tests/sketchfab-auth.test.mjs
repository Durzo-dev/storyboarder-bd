/**
 * tests/sketchfab-auth.test.mjs: the Sketchfab sign-in decisions (electron/bibliotheque/sketchfab-auth.js)
 * and the account line of the store (src/store-ui.js, accountLineState).
 *
 * Out of reach under Node: the login window, the token requests and the encrypted storage
 * (sketchfab-session.js). They are checked in the application, by signing in for real.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import auth from '../electron/bibliotheque/sketchfab-auth.js';
import './helpers/dom-stub.mjs';
const { accountLineState } = await import('../src/store-ui.js');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STATE = 'ab'.repeat(16);

describe('#444c, the authorization request', () => {
  test('Authorization Code, our client, the registered redirect, and the state', () => {
    const u = new URL(auth.authorizeUrl(STATE));
    assert.equal(u.origin + u.pathname, 'https://sketchfab.com/oauth2/authorize/');
    assert.equal(u.searchParams.get('response_type'), 'code');
    assert.equal(u.searchParams.get('client_id'), auth.CLIENT_ID);
    assert.equal(u.searchParams.get('redirect_uri'), 'http://127.0.0.1:53682/sketchfab/retour');
    assert.equal(u.searchParams.get('state'), STATE);
  });

  test('the state is random bytes in hex, never empty', () => {
    assert.equal(auth.newState(Buffer.alloc(16, 0xab)), STATE);
    assert.notEqual(auth.newState(Buffer.alloc(16, 1)), auth.newState(Buffer.alloc(16, 2)));
  });
});

describe('#444c, the redirect', () => {
  const back = (q) => `http://127.0.0.1:53682/sketchfab/retour?${q}`;

  test('a code with the right state is accepted', () => {
    assert.deepEqual(auth.parseRedirect(back(`code=XYZ&state=${STATE}`), STATE), { code: 'XYZ' });
  });

  test('a wrong or missing state is refused', () => {
    assert.equal(auth.parseRedirect(back('code=XYZ&state=other'), STATE).error, 'state');
    assert.equal(auth.parseRedirect(back('code=XYZ'), STATE).error, 'state');
    assert.equal(auth.parseRedirect(back(`code=XYZ&state=${STATE}`), '').error, 'state');
  });

  test('a refusal on Sketchfab is told apart from other errors', () => {
    assert.equal(auth.parseRedirect(back(`error=access_denied&state=${STATE}`), STATE).error, 'denied');
    assert.equal(auth.parseRedirect(back(`error=server_error&state=${STATE}`), STATE).error, 'invalid');
  });

  test('another address is not the redirect', () => {
    assert.equal(auth.isRedirect('http://127.0.0.1:53682/sketchfab/retour?code=1'), true);
    assert.equal(auth.isRedirect('http://127.0.0.1:53683/sketchfab/retour?code=1'), false);
    assert.equal(auth.isRedirect('http://127.0.0.1:53682/autre?code=1'), false);
    assert.equal(auth.isRedirect('https://sketchfab.com/oauth2/authorize/'), false);
    assert.equal(auth.isRedirect('not a url'), false);
    assert.equal(auth.parseRedirect(`https://evil.example/sketchfab/retour?code=X&state=${STATE}`, STATE).error, 'invalid');
  });

  test('no code: invalid', () => {
    assert.equal(auth.parseRedirect(back(`state=${STATE}`), STATE).error, 'invalid');
  });
});

describe('#444c, the token', () => {
  test('the code exchange sends no client secret (public client)', () => {
    const body = new globalThis.URLSearchParams(auth.codeRequestBody('XYZ'));
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('code'), 'XYZ');
    assert.equal(body.get('client_id'), auth.CLIENT_ID);
    assert.equal(body.get('redirect_uri'), auth.REDIRECT_URI);
    assert.equal(body.has('client_secret'), false);
    assert.equal(new globalThis.URLSearchParams(auth.refreshRequestBody('R')).has('client_secret'), false);
  });

  test('a token response becomes a session with an expiry', () => {
    const s = auth.sessionFromTokenResponse({ access_token: 'A', refresh_token: 'R', expires_in: 3600, scope: 'read' }, 1000);
    assert.deepEqual(s, { accessToken: 'A', refreshToken: 'R', expiresAt: 1000 + 3600 * 1000, scope: 'read' });
    assert.equal(auth.sessionFromTokenResponse({ refresh_token: 'R' }, 0), null);
    assert.equal(auth.sessionFromTokenResponse(null, 0), null);
    assert.equal(auth.sessionFromTokenResponse({ access_token: 'A' }, 0).expiresAt, null);
  });

  test('refresh five minutes before expiry, never for a token without expiry', () => {
    const s = { accessToken: 'A', expiresAt: 10 * 60 * 1000 };
    assert.equal(auth.needsRefresh(s, 0), false);
    assert.equal(auth.needsRefresh(s, 6 * 60 * 1000), true);
    assert.equal(auth.needsRefresh({ accessToken: 'A', expiresAt: null }, 1e15), false);
    assert.equal(auth.needsRefresh(null, 0), false);
  });

  test('a stored session read back: missing token means forgotten', () => {
    assert.equal(auth.readSession({ refreshToken: 'R' }), null);
    assert.equal(auth.readSession('x'), null);
    assert.deepEqual(auth.readSession({ accessToken: 'A', expiresAt: 5, user: { name: 'Durzo' } }).user, { name: 'Durzo', url: null });
  });

  test('the interface never receives the token', () => {
    const st = auth.publicStatus({ accessToken: 'SECRET-TOKEN', refreshToken: 'R', user: { name: 'D', url: null } });
    assert.deepEqual(st, { connected: true, user: { name: 'D', url: null } });
    assert.equal(JSON.stringify(st).includes('SECRET-TOKEN'), false);
    assert.deepEqual(auth.publicStatus(null), { connected: false, user: null });
  });

  test('the user shown comes from /v3/me', () => {
    assert.deepEqual(auth.userFromMe({ username: 'azoth', displayName: 'Durzo', profileUrl: 'https://sketchfab.com/azoth' }), { name: 'Durzo', url: 'https://sketchfab.com/azoth' });
    assert.deepEqual(auth.userFromMe({ username: 'azoth' }), { name: 'azoth', url: null });
    assert.equal(auth.userFromMe({}), null);
  });
});

describe('#444c, the store account line', () => {
  test('signed out: offers to sign in', () => {
    const s = accountLineState({ status: { connected: false, user: null }, lang: 'en' });
    assert.equal(s.action, 'login');
    assert.equal(s.disabled, false);
    assert.match(s.text, /Not signed in/);
  });

  test('signed in: shows the name and offers to sign out', () => {
    const s = accountLineState({ status: { connected: true, user: { name: 'Durzo' } }, lang: 'fr' });
    assert.equal(s.action, 'logout');
    assert.match(s.text, /Durzo/);
  });

  test('while signing in, the button is disabled; an error is spelled out', () => {
    assert.equal(accountLineState({ status: null, busy: true }).disabled, true);
    assert.match(accountLineState({ status: null, error: 'denied', lang: 'en' }).text, /refused/);
  });

  test('every error the session can return has a message in both languages', () => {
    for (const lang of ['fr', 'en']) {
      for (const e of ['cancelled', 'denied', 'state', 'invalid', 'network', 'token', 'busy']) {
        const s = accountLineState({ status: null, error: e, lang });
        assert.notEqual(s.text, accountLineState({ status: null, lang }).text, `${lang}/${e}`);
      }
    }
  });
});

describe('#444c, the client secret never enters the repository', () => {
  test('no client_secret anywhere in the code', () => {
    const files = [];
    const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(m?js|html|json)$/.test(n)) files.push(p); } };
    for (const d of ['src', 'electron', 'tools']) walk(join(ROOT, d));
    const offenders = files.filter(p => /client_secret|clientSecret/.test(readFileSync(p, 'utf8')));
    assert.deepEqual(offenders, []);
  });
});
