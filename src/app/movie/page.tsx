"use client";

import {
  ArrowRight, Bot, CalendarDays, Check, Cloud, FolderOpen, Gauge, Mail, Mic,
  Pause, Play, RotateCcw, ShieldCheck, Sparkles, Target, Video, Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * MeetingOps cinematic — a self-playing product film built for screen recording.
 * Open /movie, press fullscreen, hit record. It opens on a live Google Meet,
 * the call ends, the agent wakes, then runs through every feature beat by beat.
 */

type Beat = { id: string; ms: number; chapter: string; narration: string };

const BEATS: Beat[] = [
  { id: "title", ms: 3400, chapter: "MeetingOps", narration: "Your meetings finish. The work begins." },
  { id: "meet", ms: 16500, chapter: "The meeting", narration: "Six people, conflicting deadlines, a conditional launch decision. MeetingOps is in the room, listening." },
  { id: "wake", ms: 3800, chapter: "The agent wakes", narration: "The call ends. A Workspace event wakes the agent automatically — no one had to push a button." },
  { id: "capture", ms: 6200, chapter: "Capture", narration: "It captures the transcript as a verifiable source of truth — every speaker turn preserved." },
  { id: "reason", ms: 7200, chapter: "Reason", narration: "It reasons over the conversation, grounding every decision, task, and risk in a real quote." },
  { id: "brief", ms: 7600, chapter: "Brief", narration: "Minutes become an operational brief: decisions, owners, due dates, risks, and a closure score." },
  { id: "approval", ms: 6800, chapter: "Human approval", narration: "Then it stops. Every external action waits for your approval — nothing runs silently." },
  { id: "drive", ms: 5400, chapter: "Drive", narration: "Approved, the evidence-backed brief is filed to the right Google Drive folder." },
  { id: "gmail", ms: 5400, chapter: "Gmail", narration: "A follow-up email is drafted for the attendees — prepared, never auto-sent." },
  { id: "memory", ms: 7000, chapter: "Memory", narration: "Decisions become durable memory, changes are tracked across meetings, and the next agenda writes itself." },
  { id: "outro", ms: 5600, chapter: "MeetingOps", narration: "Observe. Reason. Act safely. The meeting agent that does the work after the meeting." },
];

const TOTAL = BEATS.reduce((sum, b) => sum + b.ms, 0);

const PARTICIPANTS = [
  { initials: "HY", name: "Harshil", color: "#315f4b" },
  { initials: "MK", name: "Maya", color: "#825f42" },
  { initials: "AP", name: "Avery", color: "#6d4f82" },
  { initials: "RL", name: "Rahul", color: "#4e5f82" },
  { initials: "NS", name: "Nia", color: "#7a7046" },
];

// Each line points at the participant index who is speaking.
const SCRIPT: { who: number; line: string }[] = [
  { who: 0, line: "We keep June 18 — but only if Android notifications pass and we hit 15 testers." },
  { who: 1, line: "30% of Android pushes arrive late. I'll disable push for beta and retest by the 15th." },
  { who: 2, line: "Then the known-issues copy has to say push is off on purpose, not broken." },
  { who: 3, line: "Analytics events ship today, but the saved-event funnels still need QA." },
  { who: 4, line: "Eight testers confirmed — I can recruit student orgs tomorrow." },
  { who: 0, line: "Decision: June 18 target, June 25 fallback if we miss QA or the tester count." },
];

// Optional seek: /movie?start=9000 (ms) or /movie?beat=approval — handy for re-recording one section.
function initialElapsed(): number {
  if (typeof window === "undefined") return 0;
  const params = new URLSearchParams(window.location.search);
  const start = params.get("start");
  if (start !== null && !Number.isNaN(Number(start))) return Math.max(0, Math.min(TOTAL, Number(start)));
  const beat = params.get("beat");
  if (beat) {
    let acc = 0;
    for (const b of BEATS) { if (b.id === beat) return acc; acc += b.ms; }
  }
  return 0;
}

export default function MoviePage() {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const last = useRef<number>(0);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => { setElapsed(initialElapsed()); }, []);

  const restart = useCallback(() => { setElapsed(0); setDone(false); setPaused(false); last.current = 0; }, []);

  // Wall-clock driver at ~30fps. Robust whether or not the tab is foregrounded.
  useEffect(() => {
    if (paused || done) return;
    last.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last.current;
      last.current = now;
      setElapsed((prev) => {
        const next = prev + dt;
        if (next >= TOTAL) { setDone(true); return TOTAL; }
        return next;
      });
    }, 1000 / 30);
    return () => window.clearInterval(id);
  }, [paused, done]);

  // Auto-hide the control bar while the film plays so the recording stays clean.
  useEffect(() => {
    function wake() {
      setShowControls(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => { if (!paused && !done) setShowControls(false); }, 2600);
    }
    wake();
    window.addEventListener("mousemove", wake);
    return () => { window.removeEventListener("mousemove", wake); if (hideTimer.current) window.clearTimeout(hideTimer.current); };
  }, [paused, done]);

  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.code === "Space") { e.preventDefault(); if (done) restart(); else setPaused((p) => !p); }
      if (e.code === "KeyR") restart();
      if (e.code === "KeyF") document.documentElement.requestFullscreen?.();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [done, restart]);

  // Resolve the active beat and the time spent inside it.
  let acc = 0, beatIndex = 0, beatElapsed = 0;
  for (let i = 0; i < BEATS.length; i++) {
    if (elapsed < acc + BEATS[i].ms || i === BEATS.length - 1) { beatIndex = i; beatElapsed = elapsed - acc; break; }
    acc += BEATS[i].ms;
  }
  const beat = BEATS[beatIndex];

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#0b1410] text-white">
      {/* ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(120% 120% at 50% -10%, #16261d 0%, #0b1410 55%, #070d0a 100%)" }} />
      <div className="pointer-events-none absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-[#b9f06b]/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-10 h-80 w-80 rounded-full bg-[#3f7d5a]/20 blur-[120px]" />

      {/* top progress bar */}
      <div className="absolute inset-x-0 top-0 z-30 h-1 bg-white/5">
        <div className="h-full bg-[#b9f06b] transition-[width] duration-100" style={{ width: `${(elapsed / TOTAL) * 100}%` }} />
      </div>

      {/* brand + chapter chip */}
      <div className="absolute left-6 top-5 z-30 flex items-center gap-2.5">
        <div className="grid size-8 place-items-center rounded-lg bg-[#b9f06b] text-[#12231b]"><Zap size={17} fill="currentColor" /></div>
        <div>
          <p className="text-sm font-semibold leading-none tracking-tight">MeetingOps</p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-[#7f9a89]">{beat.chapter}</p>
        </div>
      </div>

      {/* stage */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-10 md:px-10">
        <div className="h-full max-h-[680px] w-full max-w-[1180px]" key={beatIndex}>
          {beat.id === "title" && <TitleScene />}
          {beat.id === "meet" && <MeetScene local={beatElapsed} />}
          {beat.id === "wake" && <WakeScene />}
          {beat.id === "capture" && <CaptureScene />}
          {beat.id === "reason" && <ReasonScene />}
          {beat.id === "brief" && <BriefScene />}
          {beat.id === "approval" && <ApprovalScene />}
          {beat.id === "drive" && <DriveScene />}
          {beat.id === "gmail" && <GmailScene />}
          {beat.id === "memory" && <MemoryScene />}
          {beat.id === "outro" && <OutroScene />}
        </div>
      </div>

      {/* narration bar */}
      <div className="relative z-20 px-6 pb-7 md:px-10">
        <div className="mx-auto max-w-[1180px]">
          <div key={`narr-${beatIndex}`} className="flex items-center gap-3 animate-[cine-fade_.6s_ease-out]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b9f06b]">{String(beatIndex + 1).padStart(2, "0")} / {String(BEATS.length).padStart(2, "0")}</span>
            <p className="text-base font-medium leading-snug text-[#e7efe9] md:text-lg">{beat.narration}</p>
          </div>
        </div>
      </div>

      {/* controls (auto-hide so the recording stays clean) */}
      <div className={`absolute bottom-6 right-6 z-40 flex items-center gap-3 transition-opacity duration-500 ${showControls || done ? "opacity-100" : "opacity-0"}`}>
        {done
          ? <button onClick={restart} className="flex items-center gap-2 rounded-full bg-[#b9f06b] px-4 py-2.5 text-xs font-semibold text-[#12231b] shadow-lg"><RotateCcw size={14} /> Replay</button>
          : <>
              <span className="hidden text-[10px] text-white/35 md:inline">Space pause · R restart · F fullscreen</span>
              <button onClick={() => setPaused((p) => !p)} className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur">{paused ? <Play size={16} /> : <Pause size={16} />}</button>
              <button onClick={restart} className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur"><RotateCcw size={15} /></button>
            </>}
      </div>
    </div>
  );
}

