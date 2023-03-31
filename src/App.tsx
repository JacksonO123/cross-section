import { Component, onMount, createSignal, createEffect } from 'solid-js';
import {
  Camera,
  Color,
  degToRad,
  distance3d,
  frameLoop,
  LightSource,
  Line3d,
  Plane,
  radToDeg,
  SceneCollection,
  Simulation,
  Vector,
  Vector3,
  sortPlanes
} from 'simulationjs';
import './app.scss';

type InputChange<T = HTMLInputElement> = Event & {
  currentTarget: T;
  target: Element;
};

type CrossSectionTypes = 'square' | 'triangle' | 'semicircle';

type FuncType = 'x' | 'y';

Object.defineProperty(window, 'Math', {
  value: Math,
  writable: false,
  configurable: false
});
Object.freeze(window.Math);

const App: Component = () => {
  const [inTermsOf, setInTermsOf] = createSignal<FuncType>('x');
  const [rotationAxisInTermsOf, setRotationLineInTermsOf] = createSignal<FuncType>('x');
  const [function1, setFunction1] = createSignal('x+6');
  const [function2, setFunction2] = createSignal('x^2');
  const [intervalStart, setIntervalStart] = createSignal(-2);
  const [intervalEnd, setIntervalEnd] = createSignal(3);
  const [inc, setInc] = createSignal(0.05);
  const [focusing, setFocusing] = createSignal(false);
  const [func1Points, setFunc1Points] = createSignal<Vector[]>([]);
  const [func2Points, setFunc2Points] = createSignal<Vector[]>([]);
  const [crossSectionType, setCrossSectionType] = createSignal<CrossSectionTypes>('square');
  const [rotationAxis, setRotationAxis] = createSignal(0);
  const crossSectionOptions: CrossSectionTypes[] = ['square', 'triangle', 'semicircle'];

  let canvasRef: HTMLCanvasElement;
  let canvas: Simulation;
  let graphs: SceneCollection;
  let crossSections: SceneCollection;
  let rotationAxisScene: SceneCollection;

  const graphWidth = 120;
  const graphHeight = 120;

  const updateSortFunc = () => {
    if (inTermsOf() === 'x') {
      canvas.setSortFunc(planeSortFuncX);
    } else {
      canvas.setSortFunc(planeSortFuncY);
    }
  };

  const changeInTermsOf = (e: InputChange<HTMLSelectElement>) => {
    const val = e.currentTarget.value as FuncType;

    setInTermsOf(val);

    if (val === 'x') {
      setFunction1(function1().replace(/y/g, 'x'));
      setFunction2(function2().replace(/y/g, 'x'));
      canvas.setSortFunc(planeSortFuncX);
    } else {
      setFunction1(function1().replace(/x/g, 'y'));
      setFunction2(function2().replace(/x/g, 'y'));
      canvas.setSortFunc(planeSortFuncY);
    }
    updateSortFunc();
    graph();
    graphCrossSection();
  };

  const changeRotationAxisInTermsOf = (e: InputChange<HTMLSelectElement>) => {
    setRotationLineInTermsOf(e.currentTarget.value as FuncType);
  };

  const updateRotationAxisGraph = () => {
    rotationAxisScene.empty();
    const sections = 100;
    let currentVal = -graphWidth / 2;
    while (currentVal < graphWidth / 2 - graphWidth / sections) {
      const line = new Line3d(
        new Vector3(currentVal, -rotationAxis(), 0),
        new Vector3(currentVal + graphWidth / sections, -rotationAxis(), 0),
        new Color(200, 0, 0)
      );
      rotationAxisScene.add(line);
      currentVal += graphWidth / sections;
    }
  };

  const changeRotationAxis = (e: InputChange) => {
    setRotationAxis(+e.currentTarget.value);
    updateRotationAxisGraph();
  };

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

  const changeInc = (e: InputChange) => {
    setInc(+e.currentTarget.value);
  };

  const handleCrossSectionType = (val: CrossSectionTypes) => {
    setCrossSectionType(val);
    if (crossSections.scene.length > 0) {
      graphCrossSection();
    }
  };

  const isValidFunc = (func: string) => {
    func = func
      .replace(/arcsin/g, '')
      .replace(/arccos/g, '')
      .replace(/arctan/g, '')
      .replace(/sin/g, '')
      .replace(/cos/g, '')
      .replace(/tan/g, '')
      .replace(/sqrt/g, '')
      .replace(/log/g, '')
      .replace(/pi/g, '');
    let validChars = [
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

    validChars.push(inTermsOf());

    const chars = func.split('');
    for (let i = 0; i < chars.length; i++) {
      if (!validChars.includes(chars[i])) {
        console.error(`Invalid char: ${chars[i]}`);
        console.trace();
        return false;
      }
    }
    return true;
  };

  const replaceVars = (func: string, val: number) => {
    return func
      .replace(/e/g, Math.E + '')
      .replace(/pi/g, Math.PI + '')
      .replace(/x/g, `(${val})`)
      .replace(/y/g, `(${val})`)
      .replace(/\^/g, '**')
      .replace(/(?<!arc)sin/g, 'Math.sin')
      .replace(/(?<!arc)cos/g, 'Math.cos')
      .replace(/(?<!arc)tan/g, 'Math.tan')
      .replace(/arcsin/g, 'Math.asin')
      .replace(/arccos/g, 'Math.acos')
      .replace(/arctan/g, 'Math.atan')
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/log/g, 'Math.log');
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
    updateSortFunc();
    clearCrossSection();
    const func1Valid = isValidFunc(function1());
    const func2Valid = isValidFunc(function2());
    const sections = 2500;
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

        if (inTermsOf() === 'x') {
          func1Points.push(new Vector(currentVal, -func1Val));
          func2Points.push(new Vector(currentVal, -func2Val));
        } else {
          func1Points.push(new Vector(func1Val, -currentVal));
          func2Points.push(new Vector(func2Val, -currentVal));
        }

        currentVal += inc;
      }
      setFunc1Points(func1Points);
      setFunc2Points(func2Points);
      updateCanvasGraphs();
    }
  };

  const graphCrossSection = () => {
    updateSortFunc();
    graph();
    clearCrossSection();

    const func1Valid = isValidFunc(function1());
    const func2Valid = isValidFunc(function2());

    if (!func1Valid || !func2Valid) return;

    let currentVal = intervalStart();
    while (currentVal < intervalEnd() && inc() > 0) {
      let func1 = replaceVars(function1(), currentVal);
      let func2 = replaceVars(function2(), currentVal);

      /*
        when minimized, minifier knows initial
        value of variables, but since we set a new
        value in an eval, it does not know that it
        changes, and predicts the outcome of the condition
        and removes the if statement, random creates
        uncertainty in the difference between values
        while also defining them
      */
      let func1Val = Math.random();
      let func2Val = Math.random();

      eval(`func1Val = ${func1}`);
      eval(`func2Val = ${func2}`);

      const color = new Color(79, 13, 153, 0.25);

      let diff = 0;
      let pos = 0;
      if (func2Val < func1Val) {
        diff = func1Val - func2Val;
        pos = diff / 2 - func1Val;
      } else {
        diff = func2Val - func1Val;
        pos = diff / 2 - func2Val;
      }

      if (crossSectionType() === 'square') {
        let points: Vector3[] = [];
        let planePos = new Vector3(currentVal, pos, 0);

        if (inTermsOf() === 'x') {
          points = [
            new Vector3(0, diff / 2, -diff),
            new Vector3(0, -diff / 2, -diff),
            new Vector3(0, -diff / 2, 0),
            new Vector3(0, diff / 2, 0)
          ];
        } else {
          points = [
            new Vector3(diff / 2, 0, -diff),
            new Vector3(-diff / 2, 0, -diff),
            new Vector3(-diff / 2, 0, 0),
            new Vector3(diff / 2, 0, 0)
          ];
          planePos = new Vector3(-pos, -currentVal, 0);
        }

        const plane = new Plane(planePos, points, color, true, true);
        crossSections.add(plane);
      } else if (crossSectionType() === 'triangle') {
        let points: Vector3[] = [];
        let planePos = new Vector3(currentVal, pos, 0);

        if (inTermsOf() === 'x') {
          points = [
            new Vector3(0, -diff / 2, 0),
            new Vector3(0, diff / 2, 0),
            new Vector3(0, 0, -((diff * Math.sqrt(3)) / 2))
          ];
        } else {
          points = [
            new Vector3(-diff / 2, 0, 0),
            new Vector3(diff / 2, 0, 0),
            new Vector3(0, 0, -((diff * Math.sqrt(3)) / 2))
          ];
          planePos = new Vector3(-pos, -currentVal, 0);
        }

        const plane = new Plane(planePos, points, color, true, true);
        crossSections.add(plane);
      } else if (crossSectionType() === 'semicircle') {
        const getSemiCirclePoints = (radius: number) => {
          const res: Vector3[] = [];
          const sections = 20;
          let rotation = 90;
          for (let i = 0; i < sections + 1; i++) {
            const y = Math.sin(degToRad(rotation)) * radius;
            const z = Math.cos(degToRad(rotation)) * radius;
            let point = new Vector3(0, y, z);
            if (inTermsOf() === 'y') {
              point = new Vector3(y, 0, z);
            }
            res.push(point);
            rotation += 180 / sections;
          }
          return res;
        };

        let planePos = new Vector3(currentVal, pos, 0);

        if (inTermsOf() === 'y') {
          planePos = new Vector3(-pos, -currentVal, 0);
        }

        const semiCirclePoints = getSemiCirclePoints(diff / 2);
        let points: Vector3[] = [];
        if (inTermsOf() === 'x') {
          points = [new Vector3(0, -diff / 2, 0), ...semiCirclePoints, new Vector3(0, diff / 2, 0)];
        } else {
          points = [new Vector3(-diff / 2, 0, 0), ...semiCirclePoints, new Vector3(diff / 2, 0, 0)];
        }

        const plane = new Plane(planePos, points, color, true, true);
        crossSections.add(plane);
      }

      currentVal += inc();
    }
  };

  const showRotation = () => {
    clearCrossSection();

    const func1Valid = isValidFunc(function1());
    const func2Valid = isValidFunc(function2());

    if (!func1Valid || !func2Valid) return;

    const color = new Color(153, 78, 237);

    const func1Mesh: Vector3[][] = [];
    const func2Mesh: Vector3[][] = [];
    let currentMeshRow = 0;
    const inc = 0.3;
    const meshRotationDetail = 30;
    let currentVal = intervalStart();
    const rAxis = -rotationAxis();
    while (currentVal < intervalEnd()) {
      func1Mesh.push([]);
      func2Mesh.push([]);
      let func1 = replaceVars(function1(), currentVal);
      let func2 = replaceVars(function2(), currentVal);

      let func1Val = Math.random();
      let func2Val = Math.random();

      eval(`func1Val = ${func1}`);
      eval(`func2Val = ${func2}`);

      let vec1 =
        inTermsOf() === 'x' ? new Vector3(0, func1Val + rAxis, 0) : new Vector3(func1Val + rAxis, 0, 0);
      let vec2 =
        inTermsOf() === 'x' ? new Vector3(0, func2Val + rAxis, 0) : new Vector3(func2Val + rAxis, 0, 0);

      let currentRotation = 0;
      while (currentRotation <= 360) {
        const rotationAmount =
          inTermsOf() === 'x' ? new Vector3(currentRotation, 0, 0) : new Vector3(0, currentRotation, 0);
        func1Mesh[currentMeshRow].push(vec1.clone().rotate(rotationAmount));
        func2Mesh[currentMeshRow].push(vec2.clone().rotate(rotationAmount));
        currentRotation += 360 / meshRotationDetail;
      }

      currentVal += inc;
      currentMeshRow++;
    }
    const wireframe = true;
    const xPosInc = (intervalStart() - intervalEnd()) / (currentMeshRow - 1);
    for (let i = 0; i < currentMeshRow - 1; i++) {
      for (let j = 0; j < func1Mesh[i].length - 1; j++) {
        const points =
          inTermsOf() === 'x'
            ? [
                new Vector3(0, func1Mesh[i][j].y, func1Mesh[i][j].z),
                new Vector3(0, func1Mesh[i][j + 1].y, func1Mesh[i][j + 1].z),
                new Vector3(-xPosInc, func1Mesh[i + 1][j + 1].y, func1Mesh[i + 1][j + 1].z),
                new Vector3(-xPosInc, func1Mesh[i + 1][j].y, func1Mesh[i + 1][j].z)
              ]
            : [
                new Vector3(-func1Mesh[i][j].x, 0, func1Mesh[i][j].z),
                new Vector3(-func1Mesh[i][j + 1].x, 0, func1Mesh[i][j + 1].z),
                new Vector3(-func1Mesh[i + 1][j + 1].x, xPosInc, func1Mesh[i + 1][j + 1].z),
                new Vector3(-func1Mesh[i + 1][j].x, xPosInc, func1Mesh[i + 1][j].z)
              ];
        const pos =
          inTermsOf() === 'x'
            ? new Vector3(intervalStart() - xPosInc * i, rAxis, 0)
            : new Vector3(-rAxis, -intervalStart() + xPosInc * i, 0);
        const plane = new Plane(pos, points, color, true, wireframe, true);
        crossSections.add(plane);
      }

      for (let j = 0; j < func2Mesh[i].length - 1; j++) {
        const points =
          inTermsOf() === 'x'
            ? [
                new Vector3(0, func2Mesh[i][j].y, func2Mesh[i][j].z),
                new Vector3(0, func2Mesh[i][j + 1].y, func2Mesh[i][j + 1].z),
                new Vector3(-xPosInc, func2Mesh[i + 1][j + 1].y, func2Mesh[i + 1][j + 1].z),
                new Vector3(-xPosInc, func2Mesh[i + 1][j].y, func2Mesh[i + 1][j].z)
              ]
            : [
                new Vector3(-func2Mesh[i][j].x, 0, func2Mesh[i][j].z),
                new Vector3(-func2Mesh[i][j + 1].x, 0, func2Mesh[i][j + 1].z),
                new Vector3(-func2Mesh[i + 1][j + 1].x, xPosInc, func2Mesh[i + 1][j + 1].z),
                new Vector3(-func2Mesh[i + 1][j].x, xPosInc, func2Mesh[i + 1][j].z)
              ];
        const pos =
          inTermsOf() === 'x'
            ? new Vector3(intervalStart() - xPosInc * i, rAxis, 0)
            : new Vector3(-rAxis, -intervalStart() + xPosInc * i, 0);
        const plane = new Plane(pos, points, color, true, wireframe, true);
        crossSections.add(plane);
      }
    }
    for (let i = 0; i < func1Mesh[0].length - 1; i++) {
      const plane1Points =
        inTermsOf() === 'x'
          ? [
              new Vector3(0, func1Mesh[0][i].y, func1Mesh[0][i].z),
              new Vector3(0, func1Mesh[0][i + 1].y, func1Mesh[0][i + 1].z),
              new Vector3(0, func2Mesh[0][i + 1].y, func2Mesh[0][i + 1].z),
              new Vector3(0, func2Mesh[0][i].y, func2Mesh[0][i].z)
            ]
          : [
              new Vector3(-func1Mesh[0][i].x, 0, func1Mesh[0][i].z),
              new Vector3(-func1Mesh[0][i + 1].x, 0, func1Mesh[0][i + 1].z),
              new Vector3(-func2Mesh[0][i + 1].x, 0, func2Mesh[0][i + 1].z),
              new Vector3(-func2Mesh[0][i].x, 0, func2Mesh[0][i].z)
            ];
      const plane2Points =
        inTermsOf() === 'x'
          ? [
              new Vector3(0, func1Mesh[func1Mesh.length - 1][i].y, func1Mesh[func1Mesh.length - 1][i].z),
              new Vector3(
                0,
                func1Mesh[func1Mesh.length - 1][i + 1].y,
                func1Mesh[func1Mesh.length - 1][i + 1].z
              ),
              new Vector3(
                0,
                func2Mesh[func2Mesh.length - 1][i + 1].y,
                func2Mesh[func2Mesh.length - 1][i + 1].z
              ),
              new Vector3(0, func2Mesh[func2Mesh.length - 1][i].y, func2Mesh[func2Mesh.length - 1][i].z)
            ]
          : [
              new Vector3(-func1Mesh[func1Mesh.length - 1][i].x, 0, func1Mesh[func1Mesh.length - 1][i].z),
              new Vector3(
                -func1Mesh[func1Mesh.length - 1][i + 1].x,
                0,
                func1Mesh[func1Mesh.length - 1][i + 1].z
              ),
              new Vector3(
                -func2Mesh[func2Mesh.length - 1][i + 1].x,
                0,
                func2Mesh[func2Mesh.length - 1][i + 1].z
              ),
              new Vector3(-func2Mesh[func2Mesh.length - 1][i].x, 0, func2Mesh[func2Mesh.length - 1][i].z)
            ];
      const plane1Pos =
        inTermsOf() === 'x'
          ? new Vector3(intervalStart(), rAxis, 0)
          : new Vector3(-rAxis, -intervalStart(), 0);
      const plane2Pos =
        inTermsOf() === 'x' ? new Vector3(intervalEnd(), rAxis, 0) : new Vector3(-rAxis, -intervalEnd(), 0);
      const plane1 = new Plane(plane1Pos, plane1Points, color, true, wireframe, true);
      const plane2 = new Plane(plane2Pos, plane2Points, color, true, wireframe, true);
      crossSections.add(plane1);
      crossSections.add(plane2);
    }

    canvas.setLightSources([new LightSource(new Vector3(0, 50, -100), 1)]);
    canvas.setAmbientLighting(0.35);
    canvas.setSortFunc(sortPlanes);
  };

  const planeSortFuncX = (planes: Plane[], cam: Camera) => {
    return planes.sort((a, b) => {
      const aPos = new Vector3(a.pos.x, 0, 0);
      const aDist = distance3d(aPos, cam.pos);
      const bPos = new Vector3(b.pos.x, 0, 0);
      const bDist = distance3d(bPos, cam.pos);
      return bDist - aDist;
    });
  };

  const planeSortFuncY = (planes: Plane[], cam: Camera) => {
    return planes.sort((a, b) => {
      const aPos = new Vector3(0, a.pos.y, 0);
      const aDist = distance3d(aPos, cam.pos);
      const bPos = new Vector3(0, b.pos.y, 0);
      const bDist = distance3d(bPos, cam.pos);
      return bDist - aDist;
    });
  };

  const clearGraph = () => {
    graphs.empty();
  };

  const clearCrossSection = () => {
    crossSections.empty();
  };

  onMount(() => {
    canvas = new Simulation(canvasRef, new Vector3(0, 0, -50));
    canvas.fitElement();
    canvas.setSortFunc(planeSortFuncX);

    const axisSplit = 100;
    const axisIncX = graphWidth / axisSplit;
    const axisIncY = graphHeight / axisSplit;

    const xAxis = new SceneCollection('x-axis');
    for (let i = 0; i < axisSplit; i++) {
      const axisLine = new Line3d(
        new Vector3(-graphWidth / 2 + axisIncX * i, 0, 0),
        new Vector3(-graphWidth / 2 + axisIncY * (i + 1), 0, 0),
        new Color(0, 0, 0),
        2
      );
      xAxis.add(axisLine);
    }
    canvas.add(xAxis);

    const yAxis = new SceneCollection('x-axis');
    for (let i = 0; i < axisSplit; i++) {
      const axisLine = new Line3d(
        new Vector3(0, -graphHeight / 2 + axisIncY * i, 0),
        new Vector3(0, -graphHeight / 2 + axisIncY * (i + 1), 0),
        new Color(0, 0, 0),
        2
      );
      yAxis.add(axisLine);
    }
    canvas.add(yAxis);

    graphs = new SceneCollection('graphs');
    canvas.add(graphs);

    rotationAxisScene = new SceneCollection('rotation-axis');
    canvas.add(rotationAxisScene);

    crossSections = new SceneCollection('cross-sections');
    canvas.add(crossSections);

    graph();
    graphCrossSection();

    canvas.moveCamera(new Vector3(-graphWidth / 4, -graphHeight / 4, 0), 1);
    canvas.rotateCamera(new Vector3(-25, 30, 0), 1);

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

    let speed = 0;
    const speedDampen = 175;
    frameLoop(() => {
      speed = canvas.camera.pos.clone().divide(speedDampen).getMag();
      if (pressingW) {
        canvas.moveCamera(canvas.forward.clone().multiply(speed));
      }
      if (pressingA) {
        canvas.moveCamera(canvas.left.clone().multiply(speed));
      }
      if (pressingS) {
        canvas.moveCamera(canvas.backward.clone().multiply(speed));
      }
      if (pressingD) {
        canvas.moveCamera(canvas.right.clone().multiply(speed));
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
        <span>By Jackson Otto</span>
        <details>
          <summary>Directions</summary>
          <span>
            <ul>
              <li>
                Press <code>W</code> <code>A</code> <code>S</code> <code>D</code> to move camera around
              </li>
              <li>
                Press <code>Space</code> To move up, and <code>Shift</code> to move down
              </li>
              <li>Click and drag to look around</li>
              <li>Some functions may not be implemented</li>
            </ul>
          </span>
        </details>
        <h4>Functions</h4>
        <div class="input-group">
          <span>In terms of</span>
          <select
            onChange={changeInTermsOf}
            value={inTermsOf()}
          >
            <option value="y">y</option>
            <option value="x">x</option>
          </select>
        </div>
        <div class="func-wrapper">
          <input
            placeholder="Function 1"
            value={function1()}
            onChange={changeFunction1}
            onFocus={() => setFocusing(true)}
            onBlur={() => setFocusing(false)}
          />
        </div>
        <div class="func-wrapper">
          <input
            placeholder="Function 2"
            value={function2()}
            onChange={changeFunction2}
            onFocus={() => setFocusing(true)}
            onBlur={() => setFocusing(false)}
          />
        </div>
        <div class="input-group">
          <button onClick={graph}>Graph</button>
          <button onClick={clearGraph}>Clear graph</button>
        </div>
        <h4>Cross section and rotation interval</h4>
        <div class="input-group">
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
        <h4>Cross section increment</h4>
        <input
          placeholder="Increment"
          value={inc()}
          onChange={changeInc}
          onFocus={() => setFocusing(true)}
          onBlur={() => setFocusing(false)}
        />
        <div class="input-group">
          <button onClick={graphCrossSection}>Graph cross section</button>
          <button onClick={clearCrossSection}>Clear cross section</button>
        </div>
        <h4>Cross section type</h4>
        <div class="input-group">
          {crossSectionOptions.map((item) => (
            <button
              style={crossSectionType() === item ? { background: 'rgba(79, 13, 153, 0.25)' } : {}}
              onClick={() => handleCrossSectionType(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {crossSectionType() === 'semicircle' && (
          <span>Warning: Calculating a large interval may affect performance</span>
        )}
        <hr />
        <h4>Rotations</h4>
        <span>Warning: Rotation feature in beta</span>
        <div class="input-group">
          <span>Rotation axis in terms of:</span>
          <select
            onChange={changeRotationAxisInTermsOf}
            value={rotationAxisInTermsOf()}
          >
            <option value="y">y</option>
            <option value="x">x</option>
          </select>
        </div>
        <input
          type="number"
          placeholder="Axis"
          onInput={changeRotationAxis}
          value={rotationAxis()}
          onFocus={() => setFocusing(true)}
          onBlur={() => setFocusing(false)}
        />
        <button onClick={showRotation}>Show rotation</button>
      </div>
    </div>
  );
};

export default App;
