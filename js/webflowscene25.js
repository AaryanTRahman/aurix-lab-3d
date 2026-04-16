import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const LIGHTMAP_CONFIG = {
  'Marble 5': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom.hdr',
  'Roof': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom.hdr',
  'Pillar': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom.hdr',
  'Wall': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapRoom.hdr',
  'Table Wood': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapTable.hdr',
  'Black Table top': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/LightMapTable.hdr',
};

function isMobile() {
  return window.innerWidth <= 768; 
}

const CAMERA_SCROLL_CONFIG = {
  startOffset: new THREE.Vector3(-1, -0.9, 10),
  midOffset: new THREE.Vector3(0.2, -0.8, 6),
  endOffset: new THREE.Vector3(0, 0, 4),
  lookAtOffset: new THREE.Vector3(0, 0, 0),
  fov: { start: 56, end: 26 },
  bloom: { start: 0.1, end: 0.04 },
  scrollDistance: "+=1300",
  scrubSmoothness: 1.5
};

const SHOW_LIGHT_HELPERS = false; 
const lightHelpers = []; 
const LIGHT_INTENSITY_SCALE = 0.001;

const FX_CONFIG = {
  hdriRotation: 0.0, 
  bloomStrength: 0.11,   
  bloomRadius: 1.0,      
  bloomThreshold: 0.005,   
  vignetteOffset: 1.2,    
  vignetteDarkness: 1.0,  
  msaaSamples: 4,  // Optimized for performance
  anisotropy: 8    
};

const container = document.querySelector('.hero-bg-3d-animation');
const heroSection = document.querySelector('.hero-section');
const loaderElement = document.querySelector('.preloader-wrapper') || document.getElementById('custom-loader');
const preloaderVideo = document.querySelector('.preloader-player');
const initialLoaderDisplay = loaderElement
  ? ((window.getComputedStyle(loaderElement).display || '').replace('none', '') || 'flex')
  : 'flex';

function getViewportSize() {
  const width = container?.clientWidth || window.innerWidth;
  const height = container?.clientHeight || window.innerHeight;
  return { width: Math.max(width, 1), height: Math.max(height, 1) };
}

function setScrollLocked(locked) {
  const value = locked ? 'hidden' : '';
  // document.documentElement.style.overflow = value;
  // document.body.style.overflow = value;

  // LENIS FIX: Tell the smooth scroller what we are doing
  if (window.lenis) {
    if (locked) {
      window.lenis.stop();
    } else {
      window.lenis.start();
      window.lenis.resize(); // Force it to recalculate page height
    }
  }
  
}

function keepPreloaderVisible() {
  if (!loaderElement) return;
  loaderElement.style.display = initialLoaderDisplay;
  loaderElement.style.opacity = '1';
  loaderElement.style.visibility = 'visible';
  loaderElement.style.pointerEvents = 'auto';
}

function hidePreloader(onComplete) {
  if (!loaderElement) {
    onComplete?.();
    return;
  }
  gsap.to(loaderElement, {
    opacity: 0,
    duration: 0.6,
    ease: 'power2.out',
    onStart: () => {
      loaderElement.style.visibility = 'visible';
      loaderElement.style.pointerEvents = 'none';
    },
    onComplete: () => {
      loaderElement.style.display = 'none';
      loaderElement.style.visibility = 'hidden';
      onComplete?.();
    }
  });
}

function waitForPreloaderVideo(callback) {
  if (!loaderElement) {
    callback();
    return;
  }
  let didFinish = false;
  const finish = () => {
    if (didFinish) return;
    didFinish = true;
    callback();
  };

  const isHidden = () => {
    const styles = window.getComputedStyle(loaderElement);
    return (styles.display === 'none' || styles.visibility === 'hidden' || Number.parseFloat(styles.opacity) === 0);
  };

  if (isHidden()) { finish(); return; }

  if (preloaderVideo) {
    if (preloaderVideo.ended) { finish(); return; }
    preloaderVideo.addEventListener('ended', finish, { once: true });
    preloaderVideo.addEventListener('error', finish, { once: true });
  }

  const observer = new MutationObserver(() => {
    if (!document.body.contains(loaderElement) || isHidden()) {
      observer.disconnect();
      finish();
    }
  });

  observer.observe(loaderElement, { attributes: true, attributeFilter: ['class', 'style'] });
  window.setTimeout(() => { observer.disconnect(); finish(); }, 4500);
}

