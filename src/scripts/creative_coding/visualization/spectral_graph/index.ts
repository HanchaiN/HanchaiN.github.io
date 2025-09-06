import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { Grid2D } from "@/scripts/utils/dom/element/Grid.js";
import { startAnimationLoop } from "@/scripts/utils/dom/utils.js";

import { Graph } from "./graph.js";

export default function execute() {
  let camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    controls: OrbitControls,
    node_mesh: THREE.InstancedMesh<
      THREE.SphereGeometry,
      THREE.MeshPhongMaterial
    >;
  let grid2D: Grid2D;
  let ended = true;
  const mainelem = new Graph<number>();

  function writeTable() {
    const n = mainelem.order;
    grid2D.setSize(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        const cell = grid2D.get(i, j)?.querySelector("input");
        if (!cell) continue;
        cell.valueAsNumber = mainelem.getEdge(i, j);
        cell.dispatchEvent(new Event("change"));
      }
    }
  }
  function readTable() {
    const n = grid2D.size;
    mainelem.clear();
    for (let i = 0; i < n; i++) {
      mainelem.addNode(i);
      for (let j = 0; j <= i; j++) {
        const weight = grid2D.get(i, j)?.querySelector("input")?.valueAsNumber;
        if (weight) {
          mainelem.setEdge(i, j, weight);
        }
      }
    }
  }

  function project(vs: number[][], n: number) {
    const center = vs.reduce(
      (acc, val) => acc.map((x, i) => x + val[i] / vs.length),
      new Array(vs[0].length).fill(0),
    );
    const variance = vs.reduce(
      (acc, val) =>
        acc.map((x, i) => x + (val[i] - center[i]) * (val[i] - center[i])),
      new Array(vs[0].length).fill(0),
    );
    return vs.map((vec) =>
      vec
        .map((x, i) => ({ v: x, p: variance[i] }))
        .sort((a, b) => b.p - a.p)
        .slice(0, n)
        .map((y) => y.v),
    );
  }

  function init(canvas: HTMLCanvasElement) {
    ended = false;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      75,
      canvas.width / canvas.height,
      0.1,
      1000,
    );
    camera.position.z = 3;
    camera.up = new THREE.Vector3(0, 0, 1);

    renderer = new THREE.WebGLRenderer({ canvas });

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
  }
  function setScene(mainelem: Graph<number>) {
    scene.clear();
    const coord = project(mainelem.spectral(), 3);
    {
      node_mesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1 / 50, 32, 16),
        new THREE.MeshPhongMaterial(),
        coord.length,
      );
      node_mesh.instanceMatrix.setUsage(THREE.StreamDrawUsage);
      coord.forEach(([x, y, z], i) => {
        const matrix = new THREE.Matrix4();
        matrix.setPosition(x, y, z);
        node_mesh.setMatrixAt(i, matrix);
        node_mesh.setColorAt(i, new THREE.Color(getPaletteBaseColor(1)));
      });
      node_mesh.instanceColor?.setUsage(THREE.StaticDrawUsage);
      scene.add(node_mesh);
    }
    {
      coord.forEach(([x0, y0, z0], i) =>
        coord.forEach(([x1, y1, z1], j) => {
          if (!mainelem.getEdge(i, j)) return;
          const material = new THREE.LineBasicMaterial({
            color: getPaletteBaseColor(7 / 8),
          });
          const points = [];
          points.push(new THREE.Vector3(x0, y0, z0));
          points.push(new THREE.Vector3(x1, y1, z1));
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, material);
          scene.add(line);
        }),
      );
    }
    {
      const light = new THREE.AmbientLight(0x404040);
      scene.add(light);
    }
    {
      const light = new THREE.HemisphereLight(0xffffff, 0x888888);
      light.position.set(0, 1, 0);
      scene.add(light);
    }
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
  }
  function animate() {
    if (ended) return false;
    scene.background = new THREE.Color(getPaletteBaseColor(0));
    controls.update();
    renderer.render(scene, camera);
    return true;
  }
  function dispose() {
    ended = true;
    renderer.dispose();
    controls.dispose();
    node_mesh.dispose();
  }

  return {
    start: (canvas: HTMLCanvasElement, config: HTMLFormElement) => {
      grid2D = new Grid2D(
        config.querySelector("input#count")!,
        config.querySelector("table#edge-weight")!,
      );
      grid2D.addChangeHandler((grid2D) => {
        const n = grid2D.size;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j <= i; j++) {
            const cell = grid2D.get(i, j);
            if (!cell) continue;
            cell.innerHTML = "";
            const input = document.createElement("input");
            input.type = "number";
            input.valueAsNumber = 0;
            input.min = "0";
            input.step = "1";
            cell.appendChild(input);
            if (i !== j) {
              input.addEventListener("change", () => {
                grid2D.get(j, i)!.innerHTML = input.value;
              });
              input.dispatchEvent(new Event("change"));
            }
          }
        }
      });

      mainelem.addNode(0);
      mainelem.addNode(1);
      mainelem.addNode(2);
      mainelem.addNode(3);
      mainelem.addEdge(0, 1);
      mainelem.addEdge(1, 2);
      mainelem.addEdge(2, 0);
      mainelem.addEdge(3, 0);
      mainelem.addEdge(3, 1);
      mainelem.simplify();
      writeTable();

      config
        .querySelector<HTMLButtonElement>("#read-table")!
        .addEventListener("click", () => {
          readTable();
          setScene(mainelem);
        });
      config
        .querySelector<HTMLButtonElement>("#simplify")!
        .addEventListener("click", () => {
          mainelem.simplify();
          writeTable();
          setScene(mainelem);
        });
      init(canvas);
      setScene(mainelem);
      startAnimationLoop(animate);
    },
    stop: () => {
      dispose();
    },
  };
}
