import * as THREE from 'https://esm.sh/three@0.164.0';
import { GLTFLoader } from 'https://esm.sh/three@0.164.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'https://esm.sh/three@0.164.0/examples/jsm/libs/meshopt_decoder.module.js';
import { EXRLoader } from 'https://esm.sh/three@0.164.0/examples/jsm/loaders/EXRLoader.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode } from 'https://esm.sh/postprocessing@6.39.1?deps=three@0.164.0';
// import gsap from 'https://esm.sh/gsap@3.12.5';
// import ScrollTrigger from 'https://esm.sh/gsap@3.12.5/ScrollTrigger';

// ADD BACK YOUR OLD IMPORTS:
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

ScrollTrigger.config({
  ignoreMobileResize: true
});

const LIGHTMAP_CONFIG = {
  'Marble 5': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.exr',
  'Roof': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.exr',
  'Pillar': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.exr',
  'Wall': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.exr',
};

function isMobile() {
  return window.innerWidth <= 768;
}

const CAMERA_SCROLL_CONFIG = {
  desktop: {
    startOffset: new THREE.Vector3(-2.5,  -0.8, 10),
    midOffset:   new THREE.Vector3(-0.2,  -0.3,  6),
    endOffset:   new THREE.Vector3( 0,     0,     4),
  },
  mobile: {
    startOffset: new THREE.Vector3(-2.5, -0.8, 10),
    midOffset:   new THREE.Vector3(-1.25, -0.4,  8.5),
    endOffset:   new THREE.Vector3( 0,    0,     7),
  },
  lookAtStart: new THREE.Vector3(1.5, 0, 0),
  lookAtMid:   new THREE.Vector3(0.4, 0, 0),
  lookAtEnd:   new THREE.Vector3(0,   0, 0),
  fov:   { start: 50, end: 26, mobileStart: 58, mobileEnd: 55 },
  bloom: { start: 0.1, end: 0.01 },
  scrollDistance: "+=780",
  scrubSmoothness: 1.5
};

const LIGHT_INTENSITY_SCALE = 0.001;

const FX_CONFIG = {
  hdriRotation:     0.0,
  bloomStrength:    1.5,
  bloomRadius:      1.0,
  bloomThreshold:   0,
  vignetteOffset:   0.2,
  vignetteDarkness: 0.75,
  anisotropy:       2,
  renderScale:      1,
  msaaSamples:      2
};

// --- WEBFLOW DOM ELEMENTS ---
const container = document.querySelector('.hero-bg-3d-animation');
const heroSection = document.querySelector('.hero-section');

function getViewportSize() {
  const width = container?.clientWidth || window.innerWidth;
  const height = container?.clientHeight || window.innerHeight;
  return { width: Math.max(width, 1), height: Math.max(height, 1) };
}

function notifySceneReady() {
  window.dispatchEvent(new CustomEvent('aurix:scene-ready'));
}

function notifySceneError(error) {
  console.error('Aurix scene failed to initialize:', error);
  notifySceneReady();
}

// --- INITIALIZE RENDERER (New Performance Config) ---
const initialViewport = getViewportSize();
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });

let dpr = isMobile() ? Math.min(window.devicePixelRatio, 1.5) : 1;
dpr = dpr * FX_CONFIG.renderScale;
renderer.setPixelRatio(dpr);
// CRUCIAL: 'false' forces Three.js NOT to override Webflow's CSS vh!
renderer.setSize(initialViewport.width, initialViewport.height, false);
renderer.toneMapping = THREE.NoToneMapping; // Handled by postprocessing ToneMappingEffect
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

if (container) {
  container.appendChild(renderer.domElement);
} else {
  console.error("Could not find '.hero-bg-3d-animation' div in Webflow!");
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
scene.add(new THREE.AmbientLight(0x404040, 1.0));

const camera = new THREE.PerspectiveCamera(50, initialViewport.width / initialViewport.height, 0.01, 2000);

// --- NEW POST-PROCESSING PIPELINE ---
const composer = new EffectComposer(renderer, {
  multisampling: FX_CONFIG.msaaSamples,
  frameBufferType: THREE.HalfFloatType
});
composer.addPass(new RenderPass(scene, camera));

const bloomEffect = new BloomEffect({
  intensity: FX_CONFIG.bloomStrength,
  mipmapBlur: true,
  luminanceThreshold: FX_CONFIG.bloomThreshold,
  resolutionScale: 0.5
});

const vignetteEffect = new VignetteEffect({
  offset: FX_CONFIG.vignetteOffset,
  darkness: FX_CONFIG.vignetteDarkness
});

const toneMappingEffect = new ToneMappingEffect({
  mode: ToneMappingMode.ACES_FILMIC
});

composer.addPass(new EffectPass(camera, bloomEffect, vignetteEffect, toneMappingEffect));

let renderQueued = false;

function renderScene() {
  composer.render(0);
}

function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderScene();
  });
}

