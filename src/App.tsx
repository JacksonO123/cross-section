import { Component, onMount, createSignal } from 'solid-js';
import {
  Color,
  Cube,
  frameLoop,
  Line3d,
  Plane,
  radToDeg,
  SceneCollection,
  Simulation,
  Vector,
  Vector3
} from 'simulationjs';
import './app.scss';

type InputChange = Event & {
  currentTarget: HTMLInputElement;
  target: Element;
};

const App: Component = () => {
  const [function1, setFunction1] = createSignal('x+6');
  const [function2, setFunction2] = createSignal('(x)^2');
  const [intervalStart, setIntervalStart] = createSignal(-2);
  const [intervalEnd, setIntervalEnd] = createSignal(3);
  const [focusing, setFocusing] = createSignal(false);
  const [func1Points, setFunc1Points] = createSignal<Vector[]>([]);
  const [func2Points, setFunc2Points] = createSignal<Vector[]>([]);

  let canvasRef: HTMLCanvasElement;
  let canvas: Simulation;
  let graphs: SceneCollection;
  let crossSections: SceneCollection;

  const graphWidth = 120;
  const graphHeight = 120;

  const changeFunction1 = (e: InputChange) => {
    setFunction1(e.currentTarget.value);
  };

  const changeFunction2 = (e: InputChange) => {
    setFunction2(e.currentTarget.value);
  };

  const changeIntervalStart = (e: InputChange) => {
    setIntervalStart(+e.currentTarget.value);
  };

  const changeIntervalEnd = (e: InputChange) => {
    setIntervalEnd(+e.currentTarget.value);
  };

  const isValidFunc = (func: string) => {
    func = func
      .replace(/arcsin/g, '')
      .replace(/arccos/g, '')
      .replace(/arctan/g, '')
      .replace(/sin/g, '')
      .replace(/cos/g, '')
      .replace(/tan/g, '')
      .replace(/sqrt/g, '');
    const validChars = [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
      'e',
      'x',
      '(',
      ')',
      '.',
      '^',
      '/',
      '-',
      '*',
      '+',
      ' '
    ];
    const chars = func.split('');
    for (let i = 0; i < chars.length; i++) {
      if (!validChars.includes(chars[i])) {
        console.error(`Invalid char: ${chars[i]}`);
        return false;
      }
    }
    return true;
  };

  const replaceVars = (func: string, val: number) => {
    return func
      .replace(/e/g, Math.E + '')
      .replace(/x/g, val + '')
      .replace(/\^/g, '**')
      .replace(/(?<!arc)sin/g, 'Math.sin')
      .replace(/(?<!arc)cos/g, 'Math.cos')
      .replace(/(?<!arc)tan/g, 'Math.tan')
      .replace(/arcsin/g, 'Math.asin')
      .replace(/arccos/g, 'Math.acos')
      .replace(/arctan/g, 'Math.atan')
      .replace(/sqrt/g, 'Math.sqrt');
  };

  const toVec3 = (vec: Vector, z: number) => {
    return new Vector3(vec.x, vec.y, z);
  };

  const updateCanvasGraphs = () => {
    graphs.empty();
    for (let i = 0; i < func1Points().length - 1; i++) {
      const line = new Line3d(toVec3(func1Points()[i], 0), toVec3(func1Points()[i + 1], 0));
      graphs.add(line);
    }

    for (let i = 0; i < func2Points().length - 1; i++) {
      const line = new Line3d(toVec3(func2Points()[i], 0), toVec3(func2Points()[i + 1], 0));
      graphs.add(line);
    }
  };

  const graph = () => {
    const func1Valid = isValidFunc(function1());
    const func2Valid = isValidFunc(function2());
    const sections = 2000;
    const inc = graphWidth / sections;

    let func1Points: Vector[] = [];
    let func2Points: Vector[] = [];

    if (func1Valid && func2Valid) {
      let currentVal = -graphWidth / 2;
      while (currentVal < graphWidth / 2) {
        let func1 = replaceVars(function1(), currentVal);
        let func2 = replaceVars(function2(), currentVal);

        let func1Val = 0;
        let func2Val = 0;

        eval(`func1Val = ${func1}`);
        eval(`func2Val = ${func2}`);

        func1Points.push(new Vector(currentVal, -func1Val));
        func2Points.push(new Vector(currentVal, -func2Val));

        currentVal += inc;
      }
      setFunc1Points(func1Points);
      setFunc2Points(func2Points);
      updateCanvasGraphs();
    }
  };

  const graphCrossSection = () => {
    crossSections.empty();
    const inc = 0.5;
    let currentVal = intervalStart();
    while (currentVal < intervalEnd()) {
      let func1 = replaceVars(function1(), currentVal);
      let func2 = replaceVars(function2(), currentVal);

      let func1Val = 0;
      let func2Val = 0;

      eval(`func1Val = ${func1}`);
      eval(`func2Val = ${func2}`);

      const diff = func1Val - func2Val;
      const pos = diff / 2 - func1Val;
      const plane = new Plane(
        new Vector3(currentVal, pos, 0),
        [
          new Vector3(0, diff / 2, -diff),
          new Vector3(0, -diff / 2, -diff),
          new Vector3(0, -diff / 2, 0),
          new Vector3(0, diff / 2, 0)
        ],
        new Color(79, 13, 153, 0.25),
        true,
        true
      );
      crossSections.add(plane);

      currentVal += inc;
    }
  };

  onMount(() => {
    canvas = new Simulation(canvasRef, new Vector3(0, 0, -50));
    canvas.fitElement();

    const xAxis = new Line3d(
      new Vector3(-graphWidth / 2, 0, 0),
      new Vector3(graphWidth / 2, 0, 0),
      new Color(0, 0, 0),
      2
    );
    canvas.add(xAxis);

    const yAxis = new Line3d(
      new Vector3(0, -graphHeight / 2, 0),
      new Vector3(0, graphHeight / 2, 0),
      new Color(0, 0, 0),
      2
    );
    canvas.add(yAxis);

    graphs = new SceneCollection('graphs');
    canvas.add(graphs);

    crossSections = new SceneCollection('cross-sections');
    canvas.add(crossSections);

    let pressingW = false;
    let pressingA = false;
    let pressingS = false;
    let pressingD = false;
    let pressingSpace = false;
    let pressingShift = false;

    const keydownEvents = {
      w: () => (pressingW = true),
      a: () => (pressingA = true),
      s: () => (pressingS = true),
      d: () => (pressingD = true),
      ' ': () => (pressingSpace = true),
      shift: () => (pressingShift = true)
    } as const;

    const keyupEvents = {
      w: () => (pressingW = false),
      a: () => (pressingA = false),
      s: () => (pressingS = false),
      d: () => (pressingD = false),
      ' ': () => (pressingSpace = false),
      shift: () => (pressingShift = false)
    } as const;

    let looking = false;
    canvas.on('mousedown', () => {
      looking = true;
    });

    canvas.on('mouseup', () => {
      looking = false;
    });

    let prev = new Vector(0, 0);
    canvas.on('mousemove', (e: MouseEvent) => {
      const dampen = 1000 * canvas.ratio;
      const point = new Vector(e.offsetX, e.offsetY);
      if (looking) {
        const amount = new Vector(radToDeg(point.y - prev.y) / dampen, radToDeg(point.x - prev.x) / dampen);
        amount.x *= -1;
        amount.multiply(-1);
        canvas.rotateCamera(new Vector3(amount.x, amount.y, 0));
      }
      prev = point;
    });

    addEventListener('keydown', (e: KeyboardEvent) => {
      if (!focusing()) {
        const f = keydownEvents[e.key.toLowerCase() as keyof typeof keydownEvents];
        f && f();
      }
    });

    addEventListener('keyup', (e: KeyboardEvent) => {
      if (!focusing()) {
        const f = keyupEvents[e.key.toLowerCase() as keyof typeof keyupEvents];
        f && f();
      }
    });

    const speed = 0.5;
    frameLoop(() => {
      if (pressingW) {
        canvas.moveCamera(
          new Vector3(
            Math.sin(canvas.camera.rot.y) * Math.cos(canvas.camera.rot.x) * speed,
            0,
            Math.cos(canvas.camera.rot.y) * Math.cos(canvas.camera.rot.x) * speed
          )
        );
      }
      if (pressingA) {
        canvas.moveCamera(
          new Vector3(
            -Math.sin(canvas.camera.rot.y + Math.PI / 2) * speed,
            0,
            -Math.cos(canvas.camera.rot.y + Math.PI / 2) * speed
          )
        );
      }
      if (pressingS) {
        canvas.moveCamera(
          new Vector3(
            -Math.sin(canvas.camera.rot.y) * Math.cos(canvas.camera.rot.x) * speed,
            0,
            -Math.cos(canvas.camera.rot.y) * Math.cos(canvas.camera.rot.x) * speed
          )
        );
      }
      if (pressingD) {
        canvas.moveCamera(
          new Vector3(
            Math.sin(canvas.camera.rot.y + Math.PI / 2) * speed,
            0,
            Math.cos(canvas.camera.rot.y + Math.PI / 2) * speed
          )
        );
      }
      if (pressingSpace) {
        canvas.moveCamera(new Vector3(0, -speed, 0));
      }
      if (pressingShift) {
        canvas.moveCamera(new Vector3(0, speed, 0));
      }
    })();
  });

  return (
    <div class="app">
      {/* @ts-ignore */}
      <canvas ref={canvasRef} />
      <div class="controls">
        <input
          placeholder="Function 1"
          value={function1()}
          onChange={changeFunction1}
          onFocus={() => setFocusing(true)}
          onBlur={() => setFocusing(false)}
        />
        <input
          placeholder="Function 2"
          value={function2()}
          onChange={changeFunction2}
          onFocus={() => setFocusing(true)}
          onBlur={() => setFocusing(false)}
        />
        <button onClick={graph}>Graph</button>
        <h4>Interval</h4>
        <div class="interval-input">
          <input
            placeholder="Start"
            value={intervalStart()}
            onChange={changeIntervalStart}
            onFocus={() => setFocusing(true)}
            onBlur={() => setFocusing(false)}
          />
          <input
            placeholder="End"
            value={intervalEnd()}
            onChange={changeIntervalEnd}
            onFocus={() => setFocusing(true)}
            onBlur={() => setFocusing(false)}
          />
        </div>
        <button onClick={graphCrossSection}>Graph cross section</button>
      </div>
    </div>
  );
};

export default App;
