/**
 * Media Processor for PodcastIA
 *
 * Processes WhatsApp media into text content:
 * - Audio/PTT: Whisper transcription (local, localhost:5005)
 * - Image: Gemini vision description
 * - Video: Extract audio -> Whisper transcription
 * - PDF/Document: pdf-parse text extraction
 */

import { env } from "../lib/env.js";
// pdf-parse loaded dynamically
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";

const WHISPER_URL = "http://localhost:5005";
const TMP_DIR = "/tmp/podcastia/media";
const GEMINI_MODEL = "gemini-2.5-flash";

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

async function downloadMedia(
  base64?: string,
  mediaUrl?: string,
  mimetype?: string
): Promise<{ filePath: string; mime: string } | null> {
  ensureTmpDir();
  const id = Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  try {
    if (base64) {
      const ext = mimetype?.includes("ogg") ? "ogg"
        : mimetype?.includes("mp4") ? "mp4"
        : mimetype?.includes("webp") ? "webp"
        : mimetype?.includes("jpeg") || mimetype?.includes("jpg") ? "jpg"
        : mimetype?.includes("png") ? "png"
        : mimetype?.includes("mp3") ? "mp3"
        : mimetype?.includes("pdf") ? "pdf"
        : "bin";
      const filePath = TMP_DIR + "/" + id + "." + ext;
      writeFileSync(filePath, Buffer.from(base64, "base64"));
      return { filePath, mime: mimetype || "application/octet-stream" };
    }

    if (mediaUrl) {
      const resp = await fetch(mediaUrl, { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) return null;
      const buffer = Buffer.from(await resp.arrayBuffer());
      const ct = resp.headers.get("content-type") || mimetype || "";
      const ext = ct.includes("ogg") ? "ogg"
        : ct.includes("mp4") ? "mp4"
        : ct.includes("jpeg") ? "jpg"
        : ct.includes("png") ? "png"
        : ct.includes("webp") ? "webp"
        : ct.includes("pdf") ? "pdf"
        : "bin";
      const filePath = TMP_DIR + "/" + id + "." + ext;
      writeFileSync(filePath, buffer);
      return { filePath, mime: ct };
    }

    return null;
  } catch (err: any) {
    console.error("[media-processor] Download error:", err.message);
    return null;
  }
}

async function transcribeAudio(filePath: string): Promise<string | null> {
  try {
    const wavPath = filePath.replace(/\.[^.]+$/, ".wav");
    if (filePath !== wavPath) {
      try {
        execSync("ffmpeg -y -i \"" + filePath + "\" -ar 16000 -ac 1 \"" + wavPath + "\" 2>/dev/null", { timeout: 30000 });
      } catch {}
    }

    const fileToSend = existsSync(wavPath) ? wavPath : filePath;

    const resp = await fetch(WHISPER_URL + "/transcrever", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arquivo: fileToSend }),
      signal: AbortSignal.timeout(120000),
    });

    if (!resp.ok) {
      console.error("[media-processor] Whisper error:", resp.status);
      return null;
    }

    const data = (await resp.json()) as any;
    const text = data?.transcricao || data?.text || "";

    try { unlinkSync(filePath); } catch {}
    try { if (wavPath !== filePath) unlinkSync(wavPath); } catch {}

    if (text.trim().length < 3) return null;
    return text.trim();
  } catch (err: any) {
    console.error("[media-processor] Transcribe error:", err.message);
    return null;
  }
}

async function describeImage(filePath: string, mime: string): Promise<string | null> {
  try {
    const b64 = readFileSync(filePath).toString("base64");
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + env.GOOGLE_API_KEY;

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: mime, data: b64 } },
            { text: "Descreva esta imagem em portugues brasileiro de forma detalhada e informativa. Se for um print de conversa, transcreva o conteudo. Se for um grafico ou infografico, extraia os dados. Se for uma foto, descreva o contexto. Maximo 500 caracteres." }
          ]
        }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.2 }
      })
    });

    if (!resp.ok) {
      console.error("[media-processor] Gemini vision error:", resp.status);
      return null;
    }

    const data = (await resp.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    try { unlinkSync(filePath); } catch {}
    return text?.trim() || null;
  } catch (err: any) {
    console.error("[media-processor] Image describe error:", err.message);
    return null;
  }
}

async function processVideo(filePath: string): Promise<string | null> {
  try {
    const audioPath = filePath.replace(/\.[^.]+$/, "_audio.wav");
    execSync("ffmpeg -y -i \"" + filePath + "\" -vn -ar 16000 -ac 1 \"" + audioPath + "\" 2>/dev/null", { timeout: 60000 });

    if (!existsSync(audioPath)) {
      console.error("[media-processor] Failed to extract audio from video");
      return null;
    }

    const text = await transcribeAudio(audioPath);
    try { unlinkSync(filePath); } catch {}
    return text;
  } catch (err: any) {
    console.error("[media-processor] Video process error:", err.message);
    return null;
  }
}

async function extractPdfText(filePath: string): Promise<string | null> {
  try {
    const buffer = readFileSync(filePath);
    const data = await (await import("pdf-parse")).default(buffer);
    const text = data?.text?.trim();
    try { unlinkSync(filePath); } catch {}
    if (!text || text.length < 5) return null;
    return text.slice(0, 5000);
  } catch (err: any) {
    console.error("[media-processor] PDF parse error:", err.message);
    return null;
  }
}

export async function processMedia(
  messageType: string,
  base64?: string,
  mediaUrl?: string,
  mimetype?: string,
  caption?: string
): Promise<{ text: string; mediaType: string } | null> {
  const type = messageType.toLowerCase();

  const isAudio = type.includes("audio") || type.includes("ptt") || mimetype?.includes("audio") || mimetype?.includes("ogg");
  const isImage = type.includes("image") || mimetype?.includes("image");
  const isVideo = type.includes("video") || mimetype?.includes("video");
  const isPdf = type.includes("document") || mimetype?.includes("pdf");

  if (!isAudio && !isImage && !isVideo && !isPdf) return null;

  const media = await downloadMedia(base64, mediaUrl, mimetype);
  if (!media) {
    console.error("[media-processor] Could not download media");
    return null;
  }

  let text: string | null = null;
  let mediaType = "text";

  if (isAudio) {
    text = await transcribeAudio(media.filePath);
    mediaType = "audio_transcription";
    if (text) text = "[Audio transcrito]: " + text;
  } else if (isImage) {
    text = await describeImage(media.filePath, media.mime);
    mediaType = "image_description";
    if (text) text = "[Imagem]: " + text;
  } else if (isVideo) {
    text = await processVideo(media.filePath);
    mediaType = "video_transcription";
    if (text) text = "[Video transcrito]: " + text;
  } else if (isPdf) {
    text = await extractPdfText(media.filePath);
    mediaType = "pdf_extraction";
    if (text) text = "[PDF]: " + text;
  }

  if (caption && text) {
    text = text + "\nLegenda: " + caption;
  } else if (caption && !text) {
    text = caption;
    mediaType = "text";
  }

  if (!text) return null;
  return { text, mediaType };
}
