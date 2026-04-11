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

// ─── ADD GSAP IMPORTS ────────────────────────────────────────────────────────
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

// Register ScrollTrigger so GSAP knows how to use it
gsap.registerPlugin(ScrollTrigger);

// ─── Configuration ───────────────────────────────────────────────────────────
const LIGHTMAP_CONFIG = {
  'Marble 5': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/model/LightMap_Room_2.hdr',
  'Roof': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/model/LightMap_Room_2.hdr',
  'Pillar': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/model/LightMap_Room_2.hdr',
  'Wall': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/model/LightMap_Room_2.hdr',
  'Table Wood': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/model/LightMap_Table.hdr',
  'Black Table top': 'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/model/LightMap_Table.hdr',
};

// ─── CAMERA SCROLL ANIMATION CONFIG ──────────────────────────────────────────
const CAMERA_SCROLL_CONFIG = {
  // Coordinates are relative to the "Logo" object.
  // Start: Far back and slightly high
  startOffset: new THREE.Vector3(-1, -1, 10), 

  midOffset: new THREE.Vector3(0, -0.5, 5),

  // End: Close up to the logo
  endOffset: new THREE.Vector3(0, 0, 4),    
  // Where the camera constantly stares during the animation
  lookAtOffset: new THREE.Vector3(0, 0, 0), 

  // Camera Field of View (Zoom effect)
  fov: { start: 50, end: 26 },

  // Bloom Glow Strength
  bloom: { start: 0.1, end: 0.04 },
  
  // How many pixels the user has to scroll to complete the animation
  // (e.g., "+=3000" means 3000px of scrolling before the site moves down)
  scrollDistance: "+=3000",
  
  // Smoothness (higher = more floaty lag when scrolling stops)
  scrubSmoothness: 1.5 
};

// ─── Debug Configuration ─────────────────────────────────────────────────────
const SHOW_LIGHT_HELPERS = false; 
const lightHelpers = []; 
const LIGHT_INTENSITY_SCALE = 0.001;

// ─── Post-Processing & Environment Config ────────────────────────────────────
const FX_CONFIG = {
  hdriRotation: 0.0, 
  bloomStrength: 0.11,   
  bloomRadius: 1.0,      
  bloomThreshold: 0.005,   
  vignetteOffset: 1.2,    
  vignetteDarkness: 1.0,  
  msaaSamples: 6,  
  anisotropy: 8    
};

// ─── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Target the Webflow class you created
const container = document.querySelector('.hero-bg-3d-animation');
if (container) {
  container.appendChild(renderer.domElement);
} else {
  console.error("Could not find '.hero-bg-3d-animation' div in Webflow!");
}

// Lock scrolling while loading
document.body.style.overflow = 'hidden';

// ─── Scene & Lights ──────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
scene.add(ambientLight);

// ─── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.01,
  2000
);

// ─── Resize Handler ──────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  // Optional: ScrollTrigger.refresh() helps recalculate pinned containers on resize
  ScrollTrigger.refresh();
});

