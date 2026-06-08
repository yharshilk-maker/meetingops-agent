# MeetingOps Agent — Deep Technical Dive

_Everything you need to explain and defend this system to founders who will grill you._

---

## 1. What this is in one sentence

MeetingOps is an **autonomous agent** that treats the end of a meeting as the start of a workflow: it captures the transcript, reasons over it using an LLM, extracts structured operational knowledge, and then prepares real Workspace actions — but stops and waits for a human to approve every external side effect before executing.

---

## 2. The overall architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAPTURE LAYER                            │
│  Chrome Extension (tab audio)  │  Meet-bot (Playwright/captions)│
│  Google Meet Transcript API    │  Paste-transcript test bench   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ raw transcript (speaker: text)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NORMALIZER                                   │
│  Trusts labelled turns; runs Groq Whisper diarization on        │
│  unlabelled audio blobs; merges adjacent same-speaker turns.    │
└──────────────────────┬──────────────────────────────────────────┘
                       │ normalised TranscriptLine[]
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REASONING ENGINE  (src/lib/agent/llm.ts)     │
│  Groq Responses API  ·  JSON Schema enforcement                 │
│  Extracts: decisions · tasks (owner, dueDate) · risks           │
│  SPICED framework · folder routing · closure score              │
│  Deterministic fallback if no model key configured              │
└──────────────────────┬──────────────────────────────────────────┘
                       │ structured LlmMeetingAnalysis
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  AGENT RUNTIME  (src/lib/agent/runtime.ts)      │
│  Deduplicates by conference record ID                           │
│  Logs every stage: event_received → fetching → analyzing        │
│  → planning_actions → awaiting_approval                         │
│  Holds max 20 runs in globalThis (in-memory)                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │ AgentRun (stage: awaiting_approval)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              HUMAN APPROVAL GATE  (dashboard UI)                │
│  Three proposed actions rendered for review:                    │
│  drive_save  ·  gmail_draft  ·  memory_update                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ user clicks "Approve"
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│               GOOGLE WORKSPACE ACTIONS                          │
│  Drive: POST /upload (multipart) → native Google Doc            │
│  Gmail: POST /drafts → real draft in your Drafts folder         │
│  Memory: in-process state update (workspace brain)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Capture layer — four input paths

### 3a. Chrome Extension + Tab Audio (primary consumer path)

**Files:** `extension/popup.js`, `extension/service-worker.js`, `extension/offscreen.js`

When you click **Start MeetingOps**:

1. `popup.js` calls `chrome.tabCapture.getMediaStreamId({ targetTabId })` — this grants access to the tab's audio stream.
2. It sends `{ type: "start-capture", streamId, meetingUrl }` to the service worker.
3. The service worker creates a Chrome **Offscreen Document** (`offscreen.html`) — Manifest V3 requires all audio work in a separate document with the `USER_MEDIA` reason.
4. The offscreen document calls `navigator.mediaDevices.getUserMedia({ audio: { chromeMediaSource: "tab", chromeMediaSourceId } })` to capture the tab's audio.
5. It creates an `AudioContext`, routes the stream back to `audioContext.destination` so you can still hear the meeting.
6. It starts a `MediaRecorder` at **opus/webm, 64 kbps**.
7. Every **60 seconds**, it stops the recorder, serialises the `Blob`, and POSTs it as `multipart/form-data` to `/api/live-capture/chunk`.

Simultaneously (same button click), it POSTs to `/api/meet-bot/jobs` to dispatch the **visible bot** to join the call (see section 3b).

