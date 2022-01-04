import { machine } from "./machine";

/**
 * Sets the label for the current state.
 * @param label The label to display when error is thrown
 */
export function setLabel(label: string) {
  const processingState = machine.getProcessingState();
  if (processingState) {
    processingState.label = label;
  }
}
