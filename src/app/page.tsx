"use client";

import {
  Activity, ArrowRight, Bot, CalendarDays, Check, ChevronRight, CircleAlert, Clock3, Cloud, Gauge,
  Clapperboard, FolderOpen, LayoutDashboard, Mail, MessageSquareText, Pause, Play,
  RotateCcw, Search, ShieldCheck, SkipForward, Sparkles, Target, Users, Video,
  WandSparkles, X, Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  DEMO_MEETINGS, INITIAL_WORKSPACE, Meeting, WorkspaceState, analyzeTranscript,
  applyMeetingToWorkspace, generateChanges, generateWorkspaceChanges,
} from "@/lib/meeting-engine";

type View = "dashboard" | "meeting" | "workspace" | "actions" | "runs" | "demo";
type AgentRun = {
  id: string;
  stage: string;
  startedAt: string;
  reasoningMode?: "structured_llm" | "deterministic_fallback";
  reasoningProvider?: "groq" | "openai";
  reasoningModel?: string;
  eventType?: string;
  log: { stage: string; message: string; at: string }[];
  meeting?: Meeting;
};
type WorkspaceAgentStatus = {
  configured: boolean;
  connected: boolean;
  identity?: { email?: string; name?: string };
  capture?: { mode: "official" | "bot" | "hybrid"; botName: string; updatedAt: string };
  botJobs?: { id: string; title: string; meetingUrl?: string; status: string; createdAt: string; error?: string }[];
  watcher?: {
    state: "activating" | "active" | "needs_renewal" | "error";
    mode: "workspace_user" | "meeting_space";
    expireTime?: string;
    targetResource: string;
  };
};

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceState>(INITIAL_WORKSPACE);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [showIngest, setShowIngest] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showDemoStudio, setShowDemoStudio] = useState(false);
  const [showTestBench, setShowTestBench] = useState(false);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [workspaceAgentActive, setWorkspaceAgentActive] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/google-meet/status")
      .then((response) => response.json())
      .then((status: WorkspaceAgentStatus) => {
        setGoogleConnected(Boolean(status.connected));
        setWorkspaceAgentActive(status.watcher?.state === "active" || status.watcher?.state === "activating");
      })
      .catch(() => { setGoogleConnected(false); setWorkspaceAgentActive(false); });
  }, [showIntegrations]);

  useEffect(() => {
    let cancelled = false;
    async function syncRuns() {
      try {
        const response = await fetch("/api/agent/runs");
        const data = await response.json() as { runs?: AgentRun[] };
        if (cancelled || !data.runs) return;
        setAgentRuns(data.runs);
        setMeetings((current) => {
          const existingIds = new Set(current.map((meeting) => meeting.id));
          const incoming = data.runs!.flatMap((run) => {
            if (!run.meeting || existingIds.has(run.meeting.id)) return [];
            run.meeting.changes = generateWorkspaceChanges(workspace, run.meeting);
            return [run.meeting];
          });
          return [...incoming, ...current];
        });
      } catch {
        // The UI remains usable if the local runtime is temporarily unavailable.
      }
    }
    syncRuns();
    const interval = setInterval(syncRuns, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [workspace]);

  const activeMeeting = meetings.find((meeting) => meeting.id === activeMeetingId);
  const pendingActions = meetings.flatMap((meeting) => meeting.actions.filter((action) => action.status === "needs_approval"));

  async function ingestDemo(index: number) {
    const response = await fetch("/api/agent/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
    const run = await response.json() as AgentRun;
    setAgentRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
    const meeting = run.meeting ?? analyzeTranscript(DEMO_MEETINGS[index], workspace);
    meeting.changes = analyzeTranscript(DEMO_MEETINGS[index], workspace).changes;
    setMeetings((current) => [meeting, ...current.filter((item) => item.id !== meeting.id)]);
    setActiveMeetingId(meeting.id);
    setShowIngest(false);
    setView("meeting");
  }

  async function simulateWorkspaceWake() {
    const response = await fetch("/api/agent/demo-lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "google.workspace.meet.conference.v2.started" }),
    });
    const run = await response.json() as AgentRun;
    setAgentRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
    setShowIngest(false);
    setView("runs");
  }

  function acceptRun(run: AgentRun) {
    if (!run.meeting) return;
    run.meeting.changes = generateWorkspaceChanges(workspace, run.meeting);
    setAgentRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
    setMeetings((current) => [run.meeting!, ...current.filter((item) => item.id !== run.meeting!.id)]);
    setActiveMeetingId(run.meeting.id);
    setShowTestBench(false);
    setView("meeting");
  }

  async function setActionStatus(meetingId: string, actionId: string, status: "completed" | "rejected") {
    const meeting = meetings.find((item) => item.id === meetingId);
    if (!meeting) return false;
    const action = meeting.actions.find((item) => item.id === actionId);
    if (status === "completed" && action) {
      const response = await fetch("/api/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, actionId, actionType: action.type, meeting }),
      });
      if (!response.ok) return false;
      const execution = await response.json() as { result?: Meeting["actions"][number]["result"] };
      action.result = execution.result;
    }
    setMeetings((current) => current.map((item) => item.id === meetingId ? {
      ...item, actions: item.actions.map((currentAction) => currentAction.id === actionId ? { ...currentAction, status, result: action?.result } : currentAction),
    } : item));
    if (status === "completed" && meeting.actions.find((action) => action.id === actionId)?.type === "memory_update") {
      setWorkspace(applyMeetingToWorkspace(workspace, meeting));
    }
    return true;
  }

  function resetDemo() {
    setMeetings([]); setWorkspace(INITIAL_WORKSPACE); setActiveMeetingId(null);
    setView("dashboard");
  }

  function primeShowcase() {
    const first = analyzeTranscript(DEMO_MEETINGS[0], INITIAL_WORKSPACE);
    first.reasoningMode = "structured_llm";
    first.actions = first.actions.map((action) => ({
      ...action,
      status: "completed",
      result: action.type === "drive_save"
        ? { mode: "demo", message: "Meeting packet saved to the MeetingOps Drive folder." }
        : action.type === "gmail_draft"
          ? { mode: "demo", message: "Attendee follow-up prepared in Gmail Drafts." }
          : { mode: "local", message: "Workspace memory update approved." },
    }));
    const nextWorkspace = applyMeetingToWorkspace(INITIAL_WORKSPACE, first);
    const second = analyzeTranscript(DEMO_MEETINGS[1], nextWorkspace);
    second.reasoningMode = "structured_llm";
    second.changes = generateWorkspaceChanges(nextWorkspace, second);
    const now = new Date().toISOString();
    const runs: AgentRun[] = [
      {
        id: "demo-showcase-followup",
        stage: "awaiting_approval",
        startedAt: now,
        reasoningMode: "structured_llm",
        reasoningProvider: "groq",
        reasoningModel: "openai/gpt-oss-20b",
        meeting: second,
        log: [
          { stage: "event_received", message: "Google Meet transcript-ready event received.", at: now },
          { stage: "fetching_transcript", message: `Parsed ${second.transcript.length} official transcript entries.`, at: now },
          { stage: "analyzing", message: "Structured reasoning extracted decisions, risks, tasks, and SPICED context.", at: now },
          { stage: "planning_actions", message: "Prepared Drive, Gmail, memory, and next-meeting follow-through.", at: now },
          { stage: "awaiting_approval", message: "External actions are paused for human approval.", at: now },
        ],
      },
      {
        id: "demo-showcase-wake",
        stage: "observing",
        startedAt: now,
        eventType: "google.workspace.meet.conference.v2.started",
        log: [
          { stage: "event_received", message: "Workspace event woke MeetingOps as the meeting started.", at: now },
          { stage: "observing", message: "Hybrid capture is ready: official transcript preferred, Meet-bot available as fallback.", at: now },
        ],
      },
    ];
    setWorkspace(nextWorkspace);
    setMeetings([second, first]);
    setAgentRuns(runs);
    setActiveMeetingId(second.id);
    setShowDemoStudio(false);
    setView("meeting");
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#17211b]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-[#dfe4e1] bg-[#12231b] px-4 py-5 text-white lg:flex">
        <button className="mb-8 flex items-center gap-3 px-2 text-left" onClick={() => setView("dashboard")}>
          <div className="grid size-9 place-items-center rounded-xl bg-[#b9f06b] text-[#12231b]"><Zap size={19} fill="currentColor" /></div>
          <div><p className="text-[15px] font-semibold tracking-tight">MeetingOps</p><p className="text-[10px] uppercase tracking-[0.16em] text-[#91a299]">Workflow agent</p></div>
        </button>
        <nav className="space-y-1">
          <NavButton active={view === "dashboard"} icon={<LayoutDashboard size={17} />} label="Overview" onClick={() => setView("dashboard")} />
          <NavButton active={view === "workspace"} icon={<Target size={17} />} label="Workspace brain" onClick={() => setView("workspace")} />
          <NavButton active={view === "runs"} icon={<Activity size={17} />} label="Agent runs" badge={agentRuns.length} onClick={() => setView("runs")} />
          <NavButton active={view === "actions"} icon={<ShieldCheck size={17} />} label="Action center" badge={pendingActions.length} onClick={() => setView("actions")} />
          <NavButton active={view === "demo"} icon={<Video size={17} />} label="Demo" onClick={() => setView("demo")} />
          <a href="/movie" target="_blank" rel="noreferrer" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#a7b5ad] transition hover:bg-white/5 hover:text-white"><Clapperboard size={17} /><span>Product film</span><span className="ml-auto rounded-full bg-[#b9f06b]/20 px-2 py-0.5 text-[10px] font-semibold text-[#b9f06b]">NEW</span></a>
        </nav>
        <div className="mt-8 px-2">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6e8277]">Recent meetings</p>
          <div className="space-y-1">
            {meetings.slice(0, 4).map((meeting) => <button key={meeting.id} onClick={() => { setActiveMeetingId(meeting.id); setView("meeting"); }} className="w-full truncate rounded-lg px-2 py-2 text-left text-xs text-[#bdc9c2] transition hover:bg-white/5 hover:text-white">{meeting.title}</button>)}
            {!meetings.length && <p className="px-2 text-xs leading-5 text-[#6e8277]">Your analyzed meetings will appear here.</p>}
          </div>
        </div>
        <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium"><ShieldCheck size={15} className="text-[#b9f06b]" /> Human approval on</div>
          <p className="text-[11px] leading-4 text-[#91a299]">External actions always wait for your review.</p>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dfe4e1] bg-[#f5f6f8]/90 px-5 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-2 text-sm text-[#6d7872]"><span>MeetingOps</span><ChevronRight size={14} /><span className="font-medium text-[#26352d]">{view === "meeting" ? activeMeeting?.title : view === "workspace" ? workspace.name : view === "actions" ? "Action center" : view === "runs" ? "Agent runs" : view === "demo" ? "Demo" : "Overview"}</span></div>
          <div className="flex items-center gap-2"><button onClick={() => setView("demo")} className="icon-button" title="Watch Demo"><Video size={15} /></button><button onClick={() => setShowIntegrations(true)} className="icon-button" title="Integrations"><Cloud size={15} /></button><button onClick={() => setView("runs")} className="icon-button" title="Agent runs"><Activity size={15} /></button><button onClick={() => setView("actions")} className="icon-button" title="Action center"><ShieldCheck size={15} /></button><button onClick={resetDemo} className="icon-button" title="Reset demo"><RotateCcw size={15} /></button><button onClick={() => setShowDemoStudio(true)} className="primary-button !bg-[#172b21]"><Clapperboard size={16} /> Demo studio</button><button onClick={() => setShowTestBench(true)} className="primary-button !bg-[#476252]"><MessageSquareText size={16} /> Paste transcript</button><button onClick={() => setShowIngest(true)} className="primary-button"><Zap size={16} /> Simulate Meet event</button></div>
        </header>
        {view === "dashboard" && <Dashboard meetings={meetings} workspace={workspace} runs={agentRuns} googleConnected={googleConnected} workspaceAgentActive={workspaceAgentActive} pending={pendingActions.length} onNew={() => setShowIngest(true)} onOpen={(id) => { setActiveMeetingId(id); setView("meeting"); }} />}
        {view === "meeting" && activeMeeting && <MeetingView meeting={activeMeeting} onApprove={(m, a) => setActionStatus(m, a, "completed")} onReject={(m, a) => setActionStatus(m, a, "rejected")} onOpenWorkspace={() => setView("workspace")} />}
        {view === "workspace" && <WorkspaceView workspace={workspace} meetings={meetings} />}
        {view === "actions" && <ActionsView meetings={meetings} onApprove={(m, a) => setActionStatus(m, a, "completed")} onReject={(m, a) => setActionStatus(m, a, "rejected")} onOpenWorkspace={() => setView("workspace")} />}
        {view === "runs" && <AgentRunsView runs={agentRuns} />}
        {view === "demo" && <DemoView />}
      </main>
      {showIngest && <IngestModal meetings={meetings} onClose={() => setShowIngest(false)} onSelect={ingestDemo} onWake={simulateWorkspaceWake} />}
      {showIntegrations && <IntegrationsModal onClose={() => setShowIntegrations(false)} />}
      {showDemoStudio && <DemoStudioModal onClose={() => setShowDemoStudio(false)} onPrime={primeShowcase} onReset={resetDemo} />}
      {showTestBench && <TestBenchModal onClose={() => setShowTestBench(false)} onComplete={acceptRun} />}
    </div>
  );
}

