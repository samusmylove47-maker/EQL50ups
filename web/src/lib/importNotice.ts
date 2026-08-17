/**
 * A one-shot message handed from the screen that ran an import to the screen
 * the reader lands on afterwards.
 *
 * Importing from the game creates a set and navigates straight to it, which is
 * the right destination — an import you cannot see is an import you have to go
 * looking for. But the report of what came in, what did not, and what was
 * skipped belongs on that destination, and the two screens never share a render
 * pass. This is the handoff: one string, consumed once, gone.
 *
 * Deliberately module state rather than store state. It is not part of the
 * library, it must never be persisted, and a second reader of the same message
 * would be a bug.
 */

let pending: string | null = null;

export function queueImportNotice(message: string): void {
  pending = message;
}

/** Read and clear. Returns null when there is nothing waiting. */
export function takeImportNotice(): string | null {
  const message = pending;
  pending = null;
  return message;
}
