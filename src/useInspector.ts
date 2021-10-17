import { Hook, HookType } from "./hook";
import { Inspector } from "./inspector";
import { machine } from "./machine";

export interface InspectorHook extends Hook {
  type: HookType.INSPECTOR;
}

/**
 * Hook that returns the inspector.
 * @returns inspector.
 */
export function useInspector(): Inspector {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new Error("Cannot useNested outside of state machine scope");
  }

  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    const nestedStateHook: InspectorHook = {
      type: HookType.INSPECTOR,
    };
    processingState.setHook(nestedStateHook);
  }
  return processingState.inspector!!;
}
