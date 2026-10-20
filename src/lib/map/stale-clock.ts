export const STALE_CLOCK_INTERVAL_MS = 60_000;

type ClockTimer = ReturnType<typeof setInterval>;

/** Tick while the document is visible. A hidden tab drops the interval. */
export function startStaleClock(options: {
  onTick: (now: number) => void;
  intervalMs?: number;
  hidden?: () => boolean;
  subscribeVisibility?: (onChange: () => void) => () => void;
  now?: () => number;
  schedule?: (callback: () => void, ms: number) => ClockTimer;
  cancel?: (timer: ClockTimer) => void;
}): () => void {
  const intervalMs = options.intervalMs ?? STALE_CLOCK_INTERVAL_MS;
  const hidden = options.hidden ?? (() => false);
  const now = options.now ?? Date.now;
  const schedule = options.schedule ?? ((callback, ms) => setInterval(callback, ms));
  const cancel = options.cancel ?? ((timer) => clearInterval(timer));
  let timer: ClockTimer | null = null;

  function disarm(): void {
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
  }

  function arm(): void {
    if (timer !== null || hidden()) {
      return;
    }
    timer = schedule(() => {
      if (hidden()) {
        disarm();
        return;
      }
      options.onTick(now());
    }, intervalMs);
  }

  function onVisibility(): void {
    if (hidden()) {
      disarm();
      return;
    }
    options.onTick(now());
    arm();
  }

  if (!hidden()) {
    options.onTick(now());
  }
  arm();
  const unsubscribe = options.subscribeVisibility?.(onVisibility) ?? (() => undefined);
  return () => {
    disarm();
    unsubscribe();
  };
}
