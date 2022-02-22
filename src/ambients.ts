import { newAmbient } from "./ambient";
import { Inspector } from "./inspector";

export const [inspectorAmbient, provideInspector] =
  newAmbient<Inspector>("inspector");