// // --- RESIZE EVENT HANDLING ---
// function resizeScene() {
//   const { width, height } = getViewportSize();
//   camera.aspect = width / height;
//   camera.updateProjectionMatrix();
//   // CRUCIAL: 'false' ensures we don't inject inline CSS pixels over 100vh!
//   renderer.setSize(width, height, false);
//   if (composer) composer.setSize(width, height, false);
//   ScrollTrigger.refresh();
// }
// window.addEventListener('resize', resizeScene);

// --- RESIZE EVENT HANDLING ---
let lastWindowWidth = window.innerWidth; // Add this variable

function resizeScene() {
  const { width, height } = getViewportSize();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  // Update 3D canvas size
  renderer.setSize(width, height, false);
  if (composer) composer.setSize(width, height, false);
  
  // ONLY refresh ScrollTrigger if the screen width changes (device rotation).
  // This physically prevents the violent "teleportation" jump down the page!
  if (window.innerWidth !== lastWindowWidth) {
    lastWindowWidth = window.innerWidth;
    ScrollTrigger.refresh();
  }

  requestRender();
}
window.addEventListener('resize', resizeScene);

// --- SCENE PROCESSING ---
function processScene(gltf, loadedLightmaps) {
  const model = gltf.scene;
  model.traverse((node) => {
    if (node.isLight) {
      node.intensity *= LIGHT_INTENSITY_SCALE * 0.5;
      if (node.isSpotLight) node.color.setHex(0xfdf2c2);
      if (node.isPointLight || node.isSpotLight) node.decay = 2;
    }
    if (!node.isMesh) return;

    const geo = node.geometry;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const newMaterials = [];

    materials.forEach((mat) => {
      if (mat && loadedLightmaps[mat.name]) {
        let lmChannel = 1;
        if (mat.emissiveMap) lmChannel = mat.emissiveMap.channel !== undefined ? mat.emissiveMap.channel : 0;
        if (geo) {
          const attrName = lmChannel === 0 ? 'uv' : `uv${lmChannel}`;
          const targetUV = geo.attributes[attrName];
          if (targetUV) geo.setAttribute('uv1', targetUV);
        }
        const hdrTexture = loadedLightmaps[mat.name];
        hdrTexture.channel = 1;
        if (mat.map) mat.map.channel = 0;

        const newMat = new THREE.MeshBasicMaterial({
          name: mat.name,
          color: mat.map ? new THREE.Color(0xffffff) : mat.color,
          map: mat.map,
          lightMap: hdrTexture,
          lightMapIntensity: 1.5,
        });
        newMat.transparent = mat.transparent;
        newMat.opacity = mat.opacity;
        newMat.alphaTest = mat.alphaTest;
        newMaterials.push(newMat);
        mat.dispose();
      } else {
        newMaterials.push(mat);
      }
    });

    node.material = Array.isArray(node.material) ? newMaterials : newMaterials[0];
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const anisoLevel = Math.min(FX_CONFIG.anisotropy, maxAniso);
    const finalMats = Array.isArray(node.material) ? node.material : [node.material];
    finalMats.forEach(m => { if (m.map) m.map.anisotropy = anisoLevel; });
  });
}

