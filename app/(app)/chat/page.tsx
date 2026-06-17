"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Composer } from "@/components/chat/composer";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { PlusIcon, SpeakerIcon } from "@/components/chat/icons";
import type { Message, ToolCall } from "@/components/chat/types";
import { config } from "@/lib/config";
import { parseSSE } from "@/lib/stream";
import {
  appendChatTurn,
  createChatSession,
  getChatSession,
  patchChatSessionTitle,
  type ChatMessage as PersistedChatMessage,
} from "@/lib/api";
import { blobToBase64, generateChatTitle, type ContentBlock } from "@/lib/agent";
import { getSpeechRecognitionCtor, startSpeechSession, type SpeechSession } from "@/lib/speech";
import { useToast } from "@/components/toast";
import { useUsage } from "@/lib/usage-context";
import { useProfile } from "@/lib/profile-context";
import { cappedMessage, formatResetCountdown } from "@/components/usage-bar";

// Image-attach constraints (photo-meal-logging SOW). 5 MB cap keeps the
// base64 payload posted to the agent reasonable; the three MIME types are
// the formats Claude vision accepts. Both validated client-side with a
// toast on rejection.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// The narrowed media type used in the image content block + the chip
// state. Keeping it as a named type avoids `as never` casts at the call
// sites that build the agent payload.
type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

/**
 * Validate a picked/dropped/pasted File. Rejects the wrong MIME type and
 * oversize files with a specific toast; on success returns the blob and
 * its narrowed media type. Pure aside from the toast side-effect so the
 * three entry points (picker, drop, paste) share one validation path.
 */
function acceptImageFile(
  file: File,
  toast: ReturnType<typeof useToast>,
): { blob: Blob; mediaType: ImageMediaType } | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    toast.error("Use JPG, PNG, or WebP.");
    return null;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast.error("Image must be under 5 MB.");
    return null;
  }
  // file.type is one of ALLOWED_TYPES here, which are exactly the
  // ImageMediaType members — narrow via a guarded assignment, no cast.
  const mediaType = file.type as ImageMediaType;
  return { blob: file, mediaType };
}

// `Message` and `ToolCall` are imported from @/components/chat/types —
// the shared shapes the extracted chat components render against.

