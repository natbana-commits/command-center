// Races a promise against a deadline, resolving to `fallback` if the
// promise hasn't settled in time — the promise itself is never cancelled,
// it just stops being waited on, so any Supabase write it eventually
// makes still lands (or, if the whole function is killed first, simply
// gets retried next run via whatever dedup the caller already relies on).
export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  const result = await Promise.race([promise, timeout]);
  clearTimeout(timer!);
  return result;
}
