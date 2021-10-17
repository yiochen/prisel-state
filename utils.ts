export function assert(condition: boolean, error: string) {
  if (!condition) {
    throw new Error(error);
  }
}

export function assertNonNull<T>(value: T, label: string): NonNullable<T> {
  assert(
    value != undefined && value != null,
    `assert ${label} to be non-null, but is ${value}`
  );
  return value!!;
}
