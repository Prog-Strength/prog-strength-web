/**
 * A stand-in for `maplibre-gl.Map` for unit tests.
 *
 * The real module touches browser APIs at import time (`window.URL.createObjectURL`)
 * that jsdom does not provide, so every suite that renders a component mounting
 * a map has to stub it. This lives here rather than being retyped per suite
 * because `MapView` calls a fair surface of the Map API — `once`, `off`,
 * `isStyleLoaded`, `setStyle`, and the whole source/layer/image family that
 * `installOverlays` drives — and a stub missing any one of them fails with a
 * "not a function" that reads like a component bug rather than a fixture gap.
 *
 * NOT a test file itself (no `.test.` in the name), so vitest does not collect it.
 */

export type StubMap = {
  addSource: ReturnType<typeof vi.fn>;
  removeSource: ReturnType<typeof vi.fn>;
  getSource: ReturnType<typeof vi.fn>;
  addLayer: ReturnType<typeof vi.fn>;
  removeLayer: ReturnType<typeof vi.fn>;
  getLayer: ReturnType<typeof vi.fn>;
  addImage: ReturnType<typeof vi.fn>;
  removeImage: ReturnType<typeof vi.fn>;
  hasImage: ReturnType<typeof vi.fn>;
  setPaintProperty: ReturnType<typeof vi.fn>;
  queryRenderedFeatures: ReturnType<typeof vi.fn>;
  getStyle: ReturnType<typeof vi.fn>;
  setStyle: ReturnType<typeof vi.fn>;
  isStyleLoaded: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  /** Fire every listener registered for an event, as MapLibre would. */
  emit: (event: string) => void;
};

/**
 * Build a Map stub that records calls and immediately invokes `load` and
 * `styledata` handlers, so a component's install path actually runs.
 *
 * `styleLayers` seeds `getStyle()`; pass a symbol layer to exercise the
 * `beforeId` anchoring.
 */
export function createMapStub(styleLayers: { id: string; type: string }[] = []): StubMap {
  const layers = new Map<string, unknown>();
  const sources = new Map<string, unknown>();
  const images = new Set<string>();
  /** Every registered listener, by event name, so a test can emit any of them. */
  const handlers = new Map<string, (() => void)[]>();
  const emit = (event: string) => {
    for (const cb of handlers.get(event) ?? []) cb();
  };

  const stub: StubMap = {
    addSource: vi.fn((id: string, spec: unknown) => {
      // GeoJSON sources stay drivable via setData after installation, as in
      // MapLibre — MapView's scrub path pushes into them without reinstalling.
      const isGeoJSON = (spec as { type?: string } | null)?.type === "geojson";
      sources.set(id, isGeoJSON ? { ...(spec as object), setData: vi.fn() } : spec);
    }),
    removeSource: vi.fn((id: string) => void sources.delete(id)),
    getSource: vi.fn((id: string) => sources.get(id)),
    addLayer: vi.fn((spec: { id: string }) => void layers.set(spec.id, spec)),
    removeLayer: vi.fn((id: string) => void layers.delete(id)),
    getLayer: vi.fn((id: string) => layers.get(id)),
    addImage: vi.fn((id: string) => void images.add(id)),
    removeImage: vi.fn((id: string) => void images.delete(id)),
    hasImage: vi.fn((id: string) => images.has(id)),
    getStyle: vi.fn(() => ({
      layers: [
        ...styleLayers,
        ...[...layers.values()].map((l) => l as { id: string; type: string }),
      ],
    })),
    setPaintProperty: vi.fn(),
    // Nothing under the pointer by default, so the map→profile binding stays
    // quiet unless a test arranges a hit.
    queryRenderedFeatures: vi.fn(() => []),
    // Models the real thing: a style change WIPES every application-added
    // source, layer and image, then emits `styledata` so the consumer can
    // reinstall. Without this a component-level test of the switcher would pass
    // while the route silently vanished in a browser — the exact failure the
    // overlay installer exists to prevent.
    setStyle: vi.fn(() => {
      layers.clear();
      sources.clear();
      images.clear();
      emit("styledata");
    }),
    isStyleLoaded: vi.fn(() => true),
    fitBounds: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), cb]);
      // styledata fires immediately on registration, as it does for a style
      // that is already loading when the listener attaches.
      if (event === "styledata") {
        cb();
      }
    }),
    off: vi.fn(),
    once: vi.fn((event: string, cb: () => void) => {
      if (event === "load") cb();
    }),
    remove: vi.fn(),
    emit,
  };
  return stub;
}
