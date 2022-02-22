export interface Hook {
  type: HookType;
}

/** @internal */
export enum HookType {
  LOCAL_STATE = "useLocalState",
  EFFECT = "useSideEffect",
  EVENT = "useEvent",
  COMPUTED = "useComputed",
  STORED = "useStored",
}
