export type EvidenceItem = { text: string; evidence: string; speaker: string };
export type Task = { id: string; text: string; owner: string; dueDate: string; status: "open" | "done" };
export type Change = { field: string; label: string; before: string; after: string; evidence: string; confidence: number };
export type ProposedAction = {
  id: string;
  type: "drive_save" | "gmail_draft" | "memory_update";
  title: string;
  description: string;
  status: "needs_approval" | "completed" | "rejected";
  result?: { mode?: string; message?: string; webViewLink?: string; webUrl?: string; fileId?: string; folderId?: string; id?: string };
};
export type TranscriptLine = { speaker: string; text: string };
export type MeetingInput = { id: string; title: string; date: string; participants: string[]; transcript: TranscriptLine[] };
export type Meeting = MeetingInput & {
  type: string; summary: string; decisions: EvidenceItem[]; tasks: Task[]; risks: EvidenceItem[];
  spiced: Record<string, string>; folderPath: string; folderConfidence: number; changes: Change[]; actions: ProposedAction[];
  reasoningMode?: "structured_llm" | "deterministic_fallback";
  closureScore?: { score: number; gaps: string[] };
  workspaceName?: string;
};
export type WorkspaceState = {
  name: string; decisions: EvidenceItem[]; tasks: Task[]; risks: EvidenceItem[];
  launchDate: string; apiOwner: string; analyticsScope: string; meetingIds: string[];
};

export const INITIAL_WORKSPACE: WorkspaceState = {
  name: "Mobile App Redesign", decisions: [], tasks: [], risks: [], launchDate: "June 20",
  apiOwner: "Rahul", analyticsScope: "Optional after launch", meetingIds: [],
};

export const DEMO_MEETINGS: MeetingInput[] = [
  {
    id: "roadmap-1", title: "Mobile App Redesign Sync", date: "June 6, 2026",
    participants: ["Jordan", "Maya", "Alex", "Rahul"],
    transcript: [
      { speaker: "Jordan", text: "We are still targeting the mobile redesign launch for June 20, but the API integration is starting to put that date at risk." },
      { speaker: "Rahul", text: "I am stretched across auth and payments. Maya, can you take over the API integration from me?" },
      { speaker: "Maya", text: "Yes, I can own the API integration. I will have the core endpoints ready by June 14." },
      { speaker: "Alex", text: "I am blocked waiting on the user testing notes. Without them, I cannot finalize the onboarding flow." },
      { speaker: "Jordan", text: "Let's push the launch by one week to June 27. Analytics visibility also needs to be required for MVP, not optional." },
      { speaker: "Jordan", text: "At the next sync, we will review launch readiness and confirm whether the blockers are cleared." },
    ],
  },
  {
    id: "roadmap-2", title: "Mobile App Launch Readiness", date: "June 13, 2026",
    participants: ["Jordan", "Maya", "Alex"],
    transcript: [
      { speaker: "Jordan", text: "We moved the launch to June 27 last week. Today we need to decide whether that date still holds." },
      { speaker: "Maya", text: "The API endpoints are complete ahead of June 14, and frontend integration is underway. I can close that task." },
      { speaker: "Alex", text: "The user testing notes arrived, so onboarding is unblocked. Two accessibility issues came out of testing and need fixes." },
      { speaker: "Jordan", text: "Great. June 27 is confirmed. The analytics dashboard remains required for MVP, and Maya will also own the accessibility fixes." },
      { speaker: "Maya", text: "I will finish both accessibility fixes by June 19." },
      { speaker: "Jordan", text: "The remaining launch risk is App Store review timing. We should submit the build by June 21." },
    ],
  },
];

const e = (text: string, evidence: string, speaker: string): EvidenceItem => ({ text, evidence, speaker });