function NavButton({ active, icon, label, badge, onClick }: { active: boolean; icon: React.ReactNode; label: string; badge?: number; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-[#b9f06b] font-medium text-[#12231b]" : "text-[#a7b5ad] hover:bg-white/5 hover:text-white"}`}>{icon}<span>{label}</span>{badge ? <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px]">{badge}</span> : null}</button>;
}

function Dashboard({ meetings, workspace, runs, googleConnected, workspaceAgentActive, pending, onNew, onOpen }: { meetings: Meeting[]; workspace: WorkspaceState; runs: AgentRun[]; googleConnected: boolean; workspaceAgentActive: boolean; pending: number; onNew: () => void; onOpen: (id: string) => void }) {
  return <div className="mx-auto max-w-[1320px] px-5 py-8 md:px-8">
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7b60]"><Sparkles size={14} /> Autonomous meeting agent</div><h1 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Your meetings finish. The work begins.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#68756e]">MeetingOps captures Meet audio with its companion extension, transcribes it with Groq Whisper, and prepares the operational follow-through.</p></div><button onClick={onNew} className="primary-button h-11"><Zap size={16} /> Simulate Meet event</button></div>
    <div className="mb-7 rounded-2xl border border-[#b9d59d] bg-[#eef8e4] p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#172b21] text-[#b9f06b]"><Zap size={20} fill="currentColor" /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{workspaceAgentActive ? "Workspace agent is active" : "Workspace agent is ready to install"}</p><span className="tag !bg-[#d9edc3] !text-[#456344]">Groq connected</span><span className={`tag ${googleConnected ? "!bg-[#d9edc3] !text-[#456344]" : "!bg-[#fff5d7] !text-[#796526]"}`}>{googleConnected ? "Google Workspace connected" : "Google OAuth pending"}</span></div><p className="mt-1 text-xs leading-5 text-[#617268]">{workspaceAgentActive ? "Watching all Meet spaces you own → wake on conference start → process transcript → prepare Workspace actions" : "Connect once, then MeetingOps runs in the background across meetings you organize."}</p></div><div className="flex items-center gap-2 text-xs font-medium text-[#5d7464]"><span className={`size-2 rounded-full ${workspaceAgentActive ? "animate-pulse bg-[#6d9c50]" : "bg-[#d2a84e]"}`} /> {workspaceAgentActive ? "Background agent online" : "Installation pending"}</div></div></div>
    <div className="mb-7 grid gap-3 md:grid-cols-3"><StatCard icon={<MessageSquareText />} label="Meetings analyzed" value={meetings.length} detail="Evidence-backed briefs" /><StatCard icon={<Target />} label="Workspace decisions" value={workspace.decisions.length} detail={`${workspace.tasks.length} active tasks`} /><StatCard icon={<ShieldCheck />} label="Awaiting approval" value={pending} detail="Nothing runs silently" accent /></div>
    {!meetings.length ? <div className="grid overflow-hidden rounded-2xl border border-[#dce2de] bg-white md:grid-cols-[1.1fr_.9fr]"><div className="p-7 md:p-10"><div className="mb-6 grid size-12 place-items-center rounded-2xl bg-[#e9f8d5] text-[#345a42]"><WandSparkles size={22} /></div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#789080]">Guided agent demo</p><h2 className="max-w-lg text-2xl font-semibold tracking-[-0.03em]">Watch the agent react to a finished meeting.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#68756e]">Trigger a simulated event or use the Meet audio extension. MeetingOps will autonomously transcribe and process the conversation, then pause only for external-action approval.</p><button onClick={onNew} className="primary-button mt-7"><Zap size={16} /> Trigger first Meet event <ArrowRight size={15} /></button></div><div className="border-t border-[#e2e6e3] bg-[#f1f5f2] p-7 md:border-l md:border-t-0 md:p-9"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#6d7c73]">Agent loop</p><FeatureLine icon={<Cloud />} title="Observe" body="Capture Meet tab audio or receive Workspace events." /><FeatureLine icon={<Search />} title="Reason" body="Extract evidence and reconcile workspace state." /><FeatureLine icon={<ShieldCheck />} title="Act safely" body="Prepare actions, then wait for human approval." /></div></div>
      : <div className="grid gap-6 xl:grid-cols-[1fr_.7fr]"><section><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Recent intelligence</h2><span className="text-xs text-[#7b8780]">{meetings.length} meetings</span></div><div className="grid gap-3">{meetings.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onClick={() => onOpen(meeting.id)} />)}</div></section><section><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Latest agent run</h2><span className="text-xs text-[#7b8780]">{runs[0]?.stage.replace("_", " ")}</span></div>{runs[0] && <RunCard run={runs[0]} />}</section></div>}
  </div>;
}

