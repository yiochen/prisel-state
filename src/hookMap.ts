import type { Hook } from "./hook";
import { HookType } from "./hook";
import type { EffectHook } from "./useEffect";
import type { EventHook } from "./useEvent";
import type { MemoHook } from "./useMemo";
import type { RefHook } from "./useRef";
import type { StateHook } from "./useState";

export interface HookMap {
  [HookType.EFFECT]: EffectHook;
  [HookType.STATE]: StateHook<any>;
  [HookType.EVENT]: EventHook;
  [HookType.MEMO]: MemoHook;
  [HookType.REF]: RefHook<any>;
}

export function isHook<T extends HookType>(
  hook: Hook,
  hookType: T
): hook is HookMap[T] {
  return hook.type === hookType;
}
