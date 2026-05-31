// Thin wrapper around the browser's Web Speech API for the chat
// composer's push-to-talk mic button. Lives outside the chat page
// because:
//   1. The vendor-prefix detection + lazy SpeechRecognition
//      construction is identical no matter where it's used.
//   2. The chat page is already long enough; isolating the
//      transcription state lets the page stay focused on UI.
//
// Web Speech API supports:
//   - Chromium-family (Chrome, Edge, Opera, Brave)
//   - Safari on macOS 14+ and iOS 14+ (it's there but routes
//     through the system speech recognizer)
//   - Firefox has limited / experimental support; we treat it as
//     unsupported via feature detection so the mic button hides
//     instead of failing at start() time.

// Browsers don't ship a stable type for window.SpeechRecognition;
// the @types/dom version has improved but still flags this as a
// vendor-prefixed surface. Cast through unknown to keep TS quiet
// while staying explicit about what we're reaching for.
type SpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
};

type SpeechRecognitionErrorEvent = {
  error: string;
  message?: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

/**
 * Returns the SpeechRecognition constructor for the current
 * browser, or null when none is available. Safe to call at module
 * load time on the server (returns null when window is undefined).
 *
 * Callers should treat a null result as "voice input is not
 * supported on this browser" and hide the mic button entirely
 * rather than render a control that won't do anything.
 */
export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Shape callers consume — the underlying SpeechRecognition surface
 * is intentionally not leaked so a future swap (e.g. to
 * expo-speech-recognition's web counterpart, or a server-side
 * Whisper path) doesn't ripple through the chat page.
 */
export type SpeechSession = {
  /** Stop listening and finalize whatever has been heard so far. */
  stop: () => void;
  /** Abort listening immediately; no final result is emitted. */
  abort: () => void;
};

export type SpeechSessionCallbacks = {
  /**
   * Called every time the recognizer has new text — both interim
   * (partial, in-progress) and final (committed) results. The
   * transcript passed is the cumulative text since session start;
   * the chat page swaps it into the composer's `input` state on
   * every callback so the user sees their words typed live.
   */
  onTranscript: (transcript: string, isFinal: boolean) => void;
  /**
   * Called once when the recognizer stops (either via stop(),
   * abort(), or naturally on silence). Useful to flip a UI flag
   * out of "listening" state.
   */
  onEnd: () => void;
  /**
   * Called on any recognizer error. The browser emits a string
   * code (e.g. "not-allowed", "no-speech", "network"). The chat
   * page mostly surfaces "not-allowed" since that's the only one
   * the user can act on; the rest are logged.
   */
  onError: (error: string) => void;
};

/**
 * Start a speech recognition session and return controls to stop
 * or abort it. Throws when the API isn't available — callers
 * should feature-detect via getSpeechRecognitionCtor() before
 * showing the mic button at all.
 */
export function startSpeechSession(
  callbacks: SpeechSessionCallbacks,
): SpeechSession {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    throw new Error("SpeechRecognition is not available in this browser");
  }
  const recognition = new Ctor();
  // continuous=false because v1 is push-to-talk: the user holds the
  // button, talks once, releases. Continuous mode + manual stop is
  // also viable but adds a "did I forget to stop recording?" trap.
  recognition.continuous = false;
  // interimResults=true streams partial transcripts as the user
  // speaks, so the composer fills in live instead of jumping in
  // one big chunk at the end.
  recognition.interimResults = true;
  // en-US is fine as a default for the v1 user base; lifting this
  // into a user preference is a small follow-up once the rest of
  // voice-mode is in place.
  recognition.lang = "en-US";

  recognition.onresult = (ev) => {
    // Build the cumulative transcript by walking every result the
    // recognizer has emitted in this session. Web Speech API
    // events carry the *full* result list each time, not just the
    // delta, so we don't have to track state ourselves.
    let cumulative = "";
    let allFinal = true;
    for (let i = 0; i < ev.results.length; i++) {
      const r = ev.results[i];
      cumulative += r[0].transcript;
      if (!r.isFinal) allFinal = false;
    }
    callbacks.onTranscript(cumulative, allFinal);
  };

  recognition.onerror = (ev) => {
    callbacks.onError(ev.error);
  };

  recognition.onend = () => {
    callbacks.onEnd();
  };

  recognition.start();

  return {
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}