// ─── Process Scene Function ──────────────────────────────────────────────────
function processScene(gltf, loadedLightmaps) {
  const model = gltf.scene;

  model.traverse((node) => {
    // ── Lights ──
    if (node.isLight) {
      node.intensity *= LIGHT_INTENSITY_SCALE * 0.5;
      if (node.isSpotLight) node.color.setHex(0xfdf2c2);
      if (node.isPointLight || node.isSpotLight) node.decay = 2;
    }

    // ── Meshes & Lightmaps ──
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

    // ── APPLY ANISOTROPY ──
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

// ─── Main Execution ──────────────────────────────────────────────────────────
async function initScene() {
  const rgbeLoader = new RGBELoader();

  // ── LOAD HDRI FOR METALS ──
  rgbeLoader.load('https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/model/shanghai_bund_1k.hdr', (envMap) => {
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

  // ── Load GLB ──
  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  gltfLoader.load(
    'https://cdn.jsdelivr.net/gh/AaryanTRahman/aurix-lab-3d@main/model/Test14optimized.glb',
    (gltf) => {
      const model = gltf.scene;

      processScene(gltf, loadedLightmaps);

      const box = new THREE.Box3().setFromObject(model);
      const centre = new THREE.Vector3();
      box.getCenter(centre);
      model.position.sub(centre);

      scene.add(model);
      model.updateMatrixWorld(true);

      // Fix lights & Helpers
      model.traverse((node) => {
        if (node.isSpotLight) {
          const targetPos = new THREE.Vector3(0, 0, -1);
          node.localToWorld(targetPos);
          if (node.target && node.target.parent) node.target.parent.remove(node.target);
          node.target = new THREE.Object3D();
          node.target.position.copy(targetPos);
          scene.add(node.target);
        }

        if (SHOW_LIGHT_HELPERS) {
          if (node.isPointLight) {
            const helper = new THREE.PointLightHelper(node, 0.2);
            scene.add(helper);
            lightHelpers.push(helper);
          } else if (node.isSpotLight) {
            const helper = new THREE.SpotLightHelper(node);
            scene.add(helper);
            lightHelpers.push(helper);
          }
        }
      });

      // ─── SETUP GSAP SCROLL ANIMATION ────────────────────────────────────
      const logo = model.getObjectByName('Logo');
      if (logo) {
        const logoPos = new THREE.Vector3();
        logo.getWorldPosition(logoPos);
        
        // Calculate absolute positions
        const startPos = logoPos.clone().add(CAMERA_SCROLL_CONFIG.startOffset);
        const midPos = logoPos.clone().add(CAMERA_SCROLL_CONFIG.midOffset);
        const endPos = logoPos.clone().add(CAMERA_SCROLL_CONFIG.endOffset);
        const lookTarget = logoPos.clone().add(CAMERA_SCROLL_CONFIG.lookAtOffset);
        
        // Apply Initial Start Values
        camera.position.copy(startPos);
        camera.fov = CAMERA_SCROLL_CONFIG.fov.start;
        camera.updateProjectionMatrix();
        camera.lookAt(lookTarget);

        // Note: Because Javascript is asynchronous, the bloomPass defined at the 
        // bottom of your file is fully accessible here!
        bloomPass.strength = CAMERA_SCROLL_CONFIG.bloom.start;

        // Build the ScrollTrigger Timeline
        const tl = gsap.timeline({
          scrollTrigger: {
            // CRITICAL: Target the parent section in Webflow!
            trigger: ".hero-section", 
            start: "top top",             
            end: CAMERA_SCROLL_CONFIG.scrollDistance,
            scrub: CAMERA_SCROLL_CONFIG.scrubSmoothness, 
            pin: true,                    
          },
          onUpdate: () => camera.lookAt(lookTarget)
        });

        // 1. Camera Position: Start -> Mid (0% to 50%)
        // We use duration: 1 and ease: "none" so it flows smoothly into the next point
        tl.to(camera.position, {
          x: midPos.x, y: midPos.y, z: midPos.z,
          ease: "power1.in", // Smooth acceleration away from start
          duration: 1
        }, 0); // The '0' means start exactly at the beginning of the timeline

        // 2. Camera Position: Mid -> End (50% to 100%)
        tl.to(camera.position, {
          x: endPos.x, y: endPos.y, z: endPos.z,
          ease: "power1.out", // Smooth deceleration into the end
          duration: 1
        }, 1); // The '1' means start after the previous 1-duration tween finishes (exactly 50%)

        // 3. Camera FOV: Start -> End (0% to 100%)
        // We set duration to 2 so it stretches across the ENTIRE animation
        tl.to(camera, {
          fov: CAMERA_SCROLL_CONFIG.fov.end,
          ease: "power2.inOut",
          duration: 2,
          onUpdate: () => camera.updateProjectionMatrix() // Must be called when FOV changes
        }, 0); // Start at the beginning

        // 4. Bloom Strength: Start -> End (0% to 100%)
        tl.to(bloomPass, {
          strength: CAMERA_SCROLL_CONFIG.bloom.end,
          ease: "power2.inOut",
          duration: 2
        }, 0); // Start at the beginning

      } else {
        console.warn("Could not find an object named 'Logo' to focus on!");
      }
      
      // ─── HIDE LOADING SCREEN SAFELY ─────────────────────────────────
      // This looks for your native Webflow preloader OR the custom embed one
      const loader = document.querySelector('.preloader-wrapper') || document.getElementById('custom-loader');
      
      if (loader) {
        gsap.to(loader, {
          opacity: 0,
          duration: 1,
          ease: "power2.inOut",
          onComplete: () => {
            loader.style.display = 'none';
            document.body.style.overflow = ''; // Unlock scrolling
          }
        });
      } else {
        // If no loader exists, just unlock scrolling immediately
        document.body.style.overflow = '';
      }
      // ────────────────────────────────────────────────────────────────

    },
    (xhr) => {
      // Safely update progress text if you have an element with id="loader-progress"
      const progressText = document.getElementById('loader-progress');
      if (progressText) {
        progressText.innerText = `${((xhr.loaded / xhr.total) * 100).toFixed(0)}%`;
      }
    },
    (error) => console.error('GLTFLoader error:', error)
  );
}

// ─── Post-Processing (EffectComposer) ────────────────────────────────────────
const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  samples: FX_CONFIG.msaaSamples,
  type: THREE.HalfFloatType
});

const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
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

// Kickstart
initScene();

// ─── Animation Loop ──────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  if (SHOW_LIGHT_HELPERS) {
    lightHelpers.forEach(helper => helper.update());
  }

  composer.render();
}

animate();
