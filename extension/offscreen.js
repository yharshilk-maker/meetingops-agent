let recorder;
let mediaStream;
let audioContext;
let session;
let settings;
let sequence = 0;
let uploadQueue = Promise.resolve();
let segmentTimer;
let stopping = false;

function headers(json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(settings.extensionToken ? { "X-MeetingOps-Extension-Token": settings.extensionToken } : {}),
  };
}

async function request(path, init) {
  const response = await fetch(`${settings.backendUrl}${path}`, init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `MeetingOps returned ${response.status}.`);
  return result;
}

function report(state) {
  chrome.runtime.sendMessage({ target: "service-worker", type: "capture-state", state }).catch(() => {});
}

async function uploadChunk(blob, chunkSequence) {
  if (!blob.size) return;
  const form = new FormData();
  form.set("sessionId", session.id);
  form.set("sequence", String(chunkSequence));
  form.set("audio", blob, `meeting-${chunkSequence}.webm`);
  const result = await request("/api/live-capture/chunk", { method: "POST", headers: headers(), body: form });
  report({ status: "recording", sessionId: session.id, chunksReceived: result.chunksReceived, lastTranscript: result.text });
}

function startSegment() {
  const parts = [];
  recorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 64000 });
  recorder.ondataavailable = (event) => {
    if (event.data.size) parts.push(event.data);
  };
  recorder.onstop = () => {
    clearTimeout(segmentTimer);
    const blob = new Blob(parts, { type: "audio/webm;codecs=opus" });
    const chunkSequence = sequence++;
    uploadQueue = uploadQueue.then(() => uploadChunk(blob, chunkSequence)).catch((error) => {
      report({ status: "failed", error: error.message });
      throw error;
    });
    if (!stopping) startSegment();
  };
  recorder.start();
  segmentTimer = setTimeout(() => recorder.stop(), 60000);
}

async function startRecording(message) {
  if (recorder?.state === "recording") throw new Error("MeetingOps is already recording.");
  settings = { backendUrl: message.backendUrl, extensionToken: message.extensionToken };
  session = await request("/api/live-capture/start", {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ title: message.title, meetingUrl: message.meetingUrl }),
  });
  sequence = 0;
  uploadQueue = Promise.resolve();
  stopping = false;
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: message.streamId } },
    video: false,
  });

  // Capturing a tab mutes its normal playback. Route it back to the speakers.
  audioContext = new AudioContext();
  audioContext.createMediaStreamSource(mediaStream).connect(audioContext.destination);
  startSegment();
  report({ status: "recording", sessionId: session.id, startedAt: session.startedAt, error: null });
}

async function stopRecording() {
  if (!recorder || recorder.state === "inactive") throw new Error("MeetingOps is not recording.");
  stopping = true;
  clearTimeout(segmentTimer);
  report({ status: "processing" });
  const stopped = new Promise((resolve) => recorder.addEventListener("stop", resolve, { once: true }));
  recorder.stop();
  await stopped;
  await Promise.resolve();
  mediaStream?.getTracks().forEach((track) => track.stop());
  await audioContext?.close();
  await uploadQueue;
  const result = await request("/api/live-capture/finish", {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ sessionId: session.id }),
  });
  report({ status: "completed", sessionId: session.id, runId: result.run.id, finishedAt: result.session.finishedAt });
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen") return;
  const task = message.type === "start-recording" ? startRecording(message) : stopRecording();
  task.then((result) => sendResponse({ ok: true, result })).catch((error) => {
    report({ status: "failed", error: error.message });
    sendResponse({ ok: false, error: error.message });
  });
  return true;
});
