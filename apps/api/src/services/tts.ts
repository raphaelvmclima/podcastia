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
    voiceDirection: "Fale como dois amigos num bar, rindo, se interrompendo, com tom informal e descontraido. Muita risada e espontaneidade.",
    temperature: 1.2,
    musicVolume: 0.08,
  },
  aula: {
    voiceDirection: "Fale como uma professora paciente e carinhosa explicando para um aluno curioso. Tom calmo, pedagogico, com pausas para o aluno pensar. O aluno fala com curiosidade e duvida.",
    temperature: 0.9,
    musicVolume: 0.05,
  },
  jornalistico: {
    voiceDirection: "Fale como apresentadores de telejornal da Globo. Tom serio, formal, profissional. Diccao perfeita. Sem emocao exagerada.",
    temperature: 0.8,
    musicVolume: 0.06,
  },
  resumo: {
    voiceDirection: "Fale de forma RAPIDA, direta e objetiva. Como um assistente executivo fazendo um briefing de 2 minutos. Ritmo acelerado, sem pausas longas.",
    temperature: 0.7,
    musicVolume: 0.04,
  },
  comentarios: {
    voiceDirection: "Fale com paixao e engajamento. Dois comentaristas que discordam frequentemente mas se respeitam. Tom de mesa redonda.",
    temperature: 1.1,
    musicVolume: 0.07,
  },
  storytelling: {
    voiceDirection: "Fale como um contador de historias magistral. Varie o ritmo: lento no suspense, rapido na acao, suave na reflexao. Tom dramatico e envolvente.",
    temperature: 1.3,
    musicVolume: 0.10,
  },
  estudo: {
    voiceDirection: "Fale como uma pesquisadora universitaria apaixonada pelo assunto, explicando com clareza e entusiasmo. O estudante fala com curiosidade genuina, surpresa ao aprender coisas novas. Ritmo calmo nas explicacoes complexas, enfatico nos pontos importantes e curiosidades.",
    temperature: 0.9,
    musicVolume: 0.05,
  },
  debate: {
    voiceDirection: "Fale com intensidade e paixao. Dois debatedores que discordam fortemente. Tom acalorado, energico, quase agressivo mas sempre respeitoso.",
    temperature: 1.3,
    musicVolume: 0.07,
  },
  entrevista: {
    voiceDirection: "Fale como um jornalista fazendo perguntas incisivas e uma especialista respondendo com confianca. Tom profissional e dinamico.",
    temperature: 1.0,
    musicVolume: 0.06,
  },
  motivacional: {
    voiceDirection: "Fale com MAXIMA energia, empolgacao e poder. Como Tony Robbins em um palco. Voz potente, vibrante, que faz o ouvinte levantar da cadeira. GRITE as partes mais intensas.",
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
