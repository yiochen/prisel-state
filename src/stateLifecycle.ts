/**
 * The lifecycle of a state. The transitional diagram of state lifecycle can be
 * found at https://stately.ai/viz/9b401e89-10f2-4a7b-809f-c4245f5123f9
 */
export enum StateLifecycle {
  IDLE = "idle", // state is clean, waiting for dirty check
  RUNNING = "running", // state is dirty, running
  SIDE_EFFECT = "side_effect", // performing side effect
  CLEANING_UP = "cleaning_up", // performing clean up because of cancelation or transition
  TRANSITIONING = "transitioning", // state is transitioning, waiting for all children to be canceled
  CANCELING = "canceling", // state is canceling, waiting for all children to be canceled
  ENDED = "ended", // state ended. Either it is canceled or transitioned to another state
}
