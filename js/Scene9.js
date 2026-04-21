import * as THREE from 'https://esm.sh/three@0.164.0';
import { GLTFLoader } from 'https://esm.sh/three@0.164.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'https://esm.sh/three@0.164.0/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'https://esm.sh/three@0.164.0/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode } from 'https://esm.sh/postprocessing@6.39.1?deps=three@0.164.0';
import gsap from 'https://esm.sh/gsap@3.12.5';
import { ScrollTrigger } from 'https://esm.sh/gsap@3.12.5/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ... [KEEP YOUR CONFIG OBJECTS THE SAME: LIGHTMAP_CONFIG, CAMERA_SCROLL_CONFIG, FX_CONFIG] ...
const LIGHTMAP_CONFIG = {
  'Marble 5': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.hdr',
  'Roof':     'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.hdr',
  'Pillar':   'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.hdr',
  'Wall':     'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom_Small1.hdr',
};

function isMobile() { return window.innerWidth <= 768; }

const CAMERA_SCROLL_CONFIG = {
  desktop: { startOffset: new THREE.Vector3(-2.5, -0.8, 10), midOffset: new THREE.Vector3(-0.2, -0.3, 6), endOffset: new THREE.Vector3( 0, 0, 4) },
  mobile: { startOffset: new THREE.Vector3(-2.5, -0.8, 11), midOffset: new THREE.Vector3(-0.5, -0.5, 8.5), endOffset: new THREE.Vector3( 0, 0, 7) },
  lookAtStart: new THREE.Vector3(1.5, 0, 0), lookAtMid: new THREE.Vector3(0.1, 0, 0), lookAtEnd: new THREE.Vector3(0, 0, 0),
  fov: { start: 56, end: 26 }, bloom: { start: 0.1, end: 0.01 },
  scrollDistance: "+=1300", scrubSmoothness: 1.5
};

const LIGHT_INTENSITY_SCALE = 0.001;

const FX_CONFIG = { hdriRotation: 0.0, bloomStrength: 1.5, bloomRadius: 1.0, bloomThreshold: 0, vignetteOffset: 0.2, vignetteDarkness: 0.75, anisotropy: 2, renderScale: 1, msaaSamples: 2 };

// ==========================================
// SETUP & DOM ELEMENTS
// ==========================================
const container      = document.querySelector('.hero-bg-3d-animation');
const heroSection    = document.querySelector('.hero-section');
const loaderElement  = document.querySelector('.preloader-wrapper') || document.getElementById('custom-loader');
const preloaderVideo = document.querySelector('.preloader-player');

// Force the container to be the source of truth for size
if(container) {
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.overflow = 'hidden';
}

function setScrollLocked(locked) {
  if (window.lenis) locked ? window.lenis.stop() : window.lenis.start();
}

function hidePreloader(onComplete) {
  if (!loaderElement) { onComplete?.(); return; }
  gsap.to(loaderElement, {
    opacity: 0, duration: 0.6, ease: 'power2.out',
    onComplete: () => {
      loaderElement.style.display = 'none';
      onComplete?.();
    }
  });
}

// ==========================================
// THREE.JS SETUP & NEW RESIZE OBSERVER
// ==========================================
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
let dpr = isMobile() ? Math.min(window.devicePixelRatio, 1.5) : 1;
renderer.setPixelRatio(dpr * FX_CONFIG.renderScale);

// Force Canvas CSS to always match container
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.outline = 'none';

renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

if (container) container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
scene.add(new THREE.AmbientLight(0x404040, 1.0));
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 2000);

// NEW: ResizeObserver strictly forces Three.js to match Webflow's CSS rules
const resizeObserver = new ResizeObserver((entries) => {
  for (let entry of entries) {
    const { width, height } = entry.contentRect;
    if (width > 0 && height > 0) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      if (typeof composer !== 'undefined') composer.setSize(width, height, false);
      ScrollTrigger.refresh();
    }
  }
});
if (container) resizeObserver.observe(container);

// ==========================================
// LOADERS & PROCESSING
// ==========================================
function processScene(gltf, loadedLightmaps) { /* same as your original */ }

