const pending = new Set<Promise<void>>();

// Fire-and-forget work that must never fail the request that started it: a failure is only
// logged, under `label`.
export function runInBackground(label: string, task: () => Promise<unknown>): void {
  const run: Promise<void> = Promise.resolve()
    .then(task)
    .then(
      () => undefined,
      (err: unknown) => {
        console.error(label, err);
      },
    )
    .finally(() => pending.delete(run));
  pending.add(run);
}

// Resolves once every background task started so far, and any started meanwhile, has settled.
export async function settleBackgroundTasks(): Promise<void> {
  while (pending.size > 0) await Promise.all(pending);
}
