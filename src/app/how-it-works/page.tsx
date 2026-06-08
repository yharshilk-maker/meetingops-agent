"use client";

import {
  Activity, ArrowRight, ArrowDown, Bot, Brain, Check, ChevronDown, Cloud, Database,
  FileText, Gauge, Layers, Lock, Mail, MessageSquareText, Mic, Puzzle, Search,
  ShieldCheck, Sparkles, Target, Workflow, Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ------------------------------- helpers -------------------------------- */

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reveal immediately if already in view (robust even if the observer is flaky)…
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    // …and a fallback so content is never stuck hidden.
    const t = window.setTimeout(() => setShown(true), 1400);
    return () => { io.disconnect(); window.clearTimeout(t); };
  }, []);
  return <div ref={ref} className={className} style={{ opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(18px)", transition: `opacity .6s ease ${delay}s, transform .6s ease ${delay}s` }}>{children}</div>;
}

function SectionHeader({ kicker, title, blurb }: { kicker: string; title: string; blurb: string }) {
  return (
    <Reveal className="mb-10 max-w-3xl">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#3f7d5a]"><span className="h-px w-8 bg-[#3f7d5a]" />{kicker}</p>
      <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#13231b] md:text-[40px] md:leading-[1.1]">{title}</h2>
      <p className="mt-4 text-base leading-7 text-[#5c6b62]">{blurb}</p>
    </Reveal>
  );
}

function Accordion({ q, children, defaultOpen = false }: { q: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-[#dce4de] bg-white">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="text-sm font-semibold text-[#1c2c23]">{q}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#6c8275] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-[#edf1ee] px-5 py-4 text-sm leading-6 text-[#566359] animate-[cine-fade_.3s_ease-out]">{children}</div>}
    </div>
  );
}

const NAV = [
  ["overview", "Overview"], ["capture", "Capture"], ["reason", "Reasoning"],
  ["runtime", "Runtime"], ["actions", "Actions"], ["security", "Security"], ["faq", "Q&A"],
] as const;

/* --------------------------------- page --------------------------------- */

export default function HowItWorks() {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    NAV.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#17211b]">
      {/* top nav */}
      <header className="sticky top-0 z-40 border-b border-[#e1e6e2] bg-[#f5f6f8]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 md:px-8">
          <a href="#top" className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-lg bg-[#b9f06b] text-[#12231b]"><Zap size={15} fill="currentColor" /></span><span className="text-sm font-semibold tracking-tight">MeetingOps</span><span className="hidden text-[11px] text-[#8a958f] sm:inline">· How it works</span></a>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(([id, label]) => <a key={id} href={`#${id}`} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active === id ? "bg-[#172b21] text-white" : "text-[#5c6b62] hover:bg-[#e8ece9]"}`}>{label}</a>)}
          </nav>
          <a href="/movie" className="rounded-full bg-[#172b21] px-3.5 py-1.5 text-xs font-semibold text-white">Watch demo</a>
        </div>
      </header>

      {/* hero */}
      <section id="top" className="relative overflow-hidden bg-[#0f1b15] text-white">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#b9f06b]/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#3f7d5a]/20 blur-[120px]" />
        <div className="relative mx-auto max-w-[1200px] px-5 py-20 md:px-8 md:py-28">
          <Reveal>
            <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b9f06b]"><Sparkles size={13} /> Autonomous meeting agent · technical walkthrough</p>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] md:text-6xl md:leading-[1.05]">How the MeetingOps agent actually works</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#a9bcb0]">It treats the <span className="text-white">end of a meeting</span> as the start of a workflow: capture the conversation, reason over it, extract structured operational knowledge, prepare real Workspace actions — and <span className="text-[#b9f06b]">stop for human approval</span> before touching anything.</p>
          </Reveal>
          <Reveal delay={0.1} className="mt-10 flex flex-wrap gap-3">
            {[["Observe", <Cloud key="c" size={15} />], ["Reason", <Brain key="b" size={15} />], ["Act safely", <ShieldCheck key="s" size={15} />]].map(([l, ic], i) => (
              <span key={l as string} className="flex items-center gap-2"><span className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-medium"><span className="text-[#b9f06b]">{ic}</span>{l}</span>{i < 2 && <ArrowRight size={15} className="text-white/30" />}</span>
            ))}
          </Reveal>
        </div>
      </section>

      <main className="mx-auto max-w-[1200px] px-5 md:px-8">

        {/* OVERVIEW — pipeline */}
        <section id="overview" className="scroll-mt-20 border-b border-[#e6eae7] py-20">
          <SectionHeader kicker="The pipeline" title="One transcript, six stages, zero silent side effects" blurb="Every meeting flows through the same path. The agent has full autonomy up to the moment an external action would fire — then control returns to you." />
          <div className="pipeline-grid">
            {[
              { icon: <Layers />, t: "Capture", d: "4 input paths feed a raw transcript", c: "#3f7d5a" },
              { icon: <Workflow />, t: "Normalize", d: "Unify speaker turns; diarize audio", c: "#3f7d5a" },
              { icon: <Brain />, t: "Reason", d: "LLM extracts structured knowledge", c: "#3f7d5a" },
              { icon: <Activity />, t: "Runtime", d: "Stateful run, logged + deduped", c: "#3f7d5a" },
              { icon: <ShieldCheck />, t: "Approve", d: "Human reviews every side effect", c: "#a06a1f" },
              { icon: <Cloud />, t: "Act", d: "Drive Doc · Gmail draft · memory", c: "#2f6d49" },
            ].map((s, i) => (
              <Reveal key={s.t} delay={i * 0.06}>
                <div className="relative h-full rounded-2xl border border-[#dce4de] bg-white p-5">
                  <div className="mb-3 grid size-10 place-items-center rounded-xl text-white [&>svg]:size-[18px]" style={{ background: s.c }}>{s.icon}</div>
                  <p className="text-[10px] font-semibold text-[#8a958f]">STEP {i + 1}</p>
                  <p className="mt-0.5 text-sm font-semibold">{s.t}</p>
                  <p className="mt-1.5 text-xs leading-5 text-[#6c7a71]">{s.d}</p>
                  {i < 5 && <ArrowDown className="absolute -bottom-[18px] left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#f5f6f8] text-[#b3c2b8] lg:hidden" size={20} />}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2} className="mt-6 rounded-2xl border border-[#b9d59d] bg-[#eef8e4] p-5">
            <p className="flex items-start gap-3 text-sm leading-6 text-[#3c5640]"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#5f8a4d]" /><span><b>The core guarantee:</b> the agent cannot produce an external side effect without an explicit human click. Autonomy ends at the approval gate, by design — enforced by both the UI and the narrow OAuth scopes.</span></p>
          </Reveal>
        </section>

        {/* CAPTURE */}
        <section id="capture" className="scroll-mt-20 border-b border-[#e6eae7] py-20">
          <SectionHeader kicker="Capture layer" title="Four ways a conversation gets in" blurb="The agent is capture-agnostic. Each path produces the same TranscriptLine[] shape and hands off to the same pipeline. Click any path for the engineering detail." />
          <div className="grid gap-4 md:grid-cols-2">
            <CaptureCard icon={<Puzzle />} title="Chrome extension — tab audio" tag="Consumer path · works on @gmail" summary="Captures the meeting tab's mixed audio and transcribes it with Groq Whisper.">
              <ol className="list-decimal space-y-1.5 pl-4">
                <li><code>chrome.tabCapture</code> grants the tab's audio stream (everyone, not just your mic).</li>
                <li>A Manifest-V3 <b>offscreen document</b> holds a <code>MediaRecorder</code> — service workers can&apos;t run audio and die after ~30s.</li>
                <li>Records opus/webm at 64 kbps; every <b>60 seconds</b> POSTs a blob to <code>/api/live-capture/chunk</code>.</li>
                <li>Server runs <b>Groq Whisper large-v3-turbo</b> on each chunk, stores the text.</li>
                <li>On stop, chunks concatenate → normalizer → reasoning.</li>
              </ol>
            </CaptureCard>
            <CaptureCard icon={<Bot />} title="Meet bot — browser automation" tag="Visible notetaker tile" summary="A Playwright-driven Chrome joins the call as a guest and scrapes live captions.">
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>Clicking Start MeetingOps POSTs the meeting URL to <code>/api/meet-bot/jobs</code> (queued).</li>
                <li>A local <code>worker.mjs</code> polls, claims the job, spawns <code>meet-bot.mjs</code>.</li>
                <li>Opens a <b>fresh logged-out Chrome profile</b> → joins as guest &ldquo;MeetingOps AI Agent&rdquo; (not a clone of you).</li>
                <li>Turns on Google Meet captions, scrapes the caption DOM every second, dedupes.</li>
                <li>On call end, POSTs the transcript to <code>/api/meet-bot/complete</code>.</li>
              </ol>
              <p className="mt-2 text-xs text-[#8a6a25]">Runs on your machine — a real browser can&apos;t run on Railway.</p>
            </CaptureCard>
            <CaptureCard icon={<FileText />} title="Official Meet transcript" tag="Google Workspace only" summary="Subscribes to Google Workspace Events and pulls the real transcript via the Meet API.">
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>Creates a <b>Workspace Events</b> subscription (7-day TTL, auto-renews) on your Cloud Identity user.</li>
                <li>Meet events flow to a <b>Pub/Sub</b> topic → webhook at <code>/api/webhooks/google-meet</code>.</li>
                <li>On <code>transcript.fileGenerated</code>, calls the Meet v2 API for speaker-attributed entries.</li>
              </ol>
              <p className="mt-2 text-xs text-[#8a6a25]">Requires paid Workspace — consumer Gmail has no Cloud Identity / transcript generation.</p>
            </CaptureCard>
            <CaptureCard icon={<MessageSquareText />} title="Paste transcript" tag="Test bench" summary="Paste any text in 'Speaker: line' format and run the full real pipeline.">
              <p>No bot, no extension — the fastest way to demo the reasoning, routing, scoring, and approval flow end to end. Same code path as a real meeting.</p>
            </CaptureCard>
          </div>
        </section>

        {/* NORMALIZE + REASON */}
        <section id="reason" className="scroll-mt-20 border-b border-[#e6eae7] py-20">
          <SectionHeader kicker="Normalize → Reason" title="From messy turns to grounded structure" blurb="A normalizer unifies every transcript format, then a schema-constrained LLM turns the conversation into decisions, tasks, risks, and a routing decision — each grounded in a direct quote." />
          <div className="grid gap-4 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-[#dce4de] bg-white p-6">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Workflow size={17} className="text-[#3f7d5a]" /> The normalizer</div>
                <p className="text-sm leading-6 text-[#566359]">Bot captions, Whisper audio, official transcripts, and pasted text all arrive in different shapes. The normalizer resolves them to one format:</p>
                <ul className="mt-3 space-y-2 text-sm text-[#566359]">
                  <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#5f8a4d]" /><span><b>Labelled turns</b> (bot/official) → trusted as-is, adjacent same-speaker turns merged.</span></li>
                  <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#5f8a4d]" /><span><b>Unlabelled audio</b> → a separate <b>llama-3.3-70b</b> diarization pass infers speakers.</span></li>
                </ul>
                <div className="mt-4 rounded-lg bg-[#fbf6e9] p-3 text-xs leading-5 text-[#7a6326]"><b>War story:</b> the normalizer used to re-derive speakers from raw text, which read a line like <code>&quot;Decision: June 18&quot;</code> as a speaker named &ldquo;Decision&rdquo; — corrupting every bot run. Fixed by trusting real labels first.</div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="h-full rounded-2xl border border-[#dce4de] bg-white p-6">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Brain size={17} className="text-[#3f7d5a]" /> The reasoning call</div>
                <p className="text-sm leading-6 text-[#566359]">A single <b>Groq Responses API</b> call with a <b>strict JSON Schema</b> — the inference server constrains output tokens so the model can only emit valid structure. Extracts:</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {[["Decisions", "with quote + speaker"], ["Tasks", "owner + due date"], ["Risks", "with evidence"], ["SPICED", "operational lens"], ["Folder route", "category + project"], ["Summary", "2-3 sentences"]].map(([t, d]) => (
                    <div key={t} className="rounded-lg border border-[#e6ece8] bg-[#f8faf8] p-2.5"><p className="text-[11px] font-semibold text-[#2f4a39]">{t}</p><p className="mt-0.5 text-[11px] text-[#73817a]">{d}</p></div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-[#73817a]">No key configured? A deterministic, regex-based fallback runs entirely in-process. The UI labels which path was used.</p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="mt-4 rounded-2xl border border-[#dce4de] bg-white p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Target size={17} className="text-[#3f7d5a]" /> The one part that isn&apos;t the LLM: owner attribution</div>
              <p className="text-sm leading-6 text-[#566359]">A 20B model reliably mis-assigns task owners (defaults everything to the first speaker, or emits &ldquo;Speaker&rdquo;). So owners are derived <b>deterministically</b>: each task is matched to the transcript line it came from by word overlap, with a bonus for commitment phrases (&ldquo;I will&rdquo;, &ldquo;I can&rdquo;, &ldquo;I&apos;ll take&rdquo;). The speaker of the best match becomes the owner.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-[#f0f4f1] px-3 py-1.5 text-[#566359]">&ldquo;<b>I will</b> disable push…&rdquo; → Maya</span>
                <span className="rounded-full bg-[#f0f4f1] px-3 py-1.5 text-[#566359]">&ldquo;<b>I can</b> own that QA&rdquo; → Rahul</span>
                <span className="rounded-full bg-[#f0f4f1] px-3 py-1.5 text-[#566359]">&ldquo;<b>I can</b> recruit…&rdquo; → Nia</span>
              </div>
            </div>
          </Reveal>
        </section>

        {/* RUNTIME */}
        <section id="runtime" className="scroll-mt-20 border-b border-[#e6eae7] py-20">
          <SectionHeader kicker="Agent runtime" title="A logged, deduplicated state machine" blurb="Every analysis is an AgentRun that moves through explicit stages. Each transition is timestamped and visible in the dashboard — the agent is fully observable." />
          <Reveal>
            <div className="flex flex-wrap items-center gap-2">
              {["event_received", "fetching_transcript", "analyzing", "planning_actions", "awaiting_approval"].map((s, i, arr) => (
                <span key={s} className="flex items-center gap-2">
                  <span className={`rounded-lg px-3.5 py-2 text-xs font-medium ${i === arr.length - 1 ? "bg-[#fff3d6] text-[#8a6a25]" : "bg-[#172b21] text-white"}`}>{s.replace(/_/g, " ")}</span>
                  {i < arr.length - 1 && <ArrowRight size={14} className="text-[#b3c2b8]" />}
                </span>
              ))}
            </div>
          </Reveal>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: <Activity />, t: "Observable", d: "Every stage transition is logged with a timestamp and message — the 'Agent runs' view replays exactly what the agent observed, retrieved, and reasoned." },
              { icon: <Layers />, t: "Deduplicated", d: "Keyed by conference-record ID. One meeting that fires five Google events (started, transcript-ready, ended…) updates one run, not five." },
              { icon: <Database />, t: "Provider-tagged", d: "Each run records its source — google_meet, meet_bot, live_audio, or manual_test — so you always know how a brief was produced." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.07}><div className="h-full rounded-2xl border border-[#dce4de] bg-white p-5"><div className="mb-3 grid size-9 place-items-center rounded-xl bg-[#edf5ef] text-[#3f7d5a] [&>svg]:size-[17px]">{c.icon}</div><p className="text-sm font-semibold">{c.t}</p><p className="mt-1.5 text-xs leading-5 text-[#6c7a71]">{c.d}</p></div></Reveal>
            ))}
          </div>
        </section>

        {/* ACTIONS */}
        <section id="actions" className="scroll-mt-20 border-b border-[#e6eae7] py-20">
          <SectionHeader kicker="Approval gate → actions" title="What actually fires when you approve" blurb="Three proposed actions, each shown with its exact payload before execution. Nothing runs until you click. Drive and Gmail are real Google API calls; memory is in-process state." />
          <div className="grid gap-4 md:grid-cols-3">
            <ActionCard icon={<Cloud />} title="Save brief to Drive" scope="drive.file" color="#2559a7">
              <ul className="space-y-1.5">
                <li>Walks the agent&apos;s routed path, find-or-creating each nested folder (<code>MeetingOps / Launch / CampusConnect / …</code>).</li>
                <li>Uploads HTML via multipart → Drive converts it to a <b>native Google Doc</b> with headings, decisions, and evidence quotes.</li>
                <li>Returns a real <code>fileId</code> + link.</li>
              </ul>
            </ActionCard>
            <ActionCard icon={<Mail />} title="Create Gmail draft" scope="gmail.compose" color="#ad493e">
              <ul className="space-y-1.5">
                <li>Builds a MIME recap (decisions + tasks), base64url-encodes it.</li>
                <li>POSTs to the Gmail <code>drafts</code> endpoint — a <b>real draft</b> in your Drafts folder.</li>
                <li><b>Never sends.</b> The scope cannot read your inbox or send mail without you.</li>
              </ul>
            </ActionCard>
            <ActionCard icon={<Target />} title="Update workspace memory" scope="in-process" color="#2f6d49">
              <ul className="space-y-1.5">
                <li>Appends decisions, tasks, risks to the &ldquo;Workspace brain&rdquo; state.</li>
                <li>Powers cross-meeting change detection and the next-meeting agenda.</li>
                <li>Currently in-memory (see durability below).</li>
              </ul>
            </ActionCard>
          </div>

          <Reveal delay={0.1} className="mt-8">
            <div className="rounded-2xl border border-[#dce4de] bg-white p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold"><Gauge size={17} className="text-[#3f7d5a]" /> Closure score — was the meeting actually complete?</div>
              <p className="text-sm leading-6 text-[#566359]">A 0–100 heuristic: points for tasks having owners (+30) and due dates (+30), decisions made (+20), risks identified (+10), with a penalty for any unowned task. Surfaces concrete gaps like &ldquo;2 tasks have no owner&rdquo; so you know what the meeting <i>failed</i> to resolve.</p>
            </div>
          </Reveal>
        </section>

        {/* SECURITY + DURABILITY */}
        <section id="security" className="scroll-mt-20 border-b border-[#e6eae7] py-20">
          <SectionHeader kicker="Trust boundaries" title="Why this agent is safe by construction" blurb="Three independent mechanisms mean the agent is incapable of acting against you — not just unlikely to." />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: <Lock />, t: "Narrow OAuth scopes", d: "drive.file = only files the app created (can't read your Drive). gmail.compose = drafts only (can't read your inbox or send). meetings.space.readonly = transcripts only." },
              { icon: <ShieldCheck />, t: "Human approval gate", d: "No external side effect fires without an explicit click. The agent prepares the exact payload and stops." },
              { icon: <Search />, t: "Evidence grounding", d: "Every decision and risk carries the verbatim quote and speaker. You can audit any extraction back to the source line and reject it." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.07}><div className="h-full rounded-2xl border border-[#dce4de] bg-white p-5"><div className="mb-3 grid size-10 place-items-center rounded-xl bg-[#172b21] text-[#b9f06b] [&>svg]:size-[18px]">{c.icon}</div><p className="text-sm font-semibold">{c.t}</p><p className="mt-1.5 text-xs leading-5 text-[#6c7a71]">{c.d}</p></div></Reveal>
            ))}
          </div>

          <Reveal delay={0.12} className="mt-8">
            <p className="mb-3 text-sm font-semibold text-[#1c2c23]">What&apos;s durable vs. ephemeral (the honest picture)</p>
            <div className="overflow-hidden rounded-2xl border border-[#dce4de] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f3f6f3] text-[11px] uppercase tracking-wide text-[#7c897f]"><tr><th className="px-5 py-3 font-semibold">Data</th><th className="px-5 py-3 font-semibold">Storage</th><th className="px-5 py-3 font-semibold">Survives restart?</th></tr></thead>
                <tbody className="divide-y divide-[#edf1ee] text-[#566359]">
                  {[
                    ["OAuth tokens, identity", "Encrypted disk / Railway volume", true],
                    ["Workspace watcher + bot jobs", "Disk / Railway volume", true],
                    ["Live capture sessions", "Disk / Railway volume", true],
                    ["Agent runs (briefs)", "In-memory (globalThis, max 20)", false],
                    ["Workspace memory", "In-memory (globalThis)", false],
                  ].map(([d, s, ok]) => (
                    <tr key={d as string}><td className="px-5 py-3 font-medium text-[#2f4a39]">{d}</td><td className="px-5 py-3">{s}</td><td className="px-5 py-3">{ok ? <span className="inline-flex items-center gap-1 text-[#2f7d4e]"><Check size={14} /> Yes</span> : <span className="text-[#a06a1f]">No — Postgres is the next step</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-20">
          <SectionHeader kicker="Anticipated questions" title="The hard questions, answered straight" blurb="The trade-offs a sharp reviewer will probe — and the honest engineering answers." />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <Accordion q="Why not always use Google's official transcript?" defaultOpen>It requires a paid Google Workspace account — consumer Gmail has no Cloud Identity ID and no transcript generation, so the Workspace Events API returns 403. The bot and the tab-audio extension are the consumer-grade alternatives.</Accordion>
              <Accordion q="Does it work without the bot worker running?">Yes. The Chrome extension transcribes from tab audio independently. The bot only adds the visible notetaker tile. No worker, no second window — the meeting is still captured and analyzed.</Accordion>
              <Accordion q="Why must the bot run on my machine?">It drives a real Chrome browser, which Railway (a headless container platform) can&apos;t provide. The production path is a hosted browser (BrowserBase / Browserless) or a container with Xvfb — a known, scoped next step.</Accordion>
              <Accordion q="What stops it from reading my email or Drive?">The OAuth scopes. <code>gmail.compose</code> physically cannot call inbox read endpoints; <code>drive.file</code> can only see files this app itself created. It&apos;s a capability boundary, not a policy.</Accordion>
            </div>
            <div className="space-y-3">
              <Accordion q="Why is workspace memory lost on restart?">It lives in <code>globalThis</code> — a deliberate first-pass to ship fast. Tokens, watcher, and jobs are already durable on the volume. Moving runs + memory to Postgres is a single-table change.</Accordion>
              <Accordion q="What if the LLM hallucinates a decision?">Every decision and risk includes the verbatim quote and speaker, shown in the UI. A human can trace each extraction to its source line and reject it at the approval gate before anything fires.</Accordion>
              <Accordion q="What does it cost per meeting?">Groq Whisper for a 1-hour meeting (~14 MB opus) plus a few-thousand-token reasoning call is well under $0.05 at current pricing. Hosting fits Railway&apos;s starter tier.</Accordion>
              <Accordion q="What would you build next?">Durable Postgres storage, Calendar-sourced attendee emails (so Gmail recipients auto-fill), a cloud bot worker, encrypted multi-user tokens, and signed Pub/Sub verification.</Accordion>
            </div>
          </div>
        </section>
      </main>

      {/* footer cta */}
      <footer className="border-t border-[#e1e6e2] bg-[#0f1b15] text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 px-5 py-12 md:flex-row md:items-center md:px-8">
          <div>
            <p className="text-lg font-semibold">The work happens <span className="text-[#b9f06b]">after</span> the meeting.</p>
            <p className="mt-1 text-sm text-[#a9bcb0]">MeetingOps — observe, reason, act safely.</p>
          </div>
          <div className="flex gap-3">
            <a href="/movie" className="rounded-full bg-[#b9f06b] px-5 py-2.5 text-sm font-semibold text-[#12231b]">Watch the 70-second demo</a>
            <a href="/" className="rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold">Open the dashboard</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------- sub-components ---------------------------- */

function CaptureCard({ icon, title, tag, summary, children }: { icon: React.ReactNode; title: string; tag: string; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal>
      <div className="h-full rounded-2xl border border-[#dce4de] bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-[#edf5ef] text-[#3f7d5a] [&>svg]:size-[20px]">{icon}</div>
          <span className="rounded-full bg-[#f0f4f1] px-2.5 py-1 text-[10px] font-semibold text-[#5d7466]">{tag}</span>
        </div>
        <h3 className="mt-4 text-base font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-[#6c7a71]">{summary}</p>
        <button onClick={() => setOpen((o) => !o)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2f6d49]">{open ? "Hide" : "How it works"} <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} /></button>
        {open && <div className="mt-4 border-t border-[#edf1ee] pt-4 text-xs leading-6 text-[#566359] animate-[cine-fade_.3s_ease-out] [&_code]:rounded [&_code]:bg-[#f0f4f1] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px]">{children}</div>}
      </div>
    </Reveal>
  );
}

function ActionCard({ icon, title, scope, color, children }: { icon: React.ReactNode; title: string; scope: string; color: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <div className="h-full rounded-2xl border border-[#dce4de] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="grid size-10 place-items-center rounded-xl text-white [&>svg]:size-[18px]" style={{ background: color }}>{icon}</div>
          <code className="rounded bg-[#f0f4f1] px-2 py-1 text-[10px] font-semibold text-[#5d7466]">{scope}</code>
        </div>
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-2 text-xs leading-6 text-[#6c7a71] [&_code]:rounded [&_code]:bg-[#f0f4f1] [&_code]:px-1 [&_code]:text-[11px] [&_li]:flex [&_li]:gap-1.5">{children}</div>
      </div>
    </Reveal>
  );
}
