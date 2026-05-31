"use client";

import { useEffect, useMemo, useState } from "react";
import { type PantryItem, type Recipe } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { RecipeModal } from "@/components/recipe-modal";

const PAGE_SIZE = 25;

type ModalTarget = null | { mode: "create" } | { mode: "edit"; id: string };

/**
 * Recipes view rendered when /nutrition?view=recipes. Mirrors
 * PantryView: search, page-25 with letter headers within page, click
 * row to open edit modal. Threads the page-level pantry array through
 * to the RecipeModal so the form can render its component picker.
 */
export function RecipesView({
  token,
  pantry,
  recipes,
  onChanged,
}: {
  token: string;
  pantry: PantryItem[] | null;
  recipes: Recipe[] | null;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalTarget>(null);

  const filtered = useMemo(() => {
    if (recipes === null) return null;
    const q = query.trim().toLowerCase();
    const sorted = recipes
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (q === "") return sorted;
    return sorted.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, query]);

  const pageCount = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;
  // Clamp page inline so we never render an empty slice if filtering shrinks
  // the list below the current page. Avoids a setState-in-effect.
  const effectivePage = Math.min(page, pageCount);

  const pageItems = useMemo(() => {
    if (!filtered) return [];
    const start = (effectivePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, effectivePage]);

  // Group the page slice by first-letter bucket so we can emit
  // headers when the bucket changes within the page.
  const pageGroups = useMemo(() => {
    const groups: { letter: string; items: Recipe[] }[] = [];
    for (const item of pageItems) {
      const letter = bucketLetter(item.name);
      const last = groups[groups.length - 1];
      if (last && last.letter === letter) {
        last.items.push(item);
      } else {
        groups.push({ letter, items: [item] });
      }
    }
    return groups;
  }, [pageItems]);

  const editingRecipe =
    modal && modal.mode === "edit" ? (recipes ?? []).find((r) => r.id === modal.id) : undefined;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Recipes</h2>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium hover:opacity-80"
        >
          + Add
        </button>
      </div>

      <input
        type="search"
        aria-label="Search recipes"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder="Search…"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
      />

      {recipes === null && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {filtered && filtered.length === 0 && (
        <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          {query.trim()
            ? "No recipes match that search."
            : "No recipes yet. Add one to quick-add a regular meal."}
        </p>
      )}

      {filtered && filtered.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {pageGroups.map((g) => (
              <div key={g.letter} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {g.letter}
                </h3>
                <ul className="flex flex-col gap-2">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <RecipeRow recipe={r} onClick={() => setModal({ mode: "edit", id: r.id })} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <PaginationFooter
            page={effectivePage}
            pageCount={pageCount}
            onPrev={() => setPage(Math.max(1, effectivePage - 1))}
            onNext={() => setPage(Math.min(pageCount, effectivePage + 1))}
          />
        </>
      )}

      {modal?.mode === "create" && (
        <RecipeModal
          mode="create"
          token={token}
          pantry={pantry ?? []}
          onSaved={onChanged}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === "edit" && editingRecipe && (
        <RecipeModal
          mode="edit"
          token={token}
          pantry={pantry ?? []}
          initial={editingRecipe}
          onSaved={onChanged}
          onDeleted={onChanged}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === "edit" && !editingRecipe && (
        <CloseStaleModal onClose={() => setModal(null)} />
      )}
    </section>
  );
}

function RecipeRow({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:opacity-90"
    >
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="truncate text-sm font-medium">{recipe.name}</p>
        <p className="text-xs text-[var(--muted)] tabular-nums">
          {formatNumber(recipe.macros.calories)} cal · P {formatNumber(recipe.macros.protein_g)}g ·
          F {formatNumber(recipe.macros.fat_g)}g · C {formatNumber(recipe.macros.carbs_g)}g
          <span className="ml-2 text-[10px] uppercase tracking-wider">per batch</span>
        </p>
      </div>
    </button>
  );
}

function PaginationFooter({
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-xs">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-medium transition hover:opacity-80 disabled:opacity-40"
      >
        ◀ Prev
      </button>
      <span className="text-[var(--muted)] tabular-nums">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= pageCount}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-medium transition hover:opacity-80 disabled:opacity-40"
      >
        Next ▶
      </button>
    </div>
  );
}

function CloseStaleModal({ onClose }: { onClose: () => void }) {
  // Renders nothing; closes the modal as a side-effect on mount.
  // The parent's render condition becomes false after setModal(null)
  // commits, so this unmounts after exactly one effect fire.
  useEffect(() => {
    onClose();
  }, [onClose]);
  return null;
}

function bucketLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}
