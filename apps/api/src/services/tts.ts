import { env } from "../lib/env.js";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import path from "path";

const TMP_DIR = "/tmp/podcastia";
const MUSIC_CACHE_PATH = "/tmp/podcastia/bg_music.mp3";

// ── Voice Direction per Theme ───────────────────────────────────────────────

interface ThemeAudioConfig {
  voiceDirection: string;
  temperature: number;
  musicVolume: number;
}

const THEME_AUDIO_CONFIGS: Record<string, ThemeAudioConfig> = {
  conversa: {
    voiceDirection: "Fale com entusiasmo, energia e empolgacao num tom brincalhao e descontraido, como dois amigos conversando.",
    temperature: 1.2,
    musicVolume: 0.08,
  },
  aula: {
    voiceDirection: "Fale de forma clara, didatica e paciente, como um professor explicando para alunos curiosos. Tom calmo, encorajador e pedagogico. Faca pausas naturais para enfatizar pontos importantes.",
    temperature: 0.9,
    musicVolume: 0.05,
  },
  jornalistico: {
    voiceDirection: "Fale com tom profissional e serio, como apresentadores de um telejornal respeitado. Voz firme, diccao impecavel, ritmo constante e cadenciado. Transmita credibilidade e autoridade.",
    temperature: 0.8,
    musicVolume: 0.06,
  },
  resumo: {
    voiceDirection: "Fale de forma direta, objetiva e eficiente, como um assistente executivo fazendo um briefing. Ritmo agil mas claro, sem enrolacao. Tom profissional e assertivo.",
    temperature: 0.7,
    musicVolume: 0.04,
  },
  comentarios: {
    voiceDirection: "Fale com tom analitico e engajado, alternando entre seriedade e descontracao ao dar opinioes. Demonstre interesse genuino e paixao pelos temas.",
    temperature: 1.1,
    musicVolume: 0.07,
  },
  storytelling: {
    voiceDirection: "Fale com tom envolvente e dramatico, variando ritmo e emocao como um contador de historias magistral. Use suspense, surpresa e emocao na voz. Prenda a atencao do ouvinte.",
    temperature: 1.3,
    musicVolume: 0.10,
  },
  estudo_biblico: {
    voiceDirection: "Fale com tom reverente, acolhedor e sereno. Voz suave e reflexiva, transmitindo paz, sabedoria e compaixao. Ritmo calmo e contemplativo, com pausas para reflexao.",
    temperature: 0.8,
    musicVolume: 0.06,
  },
  debate: {
    voiceDirection: "Fale com energia e paixao, como debatedores defendendo posicoes com conviccao. Tom intenso mas respeitoso. Cada host deve demonstrar firmeza em seus argumentos com emocao na voz.",
    temperature: 1.3,
    musicVolume: 0.07,
  },
  entrevista: {
    voiceDirection: "Fale com tom profissional e curioso. O entrevistador faz perguntas incisivas e provocativas. A especialista responde com confianca e profundidade. Dialogo natural e fluido.",
    temperature: 1.0,
    musicVolume: 0.06,
  },
  motivacional: {
    voiceDirection: "Fale com MUITA energia, empolgacao e entusiasmo vibrante. Tom inspirador e poderoso, como um coach motivacional que transforma vidas. Transmita forca, determinacao e positividade contagiante.",
    temperature: 1.4,
    musicVolume: 0.09,
  },
};

function getThemeAudioConfig(theme: string): ThemeAudioConfig {
  return THEME_AUDIO_CONFIGS[theme] || THEME_AUDIO_CONFIGS.conversa;
}

async function getBackgroundMusic(): Promise<string> {
  if (existsSync(MUSIC_CACHE_PATH)) return MUSIC_CACHE_PATH;
  mkdirSync("/tmp/podcastia", { recursive: true });
  const musicUrl = "https://iaibdujgbbdtkthdaxzv.supabase.co/storage/v1/object/public/Audio%20podcast/podcast_sound%20(2).mpeg";
  const res = await fetch(musicUrl);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(MUSIC_CACHE_PATH, buffer);
  return MUSIC_CACHE_PATH;
}

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    execSync(`mkdir -p ${TMP_DIR}`);
  }
}

export async function generateAudio(
  script: string,
  voiceConfig?: { speaker1Name?: string; speaker1Voice?: string; speaker2Name?: string; speaker2Voice?: string },
  theme: string = "conversa"
): Promise<{ audioPath: string; duration: number }> {
  ensureTmpDir();

  const speaker1 = voiceConfig?.speaker1Name || "Leo";
  const speaker1Voice = voiceConfig?.speaker1Voice || "Sadachbia";
  const speaker2 = voiceConfig?.speaker2Name || "Isa";
  const speaker2Voice = voiceConfig?.speaker2Voice || "Leda";

  const audioConfig = getThemeAudioConfig(theme);

  const timestamp = Date.now();
  const pcmFile = path.join(TMP_DIR, `audio_${timestamp}.pcm`);
  const mp3File = path.join(TMP_DIR, `audio_${timestamp}.mp3`);
  const musicFile = path.join(TMP_DIR, `music_${timestamp}.mp3`);
  const outputFile = path.join(TMP_DIR, `podcast_${timestamp}.ogg`);

  const ttsPayload = {
    contents: [{
      parts: [{
        text: `${audioConfig.voiceDirection}\n${script}`,
      }],
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      temperature: audioConfig.temperature,
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

  const audioBuffer = Buffer.from(audioBase64, "base64");
  writeFileSync(pcmFile, audioBuffer);

  execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i ${pcmFile} -codec:a mp3 -b:a 192k ${mp3File}`);

  const cachedMusic = await getBackgroundMusic();
  const musicBuffer = readFileSync(cachedMusic);
  writeFileSync(musicFile, musicBuffer);

  const introVol = Math.min(audioConfig.musicVolume * 10, 0.9).toFixed(2);
  const speechVol = audioConfig.musicVolume.toFixed(2);
  const filterComplex = [
    "[0:a]adelay=4000|4000,apad=pad_dur=4[a1]",
    "[1:a]aloop=loop=-1:size=2e+09[loop]",
    `[loop]volume='if(lt(t,4),(1-t/4)*${introVol}+${speechVol},${speechVol})':eval=frame[music]`,
    "[a1][music]amix=inputs=2:duration=first[mixed]",
    "[mixed]afade=t=out:st=${FADE_START}:d=4",
  ].join(";");

  const mixCmd = `DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${mp3File}) && FADE_START=$(echo "$DURATION + 4" | bc) && ffmpeg -y -i ${mp3File} -i ${musicFile} -filter_complex "${filterComplex}" -ac 1 -codec:a libvorbis -q:a 4 ${outputFile}`;

  execSync(mixCmd, { shell: "/bin/bash" });

  const durationStr = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${outputFile}`
  ).toString().trim();
  const duration = Math.round(parseFloat(durationStr));

  for (const f of [pcmFile, mp3File, musicFile]) {
    try { unlinkSync(f); } catch {}
  }

  return { audioPath: outputFile, duration };
}

export function audioToBase64(filePath: string): string {
  const buffer = readFileSync(filePath);
  return buffer.toString("base64");
}
