import { machine } from "./machine";

/**
 * Install a cleanup callback to be triggered before the generator state is
 * canceled or when it transitions.
 *
 * @param cleanup Cleanup callback to run when a generator state is canceled or completed.
 */
export function onCleanup(cleanup: () => unknown) {
  machine.getProcessingState()?.addGeneratorCleanup(cleanup);
}
