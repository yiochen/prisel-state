import { CancellablePromise, Cancellation } from "./promise";

class Scope {
  children = new Set<Scope>();
  parent?: Scope;
  promises = new Set<Promise<any>>();
  cancelled = false;

  constructor(parent: Scope | undefined = undefined) {
    this.parent = parent;
  }
  public addChild() {
    const scope = new Scope(this);
    this.children.add(scope);
    return scope;
  }

  public add(promise: CancellablePromise<any>) {
    this.promises.add(promise);
  }

  public async newChild(promiseCreator: (scope: Scope) => Promise<any>) {
    if (this.cancelled) {
      throw new Cancellation();
    }

    await promiseCreator(this.addChild());
  }
}
