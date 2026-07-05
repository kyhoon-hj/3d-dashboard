import textToSpeech from "@google-cloud/text-to-speech";

export const runtime = "nodejs";

const client = new textToSpeech.TextToSpeechClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

type TtsRequestBody = {
  text?: string;
};

function escapeSsml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSpeechInput(text: string) {
  const speakingRate = process.env.GOOGLE_TTS_SPEAKING_RATE;
  const pitch = process.env.GOOGLE_TTS_PITCH;

  if (!speakingRate && !pitch) {
    return { text };
  }

  const attributes = [
    speakingRate ? `rate="${speakingRate}"` : null,
    pitch ? `pitch="${pitch}"` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ssml: `<speak><prosody ${attributes}>${escapeSsml(text)}</prosody></speak>`,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TtsRequestBody;
    const text = body.text?.trim();

    if (!text) {
      return Response.json({ error: "Text is required." }, { status: 400 });
    }

    if (text.length > 500) {
      return Response.json({ error: "Text is too long." }, { status: 400 });
    }

    const [response] = await client.synthesizeSpeech({
      input: buildSpeechInput(text),
      voice: {
        languageCode: process.env.GOOGLE_TTS_LANGUAGE_CODE || "ko-KR",
        name: process.env.GOOGLE_TTS_VOICE_NAME || "ko-KR-Standard-A",
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    });

    const audioContent = response.audioContent;

    if (!audioContent) {
      return Response.json({ error: "TTS audio was not generated." }, { status: 502 });
    }

    const audioBuffer =
      typeof audioContent === "string"
        ? Buffer.from(audioContent, "base64")
        : Buffer.from(audioContent);
    const audioBody = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer;

    return new Response(audioBody, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("Google TTS request failed:", error);
    return Response.json({ error: "Failed to generate speech." }, { status: 500 });
  }
}
