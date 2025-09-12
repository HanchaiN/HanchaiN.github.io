import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import convert_color from "@/scripts/utils/color/conversion.js";
import {
  getChroma,
  getLightness,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import { maxWorkers, startAnimationLoop } from "@/scripts/utils/dom/utils.js";
import { constrain } from "@/scripts/utils/math/utils.js";

import type { MessageResponse } from "./worker.ts";

const hcl2hex = convert_color("hcl", "hex")!;

export default function execute() {
  let camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    controls: OrbitControls,
    electron_mesh: THREE.InstancedMesh<
      THREE.SphereGeometry,
      THREE.MeshPhongMaterial
    >,
    clock: THREE.Clock;
  let ended = true;
  let workers: Worker[];

  const counts = 8192;
  const superposition = [{ c: [1, 0], n: 3, l: 1, m: +1 }];
  const n_max = superposition.reduce((n_max, { n }) => Math.max(n_max, n), 0);
  const unit = Math.pow(n_max, 2);
  const time_scale = 1e4;

  function init(canvas: HTMLCanvasElement) {
    ended = false;
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      75,
      canvas.width / canvas.height,
      0.1,
      1000,
    );
    camera.position.z = 3 * unit;
    camera.up = new THREE.Vector3(0, 0, 1);

    renderer = new THREE.WebGLRenderer({ canvas });

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;

    {
      const nucleus = new THREE.Mesh(
        new THREE.SphereGeometry(unit / 100, 32, 16),
        new THREE.MeshPhongMaterial({
          color: 0x804040,
          emissive: 0x302020,
        }),
      );
      scene.add(nucleus);
    }

    {
      electron_mesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(unit / 50, 32, 16),
        new THREE.MeshPhongMaterial(),
        counts,
      );
      electron_mesh.instanceMatrix.setUsage(THREE.StreamDrawUsage);
      for (let i = 0; i < counts; i++)
        electron_mesh.setColorAt(i, new THREE.Color(0x000000));
      electron_mesh.instanceColor?.setUsage(THREE.StreamDrawUsage);
      scene.add(electron_mesh);
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

    workers = new Array(maxWorkers).fill(null).map(
      () =>
        new Worker(new URL("./worker.js", import.meta.url), {
          type: "module",
        }),
    );
    workers.forEach((worker, i) => {
      worker.postMessage({
        superposition,
        resetState: true,
        time_scale,
      });
      worker.addEventListener(
        "message",
        function listener({ data }: MessageEvent<MessageResponse>) {
          const saturation = getChroma(),
            lightness = getLightness();
          const index =
              i * Math.floor(counts / maxWorkers) +
              Math.min(i, counts % maxWorkers),
            target_counts =
              Math.floor(counts / maxWorkers) +
              (i < counts % maxWorkers ? 1 : 0);
          worker.postMessage({
            time: clock.getElapsedTime(),
            addStates: constrain(target_counts - data.states!.length, 0, 50),
          });
          data.states!.forEach(({ x, y, z, h }, i) => {
            const matrix = new THREE.Matrix4();
            matrix.setPosition(x, y, z);
            electron_mesh.setMatrixAt(index + i, matrix);
            electron_mesh.setColorAt(
              index + i,
              new THREE.Color(hcl2hex([h / 360, saturation, lightness])),
            );
          });
          electron_mesh.instanceMatrix.needsUpdate = true;
          if (electron_mesh.instanceColor)
            electron_mesh.instanceColor.needsUpdate = true;
        },
      );
    });
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
    electron_mesh.dispose();
  }

  return {
    start: (canvas: HTMLCanvasElement) => {
      init(canvas);
      startAnimationLoop(animate);
    },
    stop: () => {
      dispose();
      workers?.forEach((worker) => worker.terminate());
    },
  };
}