async function initScene() {
  if (!container) return;
  const rgbeLoader = new RGBELoader();

  // Load HDRI & Model
  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  gltfLoader.load('https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/Test20optimized.glb', (gltf) => {
    const model = gltf.scene;
    
    // ... [KEEP YOUR BOX CENTERING & TARGET LOGIC] ...
    const box = new THREE.Box3().setFromObject(model);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    model.position.sub(centre);
    scene.add(model);
    model.updateMatrixWorld(true);

    let startPos = null, animatedLookTarget = null, heroTimeline = null;
    let lookAtStart, lookAtMid, lookAtEnd;

    const buildHeroTimeline = (midPos, endPos) => {
      if (heroTimeline) heroTimeline.kill();
      
      const fovEnd = isMobile() ? 55 : CAMERA_SCROLL_CONFIG.fov.end;

      // DEBUG: markers: true added to see if Webflow is overriding scroll
      heroTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: heroSection || '.hero-section',
          start: 'top top',
          end: CAMERA_SCROLL_CONFIG.scrollDistance,
          scrub: CAMERA_SCROLL_CONFIG.scrubSmoothness,
          pin: true,
          markers: true, // <--- Look for these markers on your live site!
          invalidateOnRefresh: true,
        },
        onUpdate: () => { if (animatedLookTarget) camera.lookAt(animatedLookTarget); }
      });

      heroTimeline.to(camera.position, {
        keyframes: [
          { x: midPos.x, y: midPos.y, z: midPos.z, ease: 'power1.in', duration: 1 },
          { x: endPos.x, y: endPos.y, z: endPos.z, ease: 'power1.out', duration: 1 },
        ]
      }, 0);
      heroTimeline.to(camera, { fov: fovEnd, ease: 'power2.inOut', duration: 2, onUpdate: () => camera.updateProjectionMatrix() }, 0);
      heroTimeline.to(animatedLookTarget, {
        keyframes: [
          { x: lookAtMid.x, y: lookAtMid.y, z: lookAtMid.z, ease: 'power2.inOut', duration: 1 },
          { x: lookAtEnd.x, y: lookAtEnd.y, z: lookAtEnd.z, ease: 'power2.inOut', duration: 1 },
        ]
      }, 0);
      heroTimeline.to(bloomEffect, { intensity: CAMERA_SCROLL_CONFIG.bloom.end, ease: 'power2.inOut', duration: 2 }, 0);
    };

    const logo = model.getObjectByName('Center');
    if (logo) {
      const logoPos = new THREE.Vector3();
      logo.getWorldPosition(logoPos);
      const mobile = isMobile();

      const offsets  = mobile ? CAMERA_SCROLL_CONFIG.mobile : CAMERA_SCROLL_CONFIG.desktop;
      startPos       = logoPos.clone().add(offsets.startOffset);
      const midPos   = logoPos.clone().add(offsets.midOffset);
      const endPos   = logoPos.clone().add(offsets.endOffset);

      lookAtStart        = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtStart);
      lookAtMid          = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtMid);
      lookAtEnd          = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtEnd);
      animatedLookTarget = lookAtStart.clone();
      
      camera.position.copy(startPos);
      camera.fov = mobile ? 70 : CAMERA_SCROLL_CONFIG.fov.start;
      camera.lookAt(animatedLookTarget);
      camera.updateProjectionMatrix();

      // Wait until Preloader is actually hidden to calculate timeline
      setTimeout(() => {
        hidePreloader(() => {
          setScrollLocked(false);
          ScrollTrigger.refresh();
          buildHeroTimeline(midPos, endPos);
        });
      }, 3000); // hardcoded delay to ensure DOM is ready
    }
  });
}

// ... [KEEP COMPOSER AND ANIMATE LOOP] ...
const composer = new EffectComposer(renderer, { multisampling: FX_CONFIG.msaaSamples, frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));

const bloomEffect = new BloomEffect({ intensity: FX_CONFIG.bloomStrength, mipmapBlur: true, luminanceThreshold: FX_CONFIG.bloomThreshold, resolutionScale: 0.5 });
const vignetteEffect = new VignetteEffect({ offset: FX_CONFIG.vignetteOffset, darkness: FX_CONFIG.vignetteDarkness });
const toneMappingEffect = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

composer.addPass(new EffectPass(camera, bloomEffect, vignetteEffect, toneMappingEffect));

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  composer.render(clock.getDelta());
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => { initScene(); animate(); }, { once: true });
} else {
  initScene(); animate();
}
