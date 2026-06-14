// Server entry: thin wrapper that hands off to the client component.
import { requireBusiness } from "@/lib/session";
import { VideoStudioClient } from "./client";

export const dynamic = "force-dynamic";

export default async function VideoStudioPage() {
  await requireBusiness();
  return <VideoStudioClient />;
}
