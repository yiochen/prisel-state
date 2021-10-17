import type { StateFuncReturn } from "../../index";
import { newState, run, useEvent, useSideEffect } from "../../index";
import "./toggle.css";

const exampleClass = "#toggle_example";
const TOGGLE_EVENT = "toggle";

const container = document.querySelector(
  `${exampleClass} > .example_container`
);
if (container) {
  container.innerHTML = `
  <div>
    <div class="toggle">TOGGLE ME</div>
    <div class="toggle">TOGGLE ALL</div>
  <div>`;
}

const firstToggle = container?.querySelector(".toggle:nth-child(1)");
const secondToggle = container?.querySelector(".toggle:nth-child(2)");

function on(toggle: Element): StateFuncReturn {
  useSideEffect(() => {
    toggle.classList.add("highlight");
  }, []);
  const [toggled] = useEvent(TOGGLE_EVENT);
  if (toggled) {
    return newState(off, toggle);
  }
}

function off(toggle: Element): StateFuncReturn {
  useSideEffect(() => {
    toggle.classList.remove("highlight");
  }, []);
  const [toggled] = useEvent(TOGGLE_EVENT);
  if (toggled) {
    return newState(on, toggle);
  }
}

const inspector = run(off, firstToggle!);
const inspector2 = run(off, secondToggle!);
firstToggle!.addEventListener("click", () => {
  console.log("toggle");
  inspector.send(TOGGLE_EVENT);
});
secondToggle!.addEventListener("click", () => {
  console.log("toggle all");
  inspector2.sendAll(TOGGLE_EVENT);
});
