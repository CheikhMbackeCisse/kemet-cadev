/** Lance une tâche quand le navigateur est libre, au plus tard après timeoutMs. Renvoie l'annulation. */
export function whenIdle(task: () => void, timeoutMs: number): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(task, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(task, 0);
  return () => window.clearTimeout(handle);
}
