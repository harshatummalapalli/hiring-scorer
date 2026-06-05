export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Operation timed out")),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timer),
  );
}
