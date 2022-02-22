import type { Hook } from "./hook";
import { HookType } from "./hook";
import type { ComputedHook } from "./useComputed";
import type { EventHook } from "./useEvent";
import type { LocalStateHook } from "./useLocalState";
import type { EffectHook } from "./useSideEffect";
import type { StoredHook } from "./useStored";

export interface HookMap {
  [HookType.EFFECT]: EffectHook;
  [HookType.LOCAL_STATE]: LocalStateHook<any>;
  [HookType.EVENT]: EventHook;
  [HookType.COMPUTED]: ComputedHook;
  [HookType.STORED]: StoredHook<any>;
}

export function isHook<T extends HookType>(
  hook: Hook,
  hookType: T
): hook is HookMap[T] {
  return hook.type === hookType;
}
