import { inspectorAmbient } from "./ambients";
import { getAmbient } from "./getAmbient";
import type { Inspector } from "./inspector";
import type { StateFunc, StateFuncReturn } from "./stateConfig";

/**
 * Create a {@linkcode StateFunc} that has access to the {@linkcode Inspector}.
 * @param stateFunc A function describing a state.
 * @returns
 */
export function withInspector<PropT = void>(
  stateFunc: (inspector: Inspector, props: PropT) => StateFuncReturn
): StateFunc<PropT> {
  return (props: PropT) => {
    const inspector = getAmbient(inspectorAmbient);
    return stateFunc(inspector, props);
  };
}
