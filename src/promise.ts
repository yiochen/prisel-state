const noop = () => {};

enum PromiseState {
  INITIALIZED,
  FULFILLED,
  CANCELLED,
  FAILED,
}

export class CancellablePromise<T> extends Promise<T> {
  private resolve: (value: T) => void = noop;
  private reject: (reason?: any) => void = noop;
  private originalReject: (reason?: any) => void = noop;
  private cancelCallback: () => Promise<any> | void = noop;
  private state = PromiseState.INITIALIZED;
  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (reason?: any) => void,
      onCancel: (callback: () => Promise<any> | void) => void
    ) => void
  ) {
    super((resolve, reject) => {
      this.resolve = this.getResolve(resolve);
      this.reject = this.getReject(reject);
      this.originalReject = reject;
      executor(this.resolve, this.reject, (callback) => {
        this.cancelCallback = callback;
      });
    });
  }

  public isEnded() {
    return (
      this.state === PromiseState.FULFILLED ||
      this.state === PromiseState.FAILED ||
      this.state === PromiseState.CANCELLED
    );
  }

  private getResolve<T>(originalResolve: (value: T) => void) {
    return (value: T) => {
      switch (this.state) {
        case PromiseState.INITIALIZED:
          this.state = PromiseState.FULFILLED;
          originalResolve(value);
          break;
      }
    };
  }

  private getReject(originalReject: (reason?: any) => void) {
    return (reason?: any) => {
      switch (this.state) {
        case PromiseState.INITIALIZED:
          this.state = PromiseState.FAILED;
          originalReject(reason);
          break;
      }
    };
  }

  public async cancel(reason?: Cancellation) {
    if (this.state === PromiseState.INITIALIZED) {
      this.state = PromiseState.CANCELLED;
      try {
        await this.cancelCallback();
        this.originalReject(reason ? reason : new Cancellation());
      } catch (e) {
        this.originalReject(reason ? reason : new Cancellation(undefined, e));
      }
    }
  }
}

export class Cancellation extends Error {
  suppressed: any = undefined;
  constructor(reason?: string, suppressed?: any) {
    super(reason);
    this.suppressed = suppressed;
  }
}
