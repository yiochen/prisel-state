import type { Ambient } from "./ambient";
import { getAmbient } from "./getAmbient";
import { HookType } from "./hook";
import { machine } from "./machine";
import type { State } from "./state";
import { useEffect } from "./useEffect";
import { useEvent } from "./useEvent";
import { useMemo } from "./useMemo";
import { useRef } from "./useRef";
import { useState } from "./useState";

class BaseError extends Error {
  constructor(message: string, capture?: Function, description: string = "") {
    const processingState = machine.getProcessingState();
    const stack = processingState
      ? ` at${stackToOutput(processingState)}\n`
      : "";
    super(`${message}${stack}${description}`);

    Error.captureStackTrace(this, capture);
  }
}

export class Cancelation extends BaseError {
  constructor() {
    super("Canceling");
  }
}
/**
 * Error when accessing Ambient but was not able to find it.
 * @category Error
 */
export class AmbientNotFoundError extends BaseError {
  /** @internal */
  constructor(
    ambient: Ambient<any>,
    capture: Function = getAmbient,
    detail: string = ""
  ) {
    super(`Cannot find ambient of "${ambient.ref.name}"`, capture, detail);
  }
}

/**
 * Error when accessing hook but was not able to find it.
 * @category Error
 */
export class HookNotFoundError extends BaseError {
  /** @internal */
  constructor(hookType: HookType, detail: string) {
    super(
      `Cannot find hook but "${hookType}" is called`,
      HookNotFoundError.getHookFunc(hookType),
      detail
    );
  }

  /** @internal */
  private static getHookFunc(hookType: HookType) {
    switch (hookType) {
      case HookType.MEMO:
        return useMemo;
      case HookType.EFFECT:
        return useEffect;
      case HookType.EVENT:
        return useEvent;
      case HookType.STATE:
        return useState;
      case HookType.REF:
        return useRef;
    }
  }
}

/**
 * General assertion error.
 * @category Error
 */
export class AssertionError extends BaseError {
  /** @internal */
  constructor(message: string, capture?: Function) {
    super(message, capture);
  }
}

function stackToOutput(processingState?: State) {
  const stack = processingState?.getDebugInfo().stack ?? [];
  return "\n   " + stack.join("\n   ");
}
