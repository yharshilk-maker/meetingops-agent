# Demo vs. reality — what the agent actually does

An honest map of every feature the `/movie` film shows against the real implementation,
so the demo and the product stay aligned.

## ✅ Real and working today (with Google connected)

| Feature | How it's real |
|---|---|
| LLM reasoning → decisions, tasks, risks, SPICED, closure score | `src/lib/agent/llm.ts` calls Groq/OpenAI; deterministic fallback if no key. Verified live. |
| Human-approval gate | The UI blocks every external action until you approve. |
| **Save brief to Google Drive** | `saveMeetingBriefToDrive` creates the full routed folder path (`MeetingOps / <category> / <workspace> / <date> - <title>`) and a **native Google Doc**. Uses `drive.file` scope. |
| **Create Gmail draft** | `createGmailFollowUpDraft` creates a real draft via `gmail.compose`. *(Caveat: recipients only populate for participants that are email addresses — names alone produce an empty To: field.)* |
| **Agent joins a Google Meet** | Real Playwright bot (`meet-bot/`) joins as a visible participant, mutes mic/cam, turns on captions, scrapes speaker-attributed text, and runs the agent when the call ends. Works on consumer Gmail (caption-based, no Workspace API). **Requires the local worker — see below.** |
| Paste-transcript and Chrome-extension audio capture | Both feed the same real pipeline (`/api/agent/analyze-transcript`, `/api/live-capture/*`). |

## ⚠️ Real logic, important caveats

| Feature | Caveat |
|---|---|
| Workspace memory / change detection / next agenda | Computed for real, but stored **in-memory** (`globalThis`, max 20 runs). Resets on every server restart. Not a durable database yet. |
| Drive folder nesting | Matches the agent's computed `folderPath`, which is LLM-suggested per meeting — not literally `Product / CampusConnect` unless the meeting routes there. |

## ❌ Not possible on a consumer @gmail.com account

| Movie implies | Why not |
|---|---|
| Agent **auto-joins** the moment you start a Meet (no link, no worker) | Auto-dispatch needs Google **Workspace Events API** (`conference.started`) which is **Workspace-only (paid)**; consumer Meets don't emit these. An always-on cloud bot is also fragile and against Google's ToS. The honest substitute is on-demand dispatch (below). |
| Official Google Meet transcript | Meet only generates transcripts for **Workspace** accounts. |

---

## Make the agent actually join your Meet (consumer Gmail, real)

This is the on-demand, working version of the headline feature.

**One-time setup** (on a machine with Chrome):
```bash
cd meet-bot
npm install
npm run login        # sign in as the Google account the bot should appear as
```

**Keep the worker running** (points at your site — local or Railway):
```bash
MEETINGOPS_BACKEND_URL=https://meetingops-production.up.railway.app npm run worker
```

**Dispatch the agent to a meeting:**
- In the dashboard, click **“Send agent to Meet”**, paste your `https://meet.google.com/...` link, and dispatch.
- Within ~15s the worker claims the job and Chrome joins the call as **MeetingOps AI Agent**.
- Admit it if prompted. When the call ends, it submits the transcript and the brief + actions appear.

> The bot cannot run on Railway itself (no browser). It runs wherever you start `npm run worker`.