// Feature-detect SpeechRecognition once at module load. Anywhere in the
// page that gates a mic-related affordance reads this — null means we
// hide the button entirely. Computed once because the support state
// doesn't change at runtime, and the chat page re-renders enough that
// running the lookup per render would be wasteful.
const SPEECH_CTOR = getSpeechRecognitionCtor();
const SPEECH_SUPPORTED = SPEECH_CTOR !== null;

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("session");
  const toast = useToast();
  // Shared daily-AI-usage snapshot (settings + chat read one source).
  // When `capped`, the composer disables and a banner explains the reset.
  const usage = useUsage();
  const { capped, resetsAt, refresh: refreshUsage } = usage;
  // Shared resolved profile (settings + sidebar + chat read one source).
  // The /chat payload carries display_name + height_cm alongside
  // client_timezone so the agent can address the user by name and
  // reference their height as conversational context.
  const { profile } = useProfile();
  // The "Daily AI allowance used. Resets in Xh Ym." tooltip on the
  // disabled composer controls. Recomputed each render off resetsAt.
  const cappedTooltip = `Daily AI allowance used. Resets in ${formatResetCountdown(
    resetsAt.getTime() - Date.now(),
  )}.`;

  // The active session id. Set immediately on mount: either from the
  // URL (resume) or a fresh client-minted UUID (new chat). For the
  // new-chat path the server-side row is created lazily inside
  // send() — eager creation would litter the user's history with
  // empty sessions every time they tap the chat surface without
  // actually sending a message.
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Whether the API has the chat_sessions row for this id. True
  // after a successful resume GET or after the lazy POST inside
  // send(). Drives whether send() needs to call createChatSession
  // before appending the first turn.
  const [sessionPersisted, setSessionPersisted] = useState(false);
  // Loading is only meaningful for the resume path — we have to
  // wait for the GET before we know what messages to show. The
  // composer is gated on `!loading` so a user can't send into a
  // session whose history hasn't loaded yet (the new turn would
  // append to position N but the rehydrated history would show
  // position 0..N-1 mid-flight).
  const [loading, setLoading] = useState<boolean>(!!urlSessionId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // The image staged for the next turn. `previewUrl` is an
  // object URL for the chip thumbnail (revoked on replace/dismiss/send).
  // `blob` is base64-encoded into the agent payload at send time; the
  // raw bytes never touch state beyond this. null = no image staged.
  const [pendingImage, setPendingImage] = useState<{
    blob: Blob;
    previewUrl: string;
    filename: string;
    mediaType: ImageMediaType;
  } | null>(null);
  // The hidden <input type="file"> the paperclip button proxies clicks
  // to. A ref (not state) because we only ever imperatively .click() it.
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Voice mode: when on, the page asks the agent's /speak endpoint
  // for an mp3 of each completed assistant turn and plays it. Off
  // by default; survives component-level re-renders but not refresh
  // (per the voice-chat SOW's "session-only" lean).
  const [voiceMode, setVoiceMode] = useState(false);
  // True once voice mode has been auto-disabled because the user hit
  // their daily cap. Drives a small inline note next to the voice
  // toggle so the user knows why it switched off (rather than silently).
  const [voiceForcedOff, setVoiceForcedOff] = useState(false);
  // Mobile-only conversation pane. On lg+ the ConversationList is a
  // persistent column; below lg it's a slide-over toggled by the
  // header's "Chats" button. Desktop never reads this flag.
  const [paneOpen, setPaneOpen] = useState(false);
  // True while the mic button is held and the Web Speech API is
  // actively listening. Drives the pulsing-red mic visual.
  const [listening, setListening] = useState(false);
  // Holds the active session so a re-render or a mouseleave can
  // tear it down cleanly. Ref (not state) because the recognition
  // object is a mutable browser handle, not render state.
  const speechSessionRef = useRef<SpeechSession | null>(null);
  // The audio element + the blob URL used to play the agent's most
  // recent spoken reply. Stored in refs so we can stop playback and
  // revoke the URL when the user starts a new turn or toggles voice
  // mode off mid-playback.
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  // Per-sentence mp3 Blobs queued from the agent's audio_chunk SSE
  // events. The drainAudioQueue() helper pops the head, plays it,
  // and chains onto the next via the audio element's onEnded — so
  // sentences play in order even though the agent's TTS fires them
  // in parallel server-side. Cleared on new turn / voice toggle off
  // / unmount via stopPlayback().
  const audioQueueRef = useRef<Blob[]>([]);
  // Captures performance.now() when the user pressed Send so the
  // first audio_chunk's onPlay handler can compute end-to-end TTFA
  // and POST it to /telemetry/voice. Reset per turn.
  const turnStartMsRef = useRef<number>(0);
  // Guards the TTFA telemetry POST so we only report once per turn
  // even though audio_chunk N+1 also triggers a play() call.
  const firstAudioReportedRef = useRef<boolean>(false);

  // Bootstrap the session on every mount. Two paths:
  //   - URL has ?session=<id>: GET to rehydrate (history + persisted
  //     flag flips). Aborted via `cancelled` if the user races
  //     forward to a New Chat before the GET resolves.
  //   - URL is bare: mint a UUID locally and set it; no API call.
  //     The row gets created inside send() on the first real turn.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Reset inside the async body so React's rules-of-hooks lint
      // against sync setState in effects stays satisfied — awaits
      // below force these updates onto a microtask tick.
      setMessages([]);
      setError(null);
      setSessionPersisted(false);
      setLoading(!!urlSessionId);

      if (!urlSessionId) {
        const id = crypto.randomUUID();
        if (cancelled) return;
        setSessionId(id);
        return;
      }

      try {
        const token = getToken();
        if (!token) {
          router.replace("/login");
          return;
        }
        const session = await getChatSession(token, urlSessionId);
        if (cancelled) return;
        setSessionId(session.id);
        setMessages(session.messages.map(persistedToUI));
        setSessionPersisted(true);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [urlSessionId, router]);

  // Auth-gating lives in the (app) layout; this page assumes a token
  // exists. Auto-scroll on every message-list change — standard chat UX.
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  // Stop + revoke any in-flight audio. Idempotent — safe to call
  // even when nothing is playing. The blob URL revocation matters
  // because each /speak roundtrip mints a fresh one and a long
  // session would otherwise leak them.
  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current.src = "";
      playbackRef.current = null;
    }
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
    // Discard any not-yet-played audio chunks too. A new turn after
    // an interrupted one shouldn't replay the previous turn's
    // remaining sentences.
    audioQueueRef.current = [];
    firstAudioReportedRef.current = false;
  }, []);

  // Pop the head of audioQueueRef and play it; chain onto the next
  // chunk via onEnded. The first audio that plays in a turn fires
  // the TTFA telemetry POST exactly once (guarded by
  // firstAudioReportedRef). Caller-driven — invoked when an
  // audio_chunk arrives OR by an outer effect that wants to kick
  // playback if it stalled.
  const drainAudioQueue = useCallback(() => {
    if (playbackRef.current) return; // already playing something
    const blob = audioQueueRef.current.shift();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    playbackUrlRef.current = url;
    const audio = new Audio(url);
    playbackRef.current = audio;
    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(url);
      if (playbackUrlRef.current === url) playbackUrlRef.current = null;
      if (playbackRef.current === audio) playbackRef.current = null;
      drainAudioQueue();
    });

    // First audio in this turn — report TTFA. Fire-and-forget; a
    // network blip on the telemetry endpoint shouldn't affect the
    // user's voice experience.
    if (!firstAudioReportedRef.current && turnStartMsRef.current > 0) {
      firstAudioReportedRef.current = true;
      const ttfaMs = performance.now() - turnStartMsRef.current;
      const token = getToken();
      if (token) {
        void fetch(`${config.agentUrl}/telemetry/voice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            session_id: sessionId,
            time_to_first_audio_ms: ttfaMs,
          }),
        }).catch(() => {
          // Swallow — telemetry failure is invisible to users.
        });
      }
    }

    audio.play().catch((err) => {
      console.warn("voice mode: audio.play() rejected", err);
    });
  }, [sessionId]);

  // Clean up any audio playback + speech session on unmount. Without
  // these, a navigation away mid-stream-or-playback leaks the Audio
  // element and the blob URL the browser is holding for it.
  useEffect(() => {
    return () => {
      stopPlayback();
      speechSessionRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push-to-talk: mouse/touch DOWN starts a recognition session,
  // mouse/touch UP (or LEAVE) stops it. Web Speech API fills the
  // composer's input state live as the user speaks; release commits
  // the transcript but doesn't send — the user can edit before
  // hitting Send, the standard manual safety net for misheard words.
  const startListening = useCallback(() => {
    if (!SPEECH_SUPPORTED || listening) return;
    setError(null);
    // Stop any agent-reply audio playing — listening over the agent's
    // voice would just feed it back into the recognizer.
    stopPlayback();
    try {
      const session = startSpeechSession({
        onTranscript: (transcript) => {
          setInput(transcript);
        },
        onEnd: () => {
          setListening(false);
          speechSessionRef.current = null;
        },
        onError: (errCode) => {
          // "not-allowed" is the only error worth surfacing — the
          // user has to grant mic permission in browser settings.
          // "no-speech" and "aborted" are routine and noisy.
          if (errCode === "not-allowed") {
            setError("Microphone access is blocked. Allow it in your browser's site settings.");
          }
          setListening(false);
          speechSessionRef.current = null;
        },
      });
      speechSessionRef.current = session;
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice input failed to start");
    }
  }, [listening, stopPlayback]);

  const stopListening = useCallback(() => {
    if (speechSessionRef.current) {
      speechSessionRef.current.stop();
      // onEnd flips `listening` to false and clears the ref.
    }
  }, []);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((prev) => {
      const next = !prev;
      // Turning voice mode off mid-playback should silence the
      // active audio — surprising otherwise.
      if (!next) stopPlayback();
      return next;
    });
  }, [stopPlayback]);

  // When the user hits their daily cap, force voice mode off (the agent
  // would 429 the /speak path anyway) and silence any in-flight audio.
  // The inline note next to the toggle explains the switch; it clears if
  // usage recovers (e.g. after the daily reset converges).
  useEffect(() => {
    if (capped) {
      setVoiceMode((prev) => {
        if (prev) {
          stopPlayback();
          setVoiceForcedOff(true);
        }
        return false;
      });
    } else {
      setVoiceForcedOff(false);
    }
  }, [capped, stopPlayback]);

  // Validate + stage an image picked from any source (picker, drag-drop,
  // paste). Revokes the previous chip's object URL before minting a fresh
  // one so replacing an attachment doesn't leak the old preview.
  const onSelectImage = useCallback(
    (file: File) => {
      const accepted = acceptImageFile(file, toast);
      if (!accepted) return;
      setPendingImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return {
          blob: accepted.blob,
          previewUrl: URL.createObjectURL(accepted.blob),
          filename: file.name,
          mediaType: accepted.mediaType,
        };
      });
    },
    [toast],
  );

  // Drop the staged image and revoke its preview URL.
  const onDismissImage = useCallback(() => {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  // Revoke any staged preview URL on unmount so navigating away with an
  // un-sent attachment doesn't leak the object URL.
  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if ((!trimmed && !pendingImage) || streaming || loading || !sessionId || capped) return;

    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setError(null);

    // Lazy-create the session row server-side if we haven't yet —
    // this is the first turn of a fresh chat. Done BEFORE the
    // optimistic UI update so an early failure here doesn't leave
    // the user staring at their own message with no way to recover.
    if (!sessionPersisted) {
      try {
        await createChatSession(token, sessionId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(msg);
        return;
      }
      // Eviction may have run during create — refetching the
      // history list isn't this surface's job, but flip the flag
      // so subsequent turns don't re-POST.
      setSessionPersisted(true);
    }

    // Snapshot the staged image before any awaits so the rest of this
    // turn works against a stable value even if the user stages another
    // one mid-send. The chip state is cleared once the stream starts.
    const turnImage = pendingImage;

    // The current user turn's content. With an image it becomes a
    // multimodal block list (image first, then text — Claude requires a
    // text block alongside the image, so an empty caption becomes a
    // single space). Text-only turns stay a plain string, exactly as
    // today. The image bytes are base64-encoded here and only here.
    const userContent: string | ContentBlock[] = turnImage
      ? [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: turnImage.mediaType,
              data: await blobToBase64(turnImage.blob),
            },
          },
          { type: "text", text: trimmed || " " },
        ]
      : trimmed;

    // The string form persisted to the API and used for title
    // generation. Image bytes never reach the API — the stored record is
    // the `[image attached] …` placeholder.
    const persistedUserContent = turnImage
      ? trimmed
        ? `[image attached] ${trimmed}`
        : "[image attached]"
      : trimmed;

    // Optimistic update: append the user's message and a placeholder
    // assistant message we'll fill as deltas arrive. Setting both at
    // once avoids a flash where the user message renders alone. The user
    // message carries the multimodal content so the bubble paints the
    // image inline (from the block's base64, not the chip's blob URL).
    const userMsg: Message = { role: "user", content: userContent };
    const placeholder: Message = { role: "assistant", content: "", tools: [] };
    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, placeholder]);
    setInput("");
    // The image is now baked into userContent + the optimistic message;
    // clear the composer chip and revoke its preview URL.
    if (turnImage) {
      URL.revokeObjectURL(turnImage.previewUrl);
      setPendingImage(null);
    }
    setStreaming(true);

    // Cancel any audio queue / playback left over from a prior turn
    // and capture the turn-start timestamp so the first audio_chunk
    // that arrives can compute TTFA against it. firstAudioReported
    // resets too so the new turn's first chunk fires telemetry.
    stopPlayback();
    turnStartMsRef.current = performance.now();

    // Track whether this is the first turn of the session so we
    // know to fire the title-generation flow after the append. The
    // pre-append messages array (before this turn) defines "first".
    const isFirstTurn = messages.length === 0;

    let assistantText = "";
    let chosenModel: string | undefined;
    const toolsLog: ToolCall[] = [];
    try {
      const resp = await fetch(`${config.agentUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          // Hint to the server we expect SSE; not required by spec but
          // a useful signal for shared middleware (e.g. Caddy).
          Accept: "text/event-stream",
        },
        // client_timezone is the IANA name detected by the browser
        // (e.g. "America/Denver"). The agent uses it to compute the
        // user's local date and prepend it to the system prompt so
        // the model answers "did I work out yesterday?" against the
        // actual local-day boundary instead of UTC. Server falls
        // back to UTC if the value is missing or unrecognized, so
        // a browser without Intl support never breaks /chat.
        body: JSON.stringify({
          messages: nextMessages,
          session_id: sessionId,
          client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          // Identity context from the shared resolved profile. Null-safe
          // when the profile hasn't loaded yet; the agent treats both as
          // optional and falls back gracefully when absent.
          display_name: profile?.display_name,
          height_cm: profile?.height_cm ?? null,
          // When true, the agent's voice_streamer wraps the SSE
          // stream with per-sentence audio_chunk events alongside
          // the text_delta events. The client below handles those
          // by decoding base64 mp3, queueing Blobs, and chaining
          // playback via onEnded. See
          // prog-strength-docs/sows/streaming-tts.md.
          voice_mode: voiceMode,
        }),
      });

      if (resp.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      if (resp.status === 429) {
        // The gate flipped to capped between the last usage refresh and
        // this send. Surface the same copy as the settings/banner, force
        // the shared snapshot to converge, and strip BOTH the optimistic
        // user message and the blank assistant placeholder so the user
        // isn't left staring at an unanswered turn.
        const drained = await resp.text().catch(() => "");
        // Prefer the freshly-fetched resetsAt for an accurate countdown;
        // fall back to the agent's plain-text body if usage is unknown.
        await refreshUsage().catch(() => {});
        const copy =
          usage.error || usage.loading
            ? drained.trim() || "You've used your daily AI allowance."
            : cappedMessage(usage.resetsAt);
        toast.error(copy);
        setMessages((prev) => {
          // Drop a trailing blank assistant placeholder, then a trailing
          // user message (this turn's optimistic pair).
          let next = prev;
          const last = next[next.length - 1];
          if (
            last &&
            last.role === "assistant" &&
            last.content === "" &&
            (!last.tools || last.tools.length === 0) &&
            !last.model
          ) {
            next = next.slice(0, -1);
          }
          const newLast = next[next.length - 1];
          if (newLast && newLast.role === "user") {
            next = next.slice(0, -1);
          }
          return next;
        });
        return;
      }
      if (!resp.ok || !resp.body) {
        const text = await resp.text();
        throw new Error(`agent returned ${resp.status}: ${text.slice(0, 200)}`);
      }

      for await (const ev of parseSSE(resp.body)) {
        if (ev.type === "text_delta") {
          assistantText += ev.text;
          // Mutate the text on the last (assistant) message while
          // preserving any tools that were attached during this turn.
          setMessages((prev) => replaceLast(prev, (last) => ({ ...last, content: assistantText })));
        } else if (ev.type === "tool_use_start") {
          toolsLog.push({ name: ev.name, state: "running" });
          // Append a "running" tool to the in-progress assistant
          // message. Persisting tools on the message (rather than a
          // separate activeTools state) keeps them visible after the
          // turn completes — the user can scroll back and see what
          // the agent did for any historical reply.
          setMessages((prev) =>
            replaceLast(prev, (last) => ({
              ...last,
              tools: [...(last.tools ?? []), { name: ev.name, state: "running" }],
            })),
          );
        } else if (ev.type === "tool_result") {
          // Flip the matching running tool to ok/error. Match on name
          // + state so parallel tool calls with the same name resolve
          // in order (the in-flight one transitions; later ones wait).
          const finalState: "ok" | "error" = ev.is_error ? "error" : "ok";
          for (let i = toolsLog.length - 1; i >= 0; i--) {
            if (toolsLog[i].name === ev.name && toolsLog[i].state === "running") {
              toolsLog[i] = { ...toolsLog[i], state: finalState };
              break;
            }
          }
          setMessages((prev) =>
            replaceLast(prev, (last) => ({
              ...last,
              tools: (last.tools ?? []).map((t) =>
                t.name === ev.name && t.state === "running" ? { ...t, state: finalState } : t,
              ),
            })),
          );
        } else if (ev.type === "model_chosen") {
          chosenModel = ev.model;
          // Stamp the chosen model onto the in-progress assistant
          // message so the UI can render "via Haiku" / "via Sonnet"
          // and the label persists in conversation history.
          setMessages((prev) => replaceLast(prev, (last) => ({ ...last, model: ev.model })));
        } else if (ev.type === "audio_chunk") {
          // Decode the base64 mp3 + push onto the playback queue.
          // drainAudioQueue is idempotent — calls beyond the first
          // are no-ops while playback is in flight; the onEnded
          // handler picks up subsequent chunks. Order is preserved
          // because the agent yields audio_chunks in source order
          // even when their TTS calls complete out of order.
          const bytes = Uint8Array.from(atob(ev.mp3_base64), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: "audio/mpeg" });
          audioQueueRef.current.push(blob);
          drainAudioQueue();
        } else if (ev.type === "error") {
          setError(ev.message);
        }
        // `done` event needs no UI side-effect; the loop ends when the
        // server closes the body.
      }

      // Stream completed successfully — persist the turn. The user
      // message stays visible regardless of this write; a failure
      // here just means the session's history will lack one turn.
      if (assistantText) {
        const toolsJSON = toolsLog.length > 0 ? JSON.stringify(toolsLog) : undefined;
        try {
          await appendChatTurn(token, sessionId, {
            user: { content: persistedUserContent },
            assistant: {
              content: assistantText,
              model: chosenModel,
              tools_json: toolsJSON,
            },
          });
        } catch (err) {
          // Persistence failure is non-fatal — surface inline but
          // don't roll back the messages the user already saw.
          const msg = err instanceof Error ? err.message : String(err);
          setError(`failed to save turn: ${msg}`);
        }

        if (isFirstTurn) {
          // Background title generation. We deliberately do NOT
          // await this so the user can keep chatting; the title
          // appears in the sidebar/history list whenever the PATCH
          // lands. Local fallback mirrors the agent's so the stored
          // title is sane even if the agent /title endpoint fails.
          void titleAndPatch(token, sessionId, persistedUserContent, assistantText);
        }

        // Voice playback (when voiceMode is on) now rides on the
        // SSE stream itself via audio_chunk events handled inline
        // above — no post-stream /speak roundtrip. The streaming-tts
        // SOW switched us from one-mp3-per-turn to one-mp3-per-
        // sentence so first audio starts within ~1-2s of send
        // instead of ~5-12s.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      // Roll back the empty placeholder so the user doesn't see a
      // blank assistant bubble after a failure. Only drop the row if
      // nothing visible to the user had landed yet — no text, no tool
      // activity, and no model label. If any signal arrived we keep
      // the row so the user retains context for debugging or retry.
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const isBlankAssistant =
          last.role === "assistant" &&
          last.content === "" &&
          (!last.tools || last.tools.length === 0) &&
          !last.model;
        if (isBlankAssistant) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
    }
  }, [
    input,
    streaming,
    messages,
    router,
    sessionId,
    sessionPersisted,
    loading,
    voiceMode,
    pendingImage,
    profile,
    stopPlayback,
    drainAudioQueue,
    toast,
    usage,
    capped,
    refreshUsage,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline. Standard chat UX.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const startNewChat = () => {
    // Pushing /chat without ?session triggers the mount effect's
    // new-session branch. router.push (not replace) so the user can
    // hit Back to return to the previous conversation.
    router.push("/chat");
  };

  // Escape collapses the conversation pane — the desktop inline column and
  // the mobile slide-over alike, since both are driven by paneOpen. Only
  // wired while the pane is open so the listener doesn't run when closed.
  useEffect(() => {
    if (!paneOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPaneOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paneOpen]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Collapsible conversation pane on desktop. Defaults closed (see
          paneOpen) so it doesn't eat chat width on load — the header's
          "Chats" button toggles it. The wrapper animates its width while the
          inner column keeps its fixed w-72, so the list slides in from the
          edge. `inert` while collapsed keeps the clipped pane out of the
          tab/a11y order. */}
      <div
        className={`hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out lg:flex ${
          paneOpen ? "w-72" : "w-0"
        }`}
        inert={!paneOpen}
      >
        <ConversationList activeSessionId={sessionId} onNewChat={startNewChat} />
      </div>

      {/* Mobile: the same pane in a slide-over overlay, toggled by the
          header's "Chats" button. */}
      {paneOpen && (
        // The mobile sheet is a second ConversationList instance — the
        // desktop pane above stays mounted (CSS-hidden) but only one is
        // ever visible at a breakpoint, so the duplicate mount is benign
        // (the sessions GET is idempotent). Backdrop click + Escape (effect
        // above) dismiss, matching the retired drawer.
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chats"
          className="fixed inset-0 z-40 flex lg:hidden"
        >
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setPaneOpen(false)}
          />
          <div className="relative z-10">
            <ConversationList
              activeSessionId={sessionId}
              onNewChat={() => {
                setPaneOpen(false);
                startNewChat();
              }}
            />
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col overflow-hidden">
        <ChatHeader
          voiceMode={voiceMode}
          onToggleVoice={toggleVoiceMode}
          capped={capped}
          cappedTooltip={cappedTooltip}
          onNewChat={startNewChat}
          chatsOpen={paneOpen}
          onToggleChats={() => setPaneOpen((v) => !v)}
        />

        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.length === 0 && <ChatEmptyState />}

            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                content={m.content}
                tools={m.tools}
                model={m.model}
              />
            ))}

            {error && (
              <div className="rounded-[var(--radius-card)] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}
          </div>
        </div>

        <footer
          className="border-t border-[var(--border)] px-3 py-3 sm:px-6 sm:py-4"
          // The whole footer is a drop target. preventDefault on dragOver
          // is what actually enables the drop (the browser blocks it
          // otherwise); on drop we route the first dropped file through the
          // same validation path as the picker, and preventDefault stops
          // the browser from navigating to the image.
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (streaming || loading || !sessionId) return;
            const file = e.dataTransfer.files?.[0];
            if (file) onSelectImage(file);
          }}
        >
          {capped && (
            // Capped banner above the composer. Same copy as the settings
            // 100% state + the 429 toast so the message is consistent.
            <div
              role="status"
              className="mx-auto mb-2 max-w-2xl rounded-[var(--radius-card)] border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]"
            >
              {cappedMessage(resetsAt)}
            </div>
          )}
          {voiceForcedOff && (
            // Inline note: voice mode was auto-disabled because of the cap.
            <div className="mx-auto mb-2 max-w-2xl px-1 text-xs text-[var(--muted)]">
              Voice mode turned off — daily AI allowance used.
            </div>
          )}
          <div className="mx-auto max-w-2xl">
            <Composer
              input={input}
              onInputChange={setInput}
              onSend={send}
              onKeyDown={handleKeyDown}
              onAttachClick={() => fileInputRef.current?.click()}
              onPaste={(e) => {
                // Pull the first image/* item off the clipboard (a pasted
                // screenshot) and route it through the same validation
                // path. Text pastes fall through to the default handler.
                for (const item of e.clipboardData.items) {
                  if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                      e.preventDefault();
                      onSelectImage(file);
                    }
                    break;
                  }
                }
              }}
              fileInputRef={fileInputRef}
              onFileChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onSelectImage(file);
                // Reset so picking the same file twice in a row still fires
                // onChange (the value is unchanged otherwise).
                e.currentTarget.value = "";
              }}
              pendingImage={
                pendingImage
                  ? { previewUrl: pendingImage.previewUrl, filename: pendingImage.filename }
                  : null
              }
              onDismissImage={onDismissImage}
              speechSupported={SPEECH_SUPPORTED}
              listening={listening}
              onMicDown={startListening}
              onMicUp={stopListening}
              capped={capped}
              cappedTooltip={cappedTooltip}
              streaming={streaming}
              loading={loading}
              sessionId={sessionId}
              placeholder={
                loading ? "Loading…" : listening ? "Listening…" : "Message Prog Strength…"
              }
            />
          </div>
        </footer>
      </main>
    </div>
  );
}

