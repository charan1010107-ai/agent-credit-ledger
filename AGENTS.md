# AGENTS.md

This file gives AI coding agents (Claude Code, Cursor, Lovable, etc.) the context needed to work on this repo correctly. Read this before making changes.

## Project Overview

**AgentLine** (repo: `agent-credit-ledger`) is a credit protocol for autonomous AI agents. It solves a hackathon problem statement: AI agents transact on their own but can't access credit because they have no legal identity, no collateral, and no ability to sign a contract.

The system works by:
1. Anchoring identity to a human/org "principal" who authorizes each agent (Agent Passport)
2. Underwriting agents on behavioral signals instead of credit history (score, SHAP-style breakdown)
3. Enforcing repayment by routing task revenue through escrow automatically, rather than relying on a contract or legal recourse
4. Containing risk with graduated response (Warning → Throttled → Frozen) instead of a binary kill switch

## Stack

- Frontend: React + TypeScript, built via Lovable
- Backend/DB: Supabase (Postgres + Auth)
- Styling: Tailwind, dark fintech aesthetic (navy/black background, blue/violet accents)
- No real blockchain calls in the hackathon build — escrow/wallet behavior is simulated in the data model, not deployed to a live chain, unless a `/contracts` directory says otherwise

## Core Data Model

- `profiles` / `users` — principal accounts, has `account_type` (individual | organization), name/org_name, reputation score
- `agents` — one-to-one with a principal (each user has exactly one agent), has credit score, credit limit, interest rate, risk status (Healthy | Warning | Throttled | Frozen), use case
- `tasks` — historical and active task records per agent: task_type, description, outcome, duration, cost, revenue, vendor
- `loans` — loan requests and their status, tied to an agent and a specific task
- `escrow_transactions` — repayment split events: principal, interest, surplus, timestamps
- `score_history` — time series of an agent's credit score
- `protocol_events` — log of risk actions (warnings, throttles, freezes) with timestamps and reasons

**Important:** scoring, credit limit, and interest rate must always be computed through the same shared logic regardless of entry point (agent creation via manual form, agent creation via CSV upload, or a Loan Desk custom use case request). Do not fork this into separate calculation paths — find the existing scoring function before adding a new one.

## Key Conventions

- **Score → Rate → Limit is one pipeline.** Score drives interest rate tier (higher score = lower rate) and credit limit. If you change one, check the other two still derive from it correctly.
- **Risk status has 4 states, not 2.** Healthy, Warning, Throttled, Frozen — in that escalation order. Don't reintroduce a binary healthy/frozen toggle.
- **Principal reputation and the SHAP "principal reputation" factor must reference the same underlying value.** These should never drift into two disconnected numbers.
- **One agent per user account.** Enforce this at the data layer, not just the UI — a user should not be able to create a second agent via a stale route or direct API call.
- **Custom use cases fold back into agent history.** When a custom Loan Desk use case's task completes, its outcome must be added to that agent's `tasks` history like any other, so future scoring accounts for it.

## What NOT to change without asking

- The escrow repayment logic (senior-claim routing of revenue before agent receives surplus) — this is the core enforceability thesis of the project, don't simplify it away.
- The identity model where the agent is never itself the accountable legal party — the principal always is.

## File-finding hints

- Scoring/underwriting logic: look for files referencing `score`, `underwrit`, or `shap`
- Escrow split logic: look for files referencing `escrow` or `repayment`
- Risk escalation: look for files referencing `risk`, `throttle`, or `freeze`
- Agent creation (manual + CSV upload + custom use case): look for files under a `create-agent` or `onboarding` route/component

## Known simulation boundaries (be honest about these in any docs/demo copy)

- Wallet balances and task revenue are simulated inputs, not connected to live external payment rails
- Smart contract references (escrow, soulbound NFT passport) describe the intended production design; unless a `/contracts` folder with deployed addresses exists, treat these as architectural intent, not live on-chain state
- Do not claim real blockchain deployment in generated copy (README, pitch materials) unless contracts are actually deployed and verifiable
