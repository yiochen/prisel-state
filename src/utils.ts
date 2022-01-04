import { AssertionError } from "./errors";

export function assert(condition: boolean, error: string) {
  if (!condition) {
    throw new AssertionError(error);
  }
}

export function assertNonNull<T>(value: T, label: string): NonNullable<T> {
  assert(
    value != undefined && value != null,
    `assert ${label} to be non-null, but is ${value}`
  );
  return value!!;
}

export type AllDeps = undefined;
export const AllDeps = undefined;

/**
 * Compare dependency arrays.
 * @param oldDeps
 * @param newDeps
 * @returns true if dependencies are considered equal
 */
export function unchangedDeps(
  oldDeps: any[] | AllDeps,
  newDeps: any[] | AllDeps
) {
  if (oldDeps === AllDeps || newDeps === AllDeps) {
    // if any of the dependencies are undefined. That means whole closure
    // is considered as dependency. Every call to state func will trigger
    // execution of the hook.
    return false;
  }
  if (newDeps.length != oldDeps.length) {
    return false;
  }
  return oldDeps.every((value, index) => Object.is(value, newDeps[index]));
}

export function isGenerator(value: any): value is Generator<any, any, any> {
  return (
    typeof value === "object" &&
    typeof value.next === "function" &&
    typeof value.return === "function" &&
    typeof value.throw === "function"
  );
}
