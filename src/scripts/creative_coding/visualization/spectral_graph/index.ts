import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Graph } from "./graph.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";

export default function execute() {
  let camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    controls: OrbitControls,
    node_mesh: THREE.InstancedMesh<
      THREE.SphereGeometry,
      THREE.MeshPhongMaterial
    >;
  let ended = true;
  const mainelem = new Graph<number>();
  mainelem.addNode(1);
  mainelem.addNode(2);
  mainelem.addNode(3);
  mainelem.addNode(4);
  mainelem.addEdge(1, 2);
  mainelem.addEdge(2, 3);
  mainelem.addEdge(3, 1);
  mainelem.addEdge(4, 1);
  mainelem.addEdge(4, 2);
  mainelem.simplify();

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

    const coord = mainelem.spectral();
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
          if (!mainelem.adj[i][j]) return;
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
    if (ended) return;
    scene.background = new THREE.Color(getPaletteBaseColor(0));
    controls.update();
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  }
  function dispose() {
    ended = true;
    renderer.dispose();
    controls.dispose();
    node_mesh.dispose();
  }

  return {
    start: (canvas: HTMLCanvasElement) => {
      init(canvas);
      animate();
    },
    stop: () => {
      dispose();
    },
  };
}
