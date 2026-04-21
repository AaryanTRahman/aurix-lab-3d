import * as THREE from 'https://esm.sh/three@0.164.0';
import { GLTFLoader } from 'https://esm.sh/three@0.164.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'https://esm.sh/three@0.164.0/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'https://esm.sh/three@0.164.0/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode } from 'https://esm.sh/postprocessing@6.39.1?deps=three@0.164.0';
import gsap from 'https://esm.sh/gsap@3.12.5';
import { ScrollTrigger } from 'https://esm.sh/gsap@3.12.5/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// --- NEW: Sync GSAP with Lenis if it exists ---
if (window.lenis) {
  window.lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => { window.lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0, 0);
}

const LIGHTMAP_CONFIG = {
  'Marble 5': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.hdr',
  'Roof':     'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.hdr',
  'Pillar':   'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.hdr',
  'Wall':     'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.hdr',
};

function isMobile() { return window.innerWidth <= 768; }

const CAMERA_SCROLL_CONFIG = {
  desktop: {
    startOffset: new THREE.Vector3(-2.5, -0.8, 10),
    midOffset:   new THREE.Vector3(-0.2, -0.3,  6),
    endOffset:   new THREE.Vector3( 0,    0,     4),
  },
  mobile: {
    startOffset: new THREE.Vector3(-2.5, -0.8, 11),
    midOffset:   new THREE.Vector3(-0.5, -0.5,  8.5),
    endOffset:   new THREE.Vector3( 0,    0,    7),
  },
  lookAtStart: new THREE.Vector3(1.5, 0, 0),
  lookAtMid:   new THREE.Vector3(0.1, 0, 0),
  lookAtEnd:   new THREE.Vector3(0,   0, 0),
  fov:             { start: 56, end: 26 },
  bloom:           { start: 0.1, end: 0.01 },
  scrollDistance:  "+=1500", // Increased to ensure it has room to scroll
  scrubSmoothness: 1
};

const FX_CONFIG = {
  hdriRotation: 0.0, bloomStrength: 1.5, bloomThreshold: 0,
  vignetteOffset: 0.2, vignetteDarkness: 0.75, anisotropy: 2,
  renderScale: 1, msaaSamples: 2
};

const container      = document.querySelector('.hero-bg-3d-animation');
const heroSection    = document.querySelector('.hero-section');
const loaderElement  = document.querySelector('.preloader-wrapper') || document.getElementById('custom-loader');

function setScrollLocked(locked) {
  if (window.lenis) { locked ? window.lenis.stop() : window.lenis.start(); }
  else { document.body.style.overflow = locked ? 'hidden' : ''; }
}

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
let dpr = isMobile() ? Math.min(window.devicePixelRatio, 1.5) : 1;
renderer.setPixelRatio(dpr * FX_CONFIG.renderScale);

// --- NEW: CSS forced fill so Webflow classes dictate sizing ---
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.pointerEvents = 'none'; // Prevents blocking clicks

renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

if (container) container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
scene.add(new THREE.AmbientLight(0x404040, 1.0));

// Temporary starting aspect ratio
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 2000);

const composer = new EffectComposer(renderer, {
  multisampling: FX_CONFIG.msaaSamples,
  frameBufferType: THREE.HalfFloatType
});
composer.addPass(new RenderPass(scene, camera));

const bloomEffect = new BloomEffect({ intensity: FX_CONFIG.bloomStrength, mipmapBlur: true, luminanceThreshold: FX_CONFIG.bloomThreshold });
const vignetteEffect = new VignetteEffect({ offset: FX_CONFIG.vignetteOffset, darkness: FX_CONFIG.vignetteDarkness });
const toneMappingEffect = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
composer.addPass(new EffectPass(camera, bloomEffect, vignetteEffect, toneMappingEffect));

// --- NEW APPROACH: ResizeObserver ---
// Instead of trusting 'window.innerHeight', we watch exactly what Webflow does to the container div.
const resizeObserver = new ResizeObserver((entries) => {
  for (let entry of entries) {
    const { width, height } = entry.contentRect;
    if (width > 0 && height > 0) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false); // false = don't overwrite inline CSS width/height
      composer.setSize(width, height, false);
      ScrollTrigger.refresh();
    }
  }
});
if (container) resizeObserver.observe(container);

async function initScene() {
  if (!container) return;
  const rgbeLoader = new RGBELoader();
  
  rgbeLoader.load('https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/shanghai_bund_1k_desaturated.hdr', (envMap) => {
    scene.environmentIntensity = 0.05;
    envMap.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envMap;
  });

  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  gltfLoader.load('https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/Test20optimized.glb', (gltf) => {
    const model = gltf.scene;
    // ... basic centering logic ...
    const box = new THREE.Box3().setFromObject(model);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    model.position.sub(centre);
    scene.add(model);

    const logo = model.getObjectByName('Center');
    if (!logo) return;

    const logoPos = new THREE.Vector3();
    logo.getWorldPosition(logoPos);
    
    const offsets = isMobile() ? CAMERA_SCROLL_CONFIG.mobile : CAMERA_SCROLL_CONFIG.desktop;
    const startPos = logoPos.clone().add(offsets.startOffset);
    const midPos   = logoPos.clone().add(offsets.midOffset);
    const endPos   = logoPos.clone().add(offsets.endOffset);

    const lookAtStart = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtStart);
    const lookAtMid   = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtMid);
    const lookAtEnd   = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtEnd);

    let animatedLookTarget = lookAtStart.clone();
    
    // Set initial state
    camera.position.copy(startPos);
    camera.lookAt(animatedLookTarget);
    camera.fov = isMobile() ? 70 : CAMERA_SCROLL_CONFIG.fov.start;
    bloomEffect.intensity = CAMERA_SCROLL_CONFIG.bloom.start;

    // Wait until preloader is actually gone to build trigger
    setTimeout(() => {
      setScrollLocked(false);
      
      // NEW APPROACH: We use a wrapper timeline, and specific fromTo's to enforce boundaries
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroSection || '.hero-section',
          start: 'top top',
          end: CAMERA_SCROLL_CONFIG.scrollDistance,
          scrub: true,
          pin: true,
          invalidateOnRefresh: true,
          onUpdate: () => {
            camera.lookAt(animatedLookTarget);
          }
        }
      });

      tl.to(camera.position, {
        keyframes: [
          { x: midPos.x, y: midPos.y, z: midPos.z, ease: 'none', duration: 1 },
          { x: endPos.x, y: endPos.y, z: endPos.z, ease: 'none', duration: 1 },
        ]
      }, 0);

      tl.to(animatedLookTarget, {
        keyframes: [
          { x: lookAtMid.x, y: lookAtMid.y, z: lookAtMid.z, ease: 'none', duration: 1 },
          { x: lookAtEnd.x, y: lookAtEnd.y, z: lookAtEnd.z, ease: 'none', duration: 1 },
        ]
      }, 0);

      tl.to(camera, { fov: isMobile() ? 55 : CAMERA_SCROLL_CONFIG.fov.end, duration: 2, ease: 'none', onUpdate: () => camera.updateProjectionMatrix() }, 0);
      tl.to(bloomEffect, { intensity: CAMERA_SCROLL_CONFIG.bloom.end, duration: 2, ease: 'none' }, 0);

      ScrollTrigger.refresh();

    }, 3000); // adjust delay if preloader takes longer

  });
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  composer.render(clock.getDelta());
}

window.addEventListener('DOMContentLoaded', () => {
  initScene();
  animate();
});
