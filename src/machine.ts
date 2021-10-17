import type { StateMachine } from "./stateMachine";
import { MachineImpl } from "./stateMachine";

export const machine: StateMachine = new MachineImpl();
