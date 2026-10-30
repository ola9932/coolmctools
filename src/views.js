import {
  CanvasTexture,
  NearestFilter,
  LinearFilter,
  LinearMipmapLinearFilter,
  Raycaster,
  Vector2,
  MOUSE,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
} from "three";
import {
  SkinViewer,
  IdleAnimation,
  WalkingAnimation,
  RunningAnimation,
  WaveAnimation,
  FlyingAnimation,
  CrouchAnimation,
} from "skinview3d";
import { PARTS, faces, uvPixel } from "./skin.js";

export function createViews(source, getState) {
  const texture = new CanvasTexture(source);
  texture.magFilter = texture.minFilter = NearestFilter;
  const editor = new SkinViewer({
    canvas: document.querySelector("#editor-canvas"),
    width: 600,
    height: 570,
    zoom: 0.78,
    pixelRatio: Math.min(devicePixelRatio, 2),
  });
  const preview = new SkinViewer({
    canvas: document.querySelector("#preview-canvas"),
    width: 280,
    height: 310,
    zoom: 0.7,
    pixelRatio: Math.min(devicePixelRatio, 2),
  });
  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = gridCanvas.height = 1024;
  const gridContext = gridCanvas.getContext("2d");
  const gridTexture = new CanvasTexture(gridCanvas);
  gridTexture.magFilter = LinearFilter;
  gridTexture.minFilter = LinearMipmapLinearFilter;
  const gridMaterial = new MeshBasicMaterial({
    map: gridTexture,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const grids = [];
  for (const viewer of [editor, preview]) {
    viewer.playerObject.skin.visible = true;
    viewer.playerObject.skin.map = texture;
    viewer.globalLight.intensity = 2.2;
    viewer.cameraLight.intensity = 0.4;
    viewer.controls.enablePan = false;
    viewer.controls.enableDamping = false;
    viewer.controls.minDistance = 22;
    viewer.controls.maxDistance = 150;
    const distance = viewer.camera.position.length();
    viewer.camera.position
      .set(0.35, 0.18, 1)
      .normalize()
      .multiplyScalar(distance);
    viewer.controls.update();
    viewer.playerObject.skin.traverse((node) => {
      if (node.isMesh) {
        node.material.transparent = true;
        node.material.alphaTest = 0.01;
      }
    });
  }
  for (const part of Object.keys(PARTS)) {
    for (const layer of ["base", "overlay"]) {
      const mesh =
        editor.playerObject.skin[part][
          layer === "base" ? "innerLayer" : "outerLayer"
        ];
      const grid = new Mesh(mesh.geometry, gridMaterial);
      grid.scale.setScalar(1.002);
      grid.renderOrder = 2;
      mesh.add(grid);
      grids.push({ part, layer, grid, mesh });
    }
  }
  editor.controls.mouseButtons.LEFT = null;
  editor.controls.mouseButtons.RIGHT = MOUSE.ROTATE;
  editor.controls.mouseButtons.MIDDLE = MOUSE.DOLLY;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let hovered = null;
  let showGrid = true;

  function renderGrid(hit = hovered) {
    hovered = hit;
    gridContext.clearRect(0, 0, 1024, 1024);
    if (showGrid) {
      gridContext.strokeStyle = "rgba(10,20,30,0.23)";
      gridContext.lineWidth = 1;
      gridContext.beginPath();
      for (let n = 0; n <= 1024; n += 16) {
        gridContext.moveTo(n + 0.5, 0);
        gridContext.lineTo(n + 0.5, 1024);
        gridContext.moveTo(0, n + 0.5);
        gridContext.lineTo(1024, n + 0.5);
      }
      gridContext.stroke();
    }
    if (hit) {
      gridContext.fillStyle = "rgba(255,255,255,0.3)";
      gridContext.fillRect(hit.x * 16, hit.y * 16, 16, 16);
      gridContext.strokeStyle = "#ffffff";
      gridContext.lineWidth = 2;
      gridContext.strokeRect(hit.x * 16 + 1, hit.y * 16 + 1, 14, 14);
    }
    gridTexture.needsUpdate = true;
  }
  function sync() {
    const state = getState();
    texture.needsUpdate = true;
    for (const viewer of [editor, preview]) {
      const skin = viewer.playerObject.skin;
      skin.modelType = state.model;
      for (const part of Object.keys(PARTS)) {
        // Editing visibility must not hide parts in the full-character preview.
        skin[part].visible = viewer === preview || state.visible.has(part);
        skin[part].outerLayer.visible =
          viewer === preview || state.overlayVisible;
      }
    }
    for (const item of grids) {
      item.grid.geometry = item.mesh.geometry;
      item.grid.visible = item.layer === state.layer;
    }
  }
  function pick(event) {
    const rect = editor.canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    editor.scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, editor.camera);
    const state = getState();
    const targets = [...state.visible].map((part) => {
      const mesh =
        editor.playerObject.skin[part][
          state.layer === "base" ? "innerLayer" : "outerLayer"
        ];
      return { part, mesh };
    });
    const hit = raycaster.intersectObjects(
      targets.map(({ mesh }) => mesh),
      false,
    )[0];
    if (!hit) return null;
    const part = targets.find(({ mesh }) => mesh === hit.object).part;
    const face = Math.floor(hit.faceIndex / 2);
    const region = faces(part, state.layer, state.model)[face];
    return { ...uvPixel(hit.uv, region), part, face, region };
  }
  const animations = {
    idle: IdleAnimation,
    walk: WalkingAnimation,
    run: RunningAnimation,
    wave: WaveAnimation,
    fly: FlyingAnimation,
    crouch: CrouchAnimation,
  };
  function animate(name, speed = 1, paused = false) {
    preview.animation = new animations[name]();
    preview.animation.speed = speed;
    preview.animation.paused = paused;
  }
  const observers = [];
  for (const [viewer, element] of [
    [editor, document.querySelector("#stage")],
    [preview, document.querySelector("#preview-stage")],
  ]) {
    const observer = new ResizeObserver(() => {
      if (element.clientWidth && element.clientHeight)
        viewer.setSize(element.clientWidth, element.clientHeight);
    });
    observer.observe(element);
    observers.push(observer);
  }
  renderGrid();
  sync();
  animate("walk");
  return {
    editor,
    preview,
    sync,
    pick,
    renderGrid,
    animate,
    setGrid(value) {
      showGrid = value;
      renderGrid();
    },
    setTool(tool) {
      editor.controls.mouseButtons.LEFT =
        tool === "rotate" ? MOUSE.ROTATE : null;
      editor.controls.enableRotate = true;
    },
    reset() {
      editor.resetCameraPose();
      editor.controls.target.set(0, 0, 0);
      editor.controls.update();
    },
    zoom(factor) {
      editor.camera.position.multiplyScalar(factor);
      editor.camera.position.clampLength(22, 150);
      editor.controls.update();
    },
    dispose() {
      observers.forEach((observer) => observer.disconnect());
      editor.dispose();
      preview.dispose();
      texture.dispose();
      gridTexture.dispose();
      gridMaterial.dispose();
    },
  };
}
