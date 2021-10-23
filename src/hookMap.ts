import type { Hook } from "./hook";
import { HookType } from "./hook";
import { ComputedHook } from "./useComputed";
import type { EventHook } from "./useEvent";
import type { LocalStateHook } from "./useLocalState";
import type { NestedStateHook } from "./useNested";
import type { EffectHook } from "./useSideEffect";

export interface HookMap {
  [HookType.EFFECT]: EffectHook;
  [HookType.LOCAL_STATE]: LocalStateHook<any>;
  [HookType.EVENT]: EventHook;
  [HookType.NESTED_STATE]: NestedStateHook;
  [HookType.COMPUTED]: ComputedHook;
}

export function isHook<T extends HookType>(
  hook: Hook,
  hookType: T
): hook is HookMap[T] {
  return hook.type === hookType;
}
