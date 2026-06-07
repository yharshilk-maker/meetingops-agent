# Founder Demo Guide

## Core story

Meeting summaries are passive documents. MeetingOps is an agent because it reacts to an event, retrieves its own context, reasons about operational state, plans actions, waits for approval, and carries approved knowledge into the next meeting.

## Recommended 7-minute demo

### 1. Frame the problem (45 seconds)

> Most meeting tools stop at summarization. The actual failure happens afterward: decisions disappear, owners are unclear, risks are not tracked, and follow-up work is manual. MeetingOps treats the end of a meeting as the start of an agent workflow.

Briefly show the agent loop on the overview page.

### 2. Prove it handles arbitrary meetings (2 minutes)

Open **Paste transcript** and use:

```text
Jordan: We need to ship the onboarding redesign by July 15.
Maya: I can own the API integration and finish it by July 10.
Alex: User testing is blocked because recruiting has not confirmed participants.
Jordan: Decision made: analytics is required for launch. Alex, please confirm participants by Friday.
```

Point out:

- The summary is generated from arbitrary text.
- Decisions and risks include transcript evidence.
- Tasks have owners and due dates.
- SPICED creates a useful operational lens.
- The closure score identifies what the meeting failed to resolve.

### 3. Show controlled action (1 minute)

Approve **Update workspace memory**.

Open **Workspace brain** and show that the decision, tasks, and risk became durable operational state. Explain that Drive and Gmail actions use the same approval boundary and create a brief or unsent draft rather than silently acting.

### 4. Show longitudinal intelligence (1.5 minutes)

Use the seeded event flow:

1. Reset the demo.
2. Trigger the first Meet event.
3. Approve its memory update.
4. Trigger **Mobile App Launch Readiness**.
5. Open **What changed**.

Explain that the useful unit is not one summary; it is the change in state across meetings.

### 5. Show the real integration architecture (1 minute)

Open **Integrations** and explain:

```text
Google Meet transcript-ready event
→ Workspace Events API
→ Pub/Sub webhook
→ transcript retrieval
→ agent reasoning
→ approval-gated actions
```

Mention that a real Drive brief and Gmail draft were tested. Only run a live Google Meet during the demo if timing is predictable.

### 6. Close with engineering judgment (45 seconds)

> I intentionally kept external side effects behind human approval. The next production steps are encrypted multi-user token storage, durable agent runs and memory, signed Pub/Sub validation, scheduled watcher renewal, and a job queue.

## What to send

Send both the hosted URL and GitHub repository:

- Hosted URL: immediate product evaluation.
- GitHub: architecture, setup instructions, deployment thinking, and implementation quality.

Do not make reviewers download and configure the repository before they can understand the product.

## Backup plan

- Keep the local app running.
- Keep the ngrok tunnel available for the Google webhook.
- Use the paste-transcript flow as the primary reliable demonstration.
- Use simulated Meet events to demonstrate state changes.
- Treat the live Google Meet flow as proof of integration, not as the only way to show the product.
