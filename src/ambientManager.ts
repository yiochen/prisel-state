import { AmbientRef, AmbientValueRef } from "./ambient";
import { State } from "./state";
import { ImmutableMap } from "./utils";

export class AmbientManager {
  private stateIdToAmbientMap: Map<
    string,
    ImmutableMap<AmbientRef<any>, AmbientValueRef<any>>
  > = new Map();

  public static create() {
    return new AmbientManager();
  }

  public storeWrappedAmbient(state: State, previousState?: State) {
    if (
      state.config.ambient.isEmpty() &&
      (!previousState || previousState.chainId === state.chainId)
    ) {
      // if current state doesn't modify any ambient, we don't need to do
      // anything because ambients are stored by chainId.
      return;
    }
    if (previousState) {
      state.config.ambient = state.config.ambient.setParent(
        previousState.config.ambient
      );
    }
    const ambientMap = state.config.ambient.build();
    this.stateIdToAmbientMap.set(state.chainId, ambientMap);
  }

  public hasAmbient(stateChainId: string, ambientRef: AmbientRef<any>) {
    return this.stateIdToAmbientMap.get(stateChainId)?.has(ambientRef) ?? false;
  }

  public getAmbient(stateChainId: string, ambientRef: AmbientRef<any>) {
    const ambientMap = this.stateIdToAmbientMap.get(stateChainId);
    if (ambientMap === undefined) {
      throw new Error(`Cannot get ambient for state ${stateChainId}`);
    }
    if (!ambientMap.has(ambientRef)) {
      throw new Error(`Ambient ${ambientRef.name} is not provided`);
    }
    return ambientMap.get(ambientRef)!.value;
  }

  public clearAmbientForChainId(stateChainId: string) {
    this.stateIdToAmbientMap.delete(stateChainId);
  }
}