function StatCard({ icon, label, value, detail, accent }: { icon: React.ReactNode; label: string; value: number; detail: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-5 ${accent ? "border-[#b5d98b] bg-[#ecf8de]" : "border-[#dce2de] bg-white"}`}><div className="mb-5 flex items-start justify-between"><span className="text-sm text-[#68756e]">{label}</span><span className="text-[#52705f] [&>svg]:size-4">{icon}</span></div><div className="text-3xl font-semibold tracking-[-0.04em]">{value}</div><p className="mt-1 text-xs text-[#7b8780]">{detail}</p></div>;
}
function FeatureLine({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <div className="mb-5 flex gap-3"><div className="mt-0.5 text-[#55705f] [&>svg]:size-4">{icon}</div><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-[#718078]">{body}</p></div></div>; }
function MeetingRow({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) { return <button onClick={onClick} className="group flex w-full items-center gap-4 rounded-xl border border-[#dce2de] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b8c7bd] hover:shadow-sm"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf5ef] text-[#4f735d]"><MessageSquareText size={18} /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{meeting.title}</p><span className="tag">{meeting.type}</span></div><p className="mt-1 truncate text-xs text-[#758179]">{meeting.summary}</p></div><div className="hidden text-right sm:block"><p className="text-xs font-medium">{meeting.date}</p><p className="mt-1 text-[11px] text-[#8a958f]">{meeting.changes.length} changes detected</p></div><ChevronRight size={16} className="text-[#8a958f]" /></button>; }

function RunCard({ run }: { run: AgentRun }) {
  const detail = run.reasoningMode === "structured_llm" ? `${run.reasoningProvider ?? "Model"} · ${run.reasoningModel ?? "Structured reasoning"}` : run.eventType ? "Google Workspace background event" : "Deterministic fallback";
  return <div className="rounded-2xl border border-[#dce2de] bg-white p-5"><div className="mb-5 flex items-start justify-between"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-[#172b21] text-[#b9f06b]"><Bot size={17} /></div><div><p className="text-sm font-semibold">{run.meeting?.title ?? "Active Google Meet conference"}</p><p className="mt-1 text-[11px] text-[#7b8780]">{detail}</p></div></div><span className="tag">{run.stage.replace("_", " ")}</span></div><div className="space-y-0">{run.log.map((entry, index) => <div key={`${entry.at}-${index}`} className="grid grid-cols-[18px_1fr] gap-3"><div className="flex flex-col items-center"><span className={`mt-1.5 size-2 rounded-full ${index === run.log.length - 1 ? "bg-[#79a756]" : "bg-[#b9c5bd]"}`} />{index < run.log.length - 1 && <span className="h-full w-px bg-[#e0e6e2]" />}</div><div className="pb-4"><p className="text-xs font-medium capitalize">{entry.stage.replace("_", " ")}</p><p className="mt-1 text-[11px] leading-4 text-[#78847d]">{entry.message}</p></div></div>)}</div></div>;
}

function AgentRunsView({ runs }: { runs: AgentRun[] }) {
  return <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-8"><div className="mb-7"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7b60]"><Activity size={14} /> Agent observability</div><h1 className="text-3xl font-semibold tracking-[-0.04em]">Agent runs</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#68756e]">Inspect how MeetingOps observed, retrieved, reasoned, planned, and stopped at its approval boundary.</p></div>{runs.length ? <div className="grid gap-4 md:grid-cols-2">{runs.map((run) => <RunCard key={run.id} run={run} />)}</div> : <div className="rounded-2xl border border-dashed border-[#cdd6d0] bg-white p-12 text-center"><Bot className="mx-auto mb-3 text-[#65806e]" /><p className="text-sm font-semibold">No agent runs yet</p><p className="mt-2 text-xs text-[#7b8780]">A run appears when Google Meet publishes a transcript-ready event.</p></div>}</div>;
}

const DEMO_SCENES = [
  { title: "A complicated launch meeting begins", caption: "Six people discuss conflicting deadlines, technical risk, customer commitments, ownership, and a conditional launch decision." },
  { title: "MeetingOps captures the source of truth", caption: "The official transcript or Meet-bot produces speaker-attributed turns that remain available for audit." },
  { title: "The agent reasons over evidence", caption: "Every extracted decision, task, risk, and SPICED field is grounded in a source quote instead of invented." },
  { title: "A complete operational brief appears", caption: "The agent converts the conversation into decisions, owners, due dates, risks, closure gaps, and follow-up." },
  { title: "External actions stop for approval", caption: "MeetingOps shows the exact side effects before invoking Drive, Gmail, or workspace-memory executors." },
  { title: "The approved brief is saved to Drive", caption: "The agent creates the routed folder and writes a durable evidence-backed meeting packet." },
  { title: "An attendee follow-up waits in Gmail Drafts", caption: "The draft contains decisions, owners, deadlines, unresolved risks, and the next review date, but is never auto-sent." },
  { title: "Memory changes what happens next", caption: "Approved state updates the workspace brain, detects changes across meetings, and prepares the next agenda." },
] as const;

function DemoView() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setScene((current) => current === DEMO_SCENES.length - 1 ? 0 : current + 1), 8500);
    return () => window.clearInterval(timer);
  }, [playing]);
  const current = DEMO_SCENES[scene];
  return <div className="min-h-[calc(100vh-4rem)] bg-[#0f1b15] px-4 py-5 text-white md:px-8 md:py-8"><div className="mx-auto max-w-[1380px]"><div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b9f06b]"><Video size={14} /> Founder technical walkthrough</div><h1 className="text-2xl font-semibold md:text-3xl">A real meeting, traced through every agent step</h1><p className="mt-2 max-w-4xl text-sm text-[#a8b7ae]">{current.caption}</p></div><div className="flex items-center gap-2"><button onClick={() => setPlaying((value) => !value)} className="icon-button !border-white/15 !bg-white/10 !text-white" title={playing ? "Pause demo" : "Play demo"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button><button onClick={() => setScene((scene + 1) % DEMO_SCENES.length)} className="icon-button !border-white/15 !bg-white/10 !text-white" title="Next scene"><SkipForward size={15} /></button></div></div><div className="relative aspect-video min-h-[560px] overflow-hidden rounded-2xl border border-white/10 bg-[#f4f6f4] text-[#17211b] shadow-2xl"><div key={scene} className="h-full animate-[demo-enter_.45s_ease-out]">{scene === 0 && <DemoMeetingScene />}{scene === 1 && <DemoTranscriptScene />}{scene === 2 && <DemoReasoningScene />}{scene === 3 && <DemoBriefScene />}{scene === 4 && <DemoApprovalScene />}{scene === 5 && <DemoDriveScene />}{scene === 6 && <DemoGmailScene />}{scene === 7 && <DemoMemoryScene />}</div><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0d1712]/95 via-[#0d1712]/75 to-transparent px-6 pb-6 pt-16 text-white"><div className="flex items-end justify-between gap-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b9f06b]">Step {scene + 1} of {DEMO_SCENES.length} · actual workflow reproduction</p><h2 className="mt-1 text-xl font-semibold md:text-2xl">{current.title}</h2></div><div className="hidden gap-1 md:flex">{DEMO_SCENES.map((item, index) => <button key={item.title} onClick={() => setScene(index)} className={`h-1.5 rounded-full transition-all ${index === scene ? "w-10 bg-[#b9f06b]" : "w-5 bg-white/35 hover:bg-white/60"}`} title={item.title} />)}</div></div></div></div></div></div>;
}

function DemoMeetingScene() {
  return <div className="h-full bg-[#202923] p-6"><div className="mb-5 flex items-center justify-between text-white"><div><p className="text-sm font-semibold">CampusConnect launch readiness</p><p className="mt-1 text-xs text-white/55">Google Meet · 6 participants · official transcript + Meet-bot fallback</p></div><span className="flex items-center gap-2 rounded-full bg-[#d45b55] px-3 py-1.5 text-xs font-semibold"><span className="size-2 animate-pulse rounded-full bg-white" /> Live</span></div><div className="grid h-[calc(100%-64px)] grid-cols-3 gap-3"><DemoParticipant initials="HY" name="Harshil" color="#315f4b" line="We launch June 18 only if Android notifications pass and we have 15 testers." /><DemoParticipant initials="MK" name="Maya" color="#825f42" line="Push is still late for 30% of Android tests. I need until June 15." /><DemoParticipant initials="AP" name="Avery" color="#6d4f82" line="If we disable Android push, onboarding copy needs a known-issues note." /><DemoParticipant initials="RL" name="Rahul" color="#4e5f82" line="Analytics event tracking is done, but I need QA on saved-event funnels." /><DemoParticipant initials="NS" name="Nia" color="#7a7046" line="Eight testers are confirmed. I can recruit from student orgs tomorrow." /><div className="relative grid place-items-center rounded-xl border border-[#b9f06b]/50 bg-[#14221b] text-white"><div className="grid size-20 place-items-center rounded-full bg-[#b9f06b] text-[#172b21]"><Bot size={34} /></div><div className="absolute bottom-4 left-4"><p className="text-xs font-semibold">MeetingOps AI Agent</p><p className="mt-1 text-[10px] text-[#b9f06b]">Listening · captions · transcript audit trail</p></div></div></div></div>;
}
function DemoParticipant({ initials, name, color, line }: { initials: string; name: string; color: string; line: string }) { return <div className="relative grid place-items-center rounded-xl bg-[#303b34] text-white"><div className="grid size-20 place-items-center rounded-full text-xl font-semibold" style={{ background: color }}>{initials}</div><div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/45 p-2 backdrop-blur"><p className="text-[10px] font-semibold">{name}</p><p className="mt-1 text-[10px] leading-4 text-white/70">{line}</p></div></div>; }
function DemoTranscriptScene() { return <div className="h-full bg-[#f5f6f8] p-7"><div className="mb-4 flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4f7b60]">Transcript source of truth</p><h2 className="mt-2 text-xl font-semibold">Speaker turns preserved before analysis</h2><p className="mt-1 text-xs text-[#68756e]">The brief can always be audited back to the exact conversation.</p></div><span className="tag">14 turns captured</span></div><div className="grid grid-cols-[1fr_.8fr] gap-4"><div className="space-y-2">{[
    ["Harshil", "We keep June 18 only if Android notifications pass and tester count reaches 15 by June 14."],
    ["Maya", "Thirty percent of Android pushes arrive late. I will disable push for beta and retest by June 15."],
    ["Avery", "Known-issues copy needs to explain Android push is intentionally off, not broken."],
    ["Rahul", "Analytics events are shipping today, but saved-event funnels need QA before beta."],
    ["Nia", "I have eight confirmed testers and can recruit student orgs tomorrow."],
    ["Harshil", "Decision: June 18 target, June 25 fallback if fewer than 15 testers or Android QA fails."],
  ].map(([speaker, text]) => <div key={`${speaker}-${text}`} className="grid grid-cols-[86px_1fr] gap-3 rounded-xl border border-[#e0e6e2] bg-white p-3"><p className="text-xs font-semibold text-[#3f6250]">{speaker}</p><p className="text-xs leading-5 text-[#536159]">{text}</p></div>)}</div><div className="rounded-xl border border-[#dce2de] bg-white p-4"><p className="mb-3 text-xs font-semibold">Capture paths</p><DemoTraceLine title="Official transcript" body="Workspace Events -> Pub/Sub -> Meet REST entries" complete /><DemoTraceLine title="Meet-bot fallback" body="Visible bot joins, captions on, transcript posted" complete /><DemoTraceLine title="Normalizer" body="Merges duplicate captions and repairs raw audio chunks" complete /><DemoTraceLine title="Deduplication" body="Conference record prevents repeated agent runs" complete /></div></div></div>; }
function DemoReasoningScene() { return <div className="h-full bg-[#f5f6f8] p-7"><div className="mb-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4f7b60]">Evidence-grounded reasoning</p><h2 className="mt-2 text-xl font-semibold">The model extracts facts, then MeetingOps validates the structure</h2></div><div className="grid grid-cols-3 gap-3">{[
    { title: "Decision", value: "June 18 target with June 25 fallback", evidence: "Decision: June 18 target, June 25 fallback...", confidence: "98%" },
    { title: "Task", value: "Maya retests Android notifications", evidence: "I will disable push for beta and retest by June 15.", confidence: "96%" },
    { title: "Risk", value: "Tester recruitment may miss threshold", evidence: "I have eight confirmed testers...", confidence: "94%" },
    { title: "Owner", value: "Nia owns student-org recruitment", evidence: "I can recruit student orgs tomorrow.", confidence: "92%" },
    { title: "SPICED pain", value: "Late Android push threatens engagement", evidence: "Thirty percent of Android pushes arrive late.", confidence: "95%" },
    { title: "Closure gap", value: "QA owner for analytics funnel unresolved", evidence: "Saved-event funnels need QA before beta.", confidence: "88%" },
  ].map((item) => <div key={item.title} className="rounded-xl border border-[#dce2de] bg-white p-4"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#66806f]">{item.title}</span><span className="tag">{item.confidence}</span></div><p className="text-sm font-semibold leading-5">{item.value}</p><p className="mt-3 border-l-2 border-[#c9dfb1] pl-3 text-[10px] italic leading-4 text-[#77837c]">&ldquo;{item.evidence}&rdquo;</p></div>)}</div></div>; }
function DemoBriefScene() { return <div className="h-full bg-[#f5f6f8] p-7"><div className="mb-5 flex items-start justify-between"><div><div className="flex gap-2"><span className="tag">Product launch</span><span className="tag">6 attendees</span><span className="tag">LLM reasoned</span></div><h2 className="mt-3 text-xl font-semibold">CampusConnect Beta Launch Review</h2><p className="mt-2 max-w-3xl text-xs leading-5 text-[#68756e]">The team kept the June 18 beta target, disabled Android push for beta, set June 25 as fallback, and tied the final launch call to Android QA plus tester recruitment.</p></div><div className="rounded-xl border border-[#cdddbc] bg-[#f2f8eb] p-4 text-right"><p className="text-[10px] text-[#68756e]">Meeting closure</p><p className="text-2xl font-semibold">78%</p><p className="mt-1 text-[10px] text-[#7a867f]">2 gaps flagged</p></div></div><div className="grid grid-cols-[1.1fr_.9fr] gap-4"><div className="space-y-3"><DemoPanel title="Key decisions" lines={["June 18 remains target; June 25 is fallback", "Android push disabled for beta until reliable", "Launch review happens June 16 with tester count + QA"]} /><DemoPanel title="Action items" lines={["Maya · Android notification retest · June 15", "Nia · Recruit student-org testers · June 14", "Rahul · QA saved-event analytics funnels · owner needed"]} /></div><div className="space-y-3"><DemoPanel title="Risks" lines={["Only 8 testers confirmed against 15-person threshold", "Android push lateness could hurt engagement", "Analytics QA has deadline but unclear assignee"]} /><DemoPanel title="SPICED lens" lines={["Situation · Beta launch readiness for Northeastern students", "Pain · Reliability and recruitment blockers", "Decision · Target date holds with explicit fallback criteria"]} /></div></div></div>; }
function DemoPanel({ title, lines }: { title: string; lines: string[] }) { return <div className="rounded-xl border border-[#dce2de] bg-white p-4"><p className="mb-2 text-xs font-semibold">{title}</p>{lines.map((line) => <p key={line} className="border-b border-[#edf0ee] py-2 text-[10px] leading-4 text-[#64736b] last:border-0">{line}</p>)}</div>; }
function DemoApprovalScene() { return <div className="h-full bg-[#f5f6f8] p-8"><div className="mb-6"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4f7b60]">Human approval boundary</p><h2 className="mt-2 text-xl font-semibold">MeetingOps prepares side effects, then stops</h2></div><div className="grid grid-cols-[1fr_1fr_1fr] gap-4">{[{ icon: <Cloud />, title: "Save meeting brief to Drive", payload: "folder: MeetingOps/Product/CampusConnect\nfile: 2026-06-07 Launch Readiness.md" }, { icon: <Mail />, title: "Create attendee follow-up draft", payload: "to: attendees\nsubject: CampusConnect beta launch decisions\nsend: false" }, { icon: <Target />, title: "Update workspace memory", payload: "decisions: 3\ntasks: 4\nrisks: 3\nnext agenda: 5" }].map((item) => <div key={item.title} className="rounded-xl border border-[#dce2de] bg-white p-5"><div className="mb-4 flex items-start justify-between"><div className="grid size-10 place-items-center rounded-xl bg-[#edf5ef] text-[#4f735d] [&>svg]:size-4">{item.icon}</div><span className="tag !bg-[#fff9e7] !text-[#7a6126]">needs approval</span></div><p className="text-sm font-semibold">{item.title}</p><pre className="mt-4 whitespace-pre-wrap rounded-lg bg-[#f6f8f6] p-3 font-mono text-[10px] leading-4 text-[#59675f]">{item.payload}</pre><button className="primary-button mt-4 w-full justify-center !py-2 text-xs"><Check size={13} /> Approve</button></div>)}</div><div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#6f7d75]"><ShieldCheck size={15} /> The agent has autonomy until external side effects; then control returns to the human.</div></div>; }
function DemoDriveScene() { return <div className="h-full bg-[#edf2f7] p-7"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3f5e8a]">Google Drive result</p><h2 className="mt-2 text-xl font-semibold">Evidence-backed brief saved in the right folder</h2></div><span className="tag !bg-white">Open result</span></div><div className="grid grid-cols-[260px_1fr] gap-4"><div className="rounded-xl bg-white p-4 shadow-sm"><p className="mb-3 text-xs font-semibold">Drive folders</p>{["MeetingOps", "Product", "CampusConnect", "2026-06-07 Launch Readiness"].map((folder, index) => <div key={folder} className={`mb-2 rounded-lg px-3 py-2 text-xs ${index === 3 ? "bg-[#e8f0fe] font-semibold text-[#2559a7]" : "bg-[#f6f8fa] text-[#5f6b74]"}`}>/{folder}</div>)}</div><div className="rounded-xl bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3 border-b border-[#e6ebf0] pb-3"><FolderOpen size={18} className="text-[#3f5e8a]" /><div><p className="text-sm font-semibold">CampusConnect Beta Launch Review.md</p><p className="text-[10px] text-[#6d7882]">Created by MeetingOps · routed with 92% confidence</p></div></div><div className="grid grid-cols-2 gap-3 text-[10px] leading-4 text-[#4f5d66]"><DemoDocBlock title="Summary" body="June 18 target remains, with June 25 fallback if tester threshold or Android QA misses." /><DemoDocBlock title="Decisions" body="Disable Android push for beta. Review launch on June 16. Require 15 confirmed testers." /><DemoDocBlock title="Tasks" body="Maya: Android retest. Nia: student-org recruiting. Rahul: analytics QA. Avery: known-issues copy." /><DemoDocBlock title="Evidence" body="Every decision includes transcript speaker + quote for auditability." /></div></div></div></div>; }
function DemoDocBlock({ title, body }: { title: string; body: string }) { return <div className="rounded-lg border border-[#e6ebf0] bg-[#fbfcfd] p-3"><p className="mb-1 text-[10px] font-semibold text-[#2f4f70]">{title}</p><p>{body}</p></div>; }
function DemoGmailScene() { return <div className="h-full bg-[#f5f6f8] p-7"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ad493e]">Gmail draft result</p><h2 className="mt-2 text-xl font-semibold">Follow-up email prepared, not sent</h2></div><span className="tag !bg-[#fff0ee] !text-[#ad493e]">Drafts</span></div><div className="mx-auto max-w-4xl rounded-2xl border border-[#e1d6d3] bg-white shadow-sm"><div className="border-b border-[#eee5e2] p-4"><p className="text-xs text-[#746864]">To: Harshil, Maya, Avery, Rahul, Nia, Jordan</p><p className="mt-2 text-sm font-semibold">CampusConnect beta launch recap: June 18 target, owners, and fallback criteria</p></div><div className="p-5 text-xs leading-6 text-[#4f5d55]"><p>Hi team,</p><p className="mt-3">MeetingOps captured today&apos;s launch-readiness decisions and prepared this draft for review.</p><ul className="mt-3 list-disc space-y-1 pl-5"><li><strong>Decision:</strong> June 18 remains the target; June 25 is fallback if Android QA or tester count misses.</li><li><strong>Maya:</strong> disable Android push for beta and retest reliability by June 15.</li><li><strong>Nia:</strong> recruit student orgs and reach 15 confirmed testers by June 14.</li><li><strong>Rahul:</strong> finish QA on saved-event analytics funnels before readiness review.</li><li><strong>Open risk:</strong> known-issues copy must make disabled push feel intentional.</li></ul><p className="mt-3">Next review: June 16.</p><p className="mt-3 text-[#8a6a25]">Draft only. MeetingOps never sends automatically.</p></div></div></div>; }
function DemoMemoryScene() { return <div className="h-full bg-[#f5f6f8] p-7"><div className="mb-5"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4f7b60]">Workspace brain + next meeting</p><h2 className="mt-2 text-xl font-semibold">The next conversation starts from remembered state</h2></div><div className="grid grid-cols-3 gap-4"><DemoChange label="Launch date" before="June 18 tentative" after="June 18 target · June 25 fallback" /><DemoChange label="Android push" before="Unclear blocker" after="Disabled for beta; retest June 15" /><DemoChange label="Tester risk" before="8 confirmed" after="Needs 15 by June 14" /></div><div className="mt-5 grid grid-cols-[1fr_1fr] gap-4"><DemoPanel title="Workspace memory now stores" lines={["3 decisions with evidence", "4 tasks with owners and dates", "3 active risks", "Meeting timeline with Drive/Gmail destinations"]} /><DemoPanel title="Next meeting agenda" lines={["Confirm tester count >= 15", "Review Android notification QA", "Approve known-issues copy", "Make final June 18 vs June 25 call"]} /></div></div>; }
function DemoChange({ label, before, after }: { label: string; before: string; after: string }) { return <div className="rounded-xl border border-[#dce2de] bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#66806f]">{label}</p><div className="mt-4 flex items-center gap-3"><span className="flex-1 rounded-lg bg-[#f4f5f4] p-3 text-xs text-[#6c7771]">{before}</span><ArrowRight size={14} className="text-[#75837a]" /><span className="flex-1 rounded-lg bg-[#ecf8de] p-3 text-xs font-semibold text-[#334d38]">{after}</span></div></div>; }
function DemoTraceLine({ title, body, complete }: { title: string; body: string; complete: boolean }) { return <div className="mb-4 grid grid-cols-[26px_1fr] gap-3 last:mb-0"><div className={`grid size-6 place-items-center rounded-full ${complete ? "bg-[#172b21] text-[#b9f06b]" : "bg-[#eef3ef] text-[#66736b]"}`}>{complete ? <Check size={13} /> : <Clock3 size={13} />}</div><div><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-[10px] leading-4 text-[#748078]">{body}</p></div></div>; }

function MeetingView({ meeting, onApprove, onReject, onOpenWorkspace }: { meeting: Meeting; onApprove: (m: string, a: string) => Promise<boolean>; onReject: (m: string, a: string) => Promise<boolean>; onOpenWorkspace: () => void }) {
  const [tab, setTab] = useState<"brief" | "changes" | "evidence" | "transcript">("brief");
  const memoryApplied = meeting.actions.find((action) => action.type === "memory_update")?.status === "completed";
  return <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-8">
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><div className="mb-3 flex flex-wrap items-center gap-2"><span className="tag">{meeting.type}</span><span className="tag"><CalendarDays size={11} /> {meeting.date}</span><span className="tag"><Users size={11} /> {meeting.participants.length} attendees</span><span className="tag"><Bot size={11} /> {meeting.reasoningMode === "structured_llm" ? "LLM reasoned" : "Fallback reasoned"}</span></div><h1 className="text-2xl font-semibold tracking-[-0.035em] md:text-3xl">{meeting.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#65736b]">{meeting.summary}</p></div><div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${memoryApplied ? "border-[#b7d69a] bg-[#edf8e2] text-[#42633f]" : "border-[#e3d6a5] bg-[#fff9e7] text-[#785f24]"}`}><CircleAlert size={14} />{memoryApplied ? "Workspace memory updated" : "Memory update awaiting approval"}</div></div>
    <div className="mb-5 flex gap-1 rounded-xl border border-[#dce2de] bg-white p-1">{(["brief", "changes", "evidence", "transcript"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-xs font-medium capitalize transition ${tab === item ? "bg-[#172b21] text-white" : "text-[#69766f] hover:bg-[#f1f4f2]"}`}>{item === "changes" ? `What changed (${meeting.changes.length})` : item === "transcript" ? `Full transcript (${meeting.transcript.length})` : item}</button>)}</div>
    {tab === "brief" && <Brief meeting={meeting} />}{tab === "changes" && <Changes changes={meeting.changes} />}{tab === "evidence" && <Evidence meeting={meeting} />}{tab === "transcript" && <Transcript meeting={meeting} />}
    <div className="mt-7"><SectionTitle eyebrow="Human in the loop" title="Proposed actions" subtitle="Review what MeetingOps prepared. Completed actions show exactly where their output went." /><div className="grid gap-3 lg:grid-cols-3">{meeting.actions.map((action) => <ActionCard key={action.id} action={action} meetingId={meeting.id} onApprove={onApprove} onReject={onReject} onOpenWorkspace={onOpenWorkspace} />)}</div></div>
    <div className="mt-7 rounded-2xl border border-[#dce2de] bg-white p-5"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-[#edf5ef] text-[#4f735d]"><FolderOpen size={17} /></div><div className="flex-1"><p className="text-xs text-[#76837c]">Suggested Drive destination</p><p className="mt-1 text-sm font-medium">{meeting.folderPath}</p></div><span className="tag">{meeting.folderConfidence}% match</span></div></div>
  </div>;
}

function Brief({ meeting }: { meeting: Meeting }) { return <div className="space-y-5"><NextMeetingAgenda meeting={meeting} /><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="space-y-5"><Panel title="Key decisions" icon={<Check />}>{meeting.decisions.map((item) => <EvidenceItem key={item.text} item={item} />)}</Panel><Panel title="Action items" icon={<Target />}>{meeting.tasks.map((task) => <div key={task.id} className="flex items-start gap-3 border-b border-[#edf0ee] py-3 last:border-0"><span className={`mt-1 size-2 rounded-full ${task.status === "done" ? "bg-[#78a15c]" : "bg-[#e0a741]"}`} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{task.text}</p><p className="mt-1 text-xs text-[#7a867f]">{task.owner} · Due {task.dueDate}</p></div><span className="tag">{task.status}</span></div>)}</Panel></div><div className="space-y-5"><ClosureScore meeting={meeting} /><Panel title="SPICED lens" icon={<Sparkles />}>{Object.entries(meeting.spiced).map(([key, value]) => <div key={key} className="border-b border-[#edf0ee] py-3 last:border-0"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#779080]">{key.replace("_", " ")}</p><p className="mt-1 text-xs leading-5 text-[#56645c]">{value}</p></div>)}</Panel><Panel title="Risks & open questions" icon={<CircleAlert />}>{meeting.risks.map((item) => <EvidenceItem key={item.text} item={item} />)}</Panel></div></div></div>; }
function NextMeetingAgenda({ meeting }: { meeting: Meeting }) {
  const openTasks = meeting.tasks.filter((task) => task.status === "open");
  const items = [
    ...openTasks.slice(0, 3).map((task) => ({ label: `Confirm ${task.owner || "owner"}'s progress`, detail: `${task.text} · due ${task.dueDate}` })),
    ...meeting.risks.slice(0, 2).map((risk) => ({ label: "Resolve or mitigate risk", detail: risk.text })),
    ...(meeting.closureScore?.gaps ?? []).slice(0, 2).map((gap) => ({ label: "Close meeting-quality gap", detail: gap })),
  ].slice(0, 5);
  if (!items.length) items.push({ label: "Confirm outcomes and next milestone", detail: "Review whether the decisions and completed actions produced the expected result." });
  return <section className="overflow-hidden rounded-2xl border border-[#b9d59d] bg-[#eef8e4]"><div className="flex flex-col gap-4 border-b border-[#d2e4c2] p-5 md:flex-row md:items-center md:justify-between"><div><div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#58765f]"><CalendarDays size={13} /> Proactive follow-through</div><h2 className="text-base font-semibold">Next meeting agenda</h2><p className="mt-1 text-xs leading-5 text-[#65766b]">Generated from unresolved work, risks, and closure gaps in this meeting.</p></div><span className="tag !bg-white !text-[#486351]">{items.length} agenda items</span></div><div className="grid gap-px bg-[#dce8d4] md:grid-cols-2">{items.map((item, index) => <div key={`${item.label}-${index}`} className="bg-[#f8fcf5] p-4"><div className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#dcedcc] text-[11px] font-semibold text-[#46604d]">{index + 1}</span><div><p className="text-xs font-semibold">{item.label}</p><p className="mt-1 text-[11px] leading-5 text-[#69786f]">{item.detail}</p></div></div></div>)}</div></section>;
}
function ClosureScore({ meeting }: { meeting: Meeting }) { const score = meeting.closureScore ?? { score: 0, gaps: [] }; return <section className="rounded-2xl border border-[#cdddbc] bg-[#f2f8eb] p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Gauge size={16} className="text-[#557260]" />Meeting closure score</div><span className="text-2xl font-semibold tracking-[-0.04em]">{score.score}%</span></div><div className="mb-4 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#78a15c]" style={{ width: `${score.score}%` }} /></div>{score.gaps.length ? score.gaps.map((gap) => <p key={gap} className="mt-2 flex gap-2 text-xs leading-5 text-[#68766e]"><CircleAlert size={13} className="mt-0.5 shrink-0 text-[#9a7b31]" />{gap}</p>) : <p className="text-xs text-[#617268]">Owners, dates, decisions, and mitigations are clear.</p>}</section>; }
function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#dce2de] bg-white p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><span className="text-[#557260] [&>svg]:size-4">{icon}</span>{title}</div>{children}</section>; }
function EvidenceItem({ item }: { item: { text: string; evidence: string; speaker: string } }) { return <div className="border-b border-[#edf0ee] py-3 last:border-0"><p className="text-sm font-medium leading-5">{item.text}</p><p className="mt-2 border-l-2 border-[#c9dfb1] pl-3 text-xs italic leading-5 text-[#77837c]">“{item.evidence}” — {item.speaker}</p></div>; }

function Changes({ changes }: { changes: Meeting["changes"] }) {
  if (!changes.length) return <div className="rounded-2xl border border-dashed border-[#cdd6d0] bg-white p-12 text-center"><div className="mx-auto mb-4 grid size-11 place-items-center rounded-2xl bg-[#eef4ef] text-[#607a68]"><Zap size={20} /></div><h3 className="text-sm font-semibold">Baseline established</h3><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[#748179]">Approve this meeting&apos;s memory update, then analyze the follow-up to see changes.</p></div>;
  return <div className="grid gap-3 md:grid-cols-2">{changes.map((change) => <div key={change.field} className="rounded-2xl border border-[#dce2de] bg-white p-5"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.13em] text-[#66806f]">{change.label}</span><span className="tag">{change.confidence}% confident</span></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="rounded-lg bg-[#f4f5f4] p-3"><p className="mb-1 text-[10px] uppercase tracking-wider text-[#8b958f]">Before</p><p className="text-xs font-medium text-[#6c7771]">{change.before}</p></div><ArrowRight size={14} className="text-[#75837a]" /><div className="rounded-lg bg-[#ecf8de] p-3"><p className="mb-1 text-[10px] uppercase tracking-wider text-[#6f886e]">After</p><p className="text-xs font-semibold text-[#334d38]">{change.after}</p></div></div><p className="mt-4 border-l-2 border-[#c9dfb1] pl-3 text-xs italic leading-5 text-[#77837c]">“{change.evidence}”</p></div>)}</div>;
}
function Evidence({ meeting }: { meeting: Meeting }) { return <div className="rounded-2xl border border-[#dce2de] bg-white p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Transcript evidence</h2><p className="mt-1 text-xs text-[#78847d]">Source lines used by the structured analysis.</p></div><span className="tag"><ShieldCheck size={11} /> Grounded</span></div><div className="space-y-3">{meeting.transcript.map((line, index) => <div key={index} className="grid gap-1 rounded-xl bg-[#f7f8f7] p-3 md:grid-cols-[120px_1fr]"><p className="text-xs font-semibold text-[#4d6656]">{line.speaker}</p><p className="text-xs leading-5 text-[#5e6b64]">{line.text}</p></div>)}</div></div>; }

function Transcript({ meeting }: { meeting: Meeting }) {
  return <div className="rounded-2xl border border-[#dce2de] bg-white p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Full meeting transcript</h2><p className="mt-1 text-xs text-[#78847d]">{meeting.transcript.length} captured turns · preserved as the source of truth for this brief.</p></div><span className="tag"><MessageSquareText size={11} /> Source</span></div><div className="space-y-2">{meeting.transcript.map((line, index) => <div key={index} className="grid gap-1 rounded-xl border border-[#edf0ee] bg-[#fafbfa] p-3 md:grid-cols-[140px_1fr]"><p className="text-xs font-semibold text-[#3f6250]">{line.speaker}</p><p className="text-xs leading-5 text-[#536159]">{line.text}</p></div>)}</div></div>;
}

function ActionCard({ action, meetingId, onApprove, onReject, onOpenWorkspace }: { action: Meeting["actions"][number]; meetingId: string; onApprove: (m: string, a: string) => Promise<boolean>; onReject: (m: string, a: string) => Promise<boolean>; onOpenWorkspace: () => void }) {
  const icon = action.type === "drive_save" ? <Cloud /> : action.type === "gmail_draft" ? <Mail /> : <Target />;
  const [message, setMessage] = useState("");
  async function approve() { setMessage("Executing..."); setMessage(await onApprove(meetingId, action.id) ? "" : "Execution failed. Check Google permissions and try again."); }
  const outputLink = action.result?.webViewLink ?? action.result?.webUrl;
  const destination = action.type === "drive_save" ? "Saved in Google Drive → MeetingOps folder" : action.type === "gmail_draft" ? "Created in Gmail → Drafts" : "Applied to MeetingOps → Workspace brain";
  return <div className="rounded-2xl border border-[#dce2de] bg-white p-5"><div className="mb-4 flex items-start justify-between"><div className="grid size-9 place-items-center rounded-xl bg-[#edf5ef] text-[#4f735d] [&>svg]:size-4">{icon}</div><span className="tag">{action.status.replace("_", " ")}</span></div><h3 className="text-sm font-semibold">{action.title}</h3><p className="mt-2 min-h-10 text-xs leading-5 text-[#748078]">{action.description}</p>{action.status === "needs_approval" ? <div className="mt-5 flex gap-2"><button onClick={approve} className="primary-button flex-1 justify-center !py-2 text-xs"><Check size={14} /> Approve</button><button onClick={() => onReject(meetingId, action.id)} className="icon-button"><X size={14} /></button></div> : <div className="mt-5"><div className="flex items-center gap-2 text-xs font-medium text-[#64766a]"><Check size={14} /> Action {action.status}</div>{action.status === "completed" && <div className="mt-3 rounded-lg bg-[#f1f6f2] p-3"><p className="text-[11px] leading-4 text-[#596b60]">{destination}</p>{outputLink ? <a href={outputLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#355f45]">Open result <ArrowRight size={11} /></a> : action.type === "memory_update" ? <button onClick={onOpenWorkspace} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#355f45]">Open Workspace brain <ArrowRight size={11} /></button> : action.type === "gmail_draft" ? <a href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#355f45]">Open Gmail Drafts <ArrowRight size={11} /></a> : null}</div>}</div>}{message && <p className="mt-3 text-[11px] leading-4 text-[#8a5e52]">{message}</p>}</div>;
}

function WorkspaceView({ workspace, meetings }: { workspace: WorkspaceState; meetings: Meeting[] }) {
  const latest = meetings[0]; const changes = latest ? generateChanges(INITIAL_WORKSPACE, workspace, latest) : [];
  return <div className="mx-auto max-w-[1320px] px-5 py-8 md:px-8"><div className="mb-7"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7b60]"><Target size={14} /> Workspace brain</div><h1 className="text-3xl font-semibold tracking-[-0.04em]">{workspace.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#68756e]">A living operational memory built from approved meeting evidence.</p></div><div className="mb-6 grid gap-3 md:grid-cols-4"><MiniStat label="Decisions" value={workspace.decisions.length} /><MiniStat label="Tasks" value={workspace.tasks.length} /><MiniStat label="Risks" value={workspace.risks.length} /><MiniStat label="Meetings" value={workspace.meetingIds.length} /></div><div className="grid gap-5 xl:grid-cols-[1fr_.8fr]"><div className="space-y-5"><Panel title="Current decisions" icon={<Check />}>{workspace.decisions.length ? workspace.decisions.map((item) => <EvidenceItem key={item.text} item={item} />) : <EmptyLine text="Approve a workspace memory update to establish decisions." />}</Panel><Panel title="Active tasks" icon={<Target />}>{workspace.tasks.length ? workspace.tasks.map((task) => <div key={task.id} className="border-b border-[#edf0ee] py-3 last:border-0"><p className="text-sm font-medium">{task.text}</p><p className="mt-1 text-xs text-[#7a867f]">{task.owner} · {task.dueDate} · {task.status}</p></div>) : <EmptyLine text="No approved tasks yet." />}</Panel></div><div className="space-y-5"><Panel title="Current risks" icon={<CircleAlert />}>{workspace.risks.length ? workspace.risks.map((item) => <EvidenceItem key={item.text} item={item} />) : <EmptyLine text="No approved risks yet." />}</Panel><Panel title="Workspace timeline" icon={<Clock3 />}>{meetings.slice().reverse().map((meeting) => <div key={meeting.id} className="border-b border-[#edf0ee] py-3 last:border-0"><p className="text-sm font-medium">{meeting.title}</p><p className="mt-1 text-xs text-[#7a867f]">{meeting.date} · {meeting.changes.length} changes surfaced</p></div>)}</Panel></div></div>{changes.length > 0 && <div className="mt-7"><SectionTitle eyebrow="Workspace evolution" title="Approved state changes" subtitle="The current workspace state compared with its original baseline." /><Changes changes={changes} /></div>}</div>;
}
function MiniStat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-[#dce2de] bg-white p-4"><p className="text-xs text-[#7b8780]">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{value}</p></div>; }
function EmptyLine({ text }: { text: string }) { return <p className="py-6 text-center text-xs text-[#87928c]">{text}</p>; }
function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div className="mb-4"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64806e]">{eyebrow}</p><h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2><p className="mt-1 text-xs text-[#78847d]">{subtitle}</p></div>; }
function ActionsView({ meetings, onApprove, onReject, onOpenWorkspace }: { meetings: Meeting[]; onApprove: (m: string, a: string) => Promise<boolean>; onReject: (m: string, a: string) => Promise<boolean>; onOpenWorkspace: () => void }) { const all = meetings.flatMap((meeting) => meeting.actions.map((action) => ({ action, meeting }))); return <div className="mx-auto max-w-[1320px] px-5 py-8 md:px-8"><div className="mb-7"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7b60]"><ShieldCheck size={14} /> Controlled execution</div><h1 className="text-3xl font-semibold tracking-[-0.04em]">Action center</h1><p className="mt-2 text-sm text-[#68756e]">Review, approve, or reject every external side effect. Completed actions show their destination.</p></div>{all.length ? <div className="grid gap-3 lg:grid-cols-3">{all.map(({ action, meeting }) => <ActionCard key={`${meeting.id}-${action.id}`} action={action} meetingId={meeting.id} onApprove={onApprove} onReject={onReject} onOpenWorkspace={onOpenWorkspace} />)}</div> : <EmptyLine text="Analyze a meeting to populate the approval queue." />}</div>; }

function IngestModal({ meetings, onClose, onSelect, onWake }: { meetings: Meeting[]; onClose: () => void; onSelect: (index: number) => void; onWake: () => void }) {
  const next = meetings.some((meeting) => meeting.id === "roadmap-1") ? 1 : 0;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0d1712]/60 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-white p-6 shadow-2xl md:p-7"><div className="mb-6 flex items-start justify-between"><div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5f806b]">Google Meet event simulator</p><h2 className="text-xl font-semibold tracking-[-0.03em]">Observe the background agent lifecycle</h2><p className="mt-2 text-xs leading-5 text-[#77837c]">Simulate the Workspace events that wake MeetingOps and later deliver the final transcript.</p></div><button onClick={onClose} className="icon-button"><X size={15} /></button></div><button onClick={onWake} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-[#9fbd79] bg-[#f0f8e6] p-4 text-left"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#587461]"><Activity size={16} /></div><div className="flex-1"><p className="text-sm font-semibold">Simulate conference started</p><p className="mt-1 text-xs text-[#66736b]">Show MeetingOps waking automatically when an owned Google Meet begins.</p></div><ChevronRight size={16} /></button><div className="space-y-3">{DEMO_MEETINGS.map((meeting, index) => { const done = meetings.some((item) => item.id === meeting.id); return <button key={meeting.id} onClick={() => onSelect(index)} className={`group w-full rounded-xl border p-4 text-left transition ${index === next ? "border-[#9fbd79] bg-[#f0f8e6]" : "border-[#dde3df] bg-[#f9faf9]"}`}><div className="flex items-start gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#587461]"><Zap size={16} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{meeting.title}</p>{index === next && <span className="tag">Recommended next</span>}{done && <span className="tag"><Check size={10} /> processed</span>}</div><p className="mt-1 text-xs text-[#7b8780]">{meeting.date} · Google Meet · transcript generated</p><p className="mt-2 text-xs leading-5 text-[#66736b]">The agent receives the event, retrieves {meeting.transcript.length} transcript entries, and begins its workflow.</p></div><ChevronRight size={16} className="mt-2 text-[#87938c]" /></div></button>; })}</div><div className="mt-5 rounded-xl bg-[#f4f6f4] p-3 text-[11px] leading-5 text-[#76827b]"><strong className="font-semibold text-[#52645a]">Production path:</strong> owned Meet space → Workspace Events API → Pub/Sub → Railway agent runtime → Drive and Gmail.</div></div></div>;
}

function DemoStudioModal({ onClose, onPrime, onReset }: { onClose: () => void; onPrime: () => void; onReset: () => void }) {
  const shots = [
    { time: "0:00", title: "Open on the brief", line: "MeetingOps turns a finished meeting into operational follow-through, not just notes." },
    { time: "0:15", title: "Show agenda + closure score", line: "It identifies what is unresolved and proactively prepares the next meeting." },
    { time: "0:35", title: "Open What changed", line: "Across meetings, it reconciles decisions, blockers, owners, scope, and risk." },
    { time: "0:55", title: "Open Agent runs", line: "Every autonomous step is observable, and external actions stop for approval." },
    { time: "1:15", title: "Open Action center + Workspace brain", line: "Approved work flows into Drive, Gmail drafts, and a living workspace memory." },
  ];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0d1712]/65 p-4 backdrop-blur-sm"><div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/15 bg-[#f7f8f7] shadow-2xl"><div className="flex flex-col gap-5 border-b border-[#dce2de] bg-[#172b21] p-6 text-white md:flex-row md:items-center md:justify-between"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b9f06b]"><Clapperboard size={14} /> Recording cockpit</div><h2 className="text-xl font-semibold">Prime the strongest MeetingOps story</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[#bdc9c2]">Stages two connected meetings, completed first-meeting actions, workspace memory, change detection, agent observability, and a follow-up approval queue. No external side effects.</p></div><button onClick={onClose} className="icon-button !border-white/15 !bg-white/10 !text-white"><X size={15} /></button></div><div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_.8fr]"><section><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">90-second shot list</p><p className="mt-1 text-xs text-[#748078]">Follow this order and the product tells the story for you.</p></div><span className="tag">5 shots</span></div><div className="overflow-hidden rounded-xl border border-[#dce2de] bg-white">{shots.map((shot, index) => <div key={shot.time} className="grid grid-cols-[48px_1fr] gap-3 border-b border-[#edf0ee] p-4 last:border-0"><span className="text-xs font-semibold text-[#4f735d]">{shot.time}</span><div><p className="text-xs font-semibold">{index + 1}. {shot.title}</p><p className="mt-1 text-[11px] leading-5 text-[#718078]">“{shot.line}”</p></div></div>)}</div></section><aside className="space-y-4"><div className="rounded-xl border border-[#b9d59d] bg-[#eef8e4] p-5"><p className="text-sm font-semibold">Ready-to-film state</p><div className="mt-4 space-y-2 text-xs text-[#5f7066]"><p className="flex gap-2"><Check size={14} className="shrink-0 text-[#5f8a4d]" /> Two meetings with cross-meeting changes</p><p className="flex gap-2"><Check size={14} className="shrink-0 text-[#5f8a4d]" /> Approved Drive, Gmail, and memory results</p><p className="flex gap-2"><Check size={14} className="shrink-0 text-[#5f8a4d]" /> Pending follow-up actions for approval</p><p className="flex gap-2"><Check size={14} className="shrink-0 text-[#5f8a4d]" /> Agent run timeline and proactive agenda</p></div><button onClick={onPrime} className="primary-button mt-5 w-full justify-center"><Clapperboard size={15} /> Prime showcase</button></div><a href="/movie" target="_blank" rel="noreferrer" className="block rounded-xl border border-[#172b21] bg-[#172b21] p-5 text-white"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b9f06b]"><Clapperboard size={14} /> Self-playing film</div><p className="text-sm font-semibold">Open the cinematic walkthrough</p><p className="mt-1 text-[11px] leading-5 text-[#bdc9c2]">A 70-second auto-playing movie: a live Google Meet ends, the agent wakes, and runs every feature. Press F for fullscreen, then screen-record. No clicks needed.</p><span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#b9f06b]">Play /movie <ArrowRight size={12} /></span></a><div className="rounded-xl border border-[#e3d6a5] bg-[#fff9e7] p-4"><p className="text-xs font-semibold text-[#6d5927]">Recording recovery</p><p className="mt-1 text-[11px] leading-5 text-[#806e3c]">Made a wrong click? Prime showcase again. It restores the same reliable starting state without touching Google Drive or Gmail.</p><button onClick={() => { onReset(); onClose(); }} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#6d5927]"><RotateCcw size={13} /> Start from empty dashboard</button></div></aside></div></div></div>;
}

function IntegrationsModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<WorkspaceAgentStatus | null>(null);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"official" | "bot" | "hybrid">("hybrid");
  async function refresh() {
    const response = await fetch("/api/integrations/google-meet/status");
    const next = await response.json() as WorkspaceAgentStatus;
    setStatus(next);
    if (next.capture?.mode) setMode(next.capture.mode);
  }
  useEffect(() => {
    fetch("/api/integrations/google-meet/status")
      .then((response) => response.json())
      .then((next: WorkspaceAgentStatus) => { setStatus(next); if (next.capture?.mode) setMode(next.capture.mode); })
      .catch(() => setStatus({ configured: false, connected: false }));
  }, []);
  async function saveMode(nextMode = mode) {
    setMessage("Updating capture mode...");
    const response = await fetch("/api/integrations/capture-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: nextMode }),
    });
    const result = await response.json();
    setMessage(response.ok ? `Capture mode set to ${result.mode}.` : result.error ?? "Capture mode update failed.");
    if (response.ok) await refresh();
  }
  async function activate() {
    setMessage("Installing background agent across your Workspace meetings...");
    const response = await fetch("/api/integrations/google-meet/activate", { method: "POST" });
    const result = await response.json();
    setMessage(response.ok ? result.message ?? "Workspace agent is active." : result.error ?? "Activation failed.");
    if (response.ok) await refresh();
  }
  async function renew() {
    setMessage("Renewing Workspace event subscription...");
    const response = await fetch("/api/integrations/google-meet/renew", { method: "POST" });
    const result = await response.json();
    setMessage(response.ok ? result.message : result.error ?? "Renewal failed.");
    if (response.ok) await refresh();
  }
  const active = status?.watcher?.state === "active" || status?.watcher?.state === "activating";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0d1712]/60 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-6 flex items-start justify-between"><div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5f806b]">Workspace agent installation</p><h2 className="text-xl font-semibold tracking-[-0.03em]">Run MeetingOps across Google Workspace</h2><p className="mt-2 text-xs leading-5 text-[#77837c]">Connect once. MeetingOps wakes on Meet activity, captures the transcript, and delivers follow-through into Drive and Gmail.</p></div><button onClick={onClose} className="icon-button"><X size={15} /></button></div><div className="rounded-xl border border-[#dce2de] bg-[#f7f9f7] p-4"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#52705f]"><Cloud size={18} /></div><div className="flex-1"><p className="text-sm font-semibold">Google Meet + Drive + Gmail</p><p className="mt-1 text-xs leading-5 text-[#748078]">{status?.identity?.email ? `Installed for ${status.identity.email}. ` : ""}{active ? "Watching every Meet space this user owns." : "Uses offline access so the background agent can work after meetings end."}</p></div><span className="tag">{active ? "Agent active" : status?.connected ? "Connected" : status?.configured ? "Ready" : "Needs credentials"}</span></div>{status?.connected ? <div className="mt-5 flex gap-2"><button onClick={activate} className="primary-button flex-1 justify-center">{active ? "Re-sync Workspace agent" : "Install Workspace agent"} <Zap size={14} /></button>{active && <button onClick={renew} className="icon-button" title="Renew subscription"><RotateCcw size={14} /></button>}</div> : <a href="/api/auth/google/connect" className="primary-button mt-5 w-full justify-center">Connect Google Workspace <ArrowRight size={14} /></a>}{status?.watcher?.expireTime && <p className="mt-3 text-center text-[11px] text-[#748078]">Watcher renews before {new Date(status.watcher.expireTime).toLocaleString()}.</p>}</div><div className="mt-4 rounded-xl border border-[#dce2de] bg-white p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold">Capture mode</p><p className="mt-1 text-xs leading-5 text-[#748078]">Official transcripts are preferred. The Meet-bot joins visibly when bot coverage is enabled.</p></div><span className="tag">{status?.capture?.mode ?? mode}</span></div><div className="grid gap-2 md:grid-cols-3">{(["hybrid", "official", "bot"] as const).map((item) => <button key={item} onClick={() => { setMode(item); void saveMode(item); }} className={`rounded-xl border p-3 text-left transition ${mode === item ? "border-[#9fbd79] bg-[#f0f8e6]" : "border-[#dde3df] bg-[#f9faf9] hover:bg-[#f2f5f2]"}`}><p className="text-xs font-semibold capitalize">{item}</p><p className="mt-1 text-[11px] leading-4 text-[#748078]">{item === "hybrid" ? "Queue bot at start, use official transcript when available." : item === "official" ? "No bot participant; process Google transcript files." : "Always use the visible caption bot."}</p></button>)}</div></div><div className="mt-4 rounded-xl border border-[#dce2de] bg-white p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Meet-bot queue</p><span className="tag">{status?.botJobs?.length ?? 0} jobs</span></div>{status?.botJobs?.length ? <div className="space-y-2">{status.botJobs.slice(0, 4).map((job) => <div key={job.id} className="rounded-lg bg-[#f7f9f7] p-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-semibold">{job.title}</p><span className="tag">{job.status}</span></div><p className="mt-1 truncate text-[11px] text-[#748078]">{job.meetingUrl ?? job.error ?? "Waiting for Meet join URL"}</p></div>)}</div> : <p className="py-3 text-center text-xs text-[#87928c]">No bot jobs yet.</p>}</div>{message && <p className="mt-3 text-center text-xs text-[#617268]">{message}</p>}<div className="mt-4 rounded-xl bg-[#fff8e6] p-3 text-[11px] leading-5 text-[#79672f]"><strong>Production behavior:</strong> the web app is the control plane. Workspace events run on Railway; Meet-bot auto-join requires a separate browser worker running <code>npm run worker</code> in <code>meet-bot</code>.</div></div></div>;
}

function TestBenchModal({ onClose, onComplete }: { onClose: () => void; onComplete: (run: AgentRun) => void }) {
  const [title, setTitle] = useState("Weekly Product Sync");
  const [participants, setParticipants] = useState("Jordan, Maya, Alex");
  const [transcript, setTranscript] = useState("Jordan: We need to ship the onboarding redesign by July 15.\nMaya: I can own the API integration and finish it by July 10.\nAlex: User testing is blocked because recruiting has not confirmed participants.\nJordan: Decision made: analytics is required for launch. Alex, please confirm participants by Friday.");
  const [status, setStatus] = useState("");
  async function analyze() {
    setStatus("Running Groq analysis...");
    const response = await fetch("/api/agent/analyze-transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, participants, transcript }),
    });
    const result = await response.json();
    if (!response.ok) return setStatus(result.error ?? "Analysis failed.");
    onComplete(result as AgentRun);
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0d1712]/60 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5f806b]">Post-transcript test bench</p><h2 className="text-xl font-semibold tracking-[-0.03em]">Paste any meeting transcript</h2><p className="mt-2 text-xs leading-5 text-[#77837c]">Runs the same Groq analysis, routing, closure scoring, action planning, and approval workflow as Google Meet.</p></div><button onClick={onClose} className="icon-button"><X size={15} /></button></div><div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold text-[#59685f]">Meeting title<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d8dfda] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#789b74]" /></label><label className="text-xs font-semibold text-[#59685f]">Participants, comma-separated<input value={participants} onChange={(event) => setParticipants(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d8dfda] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#789b74]" /></label></div><label className="mt-4 block text-xs font-semibold text-[#59685f]">Transcript<textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={12} className="mt-2 w-full resize-y rounded-xl border border-[#d8dfda] px-3 py-3 font-mono text-xs leading-6 outline-none focus:border-[#789b74]" /></label><p className="mt-2 text-[11px] leading-5 text-[#7b8780]">Best format: one line per turn, such as <code>Speaker: what they said</code>. Timestamp prefixes are supported.</p><button onClick={analyze} className="primary-button mt-5 w-full justify-center"><Sparkles size={15} /> Analyze with MeetingOps</button>{status && <p className="mt-3 text-center text-xs text-[#617268]">{status}</p>}</div></div>;
}
