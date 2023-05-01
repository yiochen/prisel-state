export interface Hook {
  type: HookType;
}

/** @internal */
export enum HookType {
  STATE = "useState",
  EFFECT = "useEffect",
  EVENT = "useEvent",
  MEMO = "useMemo",
  REF = "useRef",
}
