import type { AmbientRef, AmbientValueRef } from "./ambient";
import type { ImmutableMapBuilder } from "./immutableMap";

/**
 * Returned type of state function. If a state function is normal function, the
 * returned type is `StateConfig<any> | void`. If a state function is a
 * generator, the returned type is an iterator.
 */
export type StateFuncReturn =
  | StateConfig<any>
  | void
  | Generator<StateConfig<any>, StateConfig<any>, void>;

/**
 * A function describing a state. A `StateFunc` takes props and return a
 * {@linkcode StateConfig} for the next state to transition to.
 */
export interface StateFunc<PropT = void> {
  (props: PropT): StateFuncReturn;
}

/**
 * A wrapper object containing the {@linkcode StateFunc} and the props to be
 * passed to the `StateFunc`.
 */
export interface StateConfig<PropT = void> {
  stateFunc: StateFunc<PropT>;
  props: PropT;
  /** @internal */
  ambient: ImmutableMapBuilder<AmbientRef<any>, AmbientValueRef<any>>;
  label: string;
  setLabel(label: string): StateConfig<PropT>;
}

export function createStateConfig<PropT = void>(
  stateFunc: StateFunc<PropT>,
  props: PropT,
  ambient: ImmutableMapBuilder<AmbientRef<any>, AmbientValueRef<any>>,
  label?: string
): StateConfig<PropT> {
  const stateConfig: StateConfig<PropT> = {
    stateFunc,
    props,
    ambient,
    label: label ? label : stateFunc.name,
    setLabel: (label: string) => {
      stateConfig.label = label;
      return stateConfig;
    },
  };
  return stateConfig;
}
