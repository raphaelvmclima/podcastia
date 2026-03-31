import { env } from "../lib/env.js";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import path from "path";

const TMP_DIR = "/tmp/podcastia";

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    execSync(`mkdir -p ${TMP_DIR}`);
  }
}

export async function generateAudio(
  script: string,
  voiceConfig?: { speaker1Name?: string; speaker1Voice?: string; speaker2Name?: string; speaker2Voice?: string }
): Promise<{ audioPath: string; duration: number }> {
  ensureTmpDir();

  const speaker1 = voiceConfig?.speaker1Name || "Léo";
  const speaker1Voice = voiceConfig?.speaker1Voice || "Sadachbia";
  const speaker2 = voiceConfig?.speaker2Name || "Isa";
  const speaker2Voice = voiceConfig?.speaker2Voice || "Leda";

  const timestamp = Date.now();
  const pcmFile = path.join(TMP_DIR, `audio_${timestamp}.pcm`);
  const mp3File = path.join(TMP_DIR, `audio_${timestamp}.mp3`);
  const musicFile = path.join(TMP_DIR, `music_${timestamp}.mp3`);
  const outputFile = path.join(TMP_DIR, `podcast_${timestamp}.ogg`);

  // Step 1: Call Gemini TTS (multi-speaker)
  const ttsPayload = {
    contents: [{
      parts: [{
        text: `Fale com entusiasmo, bastante energia e empolgação num tom bastante brincalhão.\n${script}`,
      }],
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      temperature: 1.2,
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: speaker1, voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker1Voice } } },
            { speaker: speaker2, voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker2Voice } } },
          ],
        },
      },
    },
  };

  const ttsRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${env.GOOGLE_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ttsPayload) }
  );

  if (!ttsRes.ok) {
    const errText = await ttsRes.text();
    throw new Error(`Gemini TTS failed: ${ttsRes.status} ${errText}`);
  }

  const ttsData = (await ttsRes.json()) as any;
  const audioBase64 = ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioBase64) throw new Error("No audio data in Gemini TTS response");

  // Step 2: Decode base64 to PCM
  const audioBuffer = Buffer.from(audioBase64, "base64");
  writeFileSync(pcmFile, audioBuffer);

  // Step 3: Convert PCM to MP3
  execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i ${pcmFile} -codec:a mp3 -b:a 192k ${mp3File}`);

  // Step 4: Download background music from Supabase Storage
  const musicUrl = "https://iaibdujgbbdtkthdaxzv.supabase.co/storage/v1/object/public/Audio%20podcast/podcast_sound%20(2).mpeg";
  const musicRes = await fetch(musicUrl);
  const musicBuffer = Buffer.from(await musicRes.arrayBuffer());
  writeFileSync(musicFile, musicBuffer);

  // Step 5: Mix podcast with background music
  // 4s intro music, voice fades in, music at 0.08 volume during speech, 4s fade out
  const filterComplex = [
    "[0:a]adelay=4000|4000,apad=pad_dur=4[a1]",
    "[1:a]aloop=loop=-1:size=2e+09[loop]",
    "[loop]volume='if(lt(t,4),(1-t/4)*0.9+0.1,0.08)':eval=frame[music]",
    "[a1][music]amix=inputs=2:duration=first[mixed]",
    "[mixed]afade=t=out:st=${FADE_START}:d=4",
  ].join(";");

  const mixCmd = `DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${mp3File}) && FADE_START=$(echo "$DURATION + 4" | bc) && ffmpeg -y -i ${mp3File} -i ${musicFile} -filter_complex "${filterComplex}" -ac 1 -codec:a libvorbis -q:a 4 ${outputFile}`;

  execSync(mixCmd, { shell: "/bin/bash" });

  // Get duration
  const durationStr = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${outputFile}`
  ).toString().trim();
  const duration = Math.round(parseFloat(durationStr));

  // Cleanup temp files
  for (const f of [pcmFile, mp3File, musicFile]) {
    try { unlinkSync(f); } catch {}
  }

  return { audioPath: outputFile, duration };
}

export function audioToBase64(filePath: string): string {
  const buffer = readFileSync(filePath);
  return buffer.toString("base64");
}
