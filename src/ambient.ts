import type { StateConfig } from "./stateConfig";
import { createStateConfig } from "./stateConfig";

/**
 * An object wrapping the ambient name. `AmbientRef` is a identifier of an Ambient.
 */
// @ts-ignore
export interface AmbientRef<T> {
  name: string;
}

/**
 * A object returned from {@linkcode newAmbient}. Use `Ambient` to retrieve the
 * provided ambient value with {@linkcode getAmbient}.
 */
export interface Ambient<T> {
  ref: AmbientRef<T>;
}

export interface AmbientValueRef<T> {
  value: T;
}

/**
 * Curried provider of ambient that encapsulated the provided value.
 */
export interface AmbientWrapper<StatePropT> {
  (state: StateConfig<StatePropT>): StateConfig<StatePropT>;
}

/**
 * Provider function that sets the value of an ambient.
 */
export interface AmbientProvider<AmbientT, StatePropT = any> {
  (
    value: AmbientT,
    statConfig: StateConfig<StatePropT>
  ): StateConfig<StatePropT>;
  (value: AmbientT): AmbientWrapper<StatePropT>;
}

/**
 * Return an {@linkcode Ambient} and an {@linkcode AmbientProvider}.
 *
 * example:
 *
 * ```ts
 * const [ambient, provideAmbient] = newAmbient<number>('num');
 * ```
 *
 * An ambient represents contextual value that is accessible throughout state
 * transitions. One benefit of using ambient is to not pass common prop through
 * every state transition. Ambients of a state will be carried over to the state
 * it transitions to. If a state is started while another state is running (for
 * example, during `useEffect`), the ambients of the current state will be
 * carried to the newly started state.
 *
 * To retrieve an ambient value, use {@linkcode getAmbient}. If an ambient is
 * not provided in the current state chain, this will throw error.
 *
 * ```ts
 * // retrieve ambient
 * const value = getAmbient(ambient);
 * ```
 *
 * To provide am ambient, use the {@linkcode AmbientProvider} returned from `newAmbient`.
 * ```ts
 * function State1() {
 *  const [state, setState] = useState(1);
 *
 *  return provideAmbient(state, newState(State2)); // provide ambient and transition to State2
 * }
 * ```
 *
 * Sometimes we need to provide multiple ambients. We can use the curried form
 * of `provideAmbient` and a `pipe` function similar to [`rxjs`](https://rxjs.dev/guide/operators#piping)
 *
 * ```ts
 * const [numAmbient, provideNum] = newAmbient<number>('num');
 * const [boolAmbient, provideBool] = newAmbient<boolean>('bool');
 *
 * function State() {
 *  const [bool, setBool] = useState(true);
 *  const [num, setNum] = useState(1);
 *
 *  return pipe(newState, provideBool(bool), provideNum(num));
 * }
 *
 * function pipe<StatePropT>(
 *  stateConfig: StateConfig<StatePropT>,
 *  ...modifiers: (stateConfig: StateConfig<StatePropT>) => StateConfig<StatePropT>) {
 *      let newStateConfig = stateConfig;
 *      for (const modifier of modifiers) {
 *          newStateConfig = modifier(newStateConfig);
 *      }
 *      return newStateConfig;
 *  }
 * ```
 * @param name A name for the ambient for debugging purpose
 * @returns a tuple of {@linkcode Ambient} and {@linkcode AmbientProvider}
 */
export function newAmbient<AmbientT>(
  name: string
): [Ambient<AmbientT>, AmbientProvider<AmbientT>] {
  const ref: AmbientRef<AmbientT> = { name };

  const ambient: Ambient<AmbientT> = {
    ref,
  };

  function provideAmbient<StatePropT>(
    value: AmbientT,
    statConfig: StateConfig<StatePropT>
  ): StateConfig<StatePropT>;
  function provideAmbient(value: AmbientT): AmbientWrapper<any>;
  function provideAmbient(
    value: AmbientT,
    stateConfig?: StateConfig<StateConfig>
  ) {
    if (stateConfig) {
      return createStateConfig(
        stateConfig.stateFunc,
        stateConfig.props,
        stateConfig.ambient.set(ref, { value }),
        stateConfig.label
      );
    }

    return (stateConfig: StateConfig<any>) => {
      return createStateConfig(
        stateConfig.stateFunc,
        stateConfig.props,
        stateConfig.ambient.set(ref, { value }),
        stateConfig.label
      );
    };
  }

  return [ambient, provideAmbient];
}