/**
 * Chat thread header. Carries the assistant identity (brand badge +
 * presence dot + title/status), the voice on/off toggle, the New chat
 * button, and a mobile-only "Chats" toggle that opens the conversation
 * pane overlay. Presentational — every action is a prop the page owns.
 */
function ChatHeader({
  voiceMode,
  onToggleVoice,
  capped,
  cappedTooltip,
  onNewChat,
  chatsOpen,
  onToggleChats,
}: {
  voiceMode: boolean;
  onToggleVoice: () => void;
  capped: boolean;
  cappedTooltip: string;
  onNewChat: () => void;
  chatsOpen: boolean;
  onToggleChats: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <BrandMark size={20} />
          {/* Tiny presence dot — the assistant is always "available", so
              the green success token reads as an online indicator. */}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--success)]" />
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className="text-sm font-semibold tracking-tight">Chat</h1>
          <span className="text-[11px] text-[var(--muted)]">Prog Strength assistant</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Toggle the conversation history pane. On lg it expands/collapses
            the inline column; below lg it opens/closes the slide-over.
            Defaults collapsed, so this is how users reach past chats. */}
        <button
          type="button"
          onClick={onToggleChats}
          aria-expanded={chatsOpen}
          aria-label={chatsOpen ? "Close chats" : "Open chats"}
          title={chatsOpen ? "Close chats" : "Open chats"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition sm:px-3 ${
            chatsOpen
              ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <ChatsIcon />
          <span className="hidden sm:inline">Chats</span>
        </button>
        <button
          type="button"
          onClick={onToggleVoice}
          disabled={capped}
          aria-disabled={capped}
          aria-pressed={voiceMode}
          aria-label={voiceMode ? "Turn voice mode off" : "Turn voice mode on"}
          title={
            capped
              ? cappedTooltip
              : voiceMode
                ? "Voice mode on — agent replies play as audio"
                : "Voice mode off — turn on to hear agent replies"
          }
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 ${
            voiceMode
              ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <SpeakerIcon muted={!voiceMode} />
          <span className="hidden sm:inline">{voiceMode ? "Voice on" : "Voice off"}</span>
        </button>
        <button
          type="button"
          onClick={onNewChat}
          aria-label="Start a new chat"
          title="Start a new chat"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] sm:px-3"
        >
          <PlusIcon />
          <span className="hidden sm:inline">New chat</span>
        </button>
      </div>
    </header>
  );
}

