import { demoMeetEvent, processGoogleMeetEvent } from "@/lib/agent/runtime";

export async function POST(request: Request) {
  const { index = 0 } = await request.json() as { index?: number };
  const run = await processGoogleMeetEvent(demoMeetEvent(index));
  return Response.json(run, { status: 202 });
}
