import { publicPath } from "./publicPath";

type SttResponse = {
  text?: string;
};

type BrowserSpeechRecognitionResult = {
  transcript: string;
};

type BrowserSpeechRecognitionAlternative = {
  transcript: string;
};

type BrowserSpeechRecognitionEvent = Event & {
  results: ArrayLike<ArrayLike<BrowserSpeechRecognitionAlternative>>;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

function getSupportedMimeType() {
  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];

  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

function getFileExtension(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  return "webm";
}

export async function recordAndTranscribe(durationMs = 3500) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone recording.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  await new Promise<void>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Microphone recording failed."));
    recorder.onstop = () => resolve();
    recorder.start();
    window.setTimeout(() => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }, durationMs);
  });

  stream.getTracks().forEach((track) => track.stop());

  const audioBlob = new Blob(chunks, { type: mimeType || "audio/webm" });
  const body = new FormData();
  body.append("audio", audioBlob, `voice-command.${getFileExtension(audioBlob.type)}`);

  const response = await fetch(publicPath("/api/stt"), {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error("STT request failed.");
  }

  const result = (await response.json()) as SttResponse;
  return result.text?.trim() || "";
}

export async function listenWithBrowserSpeech(durationMs = 4500) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    throw new Error("This browser does not support Web Speech recognition.");
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "ko-KR";
  recognition.maxAlternatives = 1;

  let timeoutId: number | null = null;
  let settled = false;

  return await new Promise<string>((resolve, reject) => {
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      callback();
    };

    recognition.onresult = (event) => {
      const result = event.results[0]?.[0] as BrowserSpeechRecognitionResult | undefined;
      settle(() => resolve(result?.transcript.trim() || ""));
    };

    recognition.onerror = (event) => {
      settle(() => reject(new Error(`Browser speech recognition failed: ${event.error}`)));
    };

    recognition.onend = () => {
      settle(() => resolve(""));
    };

    recognition.start();

    timeoutId = window.setTimeout(() => {
      recognition.stop();
    }, durationMs);
  });
}