export function analyzeTranscript(input: MeetingInput, workspace: WorkspaceState): Meeting {
  if (input.id !== "roadmap-1" && input.id !== "roadmap-2") {
    const meeting: Meeting = {
      ...input,
      type: "General meeting",
      summary: `Transcript received with ${input.transcript.length} entries. Configure a reasoning provider for full structured extraction.`,
      decisions: [],
      tasks: [],
      risks: [],
      spiced: { situation: "", pain: "", impact: "", critical_event: "", decision: "" },
      folderPath: `MeetingOps / General / ${input.date} - ${input.title}`,
      folderConfidence: 50,
      changes: [],
      reasoningMode: "deterministic_fallback",
      workspaceName: input.title,
      actions: [
        { id: "drive-save", type: "drive_save", title: "Save meeting brief to Drive", description: "Save the received transcript and basic meeting brief.", status: "needs_approval" },
        { id: "memory-update", type: "memory_update", title: "Update workspace memory", description: "Record this meeting in workspace history.", status: "needs_approval" },
      ],
    };
    meeting.closureScore = scoreMeetingClosure(meeting);
    return meeting;
  }
  const second = input.id === "roadmap-2";
  const decisions = second
    ? [e("June 27 launch date is confirmed.", "June 27 is confirmed.", "Jordan"), e("Analytics dashboard remains required for MVP.", "The analytics dashboard remains required for MVP.", "Jordan"), e("Maya owns the accessibility fixes.", "Maya will also own the accessibility fixes.", "Jordan")]
    : [e("Launch moved from June 20 to June 27.", "Let's push the launch by one week to June 27.", "Jordan"), e("Analytics dashboard is required for MVP.", "Analytics visibility also needs to be required for MVP, not optional.", "Jordan"), e("Maya takes ownership of API integration.", "Maya, can you take over the API integration from me?", "Rahul")];
  const tasks: Task[] = second
    ? [{ id: "api-integration", text: "Complete API integration", owner: "Maya", dueDate: "June 14", status: "done" }, { id: "accessibility-fixes", text: "Fix two accessibility issues", owner: "Maya", dueDate: "June 19", status: "open" }, { id: "app-store-submit", text: "Submit build for App Store review", owner: "Unassigned", dueDate: "June 21", status: "open" }]
    : [{ id: "api-integration", text: "Complete API integration", owner: "Maya", dueDate: "June 14", status: "open" }, { id: "testing-notes", text: "Provide user testing notes", owner: "Unassigned", dueDate: "Not stated", status: "open" }, { id: "launch-review", text: "Review launch readiness", owner: "Team", dueDate: "Next sync", status: "open" }];
  const risks = second
    ? [e("App Store review timing may threaten launch.", "The remaining launch risk is App Store review timing.", "Jordan")]
    : [e("User testing notes are blocking onboarding.", "I am blocked waiting on the user testing notes.", "Alex"), e("API integration is putting the launch date at risk.", "The API integration is starting to put that date at risk.", "Jordan")];

  const meeting: Meeting = {
    ...input, type: "Product roadmap",
    summary: second ? "The team confirmed the June 27 launch, closed the API and onboarding blockers, and identified App Store review timing as the remaining launch risk." : "The team moved the mobile redesign launch to June 27, reassigned API ownership to Maya, made analytics required for MVP, and surfaced onboarding and integration blockers.",
    decisions, tasks, risks,
    spiced: second
      ? { situation: "Launch readiness review following last week's scope and timeline changes.", pain: "Two accessibility issues remain and App Store timing is uncertain.", impact: "A delayed review could still move the June 27 launch.", critical_event: "Submit the build by June 21 for the June 27 launch.", decision: "June 27 is confirmed; Maya owns accessibility fixes." }
      : { situation: "The mobile redesign was targeting a June 20 launch.", pain: "API integration and missing testing notes are blocking progress.", impact: "The launch date and onboarding quality are at risk.", critical_event: "Core API endpoints by June 14; revised launch June 27.", decision: "Move launch, reassign API ownership, require analytics for MVP." },
    folderPath: `MeetingOps / Product / Mobile App Redesign / ${input.date} - ${input.title}`, folderConfidence: 96,
    changes: [],
    actions: [
      { id: "drive-save", type: "drive_save", title: "Save meeting brief to Drive", description: "Create the routed workspace folder and save the evidence-backed meeting packet.", status: "needs_approval" },
      { id: "gmail-draft", type: "gmail_draft", title: "Create attendee follow-up draft", description: "Prepare a concise recap with decisions, owners, deadlines, and unresolved risks.", status: "needs_approval" },
      { id: "memory-update", type: "memory_update", title: "Update workspace memory", description: "Apply approved decisions, tasks, risks, owners, and milestone changes.", status: "needs_approval" },
    ],
  };
  meeting.changes = generateChanges(workspace, projectMeetingState(workspace, meeting), meeting);
  meeting.closureScore = scoreMeetingClosure(meeting);
  return meeting;
}

