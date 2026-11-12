import { z } from 'zod';

export const SAVE_KEY = 'jbc.save';

const Job = z.enum(['cop', 'fire', 'builder']);

export const SaveV1 = z.object({
  version: z.literal(1),
  coins: z.number().int().nonnegative(),
  job: Job.nullable(),
  badges: z.array(z.string()),
  /** mission id -> best stars (1..3) */
  missionsDone: z.record(z.string(), z.number().int().min(1).max(3)),
  errandsDone: z.array(z.string()),
  owned: z.array(z.string()),
  minigamePlays: z.record(z.string(), z.number().int().nonnegative()),
  apartment: z.array(z.object({ item: z.string(), gx: z.number(), gy: z.number() })),
});
export type SaveV1 = z.infer<typeof SaveV1>;

/** Spec 006: the hat you wear (null = your uniform's own) and your own car's paint (null = plain). */
export const SaveV2 = SaveV1.extend({
  version: z.literal(2),
  hat: z.string().nullable(),
  paint: z.string().nullable(),
});
export type SaveV2 = z.infer<typeof SaveV2>;
/** The current save shape. */
export type Save = SaveV2;

export function defaultSave(): Save {
  return {
    version: 2,
    hat: null,
    paint: null,
    coins: 0,
    job: null,
    badges: [],
    missionsDone: {},
    errandsDone: [],
    owned: [],
    minigamePlays: {},
    apartment: [],
  };
}

/**
 * Turn whatever is in storage into a valid current save. Unknown/corrupt data starts fresh rather
 * than crashing (a 6-year-old can't fix a broken save). Future versions add steps here: v1 -> v2 ...
 */
export function migrate(raw: unknown): Save {
  if (!raw || typeof raw !== 'object') return defaultSave();
  const version = (raw as { version?: unknown }).version;
  if (version === 1) {
    // Fill any fields an older v1 build didn't write yet, validate as v1, then step up to v2.
    const r = SaveV1.safeParse({ ...defaultSave(), ...(raw as object), version: 1 });
    return r.success ? { ...r.data, version: 2, hat: null, paint: null } : defaultSave();
  }
  if (version === 2) {
    const r = SaveV2.safeParse({ ...defaultSave(), ...(raw as object) });
    return r.success ? r.data : defaultSave();
  }
  return defaultSave();
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** One save slot in localStorage with debounced writes. */
export class SaveStore {
  data: Save;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly debounceMs = 250,
  ) {
    this.data = this.load();
  }

  load(): Save {
    if (!this.storage) return defaultSave();
    try {
      const text = this.storage.getItem(SAVE_KEY);
      return migrate(text ? JSON.parse(text) : null);
    } catch {
      return defaultSave();
    }
  }

  /** Change the save and schedule a write. */
  update(fn: (s: Save) => void): void {
    fn(this.data);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  /** Write now (also used on page hide). */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked (private mode): keep playing without saving.
    }
  }
}