**Server side (`/api/live-capture/chunk`):**
- Receives each 60-second webm blob.
- Calls the **Groq Whisper large-v3-turbo** transcription API (`verbose_json` format).
- Stores the text chunk in the session (in `.meetingops/live-capture-sessions.json`).
- Chunks larger than 24 MB are rejected (Groq's limit).

When you click **Stop and analyze meeting:**
- The offscreen document stops the `MediaRecorder`, drains the upload queue.
- POSTs `{ sessionId }` to `/api/live-capture/finish`.
- The server concatenates all chunks into `TranscriptLine[]` with speaker `"Meeting audio"`.
- Sends to the **normalizer** → **reasoning engine** → agent run.

**Why the offscreen document?** Chrome's Manifest V3 killed persistent background pages. Audio APIs can't run in a service worker. The offscreen document is the only V3-sanctioned place to hold a `MediaRecorder`.

---

### 3b. Meet-bot (Playwright browser automation)

**Files:** `meet-bot/meet-bot.mjs`, `meet-bot/worker.mjs`

The bot is a **separate Node.js process** running on your local Mac (it cannot run on Railway because it needs a real browser).

**Dispatch flow:**
1. Extension (on Start MeetingOps) POSTs `{ meetingUrl, title }` to `/api/meet-bot/jobs`.
2. The server creates a `MeetBotJob` record in `.meetingops/meet-bot-jobs.json` with status `queued`.
3. `worker.mjs` polls `/api/meet-bot/jobs?workerId=X` every 8–15s. It claims the job (atomically sets status → `claimed`) and spawns `meet-bot.mjs` as a child process.
4. `meet-bot.mjs`:
   - Opens a **fresh, logged-out Chrome profile** (`.meetingops-bot-guest-profile`) so it appears as a guest named "MeetingOps AI Agent", not a clone of your account.
   - Navigates to the Meet URL.
   - Fills the guest-name input with `botName`.
   - Dismisses consent dialogs (cookie banners, etc.).
   - Clicks the join button (polled with `waitFor` for up to 45s).
   - Turns on **Google Meet live captions** (keyboard shortcut `Cmd+Shift+C` as fallback).
   - Every second, scrapes captions from the DOM: queries `[jsname="tgaKEf"], .iOzk7, [aria-live="polite"]`, deduplicates, and appends to a running `transcript[]`.
   - When the call ends (detects "You've left the call" / "Return to home screen"), POSTs `{ transcript, title, meetingUrl }` to `/api/meet-bot/complete`.
5. The server runs the same normalizer → reasoning → agent pipeline.

**Why a separate Chrome process?** Google Meet requires a real browser session. It can't be driven by a serverless function or a headless HTTP client. You must admit the bot because it's a guest account, not a contact.

---

### 3c. Google Meet Official Transcript API (Workspace accounts only)

**Files:** `src/lib/agent/google-meet.ts`, `src/lib/agent/workspace-watcher.ts`, `src/lib/agent/google-events.ts`

**This only works on paid Google Workspace accounts (e.g. your-company.com), not consumer @gmail.com.**

Flow:
1. You authenticate via OAuth and click **Install Workspace Agent**.
2. The server calls the **Google Workspace Events API** (`workspaceevents.googleapis.com/v1/subscriptions`) to create a subscription targeting your Cloud Identity user ID (`//cloudidentity.googleapis.com/users/<sub>`).
3. This subscription covers all 7 Meet event types (conference.started, conference.ended, transcript.started, transcript.ended, transcript.fileGenerated, participant.joined, participant.left).
4. Events arrive at your **Pub/Sub topic** → Railway webhook endpoint (`/api/webhooks/google-meet`) as base64-encoded JSON.
5. On `transcript.v2.fileGenerated`, the server:
   - Calls `GET /v2/{conferenceRecord}/transcripts` → gets transcript object ID.
   - Calls `GET /v2/{transcriptName}/entries?pageSize=100` (paginated) → gets `TranscriptEntry[]` with `participant` and `text` fields.
   - Feeds directly into normalizer → reasoning → agent.

**Subscription TTL:** 7 days (604,800s). The server auto-renews on the `expirationReminder` event, or you can manually renew from the Integrations panel.

**Why Pub/Sub?** Google's Workspace Events API only supports Pub/Sub as a notification endpoint — it can't call an arbitrary URL directly. So you need: a GCP project → a Pub/Sub topic → a Pub/Sub push subscription → your Railway URL.

---

### 3d. Paste-transcript test bench

No bot, no extension. You paste raw text in `Speaker: text` format or a block of unspeakered text. The server normalizes it → reasoning → agent. Good for demos and development.

---

## 4. Normalizer — why it exists

**File:** `src/lib/agent/transcript-normalizer.ts`

Different capture paths produce different shapes of transcript:
- **Bot captions:** `[{ speaker: "Maya", text: "I will retest by June 15." }]` — already labelled.
- **Tab audio (Whisper):** `[{ speaker: "Meeting audio", text: "all speech concatenated as one blob" }]` — unlabelled.
- **Official transcript:** `[{ speaker: "participant-name", text: "..." }]` — already labelled.
- **Paste:** `"Harshil: We keep June 18..."` or a raw block — needs parsing.

The normalizer resolves all of these to a unified `TranscriptLine[]`:

1. **If already labelled** (all lines have real speaker names): merge adjacent same-speaker turns and return. **Do not re-parse.** (This was the bug fixed: re-parsing labelled turns destroyed speaker names because a line like `"Decision: June 18..."` would be read as a speaker called "Decision".)
2. **If unlabelled audio blob:** try `parseSpeakerLines` (regex for `Name: text` patterns). If that produces real names, use it. Otherwise call `diarizeTranscript` — a separate LLM call to **llama-3.3-70b-versatile** on Groq that attributes speaker turns from conversational cues.
3. **Fallback:** round-robin the participant list across transcript segments.

---

## 5. Reasoning engine — how the LLM works

**File:** `src/lib/agent/llm.ts`

### The API call

Uses the **Groq Responses API** (`/responses`, not `/chat/completions`) with enforced **JSON Schema** output (`response_format: { type: "json_schema", strict: true }`). The schema field names are:

```typescript
{
  meeting_type: string,        // "Product launch", "Engineering sync", etc.
  workspace_name: string,      // "CampusConnect", "Mobile App Redesign"
  executive_summary: string,   // 2-3 sentence brief
  decisions: EvidenceItem[],   // { text, evidence (quote), speaker }
  tasks: Task[],               // { id, text, owner, dueDate, status }
  risks: EvidenceItem[],
  spiced: {                    // Sales methodology repurposed for meetings
    situation, pain, impact, critical_event, decision
  },
  suggested_folder_category: string  // "Launch", "Engineering", "Product"
}
```

### Why JSON Schema enforcement?

Small models (20B parameters) hallucinate structure. By enforcing a schema at the API level, Groq's inference server constrains the token logits to only produce valid JSON matching the schema. If the model still fails (rare), the server reads the `error.failed_generation` field in the error response — Groq includes whatever partial JSON it generated — and tries to parse it as a recovery path.

### SPICED framework

Originally a B2B sales discovery framework (Situation, Pain, Impact, Critical Event, Decision). Here it's repurposed to give the meeting brief a consistent operational lens — what was the context, what problem was being solved, what's at stake, what's the forcing function, and what was decided.

### Deterministic fallback

If no LLM key is configured, `analyzeTranscript()` in `meeting-engine.ts` runs entirely in-process: regex-based decision detection (`decision:`, `agreed:`, etc.), task extraction (lines with `by [date]`, `will [verb]`), and keyword-based risk detection. No API calls. This is what the "deterministic_fallback" label means in the UI.

### Owner attribution (post-fix)

The small Groq model (20B) reliably fails at assigning the right task owner — it defaults everything to the first speaker or outputs "Speaker". The fix is deterministic:

1. For each extracted task, score every transcript line by **word overlap** between the task text and the line text.
2. Add a bonus score (+2) if the line contains a commitment phrase: `"I will"`, `"I can"`, `"I'll"`, `"I'm going to"`, `"I'll take"`.
3. The speaker of the highest-scoring line (score ≥ 2) becomes the owner.
4. The LLM's owner is accepted only if it's a real name (not "Speaker N", not an email address).

This correctly attributes Maya (who said "I will disable push"), Avery (who said "I will update the copy"), Rahul (who said "I can own that QA"), and Nia (who said "I can recruit").

---

## 6. Agent runtime — the state machine

**File:** `src/lib/agent/runtime.ts`

Every meeting analysis is an `AgentRun`:

```
event_received → fetching_transcript → analyzing → planning_actions → awaiting_approval
                                                                       → completed (after approval)
                                                                       → failed (on error)
```

Key details:
- **State store:** `globalThis.meetingOpsRuns` — an in-memory array. Max 20 runs, oldest dropped. This means **runs reset on every server restart** (Railway restarts on every deploy).
- **Deduplication:** Each run is keyed by `conferenceRecord` name. If the same conference fires multiple events (started, transcript.started, transcript.ended, fileGenerated), the same run object is updated in-place, not duplicated.
- **Provider tag:** each run records where it came from: `"google_meet"`, `"meet_bot"`, `"live_audio"`, `"manual_test"`.
- **Observability:** the `log[]` array records every stage transition with a timestamp and message. This is what the "Agent runs" view shows.

---

## 7. Human approval gate — what actually fires

**File:** `src/app/api/actions/execute/route.ts`, `src/lib/agent/google-actions.ts`

Three action types:

### `drive_save`
1. Reads the meeting's `folderPath` (e.g. `MeetingOps / Launch / CampusConnect / June 8, 2026 - CampusConnect Beta Launch Review`).
2. Splits into path segments and calls `findOrCreateFolder` for each, walking root → leaf. Each call:
   - Queries `mimeType='application/vnd.google-apps.folder' and name='X' and '<parentId>' in parents`.
   - Uses the oldest existing match (ordered by `createdTime`) to avoid duplicates.
   - Creates a new folder if none found.
3. Uploads a **multipart/related** request to Drive's upload endpoint, with:
   - Metadata part: `{ mimeType: "application/vnd.google-apps.document" }` — tells Drive to convert.
   - Content part: HTML body with `<h1>`, `<h2>`, bullet lists of decisions/tasks/risks with evidence quotes.
4. Drive converts the HTML into a **native Google Doc** (not a markdown file). Returns `fileId` + `webViewLink`.
5. OAuth scope used: `drive.file` — can only see files and folders this app created. Cannot read your existing Drive files.

### `gmail_draft`
1. Builds a raw MIME email string: `To:`, `Subject: Recap: <title>`, decisions + tasks as plain text.
2. Base64url-encodes it.
3. POSTs `{ message: { raw } }` to `gmail.googleapis.com/gmail/v1/users/me/drafts`.
4. Returns a `draftId`. **Never calls send.** The draft sits in your Drafts folder until you send it manually.
5. OAuth scope: `gmail.compose` — can create drafts and send emails, but cannot read your inbox.
6. Known limitation: `To:` is empty unless participants are real email addresses. The transcript only has speaker names (Maya, Avery…). Fixable by mapping names → emails from a contacts API or Calendar attendee list.

### `memory_update`
No Google API call. Updates the in-process `WorkspaceState` object: appends decisions, tasks, risks, records the meeting ID. This is what powers the "Workspace brain" view and cross-meeting change detection. **Lost on server restart.**

---

## 8. OAuth — scopes, flow, and token storage

**File:** `src/lib/agent/google-oauth.ts`

Scopes requested:
```
openid, email, profile
https://www.googleapis.com/auth/meetings.space.readonly  ← read Meet transcript entries
https://www.googleapis.com/auth/drive.file               ← Drive: only files this app created
https://www.googleapis.com/auth/gmail.compose            ← Gmail: drafts only, no inbox read
```

**Flow:**
1. `/api/auth/google/connect` builds a Google OAuth URL with `access_type=offline`, `prompt=consent` (forces a refresh token), and a random CSRF `state` nonce stored in an httpOnly cookie.
2. Google redirects to `/api/auth/google/callback` with `code` + `state`.
3. Server validates the `state` nonce (prevents CSRF), exchanges `code` for `{ access_token, refresh_token, expires_in }`.
4. Tokens saved to `.meetingops/google-tokens.json` (mode 0o600, readable only by the process user).
5. `getGoogleAccessToken()` auto-refreshes when the token has less than 60 seconds remaining.

**Why `prompt=consent`?** To force Google to issue a `refresh_token` every time. Without it, if the user re-authenticates, Google only gives an access token (assuming they already consented), and offline access is lost.

---

## 9. Closure score

**File:** `src/lib/meeting-engine.ts` → `scoreMeetingClosure()`

A simple heuristic (0–100) that measures whether the meeting produced actionable, complete outcomes:

- **Tasks have owners:** +10 per task with a non-empty owner, up to +30.
- **Tasks have due dates:** +10 per task with a due date, up to +30.
- **Decisions were made:** +20 if `decisions.length > 0`.
- **Risks were identified:** +10 if `risks.length > 0`.
- **No undefined owners:** penalty if any task has an empty owner.

Gaps are surfaced as text (e.g. "2 tasks have no assigned owner"). The score appears in the UI as a percentage with a progress bar. A 100% score means every task has an owner and date, decisions were made, and risks were called out.

---

## 10. Workspace Events subscription — technical details

**Why it expires:** Google Workspace Events subscriptions have a maximum TTL of 7 days. The server sets 604,800s on creation and renewal. Google fires a `google.workspace.events.subscription.v1.expirationReminder` event 7 days before expiry — the webhook handles this by calling `renewStoredWorkspaceWatcher()` automatically.

**Pub/Sub push path:**
```
Google Meet ends
  → Workspace Events API publishes to your Pub/Sub topic
    → Pub/Sub push subscription POSTs base64({ type, data }) to /api/webhooks/google-meet
      → server decodes, deduplicates by event ID, routes to runtime
```

**Why it doesn't work on @gmail.com:** The Workspace Events API requires the target resource to be a Cloud Identity user ID (`//cloudidentity.googleapis.com/users/<sub>`). Consumer Gmail accounts don't have Cloud Identity IDs. The API returns a 403 on subscription creation.

---

## 11. Data persistence — what's durable vs ephemeral

| Data | Storage | Durable? |
|---|---|---|
| Google OAuth tokens | `.meetingops/google-tokens.json` (Railway volume or local disk) | ✅ Survives restart |
| Google identity (name, email) | `.meetingops/google-identity.json` | ✅ Survives restart |
| Workspace watcher state | `.meetingops/workspace-watcher.json` | ✅ Survives restart |
| Bot job queue | `.meetingops/meet-bot-jobs.json` | ✅ Survives restart |
| Live capture sessions | `.meetingops/live-capture-sessions.json` | ✅ Survives restart |
| Agent runs (meeting briefs) | `globalThis.meetingOpsRuns` — in-memory | ❌ Lost on restart |
| Workspace memory (decisions, tasks, risks) | `globalThis` in-memory | ❌ Lost on restart |

**Production implication:** Railway redeploys the container on every `railway up`. Agent runs and workspace memory are lost. The tokens and watcher are on the Railway volume and survive.

**The fix (not yet built):** move agent runs and workspace state to a Postgres or Redis store. `globalThis` is used deliberately as a cheap first pass — trivial to swap out.

---

## 12. Folder routing — how the agent decides where to put the file

The LLM extracts two fields: `workspace_name` (the project/product being discussed) and `suggested_folder_category` (a category like "Product", "Engineering", "Launch"). The engine builds:

```
MeetingOps / {suggested_folder_category} / {workspace_name} / {date} - {title}
```

Examples:
- "CampusConnect beta launch review" → `MeetingOps / Launch / CampusConnect / June 8, 2026 - CampusConnect Beta Launch Review`
- "Mobile app API sync" → `MeetingOps / Engineering / Mobile App / June 8, 2026 - API Sync`

The confidence score (50–98%) reflects whether both LLM fields were non-empty and coherent.

Drive's `drive.file` scope means `findOrCreateFolder` can only find folders this app created. It cannot see your pre-existing My Drive structure.

---

## 13. The Chrome extension — Manifest V3 constraints

**Key permissions:** `activeTab`, `offscreen`, `storage`, `tabCapture`.

**Why not use `microphone` permission?** `tabCapture` captures the tab's mixed audio (everyone speaking, not just you). A microphone permission would only capture your mic. For a meeting notetaker, you want all speakers.

**Why the offscreen document?** Manifest V3 service workers are event-driven and terminate after ~30s of inactivity. A `MediaRecorder` needs to run continuously for the duration of the meeting — sometimes hours. The offscreen document (`offscreen.html`) is a persistent hidden page that can hold the recorder and audio context alive. It communicates with the service worker via `chrome.runtime.sendMessage`.

**State persistence in the extension:** `chrome.storage.local` holds `{ captureState, backendUrl, extensionToken }`. The popup reads this on every open. The service worker updates it via `setCaptureState()`. `chrome.storage.onChanged` fires the popup's refresh whenever state changes.

---

## 14. Technology stack

| Layer | Technology | Why |
|---|---|---|
| Web framework | Next.js 15 (App Router) | API routes + React frontend in one deploy |
| Frontend | React + Tailwind CSS | |
| LLM reasoning | Groq (openai/gpt-oss-20b) | Fast, cheap, JSON Schema enforcement |
| LLM fallback | OpenAI (gpt-4o-mini) | Configurable via env var |
| Audio transcription | Groq Whisper large-v3-turbo | Fast STT, same API key |
| Diarization | Groq llama-3.3-70b-versatile | Better at speaker attribution than small models |
| Browser automation | Playwright + persistent Chrome context | Meet bot join |
| Google APIs | Drive v3, Gmail v1, Meet v2, Workspace Events v1 | |
| Deployment | Railway (Nixpacks build) | One-command deploy, volume for token storage |
| Extension | Chrome Manifest V3 | Tab audio capture |

---

## 15. Questions founders will likely ask — and the real answers

**"Why not use the official Google Meet transcript always?"**
The Workspace Events + Meet Transcript API requires a paid Google Workspace account. Consumer Gmail accounts don't get transcript generation or the Events API. The bot (Playwright) and Chrome extension (tab audio → Whisper) are the consumer-grade alternatives.

**"Can this work without the bot worker running?"**
Yes — the Chrome extension captures audio independently. The bot adds a visible notetaker tile (like the movie) but is optional. If the worker isn't running, clicking Start MeetingOps still transcribes the meeting from your tab audio.

**"Why does the bot need to run on my Mac?"**
The bot drives a real Chrome browser. Railway is a Node.js/container environment — no display, no Chrome. Running a headed browser in the cloud requires either a custom Docker image with Xvfb or a hosted browser service (BrowserBase, Browserless, etc.). That's a $50–200/month addition and is a known next production step.

**"Why is workspace memory lost on restart?"**
It's in `globalThis` — a deliberate first-pass decision to ship fast. The fix is a Postgres or Redis store, straightforward to add. The token, watcher, and job data are already durable (written to disk/volume).

**"What prevents the agent from doing something I don't want?"**
Three mechanisms: (1) the `drive.file` scope means it can only touch files it created — it cannot read or modify anything else in your Drive. (2) `gmail.compose` means it can create drafts but cannot send or read email. (3) The UI approval gate means no external action fires without an explicit user click. The agent is incapable of side effects without your approval.

**"How does it know which folder to put the file in?"**
The LLM extracts a project name (`workspace_name`) and category (`suggested_folder_category`) from the transcript content. These are then combined into a hierarchical path. The logic is in `meetingFromAnalysis()` in `meeting-engine.ts`.

**"What if the LLM hallucinates a decision that wasn't made?"**
Every decision and risk object includes an `evidence` field (the direct quote) and `speaker` field. The UI displays both. A human reading the brief can see exactly which statement each extraction came from and reject it at approval time. The LLM prompt explicitly instructs "extract only facts supported by the transcript; do not invent."

**"What's the cost to run this?"**
Groq has a generous free tier. Whisper transcription at 64kbps opus for a 1-hour meeting is roughly 14 MB of audio → ~$0.01. Reasoning analysis is a few thousand tokens → essentially free at current Groq pricing. Railway's starter plan covers the hosting. Total marginal cost per meeting: under $0.05.

**"What would you build next?"**
1. Durable storage for runs and workspace memory (Postgres, single table).
2. Calendar integration — pull attendee emails so Gmail draft recipients auto-populate.
3. Cloud bot worker (BrowserBase or a Railway container with Xvfb) so no local worker is needed.
4. Multi-user token storage (encrypted per-user credentials instead of a single server-side token file).
5. Signed Pub/Sub validation (currently the webhook trusts an optional shared secret; production should verify Google's signing key).

---

## 16. Source file map — where everything lives

```
src/
  app/
    api/
      auth/google/          ← OAuth connect + callback + status
      agent/
        analyze-transcript/ ← paste-transcript test bench
        demo/               ← simulated demo meeting event
        demo-lifecycle/     ← conference.started simulation
        runs/               ← poll agent run state
      actions/execute/      ← approve drive_save / gmail_draft / memory_update
      integrations/
        google-meet/        ← status / activate / renew / subscribe
        capture-mode/       ← switch bot/official/hybrid
      live-capture/         ← start / chunk / finish / status
      meet-bot/
        jobs/               ← queue + claim bot jobs (GET + POST)
        jobs/[id]/          ← update job status
        complete/           ← bot submits finished transcript
      webhooks/google-meet/ ← Pub/Sub push endpoint
      health/               ← Railway healthcheck
    movie/                  ← self-playing cinematic demo (/movie)
    page.tsx                ← the entire dashboard UI
  lib/
    agent/
      capture-orchestrator.ts  ← bot job queue (in-memory + file)
      data-store.ts            ← read/write JSON files under .meetingops/
      google-actions.ts        ← Drive Doc creation + Gmail draft
      google-events.ts         ← Workspace Events API (subscribe/renew/list)
      google-meet.ts           ← Meet API (fetch transcript entries)
      google-oauth.ts          ← OAuth flow + token storage + auto-refresh
      live-transcription.ts    ← Whisper chunk transcription + session mgmt
      llm.ts                   ← Groq Responses API + JSON schema + fallback
      runtime.ts               ← agent state machine + run deduplication
      transcript-normalizer.ts ← unify all transcript formats
      workspace-watcher.ts     ← Workspace Events subscription lifecycle
    meeting-engine.ts          ← deterministic analysis + owner attribution
                                  + closure score + change detection
meet-bot/
  meet-bot.mjs     ← Playwright bot (join + captions + submit)
  worker.mjs       ← polling worker that dispatches the bot
  login.mjs        ← one-time: sign in to Chrome bot profile
extension/
  manifest.json    ← MV3: tabCapture, offscreen, storage, activeTab
  service-worker.js ← handles start/stop messages, dispatches bot
  popup.js          ← button, state display
  offscreen.js      ← MediaRecorder + chunk upload loop
```
