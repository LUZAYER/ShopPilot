import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFileSync, unlinkSync, readFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

/**
 * POST /api/video/export
 *
 * Accepts a WebM video blob from the client-side MediaRecorder and transcodes
 * it to MP4 using the system ffmpeg binary. Returns the MP4 as a binary
 * response with the correct content-type.
 *
 * If ffmpeg is not available, returns the original WebM so the client can
 * still download something (just not MP4).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.arrayBuffer();
    if (body.byteLength === 0) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 });
    }

    // Cap upload at 200 MB to protect the server.
    if (body.byteLength > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "Video too large (max 200 MB)" }, { status: 413 });
    }

    // Try ffmpeg transcoding. If it fails, fall back to returning the WebM as-is.
    try {
      const tmpDir = mkdtempSync(join(tmpdir(), "sp-vid-"));
      const webmPath = join(tmpDir, "input.webm");
      const mp4Path = join(tmpDir, "output.mp4");

      writeFileSync(webmPath, Buffer.from(body));

      // -y: overwrite, -i: input, -movflags +faststart: streamable MP4,
      // -c:v libx264: H.264 video, -c:a aac: AAC audio, -preset fast: speed,
      // -crf 23: quality (lower = better, 23 is default).
      await execFileAsync("ffmpeg", [
        "-y",
        "-i", webmPath,
        "-movflags", "+faststart",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        mp4Path
      ], { timeout: 120_000 }); // 2-minute hard cap

      const mp4Data = readFileSync(mp4Path);

      // Clean up temp files.
      try { unlinkSync(webmPath); } catch { /* ignore */ }
      try { unlinkSync(mp4Path); } catch { /* ignore */ }
      try { unlinkSync(tmpDir); } catch { /* ignore */ }

      return new NextResponse(mp4Data, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(mp4Data.byteLength),
          "Content-Disposition": 'attachment; filename="shoppilot-promo.mp4"'
        }
      });
    } catch (ffmpegErr) {
      // ffmpeg not available or transcoding failed — return WebM as-is.
      console.warn("[video/export] ffmpeg transcoding failed, returning WebM:", String(ffmpegErr));
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "video/webm",
          "Content-Length": String(body.byteLength),
          "Content-Disposition": 'attachment; filename="shoppilot-promo.webm"',
          "X-Transcode-Failed": "true"
        }
      });
    }
  } catch (e) {
    return NextResponse.json({ error: "Export failed", detail: String(e) }, { status: 500 });
  }
}