// THE BULLETPROOF FAILSAFE
if (loaderElement) {
  setScrollLocked(true);
  keepPreloaderVisible();
  setTimeout(() => {
    setScrollLocked(false);
    if (loaderElement) {
      loaderElement.style.display = 'none';
      loaderElement.style.visibility = 'hidden';
    }
  }, 7000);
}

const initialViewport = getViewportSize();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(initialViewport.width, initialViewport.height, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

if (container) {
  container.appendChild(renderer.domElement);
} else {
  console.error("Could not find '.hero-bg-3d-animation' div in Webflow!");
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
scene.add(ambientLight);

const camera = new THREE.PerspectiveCamera(50, initialViewport.width / initialViewport.height, 0.01, 2000);

function resizeScene() {
  const { width, height } = getViewportSize();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (composer) composer.setSize(width, height);
  ScrollTrigger.refresh();
}
window.addEventListener('resize', resizeScene);

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
    finalMats.forEach(m => {
      ['map', 'lightMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(mapName => {
        if (m[mapName]) m[mapName].anisotropy = anisoLevel;
      });
    });
  });
}

async function initScene() {
  if (!container) return;
  const rgbeLoader = new RGBELoader();

  rgbeLoader.load('https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/shanghai_bund_1k.hdr', (envMap) => {
    scene.environmentIntensity = 0.05; 
    const SATURATION = 0.5; 
    if (SATURATION !== 1.0) {
      const data = envMap.image.data;
      for (let i = 0; i < data.length; i += 4) {
        const luma = 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
        data[i]     = luma + SATURATION * (data[i] - luma);
        data[i+1]   = luma + SATURATION * (data[i+1] - luma);
        data[i+2]   = luma + SATURATION * (data[i+2] - luma);
      }
      envMap.needsUpdate = true; 
    }
    envMap.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envMap; 
    scene.environmentRotation.y = FX_CONFIG.hdriRotation;
  });

  const loadedLightmaps = {};
  try {
    const entries = Object.entries(LIGHTMAP_CONFIG);
    await Promise.all(entries.map(async ([matName, hdrPath]) => {
      const tex = await rgbeLoader.loadAsync(hdrPath);
      tex.flipY = false; 
      loadedLightmaps[matName] = tex;
    }));
  } catch (err) {
    console.error("Failed to load HDR lightmaps:", err);
  }

  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  gltfLoader.load(
    'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/models/Test15optimized.glb',
    (gltf) => {
      const model = gltf.scene;
      processScene(gltf, loadedLightmaps);

      const box = new THREE.Box3().setFromObject(model);
      const centre = new THREE.Vector3();
      const modelSize = new THREE.Vector3();
      box.getCenter(centre);
      box.getSize(modelSize);
      model.position.sub(centre);

      scene.add(model);
      model.updateMatrixWorld(true);

      model.traverse((node) => {
        if (node.isSpotLight) {
          const targetPos = new THREE.Vector3(0, 0, -1);
          node.localToWorld(targetPos);
          if (node.target && node.target.parent) node.target.parent.remove(node.target);
          node.target = new THREE.Object3D();
          node.target.position.copy(targetPos);
          scene.add(node.target);
        }
      });

      let startPos = null, startLookTarget = null, lookTarget = null, animatedLookTarget = null, heroTimeline = null, hasRevealedScene = false;

      const resetToStartFrame = () => {
        if (!startPos || !startLookTarget || !animatedLookTarget) return;
        animatedLookTarget.copy(startLookTarget);
        camera.position.copy(startPos);
        camera.updateProjectionMatrix();
        bloomPass.strength = CAMERA_SCROLL_CONFIG.bloom.start;
        camera.lookAt(animatedLookTarget);
      };

      const buildHeroTimeline = (midPos, endPos) => {
        heroTimeline?.kill();
        resetToStartFrame();
        const fovEnd = isMobile() ? 55 : 26;

        heroTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: heroSection || ".hero-section",
            start: "top top",
            end: CAMERA_SCROLL_CONFIG.scrollDistance,
            scrub: CAMERA_SCROLL_CONFIG.scrubSmoothness,
            pin: true,
            invalidateOnRefresh: true,
            anticipatePin: 1,
            onLeave: () => window.dispatchEvent(new Event('resize')),
            onEnterBack: () => window.dispatchEvent(new Event('resize'))
          },
          onUpdate: () => { if (animatedLookTarget) camera.lookAt(animatedLookTarget); }
        });

        heroTimeline.to(camera.position, { x: midPos.x, y: midPos.y, z: midPos.z, ease: "power1.in", duration: 1 }, 0);
        heroTimeline.to(camera.position, { x: endPos.x, y: endPos.y, z: endPos.z, ease: "power1.out", duration: 1 }, 1);
        heroTimeline.to(camera, { fov: fovEnd, ease: "power2.inOut", duration: 2, onUpdate: () => camera.updateProjectionMatrix() }, 0);
        heroTimeline.to(animatedLookTarget, { x: lookTarget.x, y: lookTarget.y, z: lookTarget.z, ease: "power2.inOut", duration: 2 }, 0);
        heroTimeline.to(bloomPass, { strength: CAMERA_SCROLL_CONFIG.bloom.end, ease: "power2.inOut", duration: 2 }, 0);
        heroTimeline.to('.scroll-indicator-wrapper', { opacity: 0, duration: 0.2 }, 0);

        ScrollTrigger.refresh();
      };

      // const revealSceneWhenReady = (midPos, endPos) => {
      //   if (hasRevealedScene) return;
      //   hasRevealedScene = true;
      //   if (typeof ScrollTrigger.clearScrollMemory === 'function') ScrollTrigger.clearScrollMemory();
      //   window.scrollTo(0, 0);
      //   document.documentElement.scrollTop = 0;
      //   document.body.scrollTop = 0;

      //   requestAnimationFrame(() => {
      //     buildHeroTimeline(midPos, endPos);
      //     requestAnimationFrame(() => {
      //       hidePreloader(() => {
      //         setScrollLocked(false);
      //         ScrollTrigger.refresh();
      //         if (heroTimeline?.scrollTrigger) heroTimeline.scrollTrigger.update();
      //       });
      //     });
      //   });
      // };

      const revealSceneWhenReady = (midPos, endPos) => {
        if (hasRevealedScene) return;
        hasRevealedScene = true;
        
        if (typeof ScrollTrigger.clearScrollMemory === 'function') {
          ScrollTrigger.clearScrollMemory();
        }
        
        // Snap back to top before revealing
        window.scrollTo(0, 0);

        requestAnimationFrame(() => {
          buildHeroTimeline(midPos, endPos);
          
          requestAnimationFrame(() => {
            hidePreloader(() => {
              // 1. Refresh GSAP
              ScrollTrigger.refresh();
              if (heroTimeline?.scrollTrigger) heroTimeline.scrollTrigger.update();
              
              // 2. SECRET TRIGGER: Force Webflow's Lenis to wake up and recalculate height
              window.dispatchEvent(new Event('resize'));
            });
          });
        });
      };

      const logo = model.getObjectByName('Logo');
      if (logo) {
        const logoPos = new THREE.Vector3();
        logo.getWorldPosition(logoPos);
        const mobile = isMobile();
        startPos = logoPos.clone().add(new THREE.Vector3(mobile ? -1.5 : -1, -0.9, mobile ? 11 : 10));
        const midPos = logoPos.clone().add(new THREE.Vector3(0.2, -0.8, mobile ? 8.5 : 6));
        const endPos = logoPos.clone().add(new THREE.Vector3(0, mobile ? -0.5 : 0, mobile ? 7 : 4));
        lookTarget = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtOffset);
        startLookTarget = lookTarget.clone();
        animatedLookTarget = startLookTarget.clone();
        camera.fov = mobile ? 70 : 56;

        resetToStartFrame();
        composer.render();
        waitForPreloaderVideo(() => revealSceneWhenReady(midPos, endPos));
      } else {
        hidePreloader(() => setScrollLocked(false));
      }
    },
    (xhr) => {
      const progressText = document.getElementById('loader-progress');
      if (progressText) progressText.innerText = `${((xhr.loaded / xhr.total) * 100).toFixed(0)}%`;
    },
    (error) => console.error('GLTFLoader error:', error)
  );
}

const renderTarget = new THREE.WebGLRenderTarget(initialViewport.width, initialViewport.height, {
  samples: FX_CONFIG.msaaSamples,
  type: THREE.HalfFloatType
});

const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(initialViewport.width, initialViewport.height),
  FX_CONFIG.bloomStrength,
  FX_CONFIG.bloomRadius,
  FX_CONFIG.bloomThreshold
);
composer.addPass(bloomPass);
const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms['offset'].value = FX_CONFIG.vignetteOffset;
vignettePass.uniforms['darkness'].value = FX_CONFIG.vignetteDarkness;
composer.addPass(vignettePass);
composer.addPass(new OutputPass());

function animate() {
  requestAnimationFrame(animate);
  composer.render();
}

let hasStarted = false;
async function startScene() {
  if (hasStarted) return;
  hasStarted = true;
  if (!container) return;
  await initScene();
  resizeScene();
  animate();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', startScene, { once: true });
} else {
  startScene();
}