// --- INIT SCENE & ASSETS ---
async function initScene() {
  if (!container) {
    notifySceneReady();
    return;
  }
  const exrLoader = new EXRLoader();

  // Load Environment Map
  const envMapPromise = exrLoader.loadAsync('https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/shanghai_bund_1k_desaturated.exr')
    .then((envMap) => {
    scene.environmentIntensity = 0.05;
    envMap.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envMap;
    scene.environmentRotation.y = FX_CONFIG.hdriRotation;
  })
    .catch((error) => {
      console.error('Failed to load environment map:', error);
    });

  // Cached HDR Loading (Performance Update)
  const loadedLightmaps = {};
  const lightmapsPromise = (async () => {
    try {
      const uniqueURLs = [...new Set(Object.values(LIGHTMAP_CONFIG))];
      const textureCache = {};
      await Promise.all(uniqueURLs.map(async (url) => {
        const tex = await exrLoader.loadAsync(url);
        tex.flipY = true;
        textureCache[url] = tex;
      }));
      for (const [matName, hdrPath] of Object.entries(LIGHTMAP_CONFIG)) {
        loadedLightmaps[matName] = textureCache[hdrPath];
      }
    } catch (err) {
      console.error("Failed to load HDR lightmaps:", err);
    }
  })();

  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  try {
    await Promise.all([envMapPromise, lightmapsPromise]);
    const gltf = await gltfLoader.loadAsync(
      'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/Test20optimized.glb',
      (xhr) => {
        const progressText = document.getElementById('loader-progress');
        if (progressText && xhr.total) {
          progressText.innerText = `${((xhr.loaded / xhr.total) * 100).toFixed(0)}%`;
        }
      }
    );

    const model = gltf.scene;
    processScene(gltf, loadedLightmaps);

    const box = new THREE.Box3().setFromObject(model);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    model.position.sub(centre);
    scene.add(model);
    model.updateMatrixWorld(true);

    model.traverse((node) => {
      if (node.isSpotLight) {
        const targetPos = new THREE.Vector3(0, 0, -1);
        node.localToWorld(targetPos);
        if (node.target?.parent) node.target.parent.remove(node.target);
        node.target = new THREE.Object3D();
        node.target.position.copy(targetPos);
        scene.add(node.target);
      }
    });

    let startPos = null, animatedLookTarget = null, heroTimeline = null, hasRevealedScene = false;
    let lookAtStart, lookAtMid, lookAtEnd;

    const resetToStartFrame = () => {
      if (!startPos || !animatedLookTarget || !lookAtStart) return;
      animatedLookTarget.copy(lookAtStart);
      camera.position.copy(startPos);
      camera.updateProjectionMatrix();
      bloomEffect.intensity = CAMERA_SCROLL_CONFIG.bloom.start; // New bloom logic
      camera.lookAt(animatedLookTarget);
      requestRender();
    };

    const buildHeroTimeline = (midPos, endPos) => {
      heroTimeline?.kill();
      resetToStartFrame();
      const fovEnd = isMobile() ? CAMERA_SCROLL_CONFIG.fov.mobileEnd : CAMERA_SCROLL_CONFIG.fov.end;

      heroTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: heroSection || ".hero-section",
          start: "top top",
          end: CAMERA_SCROLL_CONFIG.scrollDistance,
          scrub: CAMERA_SCROLL_CONFIG.scrubSmoothness,
          pin: true,
          anticipatePin: 1,

          // CRUCIAL: 'invalidateOnRefresh' MUST BE GONE to prevent the camera snap!

          // BRINGING THIS BACK: This is what fixes your scroll wheel.
          // Since 'invalidateOnRefresh' is gone, this will no longer break the camera!
          onLeave: () => {
            window.dispatchEvent(new Event('resize'));
            requestRender();
          },
          onEnterBack: () => {
            window.dispatchEvent(new Event('resize'));
            requestRender();
          }
        },
        onUpdate: () => {
          if (animatedLookTarget) camera.lookAt(animatedLookTarget);
          requestRender();
        }
      });

      heroTimeline.to(camera.position, {
        keyframes: [
          { x: midPos.x, y: midPos.y, z: midPos.z, ease: "power1.in", duration: 1 },
          { x: endPos.x, y: endPos.y, z: endPos.z, ease: "power1.out", duration: 1 },
        ]
      }, 0);
      heroTimeline.to(camera, {
        fov: fovEnd,
        ease: "power2.inOut",
        duration: 2,
        onUpdate: () => {
          camera.updateProjectionMatrix();
          requestRender();
        }
      }, 0);
      heroTimeline.to(animatedLookTarget, {
        keyframes: [
          { x: lookAtMid.x, y: lookAtMid.y, z: lookAtMid.z, ease: "power1.inOut", duration: 1 },
          { x: lookAtEnd.x, y: lookAtEnd.y, z: lookAtEnd.z, ease: "power1.inOut", duration: 1 },
        ]
      }, 0);
      heroTimeline.to(bloomEffect, {
        intensity: CAMERA_SCROLL_CONFIG.bloom.end,
        ease: "power2.inOut",
        duration: 2,
        onUpdate: requestRender
      }, 0);

      ScrollTrigger.refresh();
      requestRender();
    };

    // --- WEBFLOW REVEAL LOGIC (Preserved from old code) ---
    const revealSceneWhenReady = (midPos, endPos) => {
      if (hasRevealedScene) return;
      hasRevealedScene = true;

      if (typeof ScrollTrigger.clearScrollMemory === 'function') {
        ScrollTrigger.clearScrollMemory();
      }

      window.scrollTo(0, 0);

      requestAnimationFrame(() => {
        buildHeroTimeline(midPos, endPos);

        requestAnimationFrame(() => {
          ScrollTrigger.refresh();
          if (heroTimeline?.scrollTrigger) heroTimeline.scrollTrigger.update();
          window.dispatchEvent(new Event('resize'));
          requestRender();
          notifySceneReady();
        });
      });
    };

    // Find the new target "Center"
    const targetObj = model.getObjectByName('Center');
    if (targetObj) {
      const logoPos = new THREE.Vector3();
      targetObj.getWorldPosition(logoPos);
      const mobile = isMobile();

      const offsets = mobile ? CAMERA_SCROLL_CONFIG.mobile : CAMERA_SCROLL_CONFIG.desktop;
      startPos = logoPos.clone().add(offsets.startOffset);
      const midPos = logoPos.clone().add(offsets.midOffset);
      const endPos = logoPos.clone().add(offsets.endOffset);

      lookAtStart = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtStart);
      lookAtMid   = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtMid);
      lookAtEnd   = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtEnd);

      animatedLookTarget = lookAtStart.clone();
      camera.fov = mobile ? CAMERA_SCROLL_CONFIG.fov.mobileStart : CAMERA_SCROLL_CONFIG.fov.start;

      resetToStartFrame();
      renderScene();
      revealSceneWhenReady(midPos, endPos);
    } else {
      console.warn("Object 'Center' not found in model!");
      renderScene();
      notifySceneReady();
    }
  } catch (error) {
    notifySceneError(error);
  }
}

let hasStarted = false;
async function startScene() {
  if (hasStarted) return;
  hasStarted = true;
  await initScene();
  resizeScene();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', startScene, { once: true });
} else {
  startScene();
}
