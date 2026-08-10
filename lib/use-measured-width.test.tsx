/// <reference types="vitest/globals" />

import { act, render, screen } from "@testing-library/react";
import { useMeasuredWidth } from "./use-measured-width";

// `vitest.setup.ts` stubs `getBoundingClientRect` at 260px wide and installs a
// `ResizeObserver` whose callback never fires, so the number these tests read
// off an untouched render is the on-attach measurement. The observer path is
// exercised by stubbing a spy over that global and restoring it afterwards —
// `vi.unstubAllGlobals()` would restore `undefined` (jsdom has no
// ResizeObserver) and break every later test in the file.
const setupResizeObserver = globalThis.ResizeObserver;

// --- helpers ---------------------------------------------------------------

function Harness({ attach = true }: { attach?: boolean }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  return (
    <div>
      <span data-testid="width">{width}</span>
      {attach ? <div data-testid="box" ref={ref} /> : null}
    </div>
  );
}

function measuredWidth(): string | null {
  return screen.getByTestId("width").textContent;
}

/** Only `contentRect.width` is read, so the rest of the entry is not built. */
function entry(width: number): ResizeObserverEntry {
  return { contentRect: { width } } as ResizeObserverEntry;
}

type SpyInstance = {
  notify: ResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};
const instances: SpyInstance[] = [];

class SpyResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    instances.push({ notify: callback, observe: this.observe, disconnect: this.disconnect });
  }
}

beforeEach(() => {
  instances.length = 0;
});

afterEach(() => {
  vi.stubGlobal("ResizeObserver", setupResizeObserver);
});

// --- tests -----------------------------------------------------------------

describe("useMeasuredWidth", () => {
  it("reports 0 before any node attaches", () => {
    render(<Harness attach={false} />);
    expect(measuredWidth()).toBe("0");
  });

  it("reports the measured width once a node attaches", () => {
    render(<Harness />);
    expect(measuredWidth()).toBe("260");
  });

  it("observes the node it was attached to, so later resizes reach it", () => {
    vi.stubGlobal("ResizeObserver", SpyResizeObserver);
    render(<Harness />);

    expect(instances).toHaveLength(1);
    expect(instances[0].observe).toHaveBeenCalledWith(screen.getByTestId("box"));
  });

  it("disconnects the observer on unmount", () => {
    vi.stubGlobal("ResizeObserver", SpyResizeObserver);
    const { unmount } = render(<Harness />);

    expect(instances).toHaveLength(1);
    expect(instances[0].disconnect).not.toHaveBeenCalled();

    unmount();
    expect(instances[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it("still measures on attach when ResizeObserver is undefined", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    expect(() => render(<Harness />)).not.toThrow();
    expect(measuredWidth()).toBe("260");
  });

  it("updates the width from an observation, ignoring sub-0.5px jitter", () => {
    vi.stubGlobal("ResizeObserver", SpyResizeObserver);
    render(<Harness />);
    expect(measuredWidth()).toBe("260");

    act(() => {
      instances[0].notify([entry(300)], null as unknown as ResizeObserver);
    });
    expect(measuredWidth()).toBe("300");

    // 0.4px of layout noise — a real browser emits these on every scrollbar
    // and font swap, and redrawing a chart for them is pure churn.
    act(() => {
      instances[0].notify([entry(300.4)], null as unknown as ResizeObserver);
    });
    expect(measuredWidth()).toBe("300");
  });
});