/**
 * Speech-bubble glyph for the header's "Chats" toggle. Local to the page
 * (the shared icon set has no chat-thread icon); matches the rest of the
 * header's 12px stroked-icon vocabulary.
 */
function ChatsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />
    </svg>
  );
}

// --- session helpers --------------------------------------------------

/**
 * Background title generation. Asks the agent's /title for a friendly
 * 3–6 word summary, then PATCHes the API. On any failure falls back
 * to a 60-char slice of the first user message so the session always
 * ends up with a non-empty title. All failures are swallowed — the UI
 * shouldn't bother the user with title-generation hiccups.
 */
async function titleAndPatch(
  token: string,
  sessionId: string,
  userText: string,
  assistantText: string,
): Promise<void> {
  let title = fallbackTitle(userText);
  try {
    const generated = await generateChatTitle(token, [
      { role: "user", content: userText },
      { role: "assistant", content: assistantText },
    ]);
    if (generated) title = generated;
  } catch {
    // swallow — fallback is already in `title`
  }
  try {
    await patchChatSessionTitle(token, sessionId, title);
  } catch {
    // swallow — the session is usable without a title
  }
}

/**
 * Local fallback when the agent's /title call fails. Slices the user's
 * first message to 60 chars; defaults to "New Chat" if the message is
 * blank after trimming. Mirrors the agent's own fallback shape.
 */
