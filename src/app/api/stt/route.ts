import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return Response.json({ error: "Audio file is required." }, { status: 400 });
    }

    if (audio.size === 0) {
      return Response.json({ error: "Audio file is empty." }, { status: 400 });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: process.env.OPENAI_STT_MODEL || "whisper-1",
      language: process.env.OPENAI_STT_LANGUAGE || "ko",
      response_format: "json",
    });

    return Response.json({ text: transcription.text });
  } catch (error) {
    console.error("OpenAI STT request failed:", error);
    return Response.json({ error: "Failed to transcribe audio." }, { status: 500 });
  }
}
