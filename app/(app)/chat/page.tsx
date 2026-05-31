"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clearToken, getToken } from "@/lib/auth";
import { config } from "@/lib/config";
import { parseSSE } from "@/lib/stream";
import {
  appendChatTurn,
  createChatSession,
  getChatSession,
  patchChatSessionTitle,
  type ChatMessage as PersistedChatMessage,
} from "@/lib/api";
import { generateChatSpeech, generateChatTitle } from "@/lib/agent";
import {
  getSpeechRecognitionCtor,
  startSpeechSession,
  type SpeechSession,
} from "@/lib/speech";

/**
 * A tool the agent invoked during a single assistant turn. State
 * starts as "running" when we see tool_use_start, transitions to "ok"
 * or "error" on tool_result. Persisted on the Message so the history
 * shows "the agent called X to answer this" even after streaming ends.
 */
type ToolCall = {
  name: string;
  state: "running" | "ok" | "error";
};

type Message = {
  role: "user" | "assistant";
  content: string;
  // Only populated on assistant messages — the tools the agent
  // invoked while producing this turn. Order reflects call order.
  tools?: ToolCall[];
  // The Claude model that produced this turn, e.g. "claude-haiku-4-5…"
  // or "claude-sonnet-4-6". Set when the agent emits model_chosen at
  // the start of the response, kept on the message so historical
  // turns show "via Haiku" / "via Sonnet" labels.
  model?: string;
};

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

  // Voice mode: when on, the page asks the agent's /speak endpoint
  // for an mp3 of each completed assistant turn and plays it. Off
  // by default; survives component-level re-renders but not refresh
  // (per the voice-chat SOW's "session-only" lean).
  const [voiceMode, setVoiceMode] = useState(false);
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
  }, []);

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
            setError(
              "Microphone access is blocked. Allow it in your browser's site settings.",
            );
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

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming || loading || !sessionId) return;

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

    // Optimistic update: append the user's message and a placeholder
    // assistant message we'll fill as deltas arrive. Setting both at
    // once avoids a flash where the user message renders alone.
    const userMsg: Message = { role: "user", content: trimmed };
    const placeholder: Message = { role: "assistant", content: "", tools: [] };
    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, placeholder]);
    setInput("");
    setStreaming(true);

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
        body: JSON.stringify({ messages: nextMessages, session_id: sessionId }),
      });

      if (resp.status === 401) {
        clearToken();
        router.replace("/login");
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
          setMessages((prev) =>
            replaceLast(prev, (last) => ({ ...last, content: assistantText })),
          );
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
              tools: [
                ...(last.tools ?? []),
                { name: ev.name, state: "running" },
              ],
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
                t.name === ev.name && t.state === "running"
                  ? { ...t, state: finalState }
                  : t,
              ),
            })),
          );
        } else if (ev.type === "model_chosen") {
          chosenModel = ev.model;
          // Stamp the chosen model onto the in-progress assistant
          // message so the UI can render "via Haiku" / "via Sonnet"
          // and the label persists in conversation history.
          setMessages((prev) =>
            replaceLast(prev, (last) => ({ ...last, model: ev.model })),
          );
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
            user: { content: trimmed },
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
          void titleAndPatch(token, sessionId, trimmed, assistantText);
        }

        if (voiceMode) {
          // Background TTS playback. Fire-and-forget like the title
          // flow; the chat surface stays interactive while the
          // agent's voice loads. Any failure (503 if OPENAI_API_KEY
          // unset, 429 if quota exhausted, network blip) is
          // logged-and-swallowed — voice is enhancement, not core,
          // and an inline error would punish the user for a server
          // hiccup that doesn't affect the text they already see.
          void speakAndPlay(
            token,
            assistantText,
            playbackRef,
            playbackUrlRef,
          );
        }
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

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-6 py-3">
        <h1 className="text-sm font-semibold tracking-tight">Chat</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleVoiceMode}
            aria-pressed={voiceMode}
            title={
              voiceMode
                ? "Voice mode on — agent replies play as audio"
                : "Voice mode off — turn on to hear agent replies"
            }
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              voiceMode
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <SpeakerIcon muted={!voiceMode} />
              <span>{voiceMode ? "Voice on" : "Voice off"}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={startNewChat}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium transition hover:text-[var(--foreground)]"
          >
            + New chat
          </button>
          <Link
            href="/chat/history"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium transition hover:text-[var(--foreground)]"
          >
            History
          </Link>
        </div>
      </header>
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-6 py-6"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
              <p className="font-medium text-[var(--foreground)]">
                Ask about your training.
              </p>
              <p className="mt-1">
                Try <em>&quot;what chest exercises are in the catalog?&quot;</em>{" "}
                or paste a workout log and ask it to record the session.
              </p>
            </div>
          )}

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
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-[var(--border)] px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          {SPEECH_SUPPORTED && (
            // Push-and-hold mic. mouseLeave is treated as "release"
            // too — without it a user who slides off the button
            // would never get an onMouseUp and the recognizer would
            // keep listening forever. Same shape for touch.
            <button
              type="button"
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onMouseLeave={stopListening}
              onTouchStart={(e) => {
                e.preventDefault();
                startListening();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                stopListening();
              }}
              disabled={streaming || loading || !sessionId}
              title={listening ? "Listening… release to stop" : "Hold to speak"}
              aria-pressed={listening}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg border transition disabled:opacity-40 ${
                listening
                  ? "animate-pulse border-[var(--danger)]/60 bg-[var(--danger)]/10 text-[var(--danger)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <MicIcon />
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              loading
                ? "Loading…"
                : listening
                  ? "Listening…"
                  : "Message Prog Strength…"
            }
            rows={1}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
            disabled={streaming || loading || !sessionId}
          />
          <button
            type="button"
            onClick={send}
            disabled={
              streaming || loading || !sessionId || input.trim().length === 0
            }
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </footer>
    </main>
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
 * Fetch the spoken version of `text` from the agent's /speak endpoint
 * and start playing it. Updates the audio + url refs the caller
 * holds so subsequent calls can stop the in-flight playback before
 * starting a new one (otherwise overlapping turns would step on
 * each other audibly).
 *
 * Failures are logged and swallowed — voice playback is enhancement;
 * an inline error would punish the user for a transient server
 * blip that doesn't affect the text they already see.
 */
async function speakAndPlay(
  token: string,
  text: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  urlRef: React.MutableRefObject<string | null>,
): Promise<void> {
  // Tear down any in-flight playback first. /speak roundtrips
  // sequentially, but a slow first reply + a fast second one could
  // otherwise stack two simultaneous Audio elements.
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = "";
    audioRef.current = null;
  }
  if (urlRef.current) {
    URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }

  let blob: Blob;
  try {
    blob = await generateChatSpeech(token, text);
  } catch (err) {
    // Most likely 503 (no OPENAI_API_KEY) or 429 (quota exceeded).
    // Either way the user has nothing to act on; log + move on.
    console.warn("voice mode: /speak failed", err);
    return;
  }
  const url = URL.createObjectURL(blob);
  urlRef.current = url;
  const audio = new Audio(url);
  audioRef.current = audio;
  audio.addEventListener("ended", () => {
    URL.revokeObjectURL(url);
    if (urlRef.current === url) urlRef.current = null;
    if (audioRef.current === audio) audioRef.current = null;
  });
  try {
    await audio.play();
  } catch (err) {
    // Autoplay can be blocked when the user hasn't interacted with
    // the page yet. In a chat session they always have (they
    // clicked Send), but we still log so a future regression is
    // diagnosable.
    console.warn("voice mode: audio.play() rejected", err);
  }
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

function MessageBubble({
  role,
  content,
  tools,
  model,
}: {
  role: "user" | "assistant";
  content: string;
  tools?: ToolCall[];
  model?: string;
}) {
  const isUser = role === "user";
  const hasTools = !isUser && tools && tools.length > 0;
  const hasModel = !isUser && !!model;
  const hasContent = content.length > 0;
  const hasMetadata = hasTools || hasModel;

  // User messages render as plain text (the user didn't intentionally
  // write Markdown when typing). Assistant messages render through
  // ReactMarkdown so `**bold**`, lists, code, and tables come out
  // formatted instead of as literal asterisks. `remark-gfm` enables
  // GitHub-flavored Markdown — tables, strikethrough, autolinked URLs,
  // task lists — which Claude tends to use in tool-rich responses.
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "whitespace-pre-wrap bg-[var(--accent)] text-[var(--accent-fg)]"
            : "bg-[var(--surface)] text-[var(--foreground)]"
        }`}
      >
        {hasMetadata && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {hasModel && <ModelLabel model={model} />}
            {hasTools &&
              tools.map((t, i) => <ToolPill key={i} tool={t} />)}
          </div>
        )}
        {!hasContent && !hasMetadata ? (
          // No text and no metadata yet — show the typing placeholder.
          // Once any signal arrives (model_chosen, tool start, text)
          // the metadata row acts as the in-progress indicator.
          <span className="inline-block animate-pulse text-[var(--muted)]">
            …
          </span>
        ) : isUser ? (
          content
        ) : hasContent ? (
          <AssistantMarkdown content={content} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Small "via Haiku 4.5" label that sits in the assistant bubble's
 * metadata row. Styled as muted plain text rather than a colored pill
 * so it recedes against the more visually weighted tool pills next to
 * it — the model is contextual info, not an action.
 */
function ModelLabel({ model }: { model: string }) {
  return (
    <span className="text-[10px] font-medium text-[var(--muted)]">
      via {humanizeModelName(model)}
    </span>
  );
}

/**
 * Persistent indicator that the agent invoked a tool. Each pill shows
 * the tool's humanized name and its state — running (animated dots),
 * ok (check), or error (red x). Stays on the message after the turn
 * completes so the user can scroll back and see which tools answered
 * which prompt.
 */
function ToolPill({ tool }: { tool: ToolCall }) {
  const name = humanizeToolName(tool.name);
  if (tool.state === "running") {
    return (
      <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
        <DotsIcon />
        <span>Calling {name}…</span>
      </span>
    );
  }
  if (tool.state === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
        <CheckIcon />
        <span>{name}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--danger)]">
      <XIcon />
      <span>{name} failed</span>
    </span>
  );
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

/**
 * Display form for the agent's tool names. The MCP tools are snake_case
 * ("list_exercises"); Title Case reads more naturally to the user
 * ("List Exercises") without losing the operation's identity.
 */
function humanizeToolName(name: string): string {
  return name
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

/**
 * Friendly form for a Claude model id. `claude-haiku-4-5-20251001` →
 * `Haiku 4.5`, `claude-sonnet-4-6` → `Sonnet 4.6`. Falls back to the
 * raw id if the pattern doesn't match — better to show the cryptic
 * value than nothing when a new model family lands.
 */
function humanizeModelName(model: string): string {
  const match = model.match(/^claude-([a-z]+)-(\d+)-(\d+)/);
  if (!match) return model;
  const [, family, major, minor] = match;
  const familyTitle = family[0].toUpperCase() + family.slice(1);
  return `${familyTitle} ${major}.${minor}`;
}

// --- icons -------------------------------------------------------------

function MicIcon() {
  // Rounded mic body with a stand. 14px so the button stays visually
  // balanced against the Send button's text label height.
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  // Speaker + waves on (voice mode active) or speaker + slash on
  // (muted). Same outer body so the icon doesn't visually jump
  // between states.
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
      <path d="M11 5L6 9H3v6h3l5 4z" />
      {muted ? (
        <>
          <path d="M17 9l5 6" />
          <path d="M22 9l-5 6" />
        </>
      ) : (
        <>
          <path d="M15.5 9a3.5 3.5 0 0 1 0 6" />
          <path d="M18.5 6a7 7 0 0 1 0 12" />
        </>
      )}
    </svg>
  );
}

function DotsIcon() {
  // Three small dots — used inside the running-state pill alongside
  // the surrounding animate-pulse so the whole pill breathes while
  // a tool call is in flight.
  return (
    <svg
      viewBox="0 0 24 24"
      width={10}
      height={10}
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={10}
      height={10}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={10}
      height={10}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

/**
 * Markdown renderer for assistant turns. Each element is mapped to a
 * Tailwind-styled component so the rendered output sits naturally in
 * the dark chat bubble — no `prose` plugin, no global typography
 * styles to maintain.
 *
 * `react-markdown` is safe-by-default (raw HTML in input is escaped),
 * so we don't need a sanitizer step.
 */
function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Paragraphs: tight by default. The bubble already has padding,
        // so internal margins only need to separate consecutive blocks.
        p: ({ children }) => (
          <p className="my-1 first:mt-0 last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        // Lists indent with bullets / numbers; tight vertical rhythm
        // matches the surrounding text.
        ul: ({ children }) => (
          <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0 marker:text-[var(--muted)]">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0 marker:text-[var(--muted)]">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-snug">{children}</li>,
        // Headings inside a chat bubble are usually small (Claude uses
        // them as section labels, not page titles), so we cap the size.
        h1: ({ children }) => (
          <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">
            {children}
          </h3>
        ),
        // Inline `code` gets a subtle background; fenced code blocks
        // get their own dark block + horizontal scroll for long lines.
        code: ({ className, children, ...rest }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[0.85em]"
                {...rest}
              >
                {children}
              </code>
            );
          }
          return (
            <code className={`${className ?? ""} font-mono text-xs`} {...rest}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-md bg-[var(--surface-2)] p-3 first:mt-0 last:mb-0">
            {children}
          </pre>
        ),
        // Links open in a new tab — Claude often surfaces external
        // references and you don't want to lose the chat scroll.
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline-offset-4 hover:underline"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-[var(--border)] pl-3 italic text-[var(--muted)] first:mt-0 last:mb-0">
            {children}
          </blockquote>
        ),
        // GFM tables. Horizontal scroll on overflow so long workout
        // tables don't blow out the bubble width.
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto first:mt-0 last:mb-0">
            <table className="min-w-full border-collapse text-xs">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-[var(--border)] px-2 py-1 text-left font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-[var(--border)]/50 px-2 py-1">
            {children}
          </td>
        ),
        hr: () => <hr className="my-3 border-[var(--border)]" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
