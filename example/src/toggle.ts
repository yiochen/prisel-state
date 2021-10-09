import {
  newState,
  run,
  useEvent,
  useSideEffect,
  StateConfig,
} from "../../state";
import "./toggle.css";

const exampleClass = "#toggle_example";
const TOGGLE_EVENT = "toggle";

const container = document.querySelector(
  `${exampleClass} > .example_container`
);
if (container) {
  container.innerHTML = `<div class="toggle"> TOGGLE ME</div>`;
}

const element = container?.querySelector(".toggle");

function on(): StateConfig | void {
  useSideEffect(() => {
    element?.classList.add("highlight");
  }, []);
  const [toggled] = useEvent(TOGGLE_EVENT);
  if (toggled) {
    return newState(off);
  }
}

function off(): StateConfig | void {
  useSideEffect(() => {
    element?.classList.remove("highlight");
  }, []);
  const [toggled] = useEvent(TOGGLE_EVENT);
  if (toggled) {
    return newState(on);
  }
}

const inspector = run(off);
element?.addEventListener("click", () => {
  console.log("click!");
  inspector.send(TOGGLE_EVENT);
});
