# Vercel Chat SDK Integration

**Status:** Backlog

The [Vercel Chat SDK](https://chat-sdk.dev) is a multi-platform chatbot SDK (currently public beta) that lets you write bot logic once and deploy it across Slack, Discord, GitHub, Teams, Telegram, WhatsApp, and others via an adapter pattern.

## The Opportunity

Ralph currently only reads GitHub — polling the Issues board via REST API on a sleep loop. The Chat SDK's GitHub adapter could open up a richer interaction model: responding to issue comments, PR reviews, or @mentions in real time, rather than only acting on label state.

More interestingly, if the project ever expands to other platforms (e.g. a Slack channel for approvals, or WhatsApp for on-the-go notifications), the Chat SDK would let Ralph's dispatch logic stay in one place while the platform adapter handles the transport.

## What Could Use This

- **Comment-based commands** — instead of exact-match sentiment on issue comments, humans could @mention Ralph directly with instructions (`@ralph approve`, `@ralph rework: fix the types`) and Ralph routes them rather than polling.
- **Cross-platform approvals** — approve a PR from Slack, Teams, or WhatsApp without going to GitHub.
- **Notifications** — push build/review status to a Slack channel or WhatsApp without separate webhook plumbing.

## WhatsApp Adapter

Researched as an alternative to openclaw (which uses unofficial, ToS-violating APIs).

**The Chat SDK uses the official Meta WhatsApp Business Cloud API — fully ToS-compliant.**

### What it supports
- Text, reactions, read receipts, auto-chunking of long messages
- Interactive reply buttons (up to 3 options)
- Multimedia (images, video, audio, documents)

### Setup requirements
- Meta Business Manager account + a registered WhatsApp business phone number
- Four env vars: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`
- Public webhook endpoint (Meta pushes events to you — no polling)

### Cost model
- Replies within 24h of a user-initiated message: **free**
- Outbound template messages (notifications you push unprompted): pay-per-message, varies by country

### Key constraint for Ralph
The 24-hour window is a practical problem for a PR approval flow. WhatsApp only allows the bot to reply freely within 24h of the human messaging first — so you'd need to ping Ralph before it can send you anything. Outbound-initiated notifications require pre-approved template messages (and a cost). This makes WhatsApp better suited to pull-based interactions ("message Ralph to check status") than push-based ones ("Ralph notifies you when a build is ready").

**Workaround idea — window-closing prompt:** Near the end of the 24h window, if there's an active conversation (e.g. a build in progress or a PR awaiting approval), Ralph could send a message like: _"24-hour window closing — reply `@ralph status` to wake me up and continue messaging."_ The reply reopens a fresh window, keeping the free push channel alive without requiring template messages.

**2026 restriction:** Meta now requires bots to perform concrete business tasks — open-ended AI chat is disallowed. A PR approval / build notification bot would qualify, but worth being aware of if the scope grows.

## Design Decisions to Resolve

- **Does this replace the polling loop or sit alongside it?** The sleep loop is overlap-safe and has no public endpoint. A webhook-based SDK would require a persistent server or serverless function — a meaningful architectural shift.
- **GitHub adapter maturity** — the SDK is in public beta; the GitHub adapter needs evaluation for reliability before depending on it in a production automation loop.
- **Which platform first?** Slack is likely the lowest-friction starting point (no Meta account setup, no 24h window constraint). WhatsApp is appealing for mobile but has the window limitation above.
- **Scope** — Ralph's design principle is to stay thin. If this adds a server process and new event model, it needs a clear payoff over the current approach.

## Open Questions

- Is there a concrete pain point with the current polling model that this solves, or is this additive?
- What would hosting look like — does this need a dedicated server, or can it run serverless alongside the existing daemon?
- For WhatsApp: is the pull-based model (you message Ralph, Ralph replies) acceptable, or is push notification the actual goal?