export function meetingFromAnalysis(input: MeetingInput, analysis: {
  meeting_type: string;
  workspace_name: string;
  executive_summary: string;
  decisions: EvidenceItem[];
  tasks: Task[];
  risks: EvidenceItem[];
  spiced: Record<string, string>;
  suggested_folder_category: string;
}): Meeting {
  const meetingType = analysis.meeting_type.trim() || "General meeting";
  const workspaceName = analysis.workspace_name.trim() || input.title;
  const folderCategory = analysis.suggested_folder_category.trim() || meetingType;
  const meeting: Meeting = {
    ...input,
    type: meetingType,
    summary: analysis.executive_summary.trim() || `Analyzed ${input.transcript.length} transcript entries.`,
    decisions: analysis.decisions,
    tasks: analysis.tasks,
    risks: analysis.risks,
    spiced: analysis.spiced,
    folderPath: `MeetingOps / ${folderCategory} / ${workspaceName} / ${input.date} - ${input.title}`,
    folderConfidence: analysis.workspace_name.trim() && analysis.suggested_folder_category.trim() ? 88 : 68,
    changes: [],
    reasoningMode: "structured_llm",
    workspaceName,
    actions: [
      { id: "drive-save", type: "drive_save", title: "Save meeting brief to Drive", description: "Create the routed workspace folder and save the evidence-backed meeting packet.", status: "needs_approval" },
      { id: "gmail-draft", type: "gmail_draft", title: "Create attendee follow-up draft", description: "Prepare a concise recap with decisions, owners, deadlines, and unresolved risks.", status: "needs_approval" },
      { id: "memory-update", type: "memory_update", title: "Update workspace memory", description: "Apply approved decisions, tasks, risks, owners, and milestone changes.", status: "needs_approval" },
    ],
  };
  meeting.closureScore = scoreMeetingClosure(meeting);
  return meeting;
}

export function scoreMeetingClosure(meeting: Pick<Meeting, "tasks" | "decisions" | "risks">) {
  const gaps: string[] = [];
  const unassigned = meeting.tasks.filter((task) => !task.owner || task.owner === "Unassigned").length;
  const undated = meeting.tasks.filter((task) => !task.dueDate || task.dueDate === "Not stated" || task.dueDate === "Next sync").length;
  if (unassigned) gaps.push(`${unassigned} action item${unassigned > 1 ? "s have" : " has"} no owner`);
  if (undated) gaps.push(`${undated} action item${undated > 1 ? "s have" : " has"} no firm due date`);
  if (!meeting.decisions.length) gaps.push("No explicit decision was captured");
  if (meeting.risks.length && !meeting.tasks.some((task) => /risk|block|fix|resolve|submit/i.test(task.text))) gaps.push("Risks have no explicit mitigation task");
  return { score: Math.max(20, 100 - unassigned * 20 - undated * 15 - (meeting.decisions.length ? 0 : 25) - (gaps.some((gap) => gap.includes("mitigation")) ? 15 : 0)), gaps };
}

function projectMeetingState(current: WorkspaceState, meeting: Meeting): WorkspaceState {
  const isSeededRoadmap = meeting.id === "roadmap-1" || meeting.id === "roadmap-2";
  return {
    name: meeting.workspaceName || current.name,
    decisions: meeting.decisions,
    tasks: meeting.tasks,
    risks: meeting.risks,
    launchDate: isSeededRoadmap ? "June 27" : current.launchDate,
    apiOwner: isSeededRoadmap ? "Maya" : current.apiOwner,
    analyticsScope: isSeededRoadmap ? "Required for MVP" : current.analyticsScope,
    meetingIds: [...new Set([...current.meetingIds, meeting.id])],
  };
}
export function applyMeetingToWorkspace(current: WorkspaceState, meeting: Meeting) { return projectMeetingState(current, meeting); }