/* ---------------------------------- scenes ---------------------------------- */

function TitleScene() {
  return (
    <div className="grid h-full place-items-center text-center">
      <div className="animate-[cine-rise_.8s_ease-out]">
        <div className="mx-auto mb-7 grid size-16 place-items-center rounded-2xl bg-[#b9f06b] text-[#12231b] animate-[orb-pulse_2.6s_ease-in-out_infinite]"><Zap size={30} fill="currentColor" /></div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#8fae9b]">Autonomous meeting agent</p>
        <h1 className="text-4xl font-semibold tracking-[-0.04em] md:text-6xl">Your meetings finish.<br /><span className="text-[#b9f06b]">The work begins.</span></h1>
        <p className="mx-auto mt-5 max-w-xl text-sm text-[#9fb3a6] md:text-base">MeetingOps captures the call, reasons over it, and prepares the follow-through — then waits for your approval.</p>
      </div>
    </div>
  );
}

function MeetScene({ local }: { local: number }) {
  const revealWindow = 13800;
  const perLine = revealWindow / SCRIPT.length;
  const ended = local >= revealWindow + 200;
  const lineIndex = Math.min(SCRIPT.length - 1, Math.floor(local / perLine));
  const activeWho = ended ? -1 : SCRIPT[lineIndex].who;
  const seconds = Math.min(58, 13 + Math.floor(local / 350));
  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-[#1b231e] p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">CampusConnect — launch readiness</p>
          <p className="mt-0.5 text-[11px] text-white/45">Google Meet · 5 participants · MeetingOps capturing</p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-[#d45b55] px-3 py-1.5 text-xs font-semibold"><span className="size-2 animate-pulse rounded-full bg-white" /> 00:{String(seconds).padStart(2, "0")}</span>
      </div>
      <div className="grid h-[calc(100%-56px)] grid-cols-3 grid-rows-2 gap-2.5">
        {PARTICIPANTS.map((p, i) => {
          const speaking = i === activeWho;
          // Has this person spoken at least once by now?
          const spoke = SCRIPT.some((s, idx) => s.who === i && local >= idx * perLine);
          return (
            <div key={p.name} className="relative grid place-items-center overflow-hidden rounded-xl bg-[#2a342d]">
              <div className="grid size-16 place-items-center rounded-full text-lg font-semibold transition-transform md:size-[68px]" style={{ background: p.color, animation: speaking ? "speak-ring 1.1s ease-in-out infinite" : undefined, transform: speaking ? "scale(1.05)" : "scale(1)" }}>{p.initials}</div>
              <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">{speaking && <Mic size={9} className="text-[#b9f06b]" />}{p.name}</div>
              {speaking && (
                <div className="absolute inset-x-2.5 bottom-2.5 rounded-lg bg-black/60 p-2 backdrop-blur animate-[cine-fade_.4s_ease-out]">
                  <p className="text-[11px] leading-snug text-white/85">{SCRIPT[lineIndex].line}</p>
                </div>
              )}
              {spoke && !speaking && <div className="absolute bottom-2.5 right-2.5"><Check size={12} className="text-[#b9f06b]/70" /></div>}
            </div>
          );
        })}
        {/* agent tile */}
        <div className="relative grid place-items-center overflow-hidden rounded-xl border border-[#b9f06b]/40 bg-[#14221b]">
          <div className="grid size-16 place-items-center rounded-full bg-[#b9f06b] text-[#172b21] animate-[orb-pulse_2.4s_ease-in-out_infinite] md:size-[68px]"><Bot size={30} /></div>
          <div className="absolute inset-x-2.5 bottom-2.5">
            <p className="text-[11px] font-semibold">MeetingOps Agent</p>
            <p className="mt-0.5 flex items-center gap-1 text-[9px] text-[#b9f06b]"><span className="size-1.5 animate-pulse rounded-full bg-[#b9f06b]" /> Listening · building transcript</p>
          </div>
        </div>
      </div>
      {ended && (
        <div className="absolute inset-0 grid place-items-center bg-[#0b1410]/80 backdrop-blur-sm animate-[cine-fade_.5s_ease-out]">
          <div className="text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-white/10"><Video size={22} className="text-white/70" /></div>
            <p className="text-lg font-semibold">Meeting ended</p>
            <p className="mt-1 text-xs text-white/55">Everyone left the call · 14 turns captured</p>
          </div>
        </div>
      )}
    </div>
  );
}

function WakeScene() {
  return (
    <div className="grid h-full place-items-center text-center">
      <div className="animate-[cine-fade_.6s_ease-out]">
        <div className="mx-auto mb-7 grid size-24 place-items-center rounded-full bg-[#b9f06b] text-[#12231b] animate-[orb-pulse_1.8s_ease-in-out_infinite]"><Bot size={46} /></div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#b9f06b]">Agent activated</p>
        <h2 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">A Workspace event woke MeetingOps</h2>
        <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-2 text-xs text-[#9fb3a6]">
          <span className="rounded-md bg-white/5 px-2.5 py-1.5 font-mono">conference.ended</span>
          <ArrowRight size={13} />
          <span className="rounded-md bg-white/5 px-2.5 py-1.5 font-mono">Pub/Sub</span>
          <ArrowRight size={13} />
          <span className="rounded-md bg-[#b9f06b]/15 px-2.5 py-1.5 font-mono text-[#b9f06b]">agent.run()</span>
        </div>
      </div>
    </div>
  );
}

function LightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex h-full flex-col justify-center overflow-hidden rounded-2xl bg-[#f5f6f8] p-8 text-[#17211b] shadow-2xl animate-[cine-scale-in_.5s_ease-out] ${className}`}><div className="w-full">{children}</div></div>;
}
function Eyebrow({ children, tone = "#4f7b60" }: { children: React.ReactNode; tone?: string }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: tone }}>{children}</p>;
}
function rise(i: number) { return { animation: "float-up .5s ease-out both", animationDelay: `${i * 0.12}s` } as React.CSSProperties; }

function CaptureScene() {
  const turns: [string, string][] = [
    ["Harshil", "We keep June 18 only if Android notifications pass and we reach 15 testers."],
    ["Maya", "30% of Android pushes arrive late — disabling push for beta, retest by the 15th."],
    ["Avery", "Known-issues copy must say push is intentionally off, not broken."],
    ["Rahul", "Analytics events ship today, but saved-event funnels still need QA."],
    ["Nia", "Eight testers confirmed; recruiting student orgs tomorrow."],
    ["Harshil", "Decision: June 18 target, June 25 fallback if QA or testers slip."],
  ];
  return (
    <LightCard>
      <div className="mb-4 flex items-start justify-between">
        <div><Eyebrow>Source of truth</Eyebrow><h2 className="mt-2 text-xl font-semibold">Transcript captured, speaker by speaker</h2><p className="mt-1 text-xs text-[#68756e]">Every brief can be audited back to the exact words in the room.</p></div>
        <span className="tag">14 turns</span>
      </div>
      <div className="grid grid-cols-[1fr_.62fr] gap-4">
        <div className="space-y-2">
          {turns.map(([s, t], i) => (
            <div key={i} style={rise(i)} className="grid grid-cols-[78px_1fr] gap-3 rounded-xl border border-[#e0e6e2] bg-white p-2.5">
              <p className="text-xs font-semibold text-[#3f6250]">{s}</p>
              <p className="text-xs leading-5 text-[#536159]">{t}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[#dce2de] bg-white p-4" style={rise(2)}>
          <p className="mb-3 text-xs font-semibold">Capture pipeline</p>
          {[["Official transcript", "Workspace Events → Pub/Sub → Meet REST"], ["Meet-bot fallback", "Visible bot, captions on, transcript posted"], ["Normalizer", "Merges duplicate captions, repairs chunks"], ["Deduplication", "One conference record, one agent run"]].map(([t, b], i) => (
            <div key={t} className="mb-3.5 grid grid-cols-[24px_1fr] gap-2.5 last:mb-0" style={rise(i + 2)}>
              <div className="grid size-6 place-items-center rounded-full bg-[#172b21] text-[#b9f06b]"><Check size={12} /></div>
              <div><p className="text-xs font-semibold">{t}</p><p className="mt-0.5 text-[10px] leading-4 text-[#748078]">{b}</p></div>
            </div>
          ))}
        </div>
      </div>
    </LightCard>
  );
}

function ReasonScene() {
  const cards = [
    { title: "Decision", value: "June 18 target · June 25 fallback", evidence: "Decision: June 18 target, June 25 fallback…", confidence: "98%" },
    { title: "Task", value: "Maya retests Android notifications", evidence: "I'll disable push for beta and retest by the 15th.", confidence: "96%" },
    { title: "Risk", value: "Tester recruitment may miss threshold", evidence: "Eight testers confirmed…", confidence: "94%" },
    { title: "Owner", value: "Nia owns student-org recruiting", evidence: "I can recruit student orgs tomorrow.", confidence: "92%" },
    { title: "SPICED · Pain", value: "Late Android push hurts engagement", evidence: "30% of Android pushes arrive late.", confidence: "95%" },
    { title: "Closure gap", value: "Analytics QA owner unresolved", evidence: "Saved-event funnels still need QA.", confidence: "88%" },
  ];
  return (
    <LightCard>
      <div className="mb-4"><Eyebrow>Evidence-grounded reasoning</Eyebrow><h2 className="mt-2 text-xl font-semibold">It extracts facts, then grounds each one in a quote</h2></div>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <div key={c.title} style={rise(i)} className="rounded-xl border border-[#dce2de] bg-white p-4">
            <div className="mb-2.5 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#66806f]">{c.title}</span><span className="tag">{c.confidence}</span></div>
            <p className="text-sm font-semibold leading-5">{c.value}</p>
            <p className="mt-3 border-l-2 border-[#c9dfb1] pl-3 text-[10px] italic leading-4 text-[#77837c]">&ldquo;{c.evidence}&rdquo;</p>
          </div>
        ))}
      </div>
    </LightCard>
  );
}

function MiniPanel({ title, lines, delay = 0 }: { title: string; lines: string[]; delay?: number }) {
  return (
    <div className="rounded-xl border border-[#dce2de] bg-white p-4" style={rise(delay)}>
      <p className="mb-1.5 text-xs font-semibold">{title}</p>
      {lines.map((l) => <p key={l} className="border-b border-[#edf0ee] py-1.5 text-[10px] leading-4 text-[#64736b] last:border-0">{l}</p>)}
    </div>
  );
}

function BriefScene() {
  return (
    <LightCard>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex gap-1.5"><span className="tag">Product launch</span><span className="tag">6 attendees</span><span className="tag">LLM reasoned</span></div>
          <h2 className="mt-2.5 text-xl font-semibold">CampusConnect Beta Launch Review</h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#68756e]">June 18 target held, Android push disabled for beta, June 25 set as fallback, final call tied to QA plus tester recruitment.</p>
        </div>
        <div className="shrink-0 rounded-xl border border-[#cdddbc] bg-[#f2f8eb] p-3 text-center" style={rise(1)}>
          <p className="flex items-center gap-1 text-[10px] text-[#68756e]"><Gauge size={11} /> Closure</p>
          <p className="text-3xl font-semibold tracking-[-0.04em]">78%</p>
          <p className="text-[10px] text-[#7a867f]">2 gaps flagged</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MiniPanel delay={0} title="Key decisions" lines={["June 18 target; June 25 fallback", "Android push disabled for beta", "Launch review on June 16"]} />
        <MiniPanel delay={1} title="Action items" lines={["Maya · Android retest · Jun 15", "Nia · Recruit testers · Jun 14", "Rahul · Analytics QA · owner needed"]} />
        <MiniPanel delay={2} title="Risks" lines={["Only 8 of 15 testers confirmed", "Android push lateness hurts engagement", "Analytics QA assignee unclear"]} />
        <MiniPanel delay={3} title="SPICED lens" lines={["Situation · Beta launch readiness", "Pain · Reliability + recruitment blockers", "Decision · Date holds with fallback"]} />
      </div>
    </LightCard>
  );
}

function ApprovalScene() {
  const items = [
    { icon: <Cloud />, title: "Save brief to Drive", payload: "folder: MeetingOps/Product/CampusConnect\nfile: 2026-06-07 Launch Readiness.md" },
    { icon: <Mail />, title: "Draft attendee follow-up", payload: "to: attendees\nsubject: CampusConnect decisions\nsend: false" },
    { icon: <Target />, title: "Update workspace memory", payload: "decisions: 3 · tasks: 4\nrisks: 3 · agenda: 5" },
  ];
  return (
    <LightCard>
      <div className="mb-5"><Eyebrow>Human approval boundary</Eyebrow><h2 className="mt-2 text-xl font-semibold">It prepares every side effect, then stops</h2></div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div key={item.title} style={rise(i)} className="rounded-xl border border-[#dce2de] bg-white p-4">
            <div className="mb-3 flex items-start justify-between"><div className="grid size-9 place-items-center rounded-xl bg-[#edf5ef] text-[#4f735d] [&>svg]:size-4">{item.icon}</div><span className="tag !bg-[#fff9e7] !text-[#7a6126]">needs approval</span></div>
            <p className="text-sm font-semibold">{item.title}</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[#f6f8f6] p-2.5 font-mono text-[10px] leading-4 text-[#59675f]">{item.payload}</pre>
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#172b21] py-2 text-xs font-semibold text-white"><Check size={13} /> Approve</div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#6f7d75]"><ShieldCheck size={15} /> Full autonomy up to external side effects — then control returns to you.</div>
    </LightCard>
  );
}

function DriveScene() {
  return (
    <LightCard className="!bg-[#edf2f7]">
      <div className="mb-4 flex items-center justify-between"><div><Eyebrow tone="#3f5e8a">Google Drive · approved</Eyebrow><h2 className="mt-2 text-xl font-semibold">Evidence-backed brief, filed in the right folder</h2></div><span className="flex items-center gap-1.5 rounded-full bg-[#e6f4ea] px-3 py-1.5 text-xs font-semibold text-[#2f7d4e]" style={rise(2)}><span className="grid size-4 place-items-center rounded-full bg-[#2f7d4e] text-white" style={{ animation: "check-pop .4s ease-out both", animationDelay: ".5s" }}><Check size={10} /></span> Saved</span></div>
      <div className="grid grid-cols-[230px_1fr] gap-4">
        <div className="rounded-xl bg-white p-4 shadow-sm" style={rise(0)}>
          <p className="mb-3 text-xs font-semibold">Drive folders</p>
          {["MeetingOps", "Product", "CampusConnect", "2026-06-07 Launch Readiness"].map((f, i) => <div key={f} style={rise(i)} className={`mb-2 rounded-lg px-3 py-2 text-xs ${i === 3 ? "bg-[#e8f0fe] font-semibold text-[#2559a7]" : "bg-[#f6f8fa] text-[#5f6b74]"}`}>/{f}</div>)}
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm" style={rise(1)}>
          <div className="mb-4 flex items-center gap-3 border-b border-[#e6ebf0] pb-3"><FolderOpen size={18} className="text-[#3f5e8a]" /><div><p className="text-sm font-semibold">CampusConnect Beta Launch Review.md</p><p className="text-[10px] text-[#6d7882]">Created by MeetingOps · routed with 92% confidence</p></div></div>
          <div className="grid grid-cols-2 gap-3 text-[10px] leading-4 text-[#4f5d66]">
            {[["Summary", "June 18 target, June 25 fallback if QA or testers slip."], ["Decisions", "Disable Android push. Review June 16. Need 15 testers."], ["Tasks", "Maya retest · Nia recruiting · Rahul QA · Avery copy."], ["Evidence", "Every decision keeps its transcript speaker + quote."]].map(([t, b], i) => (
              <div key={t} style={rise(i + 2)} className="rounded-lg border border-[#e6ebf0] bg-[#fbfcfd] p-3"><p className="mb-1 text-[10px] font-semibold text-[#2f4f70]">{t}</p><p>{b}</p></div>
            ))}
          </div>
        </div>
      </div>
    </LightCard>
  );
}

function GmailScene() {
  return (
    <LightCard>
      <div className="mb-4 flex items-center justify-between"><div><Eyebrow tone="#ad493e">Gmail · draft only</Eyebrow><h2 className="mt-2 text-xl font-semibold">Follow-up email prepared, never auto-sent</h2></div><span className="tag !bg-[#fff0ee] !text-[#ad493e]">Drafts</span></div>
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#e1d6d3] bg-white shadow-sm" style={rise(0)}>
        <div className="border-b border-[#eee5e2] p-4"><p className="text-xs text-[#746864]">To: Harshil, Maya, Avery, Rahul, Nia</p><p className="mt-1.5 text-sm font-semibold">CampusConnect beta recap: June 18 target, owners, and fallback criteria</p></div>
        <div className="p-5 text-xs leading-6 text-[#4f5d55]">
          <p>Hi team,</p>
          <p className="mt-2">MeetingOps captured today&apos;s launch-readiness decisions and prepared this draft for review.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li style={rise(1)}><strong>Decision:</strong> June 18 target; June 25 fallback if QA or tester count misses.</li>
            <li style={rise(2)}><strong>Maya:</strong> disable Android push for beta and retest by June 15.</li>
            <li style={rise(3)}><strong>Nia:</strong> recruit student orgs to 15 confirmed testers by June 14.</li>
            <li style={rise(4)}><strong>Rahul:</strong> finish QA on saved-event analytics funnels before review.</li>
          </ul>
          <p className="mt-2 text-[#8a6a25]">Draft only — MeetingOps never sends automatically.</p>
        </div>
      </div>
    </LightCard>
  );
}

function MemoryScene() {
  return (
    <LightCard>
      <div className="mb-4"><Eyebrow>Workspace brain · next meeting</Eyebrow><h2 className="mt-2 text-xl font-semibold">The next conversation starts from remembered state</h2></div>
      <div className="grid grid-cols-3 gap-3">
        {[["Launch date", "June 18 tentative", "June 18 target · June 25 fallback"], ["Android push", "Unclear blocker", "Disabled for beta; retest Jun 15"], ["Tester risk", "8 confirmed", "Needs 15 by Jun 14"]].map(([label, before, after], i) => (
          <div key={label} style={rise(i)} className="rounded-xl border border-[#dce2de] bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#66806f]">{label}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="flex-1 rounded-lg bg-[#f4f5f4] p-2 text-[11px] text-[#6c7771]">{before}</span>
              <ArrowRight size={13} className="shrink-0 text-[#75837a]" />
              <span className="flex-1 rounded-lg bg-[#ecf8de] p-2 text-[11px] font-semibold text-[#334d38]">{after}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MiniPanel delay={3} title="Workspace memory now stores" lines={["3 decisions with evidence", "4 tasks with owners and dates", "3 active risks", "Drive + Gmail destinations"]} />
        <MiniPanel delay={4} title="Next meeting agenda — auto-generated" lines={["Confirm tester count ≥ 15", "Review Android notification QA", "Approve known-issues copy", "Final June 18 vs June 25 call"]} />
      </div>
    </LightCard>
  );
}

function OutroScene() {
  return (
    <div className="grid h-full place-items-center text-center">
      <div className="animate-[cine-rise_.7s_ease-out]">
        <div className="mb-7 flex items-center justify-center gap-3">
          {[["Observe", <Cloud key="c" size={18} />], ["Reason", <Sparkles key="s" size={18} />], ["Act safely", <ShieldCheck key="sh" size={18} />]].map(([label, icon], i) => (
            <div key={label as string} className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#dcebe1]" style={rise(i)}><span className="text-[#b9f06b]">{icon}</span>{label}</div>
              {i < 2 && <ArrowRight size={15} className="text-white/30" />}
            </div>
          ))}
        </div>
        <h2 className="text-3xl font-semibold tracking-[-0.03em] md:text-5xl">The work happens <span className="text-[#b9f06b]">after</span> the meeting.</h2>
        <p className="mx-auto mt-4 max-w-lg text-sm text-[#9fb3a6] md:text-base">MeetingOps — the autonomous meeting agent with a human approval boundary.</p>
        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-[#b9f06b]/30 bg-[#b9f06b]/10 px-5 py-2.5 text-sm font-medium text-[#b9f06b]"><CalendarDays size={15} /> meetingops-production.up.railway.app</div>
      </div>
    </div>
  );
}
