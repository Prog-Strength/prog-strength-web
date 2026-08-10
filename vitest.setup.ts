// Extends Vitest's `expect` with @testing-library/jest-dom matchers
// (e.g. toBeInTheDocument). Loaded via setupFiles in vitest.config.ts.
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// A component that sizes an SVG from its container renders nothing at all under
// test, because jsdom implements neither `ResizeObserver` nor layout. The two
// stubs below are what let those components be tested here at all.

/**
 * Enough of the interface for a component to construct, observe and disconnect.
 * It never fires the callback — a hook that has to see a width under test should
 * measure on ref attach (see `lib/use-measured-width.ts`) rather than wait for an
 * observation that a real browser delivers and this stub does not.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// Roughly one dashboard tile's chart box — jsdom reports every element as 0x0,
// so without this a measured-width component measures nothing and draws nothing.
// Deliberately on HTMLElement rather than Element: SVG nodes fall through to the
// narrower per-file overrides that already exist (RecapChart.test.tsx), which
// measure an <svg> and would otherwise be shadowed by this one.
const STUB_WIDTH = 260;
const STUB_HEIGHT = 62;

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  writable: true,
  value(): DOMRect {
    const rect = {
      width: STUB_WIDTH,
      height: STUB_HEIGHT,
      top: 0,
      left: 0,
      bottom: STUB_HEIGHT,
      right: STUB_WIDTH,
      x: 0,
      y: 0,
    };
    return { ...rect, toJSON: () => ({ ...rect }) };
  },
});
