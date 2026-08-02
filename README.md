# Agent Line Credit

CORE CONCEPT:

AI agents can't get loans because they have no legal identity or collateral. AgentLine gives them an "Agent Passport" (identity linked to their human/org principal), underwrites them using behavioral data instead of credit history, and enforces repayment by routing task revenue through escrow automatically — no signed contract needed.

PAGES / FEATURES:

1. DASHBOARD (home)

- Grid of 4-5 simulated AI agents (e.g. "DataMiner-7", "TradeBot-Alpha", "ScraperX", "ContentGen-Prime"), each as a card showing: agent name, principal (human/org that owns it), live Agent Credit Score (0-850 style, color-coded), current credit limit, active loan status (None / Active / Repaying / Frozen).

- Top summary bar: total capital deployed, total repaid, active loans count, average credit score across agents.

2. AGENT PASSPORT VIEW (click into an agent)

- Shows the agent's "Passport": agent ID, wallet address (mock), linked principal identity + signature timestamp, declared task scope, spend cap.

- Behavioral history panel: task success rate %, avg completion time, revenue-per-task chart (last 10 tasks, simple line/bar chart), spend pattern consistency score.

- Agent Credit Score breakdown as a SHAP-style horizontal bar chart showing which factors pushed the score up/down (e.g. "+40 task success rate", "-15 revenue variance", "+20 principal reputation").

3. LOAN REQUEST FLOW

- Agent requests a loan amount for a specific task (dropdown: task description, amount needed, expected revenue on completion, expected repayment date).

- Show live underwriting: score calculates in real time (simulate with a short loading animation), approve/deny with reasoning displayed (top 3 factors from SHAP breakdown).

- On approval, show disbursement into a "scoped smart wallet" with a vendor whitelist (e.g. "API costs only: OpenAI, AWS, Compute Marketplace").

4. ESCROW / REPAYMENT SIMULATION

- A page showing the funded task "completing" (simulate button: "Simulate Task Completion").

- On completion, animate revenue flowing in, then automatically splitting: principal + interest routed to lender/escrow, surplus released to agent wallet. Show before/after balances.

- Transaction log with timestamps, styled like a block explorer (hash-like IDs, status badges).

5. RISK MONITORING / KILL SWITCH

- Real-time-style monitoring panel showing spend velocity graph for each active agent.

- One agent ("ScraperX") shows an anomaly (spend spike, task failure signal) — flagged in red with an alert banner.

- A prominent "Freeze Agent Access" button that, when clicked, instantly changes that agent's status to Frozen, disables its wallet, and logs the revocation with timestamp and reason. This should feel dramatic and instant (no confirmation delay).

6. ABOUT / HOW IT WORKS (short page)

- 4-step visual explainer: Identity → Underwriting → Disbursement & Scoped Spend → Automated Repayment via Escrow.

- Brief mention of real-world grounding: agent identity standards, account abstraction wallets, agent payment protocols — written as "built on patterns emerging in agent commerce infrastructure" (no need to over-explain, just signal credibility).

DATA:

- Use Supabase tables: agents, principals, loans, transactions, score_history.

- Seed with realistic mock data for 5 agents, their loan history, and score trends so the demo has depth immediately without manual setup.

DESIGN NOTES:

- Prioritize a "control room for AI credit risk" feel — dense with real-time-feeling data, not sparse or toy-like.

- Use subtle pulse/glow animations on live numbers (credit scores, balances) to sell the "live system" feeling.

- Mobile-responsive but optimized for desktop demo presentation.

Make it fully functional and clickable end to end — loan request → approval → disbursement → task completion → auto-repayment → and the kill switch — all need to actually update state and persist via Supabase, not just be static mockups.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://agent-credit-ledger.lovable.app

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
