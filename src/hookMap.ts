import { Hook, HookType } from "./hook";
import { EventHook } from "./useEvent";
import { InspectorHook } from "./useInspector";
import { LocalStateHook } from "./useLocalState";
import { NestedStateHook } from "./useNested";
import { EffectHook } from "./useSideEffect";

export interface HookMap {
  [HookType.EFFECT]: EffectHook;
  [HookType.LOCAL_STATE]: LocalStateHook<any>;
  [HookType.EVENT]: EventHook;
  [HookType.NESTED_STATE]: NestedStateHook;
  [HookType.INSPECTOR]: InspectorHook;
}

export function isHook<T extends HookType>(
  hook: Hook,
  hookType: T
): hook is HookMap[T] {
  return hook.type === hookType;
}
