import type { ContentBlock } from "@/lib/agent";
import { AssistantMarkdown } from "./assistant-markdown";
import { ModelPill } from "./model-pill";
import { ToolPill } from "./tool-pill";
import type { ToolCall } from "./types";

export function MessageBubble({
  role,
  content,
  tools,
  model,
}: {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  tools?: ToolCall[];
  model?: string;
}) {
  const isUser = role === "user";
  const hasTools = !isUser && tools && tools.length > 0;
  const hasModel = !isUser && !!model;
  const hasMetadata = hasTools || hasModel;
  // For the typing-placeholder decision only the string-content emptiness
  // matters — a block list always has visible content (the image).
  const hasContent = typeof content === "string" ? content.length > 0 : true;

  // User messages render as plain text (the user didn't intentionally
  // write Markdown when typing). Assistant messages render through
  // ReactMarkdown so `**bold**`, lists, code, and tables come out
  // formatted instead of as literal asterisks. `remark-gfm` enables
  // GitHub-flavored Markdown — tables, strikethrough, autolinked URLs,
  // task lists — which Claude tends to use in tool-rich responses.
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-3 py-2 text-sm ${
          isUser
            ? "whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--accent)] text-[var(--accent-fg)]"
            : "rounded-2xl rounded-bl-md bg-[var(--surface-2)] text-[var(--foreground)] shadow-[var(--shadow-soft)]"
        }`}
      >
        {hasMetadata && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {hasModel && <ModelPill model={model} />}
            {hasTools && tools.map((t, i) => <ToolPill key={i} tool={t} />)}
          </div>
        )}
        {typeof content !== "string" ? (
          // Multimodal user turn (in-flight, this session only): paint the
          // image inline from its base64 data URL — NOT the composer's
          // blob URL, which is revoked on send — and the caption below.
          <ImageMessage blocks={content} />
        ) : !hasContent && !hasMetadata ? (
          // No text and no metadata yet — show the typing placeholder.
          // Once any signal arrives (model_chosen, tool start, text)
          // the metadata row acts as the in-progress indicator.
          <span className="inline-block animate-pulse text-[var(--muted)]">…</span>
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
 * Render an in-flight multimodal user turn: the attached image (from its
 * base64 data URL) above the caption text. Only the current session's
 * optimistic user messages take this path — persisted turns come back as
 * the `[image attached] …` string and render as plain text. The image
 * block is always present (the composer guarantees it); the text block's
 * text may be a single space for an image-only send, in which case we
 * render no caption line.
 */
function ImageMessage({ blocks }: { blocks: ContentBlock[] }) {
  const image = blocks.find((b) => b.type === "image");
  const text = blocks.find((b) => b.type === "text");
  const caption = text && text.text.trim().length > 0 ? text.text : null;
  return (
    <div className="flex flex-col gap-2">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- in-memory base64 data URL; next/image can't optimize and would force a remote loader
        <img
          src={`data:${image.source.media_type};base64,${image.source.data}`}
          alt="Attached"
          className="max-h-64 max-w-full rounded-md object-contain"
        />
      )}
      {caption && <span>{caption}</span>}
    </div>
  );
}
