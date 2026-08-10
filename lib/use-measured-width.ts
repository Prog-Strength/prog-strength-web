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
 * The node is observed from the REF CALLBACK rather than from an effect, so
 * attaching and watching are the same event: a target that is rendered
 * conditionally — absent on mount and present later, or swapped for another
 * node — is measured and then watched, every time.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefCallback } from "react";

/** Measure an element's content width, live. Returns 0 until first measure. */
export function useMeasuredWidth<T extends HTMLElement>(): [RefCallback<T>, number] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback<RefCallback<T>>((node) => {
    // React calls this with `null` on detach and with the new node on
    // re-attach, so dropping the previous observer here is what keeps a
    // swapped-out node from being watched after it is gone.
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;

    setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(node);
    observer.current = ro;
  }, []);

  // A backstop only: unmounting detaches the ref, which has already
  // disconnected. Nulling the ref keeps whichever runs second a no-op.
  useEffect(
    () => () => {
      observer.current?.disconnect();
      observer.current = null;
    },
    [],
  );

  return [ref, width];
}
