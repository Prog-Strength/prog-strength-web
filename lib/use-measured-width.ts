"use client";

/**
 * Measure a container's width so an SVG can be drawn in real pixel units —
 * `viewBox` equal to the rendered size, nothing scaled.
 *
 * The alternative is a fixed `viewBox` stretched to the card with
 * `preserveAspectRatio="none"`, which scales x and y by different factors and
 * so turns every `<circle>` into an ellipse. `vectorEffect="non-scaling-stroke"`
 * rescues a stroke; nothing rescues a scaled circle — invisible with one dot,
 * glaring with thirty. Measuring removes the problem at the root, and the dot
 * pitch on screen becomes the true pitch rather than a stretched one.
 *
 * Width is 0 until the first measurement, so a caller reserves the box's height
 * in CSS and renders the SVG only once measured; otherwise hydration shifts the
 * layout.
 *
 * One limitation to know before reaching for this: the observer is wired up once,
 * on mount. A node that attaches later, or swaps identity while mounted, is still
 * MEASURED — the ref callback runs every time — but it is not watched, so it will
 * not update on resize. Attach the ref to an element that is rendered
 * unconditionally for the component's whole life and this does not arise.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefCallback } from "react";

/** Measure an element's content width, live. Returns 0 until first measure. */
export function useMeasuredWidth<T extends HTMLElement>(): [RefCallback<T>, number] {
  const [width, setWidth] = useState(0);
  const observed = useRef<T | null>(null);

  const ref = useCallback<RefCallback<T>>((node) => {
    observed.current = node;
    if (node) setWidth(node.getBoundingClientRect().width);
  }, []);

  useLayoutEffect(() => {
    const node = observed.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
