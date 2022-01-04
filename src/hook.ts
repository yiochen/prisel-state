export interface Hook {
  type: HookType;
}

/** @internal */
export enum HookType {
  LOCAL_STATE,
  EFFECT,
  EVENT,
  COMPUTED,
  STORED,
}
