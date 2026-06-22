/**
 * Monday-anchored weekly bucketing shared by every activity chart.
 *
 * For bounded windows (7/30/90d) the span runs from `days` ago to today
 * so even an empty user sees a chart shaped like the window. For "all"
 * (days === null) the span runs from the oldest item to today. Weeks with
 * no items still appear (zero-filled by `factory`) so a multi-week gap
 * shows up as a dip instead of being smoothed away.
 */

export type WeekBucket<T> = T & {
  weekKey: string;
  weekStart: Date;
  // Unix-ms of the Monday so recharts' numeric XAxis places points linearly.
  t: number;
};

export function startOfMonday(d: Date): Date {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay: 0=Sun..6=Sat; Monday-anchored offset: Sun→6, Mon→0, Tue→1…
  const offset = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - offset);
  return local;
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/**
 * @param items        the source rows (workouts or running sessions)
 * @param days         window length, or null for "all"
 * @param getTimestamp maps an item to the Date it falls on
 * @param factory      builds a fresh zero-filled accumulator for a week
 * @param accumulate   folds one item into its week bucket (mutates the bucket)
 * @param now          "today" (defaults to the real clock); inject for tests
 */
export function buildWeeklyBuckets<T, B>({
  items,
  days,
  getTimestamp,
  factory,
  accumulate,
  now = new Date(),
}: {
  items: T[];
  days: number | null;
  getTimestamp: (item: T) => Date;
  factory: () => B;
  accumulate: (bucket: WeekBucket<B>, item: T) => void;
  /** "Today" — injectable so derivations and their tests pin a deterministic
   * window edge. Defaults to the real wall clock for existing callers. */
  now?: Date;
}): WeekBucket<B>[] {
  const since =
    days !== null
      ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      : items.length > 0
        ? new Date(Math.min(...items.map((it) => getTimestamp(it).getTime())))
        : now;

  const byKey = new Map<string, WeekBucket<B>>();
  const orderedKeys: string[] = [];
  for (
    let cursor = startOfMonday(since);
    cursor.getTime() <= startOfMonday(now).getTime();
    cursor = addDays(cursor, 7)
  ) {
    const key = isoDate(cursor);
    orderedKeys.push(key);
    byKey.set(key, {
      ...factory(),
      weekKey: key,
      weekStart: new Date(cursor),
      t: cursor.getTime(),
    });
  }

  for (const it of items) {
    const bucket = byKey.get(isoDate(startOfMonday(getTimestamp(it))));
    if (bucket) accumulate(bucket, it);
  }

  return orderedKeys.map((k) => byKey.get(k)!);
}