function fallbackTitle(userText: string): string {
  const trimmed = userText.trim();
  if (!trimmed) return "New Chat";
  return trimmed.slice(0, 60).trim() || "New Chat";
}

/**
 * Persisted-message → UI-message converter. The API stores message
 * content as a plain string + optional model + optional tools JSON.
 * The UI's Message shape carries those same fields with the tools
 * parsed back into the ToolCall array the bubble renders.
 */
function persistedToUI(m: PersistedChatMessage): Message {
  const ui: Message = {
    role: m.role,
    content: m.content,
  };
  if (m.model) ui.model = m.model;
  if (m.tools_json) {
    try {
      const parsed = JSON.parse(m.tools_json);
      if (Array.isArray(parsed)) {
        ui.tools = parsed as ToolCall[];
      }
    } catch {
      // Bad JSON in the column is a corruption signal; render the
      // message without tools rather than dropping the whole turn.
    }
  }
  return ui;
}

// --- helpers -----------------------------------------------------------

/**
 * Immutably replace the last element of an array using a transformer.
 * Used during streaming to update the in-progress assistant message
 * (text deltas, tool transitions) without copying the whole array
 * inline at every call site. Returns the original array unchanged if
 * it's empty — defensive against state races on first render.
 */
function replaceLast<T>(arr: T[], fn: (last: T) => T): T[] {
  if (arr.length === 0) return arr;
  const next = arr.slice();
  next[next.length - 1] = fn(next[next.length - 1]);
  return next;
}
