---
title: "OAuth 2.0 Explained: The Valet Key of the Internet"
category: Security
excerpt: >-
  A short, diagram-led note on OAuth 2.0. The valet-key idea, the four roles,
  the Authorization Code flow with PKCE step by step, working Laravel code,
  token lifecycles, and the mistakes that cause real breaches. Readable in
  about 10–15 minutes.
---

{% raw %}
Every time you click **"Sign in with Google"**, let a calendar app read your events, or allow a CI tool to push to your GitHub repo, OAuth 2.0 is doing the work. It is the standard that lets one application act on your behalf in another **without ever seeing your password**.

It is also one of the most misunderstood standards in software. This note is a compact tour: the idea, the players, the main flow, real code, and the mistakes to avoid.

---

## The one-sentence definition

**OAuth 2.0 is a framework for _delegated authorization_: it lets a user grant an application limited, revocable access to their data on another service, using a token instead of their password.**

Two words matter there: *limited* (scopes) and *revocable* (tokens can expire or be cancelled).

---

## The valet-key analogy

When you hand your car to a hotel valet, you give them a **valet key**. It starts the engine and opens the driver's door, but it cannot open the trunk or the glove box. You never hand over your master key.

OAuth is the valet key:

- **Master key** = your username and password (full power, never shared).
- **Valet key** = an *access token* (limited power, short-lived, revocable).

