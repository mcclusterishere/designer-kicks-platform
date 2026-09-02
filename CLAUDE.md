# Claude / Codex / Cursor — stop

You are in the McCluster ecosystem.

1. Read `AGENTS.md` completely before any edit.
2. Read `docs/control-plane/ECOSYSTEM.md` if this is the control repo (`mcclusterishere/mccluster`).
3. **McCluster is the backend and the control plane.** GitHub `mcclusterishere/mccluster` + Cloudflare project `mccluster` + Supabase `zmnhbrjyhxzhkxmhkexs`.
4. This repo is either the plane or a satellite. Satellites do not grow a second auth, database, social, billing, or admin stack.
5. Do not auto-push GitHub Actions onto feature branches.
6. Do not rewrite `index.html` or revive rejected visual systems.
7. If you were about to create a new backend: stop. Put it on McCluster.

Public edge: `https://matthew.mccluster.org` (apex `mccluster.org` is the same property). Worker API: `mccluster-core` on `api.mccluster.org`.

---

# The Heat Chart — working rules

## APIs: docs first, never memory

For ANY work touching an external API — Meta/Facebook/Instagram/Threads,
Stripe, Resend, eBay, KicksDB, Gemini, anything — read the provider's
current documentation BEFORE writing or changing code. Never build an
endpoint call, parameter name, permission string, metric name, or rate
limit from memory or training data. This codebase has been burned by
exactly that: deprecated Page Insights metrics, renamed permission
families, an Instagram hide parameter that differs from Facebook's, and
a June-2026 metric deprecation wave past every model's cutoff. When docs
can't be reached, say so and mark the claim unverified — do not guess.

## The Facebook Page is the owner's livelihood

Every Meta-facing feature must be sanctioned by Meta's documented APIs
and policies. Refuse anything that risks the Page or the owner's
personal account: no scraping, no browser automation against Meta
surfaces, no cold outreach, no automation that misrepresents itself
(HUMAN_AGENT is reserved for a real person typing at the desk). All
outbound automation is REACTIVE (replies to inbound events) and capped;
caps are conservative self-imposed floors, not doc-derived ceilings —
loosen them only with a documented limit in hand.

## Verify suites are the contract

`npm run verify:meta`, `verify:chatbot`, `verify:purge` guard the seams
(signing, webhook parsing, policy boundaries like the human-agent tag
and the reactive-only rules engine). Run all three plus `npm run build`
before any commit that touches lib/ or app/. New Meta-facing behavior
gets new checks in the same pass, not later.

## Git

Commit as `McCluster Corp <mattmccluster@gmail.com>`. Push every commit
to BOTH `main` and `claude/designer-kicks-platform-80a9o2`. Never put
model identifiers in commits, code comments, or any repo artifact.
