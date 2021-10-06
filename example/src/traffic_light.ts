import { newState, run, useSideEffect, useLocalState } from "../../restate";

import "./traffic_light.css";

const exampleClass = "#traffic_light_example";
function getNthLight(index: number) {
  return document.querySelector(`${exampleClass} li:nth-child(${index})`);
}
function redState() {
  const [waiting, setWaiting] = useLocalState(true);
  useSideEffect(() => {
    const light = getNthLight(1);
    light?.classList.remove("dim");
    setTimeout(() => {
      setWaiting(false);
    }, 1000);
    return () => {
      light?.classList.add("dim");
    };
  }, []);

  if (waiting === false) {
    return newState(greenState);
  }
}

function greenState() {
  const [waiting, setWaiting] = useLocalState(true);
  useSideEffect(() => {
    const light = getNthLight(3);
    light?.classList.remove("dim");
    setTimeout(() => {
      setWaiting(false);
    }, 1000);
    return () => {
      light?.classList.add("dim");
    };
  }, []);

  if (waiting === false) {
    return newState(yellowState);
  }
}

function yellowState() {
  const [waiting, setWaiting] = useLocalState(true);
  useSideEffect(() => {
    const light = getNthLight(2);
    light?.classList.remove("dim");
    setTimeout(() => {
      setWaiting(false);
    }, 1000);
    return () => {
      light?.classList.add("dim");
    };
  }, []);

  if (waiting === false) {
    return newState(redState);
  }
}

run(redState);

// UI
const container = document.querySelector(
  `${exampleClass} > .example_container`
);
if (container) {
  container.innerHTML = `
    <ul class="traffic_light">
        <li class="dim"></li>
        <li class="dim"></li>
        <li class="dim"></li>
    </ul>`;
}
