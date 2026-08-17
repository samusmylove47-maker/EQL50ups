/**
 * Cooperative scheduling helpers.
 *
 * Long synchronous work — Auto-fill ranks every candidate for every empty slot
 * twice — has to hand the main thread back often enough that the browser can
 * paint. These two primitives are all that takes: yield to the next frame, and
 * drive an iterator a slice at a time between yields.
 */

/** Resolve on the next animation frame, or on a timer where there are none. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

/**
 * Drive a generator to completion, yielding to the browser whenever a slice
 * has run for longer than `budget` milliseconds.
 *
 * The budget bounds the *scheduling* overhead, not the block: one step that
 * takes longer than the budget still runs to completion, so the longest block
 * is the longest single step. Steps are therefore chosen to be small.
 */
export async function runSliced<T>(
  work: Generator<unknown, T, void>,
  budget = 8,
): Promise<T> {
  const now = () => (typeof performance === 'object' ? performance.now() : Date.now());
  for (;;) {
    const deadline = now() + budget;
    let step = work.next();
    while (!step.done && now() < deadline) step = work.next();
    if (step.done) return step.value;
    await nextFrame();
  }
}