<figure>
<svg viewBox="0 0 680 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Comparison between sharing a password (full access, permanent) and sharing an OAuth token (limited scope, expires, revocable)">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .t{font:12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="1" width="328" height="226" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="h" x="18" y="28" fill="#b91c1c">✗  Share your password</text>
  <text class="t" x="18" y="62">•  App gets full access to everything</text>
  <text class="t" x="18" y="88">•  Valid until you change the password</text>
  <text class="t" x="18" y="114">•  Can't revoke one app, only all</text>
  <text class="t" x="18" y="140">•  App stores your real credentials</text>
  <text class="n" x="18" y="190">One leak = your whole account.</text>

  <rect x="351" y="1" width="328" height="226" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="h" x="368" y="28" fill="#15803d">✓  Share an OAuth token</text>
  <text class="t" x="368" y="62">•  App gets only the scopes you approve</text>
  <text class="t" x="368" y="88">•  Expires in minutes or hours</text>
  <text class="t" x="368" y="114">•  Revoke a single app any time</text>
  <text class="t" x="368" y="140">•  App never sees your password</text>
  <text class="n" x="368" y="190">One leak = a small, temporary window.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Same goal (let an app do something for you), very different blast radius when something goes wrong.</figcaption>
</figure>

---

## The four roles

Every OAuth conversation has the same four actors. Learn these names and every diagram in the spec becomes readable.

<figure>
<svg viewBox="0 0 680 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The four OAuth roles: Resource Owner, Client, Authorization Server and Resource Server, with how they relate">
  <style>
    .k{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .v{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .e{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#1d4ed8;}
  </style>
  <rect x="1" y="20" width="150" height="86" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="k" x="14" y="46">Resource Owner</text>
  <text class="v" x="14" y="68">The user</text>
  <text class="v" x="14" y="86">Owns the data</text>

  <rect x="177" y="20" width="150" height="86" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="k" x="190" y="46">Client</text>
  <text class="v" x="190" y="68">The app that wants</text>
  <text class="v" x="190" y="86">access (your web app)</text>

  <rect x="353" y="20" width="150" height="86" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="k" x="366" y="46">Authorization Server</text>
  <text class="v" x="366" y="68">Logs the user in,</text>
  <text class="v" x="366" y="86">asks consent, issues tokens</text>

  <rect x="529" y="20" width="150" height="86" rx="10" fill="#dcfce7" stroke="#86efac"/>
  <text class="k" x="542" y="46">Resource Server</text>
  <text class="v" x="542" y="68">The API holding the</text>
  <text class="v" x="542" y="86">data. Checks tokens</text>

  <path d="M151 63 H177 M327 63 H353 M503 63 H529" stroke="#94a3b8" stroke-width="1.5" fill="none"/>

  <rect x="1" y="136" width="678" height="66" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
  <text class="e" x="16" y="160">Example: Google Calendar sync</text>
  <text class="v" x="16" y="182">You (owner) let Calendly (client) read your events. Google Accounts (auth server) issues the token; the Calendar API (resource server) honours it.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">In small systems the authorization server and resource server are often the same company, but they are still separate roles.</figcaption>
</figure>

**Scopes** are the permissions the client asks for, such as `calendar.readonly` or `orders:read`. The user sees them on the consent screen, and the token carries only what was approved.

---

## The main event: Authorization Code flow

This is the flow you should use for almost everything today: web apps, mobile apps, and single-page apps (with PKCE, covered next). The key trick is that the browser only ever carries a short-lived **code**; the real **token** is exchanged server-to-server.

<figure>
<svg viewBox="0 0 680 410" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sequence diagram of the Authorization Code flow with eight numbered steps between browser, client app, authorization server and resource API">
  <style>
    .p{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .m{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .c{font:11.5px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#1d4ed8;}
  </style>
  <rect x="0" y="0" width="680" height="410" rx="12" fill="#f8fafc" stroke="#e2e8f0"/>
  <rect x="20" y="6" width="100" height="30" rx="8" fill="#eff6ff" stroke="#bfdbfe"/><text class="p" x="70" y="26" text-anchor="middle">Browser</text>
  <rect x="200" y="6" width="100" height="30" rx="8" fill="#eff6ff" stroke="#bfdbfe"/><text class="p" x="250" y="26" text-anchor="middle">Client App</text>
  <rect x="380" y="6" width="100" height="30" rx="8" fill="#fef3c7" stroke="#fcd34d"/><text class="p" x="430" y="26" text-anchor="middle">Auth Server</text>
  <rect x="560" y="6" width="100" height="30" rx="8" fill="#dcfce7" stroke="#86efac"/><text class="p" x="610" y="26" text-anchor="middle">API</text>
  <path d="M70 36 V400 M250 36 V400 M430 36 V400 M610 36 V400" stroke="#cbd5e1" stroke-dasharray="4 4" fill="none"/>

  <g stroke="#475569" stroke-width="1.5" fill="none">
    <path d="M72 78 H246"/><path d="M246 118 H74"/><path d="M74 158 H426"/><path d="M426 198 H74"/>
    <path d="M426 238 H254"/><path d="M254 278 H426"/><path d="M426 318 H254"/><path d="M254 366 H606"/>
  </g>
  <g fill="#475569">
    <polygon points="248,78 240,74 240,82"/><polygon points="72,118 80,114 80,122"/><polygon points="428,158 420,154 420,162"/><polygon points="72,198 80,194 80,202"/>
    <polygon points="252,238 260,234 260,242"/><polygon points="428,278 420,274 420,282"/><polygon points="252,318 260,314 260,322"/><polygon points="608,366 600,362 600,370"/>
  </g>
  <text class="m" x="80" y="70">1  Click "Sign in"</text>
  <text class="m" x="80" y="110">2  302 redirect to the auth server</text>
  <text class="m" x="80" y="150">3  GET /authorize</text>
  <text class="c" x="80" y="172">client_id, scope, state, code_challenge</text>
  <text class="m" x="80" y="190">4  Login + consent screen: user clicks Allow</text>
  <text class="m" x="260" y="230">5  Redirect back: ?code=…&amp;state=…</text>
  <text class="m" x="260" y="270">6  POST /token (server to server)</text>
  <text class="c" x="260" y="298">code + code_verifier</text>
  <text class="m" x="260" y="310">7  Returns tokens</text>
  <text class="c" x="260" y="334">access_token, refresh_token</text>
  <text class="m" x="260" y="356">8  GET /me</text>
  <text class="c" x="400" y="358">Authorization: Bearer …</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Steps 1–5 happen in the browser (front channel) and only expose a one-time code. Steps 6–8 happen server-to-server (back channel), where the real tokens live.</figcaption>
</figure>

### Why the extra "code" hop?

Because the front channel (browser URL, history, referrer headers, logs) is leaky. If tokens travelled there, anyone watching could steal them. A one-time code is useless without the client's own credentials or PKCE verifier, so a stolen code is not a stolen session.

---

## PKCE: protecting public clients

Mobile apps and SPAs cannot keep a `client_secret` safe, because anyone can unpack the app. **PKCE** (Proof Key for Code Exchange, pronounced "pixie") fixes this with a per-request secret: the client invents a random string, sends only its *hash* up front, and reveals the original later to prove it is the same client.

<figure>
<svg viewBox="0 0 680 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PKCE: client creates a random code verifier, hashes it into a code challenge sent in step 3, then sends the original verifier in step 6 so the server can verify the hash matches">
  <style>
    .k{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .v{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .mo{font:11.5px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#1d4ed8;}
  </style>
  <rect x="1" y="20" width="190" height="90" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="k" x="14" y="44">1  code_verifier</text>
  <text class="v" x="14" y="64">Random 43–128 char string.</text>
  <text class="v" x="14" y="82">Kept secret on the client.</text>

  <rect x="245" y="20" width="190" height="90" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="k" x="258" y="44">2  code_challenge</text>
  <text class="mo" x="258" y="64">BASE64URL(SHA256(v))</text>
  <text class="v" x="258" y="82">Sent in /authorize (step 3).</text>

  <rect x="489" y="20" width="190" height="90" rx="10" fill="#dcfce7" stroke="#86efac"/>
  <text class="k" x="502" y="44">3  Verify at /token</text>
  <text class="v" x="502" y="64">Client now sends the verifier.</text>
  <text class="v" x="502" y="82">Server hashes it, compares.</text>

  <path d="M191 65 H245 M435 65 H489" stroke="#94a3b8" stroke-width="1.5" fill="none"/>
  <polygon points="245,65 237,61 237,69" fill="#94a3b8"/><polygon points="489,65 481,61 481,69" fill="#94a3b8"/>

  <rect x="1" y="130" width="678" height="50" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
  <text class="v" x="16" y="152">An attacker who steals the authorization code still lacks the verifier, so the token request fails.</text>
  <text class="v" x="16" y="169">OAuth 2.1 makes PKCE mandatory for all clients, not just public ones. Use it everywhere.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">PKCE turns the authorization code into a code that only the app that started the flow can redeem.</figcaption>
</figure>

---

## Show me the code

Here is the whole flow in Laravel, using only the HTTP client so every step stays visible. (In production you would likely reach for Laravel Socialite or Passport, shown below.)

### Step 1 — redirect to the authorization server

```php
// routes/web.php
use Illuminate\Support\Str;

Route::get('/auth/redirect', function () {
    $verifier  = Str::random(64);
    $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    $state     = Str::random(40);

    session(['pkce_verifier' => $verifier, 'oauth_state' => $state]);

    $query = http_build_query([
        'response_type'         => 'code',
        'client_id'             => config('services.provider.client_id'),
        'redirect_uri'          => route('oauth.callback'),
        'scope'                 => 'profile email',
        'state'                 => $state,            // CSRF protection
        'code_challenge'        => $challenge,        // PKCE
        'code_challenge_method' => 'S256',
    ]);

    return redirect('https://auth.example.com/authorize?' . $query);
});
```

### Step 2 — handle the callback and swap the code for tokens

```php
Route::get('/auth/callback', function (Request $request) {
    // 1. Reject forged or replayed callbacks
    abort_unless(
        hash_equals((string) session()->pull('oauth_state'), (string) $request->query('state')),
        403, 'Invalid state'
    );

    // 2. Server-to-server token exchange
    $tokens = Http::asForm()->post('https://auth.example.com/token', [
        'grant_type'    => 'authorization_code',
        'code'          => $request->query('code'),
        'redirect_uri'  => route('oauth.callback'),
        'client_id'     => config('services.provider.client_id'),
        'client_secret' => config('services.provider.client_secret'),
        'code_verifier' => session()->pull('pkce_verifier'),
    ])->throw()->json();

    // 3. Call the API with the access token
    $profile = Http::withToken($tokens['access_token'])
        ->get('https://api.example.com/me')
        ->throw()
        ->json();

    // ...log the user in, store tokens encrypted
});
```

The token response looks like this:

```json
{
  "token_type": "Bearer",
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "expires_in": 900,
  "refresh_token": "def50200a1b2c3...",
  "scope": "profile email"
}
```

### The shortcut: Laravel Socialite

```php
// redirect
return Socialite::driver('github')->redirect();

// callback
$user = Socialite::driver('github')->user();
$user->getEmail();   // handles state, code exchange and profile fetch
```

### The other side: protecting your own API with scopes

If *you* are the resource server, every endpoint should check that the token carries the right scope. With Laravel Passport:

```php
Route::middleware(['auth:api', 'scope:orders:read'])
    ->get('/orders', [OrderController::class, 'index']);

Route::middleware(['auth:api', 'scope:orders:write'])
    ->post('/orders', [OrderController::class, 'store']);
```

A token with only `orders:read` gets a `403` on the `POST`. That is the valet key in action.

---

## Token lifecycle: access vs refresh

Access tokens are deliberately short-lived, because they are sent on every request and are the most exposed. A **refresh token** lets the client quietly get a new one without bothering the user.

<figure>
<svg viewBox="0 0 680 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Timeline showing an access token valid for 15 minutes, expiring, then the client using a refresh token to obtain a new access token and a rotated refresh token">
  <style>
    .k{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .v{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="10" y="40" width="250" height="34" rx="8" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="k" x="24" y="62">Access token #1 (15 min)</text>
  <text class="v" x="10" y="94">Sent with every API call</text>

  <path d="M270 57 H300" stroke="#94a3b8" stroke-width="1.5"/>
  <circle cx="285" cy="57" r="9" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="k" x="281" y="61" style="fill:#b91c1c">!</text>
  <text class="v" x="255" y="94">401 expired</text>

  <rect x="310" y="40" width="100" height="34" rx="8" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="k" x="323" y="62">Refresh call</text>
  <text class="v" x="310" y="94">POST /token</text>
  <text class="v" x="310" y="108">grant_type=refresh_token</text>

  <path d="M410 57 H440" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="440,57 432,53 432,61" fill="#94a3b8"/>

  <rect x="445" y="40" width="225" height="34" rx="8" fill="#dcfce7" stroke="#86efac"/>
  <text class="k" x="459" y="62">Access #2 + new refresh token</text>
  <text class="v" x="445" y="94">Old refresh token is now invalid (rotation)</text>

  <rect x="1" y="130" width="678" height="50" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
  <text class="v" x="16" y="152">Access token: short life, high exposure.  Refresh token: long life, stored securely, used rarely, rotated on every use.</text>
  <text class="v" x="16" y="169">If a rotated refresh token is ever reused, the server should revoke the whole chain: that signals theft.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The user stays signed in for weeks, yet any single stolen access token is only useful for minutes.</figcaption>
</figure>

```php
$tokens = Http::asForm()->post('https://auth.example.com/token', [
    'grant_type'    => 'refresh_token',
    'refresh_token' => $stored->refresh_token,
    'client_id'     => config('services.provider.client_id'),
    'client_secret' => config('services.provider.client_secret'),
])->throw()->json();

// Save BOTH new values: the refresh token has rotated
$stored->update([
    'access_token'  => encrypt($tokens['access_token']),
    'refresh_token' => encrypt($tokens['refresh_token']),
    'expires_at'    => now()->addSeconds($tokens['expires_in']),
]);
```

---

## Which grant type should I use?

OAuth defines several "grants" (ways to obtain a token). Picking the right one is mostly a lookup.

<div markdown="1">

| Situation | Use | Notes |
| --- | --- | --- |
| Web app with a backend, user signs in | **Authorization Code + PKCE** | The default answer. |
| SPA or mobile app | **Authorization Code + PKCE** | No client secret; PKCE is essential. |
| Server-to-server, no user involved | **Client Credentials** | Cron jobs, microservices, machine identity. |
| TV or CLI with no browser | **Device Code** | User approves on a second device. |
| Renewing an expired access token | **Refresh Token** | Not a login method; a renewal method. |
| ~~Implicit~~ | Deprecated | Tokens in URLs. Replaced by Code + PKCE. |
| ~~Password (ROPC)~~ | Deprecated | Client handles the raw password, defeating OAuth's purpose. |

</div>

Machine-to-machine in one call:

```bash
curl -X POST https://auth.example.com/token \
  -d grant_type=client_credentials \
  -d client_id=billing-service \
  -d client_secret=*** \
  -d scope=invoices:write
```

---

## OAuth is not login: meet OpenID Connect

A very common misconception: **OAuth 2.0 answers "what may this app do?", not "who is this user?"**

An access token says an app may read a calendar. It does not promise to tell the app who the user is. **OpenID Connect (OIDC)** is a thin identity layer on top of OAuth 2.0 that adds an **ID token** (a signed JWT with the user's identity) and a `/userinfo` endpoint.

<div markdown="1">

| | OAuth 2.0 | OpenID Connect |
| --- | --- | --- |
| Purpose | Authorization (access) | Authentication (identity) |
| Key artifact | Access token | ID token (JWT) |
| Question answered | "What can this app do?" | "Who is this user?" |
| Add this scope | `calendar.readonly` | `openid profile email` |

</div>

"Sign in with Google" is OIDC running on OAuth 2.0. If you only need to log users in, request the `openid` scope and validate the ID token.

---

## Mistakes that cause real breaches

<div markdown="1">

| Mistake | Why it hurts | Fix |
| --- | --- | --- |
| **Skipping the `state` parameter** | Attacker forces a victim to link the attacker's account (login CSRF). | Random `state` per request, verified in the callback. |
| **Loose `redirect_uri` matching** | Codes and tokens are sent to an attacker's domain. | Register exact URIs. No wildcards, no open redirects. |
| **Tokens in `localStorage`** | Any XSS steals them. | Prefer `HttpOnly` session cookies via a backend (BFF pattern). |
| **Using the Implicit or Password grant** | Token exposure, password handling. | Authorization Code + PKCE. |
| **Over-broad scopes** | A stolen token can do everything. | Least privilege: request only what you need. |
| **Long-lived access tokens** | Large theft window. | 5–15 minutes, plus refresh token rotation. |
| **Treating an access token as proof of identity** | Token substitution attacks. | Use OIDC and validate the ID token's `aud`, `iss` and `exp`. |
| **Logging tokens or putting them in URLs** | Tokens leak into logs and analytics. | Send in the `Authorization` header only, and redact logs. |

</div>

---

## A seven-point checklist

1. **Use Authorization Code + PKCE** for every user-facing flow; avoid Implicit and Password grants.
2. **Always send and verify `state`**, and register exact `redirect_uri` values.
3. **Request the smallest scopes** that make the feature work, and enforce them on every API endpoint.
4. **Keep access tokens short-lived** (minutes) and rotate refresh tokens.
5. **Store tokens server-side and encrypted**; never in URLs, logs, or `localStorage`.
6. **Use OpenID Connect** when you need to know who the user is, and validate the ID token.
7. **Don't hand-roll it.** Prefer a battle-tested library or provider (Socialite, Passport, Keycloak, Auth0, Cognito) over writing token logic yourself.

---

## Conclusion

OAuth 2.0 is the valet key of the internet: a way to give an application *just enough* access, for *just long enough*, without ever handing over the master key. Remember the four roles (owner, client, authorization server, resource server), remember that the Authorization Code flow with PKCE is the default answer, and remember that access tokens are short-lived while refresh tokens quietly keep users signed in. Add OpenID Connect when you need identity, enforce scopes on your own APIs, and most OAuth-related breaches become things that happen to other teams.
{% endraw %}