export function generateChanges(before: WorkspaceState, after: WorkspaceState, meeting: Pick<Meeting, "id">): Change[] {
  const quotes = meeting.id === "roadmap-2"
    ? { launchDate: "June 27 is confirmed.", apiOwner: "The API endpoints are complete ahead of June 14.", analyticsScope: "The analytics dashboard remains required for MVP." }
    : { launchDate: "Let's push the launch by one week to June 27.", apiOwner: "Maya, can you take over the API integration from me?", analyticsScope: "Analytics visibility also needs to be required for MVP, not optional." };
  const changes: Change[] = [];
  if (before.launchDate !== after.launchDate) changes.push({ field: "launchDate", label: "Launch date", before: before.launchDate, after: after.launchDate, evidence: quotes.launchDate, confidence: 98 });
  if (before.apiOwner !== after.apiOwner) changes.push({ field: "apiOwner", label: "API owner", before: before.apiOwner, after: after.apiOwner, evidence: quotes.apiOwner, confidence: 96 });
  if (before.analyticsScope !== after.analyticsScope) changes.push({ field: "analyticsScope", label: "MVP scope", before: before.analyticsScope, after: after.analyticsScope, evidence: quotes.analyticsScope, confidence: 97 });
  if (meeting.id === "roadmap-2") {
    changes.push({ field: "api-status", label: "API integration", before: "Open, launch risk", after: "Complete", evidence: "The API endpoints are complete ahead of June 14.", confidence: 99 });
    changes.push({ field: "onboarding-blocker", label: "Onboarding blocker", before: "Blocked on testing notes", after: "Unblocked", evidence: "The user testing notes arrived, so onboarding is unblocked.", confidence: 99 });
    changes.push({ field: "launch-risk", label: "Primary launch risk", before: "API integration", after: "App Store review timing", evidence: "The remaining launch risk is App Store review timing.", confidence: 98 });
  }
  return changes;
}

export function generateWorkspaceChanges(before: WorkspaceState, meeting: Meeting): Change[] {
  if (!before.meetingIds.length || (meeting.id === "roadmap-1" || meeting.id === "roadmap-2")) return meeting.changes;
  const changes: Change[] = [];
  const previousTasks = new Map(before.tasks.map((task) => [task.id, task]));
  for (const task of meeting.tasks) {
    const previous = previousTasks.get(task.id);
    if (previous && previous.status !== task.status) {
      changes.push({ field: `task-status-${task.id}`, label: "Task status", before: `${previous.text}: ${previous.status}`, after: `${task.text}: ${task.status}`, evidence: `Task status changed to ${task.status}.`, confidence: 90 });
    } else if (!previous && !before.tasks.some((item) => item.text.toLowerCase() === task.text.toLowerCase())) {
      changes.push({ field: `new-task-${task.id}`, label: "New action item", before: "Not tracked", after: `${task.text} — ${task.owner}, due ${task.dueDate}`, evidence: task.text, confidence: 88 });
    }
  }
  for (const decision of meeting.decisions) {
    if (!before.decisions.some((item) => item.text.toLowerCase() === decision.text.toLowerCase())) {
      changes.push({ field: `decision-${changes.length}`, label: "New decision", before: "Not recorded", after: decision.text, evidence: decision.evidence, confidence: 92 });
    }
  }
  for (const risk of meeting.risks) {
    if (!before.risks.some((item) => item.text.toLowerCase() === risk.text.toLowerCase())) {
      changes.push({ field: `risk-${changes.length}`, label: "New risk", before: "Not tracked", after: risk.text, evidence: risk.evidence, confidence: 90 });
    }
  }
  return changes.slice(0, 8);
}
