import { Meeting } from "@/lib/meeting-engine";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

async function googleRequest<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Google API returned ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Renders the brief as simple HTML so Google converts it into a clean native Doc.
function meetingBriefHtml(meeting: Meeting) {
  const evidence = (item: { text: string; evidence: string; speaker: string }) =>
    `<li>${escapeHtml(item.text)}<br/><i>&ldquo;${escapeHtml(item.evidence)}&rdquo; — ${escapeHtml(item.speaker)}</i></li>`;
  return [
    `<h1>${escapeHtml(meeting.title)}</h1>`,
    `<p>${escapeHtml(meeting.summary)}</p>`,
    `<h2>Decisions</h2><ul>${meeting.decisions.map(evidence).join("")}</ul>`,
    `<h2>Action Items</h2><ul>${meeting.tasks.map((t) => `<li>${escapeHtml(t.text)} — <b>${escapeHtml(t.owner)}</b>, due ${escapeHtml(t.dueDate)}</li>`).join("")}</ul>`,
    `<h2>Risks &amp; Open Questions</h2><ul>${meeting.risks.map(evidence).join("")}</ul>`,
    `<hr/><p><i>Created by MeetingOps — routed to ${escapeHtml(meeting.folderPath)} (${meeting.folderConfidence}% confidence).</i></p>`,
  ].join("");
}

// Finds an app-created folder by name under a parent, or creates it. drive.file scope
// only sees files this app created, so this is idempotent across runs.
async function findOrCreateFolder(name: string, parentId: string | undefined, accessToken: string) {
  const safeName = name.replace(/'/g, "\\'");
  const parentClause = parentId ? `'${parentId}' in parents` : `'root' in parents`;
  const q = `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and ${parentClause}`;
  const found = await googleRequest<{ files?: { id: string }[] }>(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive&orderBy=createdTime`,
    accessToken,
  );
  if (found.files?.[0]?.id) return found.files[0].id;
  const created = await googleRequest<{ id: string }>(`${DRIVE_API}/files?fields=id`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) }),
  });
  return created.id;
}

export async function saveMeetingBriefToDrive(meeting: Meeting, accessToken: string) {
  // Build the full routed folder path the agent decided on, e.g.
  // MeetingOps / Product / CampusConnect / 2026-06-07 - Launch Review
  const segments = (meeting.folderPath || `MeetingOps / ${meeting.date} - ${meeting.title}`)
    .split("/").map((part) => part.trim()).filter(Boolean);
  const fileName = segments.length > 1 ? segments.pop()! : `${meeting.date} - ${meeting.title}`;
  let parentId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || undefined;
  for (const segment of segments) parentId = await findOrCreateFolder(segment, parentId, accessToken);

  // Upload as a native Google Doc (Drive converts the HTML source on upload).
  const metadata = JSON.stringify({ name: fileName, mimeType: "application/vnd.google-apps.document", parents: parentId ? [parentId] : [] });
  const boundary = "meetingops_boundary";
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${meetingBriefHtml(meeting)}\r\n--${boundary}--`;
  const file = await googleRequest<{ id: string; webViewLink?: string }>(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink`, accessToken, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return { folderId: parentId, fileId: file.id, webViewLink: file.webViewLink, folderPath: meeting.folderPath };
}

export async function createGmailFollowUpDraft(meeting: Meeting, accessToken: string) {
  const recipients = meeting.participants.filter((participant) => participant.includes("@")).join(", ");
  const actions = meeting.tasks.map((task) => `- ${task.text} — ${task.owner}, due ${task.dueDate}`).join("\n");
  const decisions = meeting.decisions.map((item) => `- ${item.text}`).join("\n");
  const message = [`To: ${recipients}`, `Subject: Recap: ${meeting.title}`, "Content-Type: text/plain; charset=UTF-8", "", meeting.summary, "", "Decisions:", decisions, "", "Action items:", actions].join("\r\n");
  const raw = Buffer.from(message).toString("base64url");
  const draft = await googleRequest<{ id: string; message: { id: string } }>(`${GMAIL_API}/drafts`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  return { ...draft, webUrl: "https://mail.google.com/mail/u/0/#drafts" };
}
