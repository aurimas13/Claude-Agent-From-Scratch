# Security

This is a public demo that spends real API credits and accepts text from strangers. The design assumes every visitor could be hostile.

## Threat model and controls

| Risk | Control | Where |
|---|---|---|
| API keys leaking to the browser | Anthropic and Supabase **secret** keys exist only as Railway env vars. The frontend only receives `NEXT_PUBLIC_*` values, which are all public. | `backend/app/config.py`, `frontend/.env.example` |
| Reading or changing the database directly | Row Level Security is **enabled on every table with no policies**, so the anon/publishable key gets nothing. Only the API (secret key) can access data. Functions are revoked from `anon` and `authenticated`. | `supabase/migrations/` |
| Using the new `sb_secret_` key incorrectly | The key is sent in the `apikey` header only, never as `Authorization: Bearer`, as Supabase's docs require. | `backend/app/store/supabase.py` |
| Cost abuse / denial of wallet | Per-visitor rate limits (per minute and per day), a **global daily USD budget cap** computed from the usage log, a turn limit per conversation, a message length limit, `max_tokens`, `max_iterations` and a cap on `web_search` uses. | `backend/app/security.py`, `main.py` |
| Bots | A Cloudflare Turnstile check gates the whole site. The token is verified server-side once (`POST /api/session`) and exchanged for an HMAC-signed, **HttpOnly, Secure, SameSite=Lax** cookie valid for 12 hours. `/api/chat` and `/api/conversations` refuse requests without it (401). Nothing is stored server-side, and rotating `IP_HASH_SALT` revokes every session. | `security.py`, `HumanGate.tsx` |
| Code execution through the calculator | No `eval()`. Expressions are parsed into an AST and only whitelisted maths nodes run. Exponent, input length and result size are capped. | `backend/app/tools/calculator.py` |
| Prompt injection via web results | Tools are read-only except `save_note` (bounded insert). The system prompt treats tool and web content as data. No tool can reach the filesystem, shell or secrets. | `backend/app/agent.py` |
| XSS through model output | React escapes text. Markdown is rendered **without raw HTML**, images are dropped, and links open with `rel="noopener noreferrer nofollow"`. A strict CSP limits scripts to self + Turnstile and network calls to the API. | `TurnView.tsx`, `next.config.ts` |
| Cross-site calls to the API | CORS allow-list (`ALLOWED_ORIGINS`), `GET`/`POST` only. | `main.py` |
| Privacy | Visitor IPs are never stored, only an HMAC-SHA256 hash with a secret salt. Conversations are keyed by unguessable UUIDv4s. An optional `pg_cron` job deletes old data. | `security.py`, migration |
| Leaking internals | `/docs` and `/openapi.json` are disabled in production. Errors returned to the client are generic, and details go to server logs only. Security headers (`nosniff`, `DENY` framing, HSTS, `no-referrer`). | `main.py` |
| Supply chain | Dependabot for pip, npm and GitHub Actions. CI runs a gitleaks secret scan on every push. The container runs as a non-root user. | `.github/`, `backend/Dockerfile` |

## Known limits

- The rate limiter is in-process. That is correct for one Railway instance, but if you scale to several replicas, move it to Redis or Postgres.
- The budget cap is checked before each request, so a burst of parallel requests can overshoot it by a few cents.
- Cost is an **estimate** from token counts and the prices set in env vars. Your Anthropic Console is the source of truth, so also set a spend limit there.

## Reporting a vulnerability

Please open a private [security advisory](../../security/advisories/new) instead of a public issue.
