# MeetingOps

**An event-driven AI agent that turns finished meetings into operational follow-through.**

MeetingOps listens for Google Meet transcript events, retrieves the transcript itself, reasons over what changed, and prepares controlled follow-up actions. It goes beyond meeting summaries by maintaining workspace memory, surfacing unresolved risks, and requiring human approval before external actions.

## Why it is an agent

MeetingOps runs an observable workflow rather than waiting for a user to manually organize notes:

```text
event received → transcript retrieved → state extracted → changes reconciled
→ actions planned → human approval → Drive / Gmail / workspace memory
```

The agent uses evidence-backed structured reasoning, has a deterministic fallback, records every execution stage, and keeps external side effects behind an approval boundary.

## Highlights

- Automatically receives Google Meet transcript-ready events through Workspace Events and Pub/Sub.
- Extracts summaries, decisions, owners, deadlines, tasks, risks, and open questions.
- Applies the SPICED framework and calculates a meeting-closure score.
- Grounds decisions and risks in quoted transcript evidence.
- Detects changes across meetings and builds a living workspace brain.
- Routes meeting packets into suggested Google Drive folders.
- Creates unsent Gmail follow-up drafts.
- Includes a paste-transcript test bench for immediate evaluation.
- Supports Groq or OpenAI structured reasoning.

## Run

```bash
npm install
npm run dev
```

## Autonomous agent loop

```text
Google Meet transcription finishes
  → Google Workspace Events API publishes transcript.fileGenerated
  → Pub/Sub forwards the CloudEvent to /api/webhooks/google-meet
  → Agent fetches transcript entries from the Google Meet REST API
  → Agent classifies, extracts, reconciles memory, and plans actions
  → External actions wait for human approval
```

Google Meet transcription must be enabled for the autonomous meeting flow. The dashboard also includes a **Paste transcript** test bench so reviewers can exercise the complete post-transcript workflow without waiting for a live meeting.

## Demo flow

### Fast evaluation

1. Click **Paste transcript**.
2. Enter a title and transcript using `Speaker: message` lines.
3. Review the evidence-backed brief, SPICED analysis, closure score, and proposed actions.
4. Approve **Update workspace memory** and inspect the workspace brain.

### State-change story

1. Click **Trigger first Meet event**.
2. The simulated Workspace event invokes the same backend agent runtime used by the production webhook.
3. Review the evidence-backed brief and approve **Update workspace memory**.
4. Trigger **Mobile App Launch Readiness**.
5. Open **What changed** to see resolved blockers and the new launch risk.

### Live Google Meet story

Connect Google Workspace, activate a Meet watcher, run a transcribed meeting in the monitored space, and end the call. Google publishes the transcript-ready event and MeetingOps processes it without a transcript upload.

## Agent endpoints

- `POST /api/webhooks/google-meet` receives `google.workspace.meet.transcript.v2.fileGenerated`.
- `POST /api/integrations/google-meet/subscribe` creates a Google Workspace Events subscription.
- `GET /api/agent/runs` returns observable agent runs and stage logs.
- `POST /api/agent/demo` triggers a simulated Google Meet event.
- `POST /api/agent/analyze-transcript` runs the post-transcript agent workflow from the test bench.

## Production setup

Follow [GOOGLE_SETUP.md](./GOOGLE_SETUP.md) for the exact OAuth, API, Pub/Sub, IAM, callback, and watcher activation steps.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting recommendations and production-hardening notes.

The agent uses structured model output when Groq or OpenAI is configured and retains a deterministic fallback for a reliable walkthrough.

## Model reasoning

Groq is the recommended provider for this take-home because it offers fast OpenAI-compatible inference and a free developer tier. Configure:

```bash
LLM_PROVIDER="groq"
GROQ_API_KEY="your-key"
GROQ_MODEL="openai/gpt-oss-20b"
```

The GPT-OSS Groq models support strict structured outputs. You can alternatively set `LLM_PROVIDER="openai"` and `OPENAI_API_KEY`. Without either key, the agent records that it used its deterministic demo fallback.

Agent runs are observable in the UI and record each stage:

```text
event received → transcript fetched → analysis → action planning → awaiting approval
```

Action approval calls `POST /api/actions/execute`, which is the server-side boundary for Drive, Gmail, and workspace-memory executors. With Google OAuth connected, Drive creates the brief and Gmail creates an unsent draft.

The Google action adapters are implemented:

- Drive creates a `MeetingOps` folder and uploads an evidence-backed Markdown meeting brief.
- Gmail creates a follow-up draft and never sends automatically.
- `GOOGLE_WEBHOOK_SECRET` can protect the Meet webhook.
- Repeated transcript events are deduplicated before processing.

Each analysis also produces a meeting-closure score that flags missing owners, missing due dates, absent decisions, and risks without mitigation tasks.

## Architecture

```text
Google Meet → Workspace Events → Pub/Sub → webhook
                                         ↓
Transcript test bench ───────────────→ agent runtime
                                         ↓
                       structured reasoning + evidence
                                         ↓
                         approval-gated action executors
                              ↙          ↓          ↘
                           Drive       Gmail      Memory
```

The app is built with Next.js, TypeScript, React, Groq/OpenAI-compatible structured outputs, Google Meet REST API, Workspace Events API, Pub/Sub, Drive API, and Gmail API.

## Current scope

MeetingOps is a take-home prototype designed to demonstrate the complete agent loop. It currently assumes one connected Google account and keeps workspace memory in the browser. The deployment guide describes the persistence, authentication, subscription-renewal, and queueing work needed for a multi-user production service.
