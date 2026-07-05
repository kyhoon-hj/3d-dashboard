const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

export async function playTts(text: string) {
  if (typeof window === "undefined") return;

  const normalizedText = text.trim();
  if (!normalizedText) return;

  let audioUrl = audioCache.get(normalizedText);

  if (!audioUrl) {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: normalizedText }),
    });

    if (!response.ok) {
      throw new Error("TTS request failed.");
    }

    const audioBlob = await response.blob();
    audioUrl = URL.createObjectURL(audioBlob);
    audioCache.set(normalizedText, audioUrl);
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  currentAudio = new Audio(audioUrl);
  await currentAudio.play();
}

export function playTtsAfterUserGesture(text: string) {
  const handlePointerDown = () => {
    window.removeEventListener("pointerdown", handlePointerDown);
    void playTts(text).catch((error) => {
      console.error("TTS playback failed after user gesture:", error);
    });
  };

  window.addEventListener("pointerdown", handlePointerDown, { once: true });
}
