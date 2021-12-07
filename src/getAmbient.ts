import type { Ambient } from "./ambient";
import { machine } from "./machine";

/**
 * Get ambient value for the given {@linkcode Ambient}. This function will throw
 * if no ambient value is provided.
 * @param ambient first object returned from {@linkcode newAmbient}.
 * @param defaultValue default ambient value to return if ambient is not provided.
 * @typeparam AmbientT the data type of the ambient value.
 */
export function getAmbient<AmbientT>(
  ambient: Ambient<AmbientT>,
  defaultValue?: AmbientT
): AmbientT;
export function getAmbient<AmbientT>(
  ambient: Ambient<AmbientT>,
  ...defaultValue: AmbientT[]
) {
  return machine.getAmbientForCurrentState(ambient, ...defaultValue);
}

/**
 * Check if ambient is provided.
 * @param ambient first object returned from {@linkcode newAmbient}.
 * @returns whether the ambient is provided.
 */
export function hasAmbient(ambient: Ambient<any>) {
  return machine.hasAmbient(ambient);
}
