import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MacroCard, parseMacroTable } from "./macro-card";

/**
 * Minimal hast-node shape we touch when walking a `<table>` to extract
 * its text grid. react-markdown hands the `table` component renderer
 * the underlying hast element on `node`; we only ever read `tagName`,
 * `children`, and (on text nodes) `value`, so we type just those rather
 * than pulling the full hast typings in.
 */
type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  children?: HastNode[];
};

/** Recursively concatenate the `.value` of all text descendants. */
function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  if (!node.children) return "";
  return node.children.map(textOf).join("");
}

/** First element child with the given tag name, searched one level deep. */
function childrenByTag(node: HastNode | undefined, tag: string): HastNode[] {
  if (!node?.children) return [];
  return node.children.filter((c) => c.type === "element" && c.tagName === tag);
}

/**
 * Defensive extraction of a `<table>`'s text grid from its hast node.
 * Returns null on any unexpected shape so odd / non-macro tables fall
 * back to the plain styled `<table>` instead of throwing.
 */
function extractTable(node: unknown): { headers: string[]; rows: string[][] } | null {
  if (!node || typeof node !== "object") return null;
  const table = node as HastNode;
  if (table.tagName !== "table" || !Array.isArray(table.children)) return null;

  const thead = childrenByTag(table, "thead")[0];
  const tbody = childrenByTag(table, "tbody")[0];
  if (!thead || !tbody) return null;

  const headerRow = childrenByTag(thead, "tr")[0];
  if (!headerRow) return null;
  const headers = childrenByTag(headerRow, "th").map((th) => textOf(th).trim());
  if (headers.length === 0) return null;

  const rows = childrenByTag(tbody, "tr").map((tr) =>
    childrenByTag(tr, "td").map((td) => textOf(td).trim()),
  );
  if (rows.length === 0) return null;

  return { headers, rows };
}

/**
 * Markdown renderer for assistant turns. Each element is mapped to a
 * Tailwind-styled component so the rendered output sits naturally in
 * the chat bubble — no `prose` plugin, no global typography styles to
 * maintain.
 *
 * `react-markdown` is safe-by-default (raw HTML in input is escaped),
 * so we don't need a sanitizer step — and we deliberately don't add
 * rehype-raw.
 *
 * The `table` renderer additionally intercepts nutrition tables: it
 * walks the hast node to pull the header/body text grid, asks
 * `parseMacroTable` whether it looks like macros, and renders a
 * `<MacroCard>` when it does. Everything else falls through to the
 * plain styled table.
 */
export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Paragraphs: tight by default. The bubble already has padding,
        // so internal margins only need to separate consecutive blocks.
        p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
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
          <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>
        ),
        // Inline `code` gets a subtle background; fenced code blocks
        // get their own block + horizontal scroll for long lines.
        code: ({ className, children, ...rest }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className="rounded bg-[var(--surface-3)] px-1 py-0.5 font-mono text-[0.85em]"
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
          <pre className="my-2 overflow-x-auto rounded-[var(--radius-card)] bg-[var(--surface-3)] p-3 first:mt-0 last:mb-0">
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
        // GFM tables. A nutrition table is rendered as a MacroCard;
        // everything else gets the plain styled table with horizontal
        // scroll on overflow so long workout tables don't blow out the
        // bubble width.
        table: ({ node, children }) => {
          const extracted = extractTable(node);
          if (extracted) {
            const parsed = parseMacroTable(extracted.headers, extracted.rows);
            if (parsed) return <MacroCard parsed={parsed} />;
          }
          return (
            <div className="my-2 overflow-x-auto first:mt-0 last:mb-0">
              <table className="min-w-full border-collapse text-xs">{children}</table>
            </div>
          );
        },
        th: ({ children }) => (
          <th className="border-b border-[var(--border)] px-2 py-1 text-left font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-[var(--border)]/50 px-2 py-1">{children}</td>
        ),
        hr: () => <hr className="my-3 border-[var(--border)]" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
