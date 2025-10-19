// lib/hdriApartmentEnvironment.ts
// This is an OPTIONAL premium version using HDRI for photorealistic apartment lighting

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

/**
 * Load HDRI environment for photorealistic apartment lighting
 * You can download free HDRIs from:
 * - https://polyhaven.com/hdris/indoor
 * - https://hdrihaven.com/
 * 
 * Recommended HDRIs for apartment:
 * - "apartment" by Greg Zaal
 * - "studio_small_03" 
 * - "lebombo"
 * - "modern_buildings_2"
 * 
 * Place your .hdr file in public/hdri/ folder
 */
export async function loadHDRIApartment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  hdriPath: string = '/hdri/apartment.hdr'
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    // Configure renderer for HDR
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const rgbeLoader = new RGBELoader();
    
    rgbeLoader.load(
      hdriPath,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        
        // Set as environment (for lighting and reflections)
        scene.environment = texture;
        
        // Optionally set as background (visible sky)
        scene.background = texture;
        
        console.log('HDRI apartment loaded successfully');
        resolve(texture);
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100;
        console.log(`Loading HDRI: ${percent.toFixed(0)}%`);
      },
      (error) => {
        console.error('Failed to load HDRI:', error);
        reject(error);
      }
    );
  });
}

/**
 * Setup hybrid approach: HDRI for lighting + 3D apartment geometry
 * This gives you the best of both worlds:
 * - Photorealistic lighting from HDRI
 * - Interactive 3D geometry for depth and occlusion
 */
export async function setupHybridApartment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  hdriPath: string = '/hdri/apartment.hdr'
) {
  try {
    // Load HDRI for lighting
    const hdriTexture = await loadHDRIApartment(scene, renderer, hdriPath);
    
    // Add subtle ambient light as backup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    
    return { hdriTexture, ambientLight };
  } catch (error) {
    console.warn('HDRI failed to load, falling back to standard lighting');
    
    // Fallback to standard lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 5);
    
    scene.add(ambientLight);
    scene.add(directionalLight);
    
    return { hdriTexture: null, ambientLight, directionalLight };
  }
}

/**
 * Blur HDRI background while keeping sharp environment lighting
 * Useful for making the character stand out more
 */
export function blurHDRIBackground(
  scene: THREE.Scene,
  texture: THREE.Texture,
  blurAmount: number = 0.5
) {
  // Clone texture for background
  const blurredTexture = texture.clone();
  blurredTexture.needsUpdate = true;
  
  // Keep original for environment lighting
  scene.environment = texture;
  
  // Use blurred version for background
  scene.background = blurredTexture;
  
  // Note: Actual blur would require post-processing or pre-blurred texture
  // This is a simplified version. For real blur, use PMREMGenerator or post-processing
  
  return blurredTexture;
}

/**
 * Adjust HDRI exposure dynamically
 * Useful for matching character brightness
 */
export function adjustHDRIExposure(
  renderer: THREE.WebGLRenderer,
  exposure: number
) {
  renderer.toneMappingExposure = exposure;
}

/**
 * Create a simple ground plane that receives HDRI lighting
 * This helps ground the character in the space
 */
export function createHDRIGroundPlane(scene: THREE.Scene, size: number = 10) {
  const geometry = new THREE.CircleGeometry(size, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.1,
  });
  
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  
  scene.add(ground);
  
  return ground;
}

/**
 * Instructions for getting free HDRI files:
 * 
 * 1. Go to https://polyhaven.com/hdris/indoor
 * 2. Download an indoor HDRI (choose 2K or 4K resolution)
 * 3. Place the .hdr file in your public/hdri/ folder
 * 4. Update the hdriPath in your component
 * 
 * Recommended apartment HDRIs (free):
 * - "apartment" - Modern apartment with large windows
 * - "studio_small_03" - Small studio with warm lighting  
 * - "lebombo" - Bright indoor space
 * - "modern_buildings_2" - Office-like environment
 * 
 * Example usage in your component:
 * 
 * import { loadHDRIApartment } from '../lib/hdriApartmentEnvironment';
 * 
 * useEffect(() => {
 *   if (showHDRI) {
 *     loadHDRIApartment(scene, renderer, '/hdri/apartment.hdr')
 *       .then(() => console.log('HDRI loaded!'))
 *       .catch(() => console.log('Failed to load HDRI'));
 *   }
 * }, [showHDRI, scene, renderer]);
 */