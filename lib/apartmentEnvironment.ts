// lib/apartmentEnvironment.ts

import * as THREE from 'three';

/**
 * Creates a simple apartment-style room with walls, floor, and basic furniture
 */
export function createApartmentEnvironment(scene: THREE.Scene) {
  const apartment = new THREE.Group();

  // Room dimensions
  const roomWidth = 8;
  const roomDepth = 8;
  const roomHeight = 4;

  // Materials
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8dcc4,
    roughness: 0.9,
    metalness: 0.1,
  });

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xc19a6b,
    roughness: 0.8,
    metalness: 0.1,
  });

  const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.9,
    metalness: 0.1,
  });

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    roughness: 0.7,
    metalness: 0.1,
  });

  const fabricMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Floor
  const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  apartment.add(floor);

  // Ceiling
  const ceiling = new THREE.Mesh(floorGeometry, ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = roomHeight;
  ceiling.receiveShadow = true;
  apartment.add(ceiling);

  // Back wall
  const wallGeometry = new THREE.PlaneGeometry(roomWidth, roomHeight);
  const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
  backWall.position.z = -roomDepth / 2;
  backWall.position.y = roomHeight / 2;
  backWall.receiveShadow = true;
  apartment.add(backWall);

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(roomDepth, roomHeight),
    wallMaterial
  );
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.x = -roomWidth / 2;
  leftWall.position.y = roomHeight / 2;
  leftWall.receiveShadow = true;
  apartment.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(roomDepth, roomHeight),
    wallMaterial
  );
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.x = roomWidth / 2;
  rightWall.position.y = roomHeight / 2;
  rightWall.receiveShadow = true;
  apartment.add(rightWall);

  // Window on back wall
  const windowGeometry = new THREE.PlaneGeometry(2.5, 2);
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: 0x87ceeb,
    transparent: true,
    opacity: 0.6,
  });
  const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
  window1.position.set(0, 2.5, -roomDepth / 2 + 0.01);
  apartment.add(window1);

  // Bookshelf (left wall)
  const shelfGroup = new THREE.Group();
  const shelfWidth = 1.5;
  const shelfHeight = 2.5;
  const shelfDepth = 0.4;

  // Bookshelf frame
  const shelfGeometry = new THREE.BoxGeometry(shelfWidth, shelfHeight, shelfDepth);
  const shelf = new THREE.Mesh(shelfGeometry, woodMaterial);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  shelfGroup.add(shelf);

  // Shelves (horizontal planks)
  for (let i = 0; i < 4; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(shelfWidth - 0.1, 0.05, shelfDepth - 0.05),
      woodMaterial
    );
    plank.position.y = -shelfHeight / 2 + (i + 1) * (shelfHeight / 5);
    plank.castShadow = true;
    shelfGroup.add(plank);
  }

  shelfGroup.position.set(-roomWidth / 2 + 1, shelfHeight / 2, -roomDepth / 2 + 1.5);
  apartment.add(shelfGroup);

  // Couch (right side)
  const couchGroup = new THREE.Group();
  
  // Couch base
  const couchBase = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.6, 1),
    fabricMaterial
  );
  couchBase.castShadow = true;
  couchBase.receiveShadow = true;
  couchGroup.add(couchBase);

  // Couch back
  const couchBack = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.8, 0.2),
    fabricMaterial
  );
  couchBack.position.y = 0.5;
  couchBack.position.z = -0.4;
  couchBack.castShadow = true;
  couchGroup.add(couchBack);

  // Couch arms
  const armGeometry = new THREE.BoxGeometry(0.2, 0.6, 1);
  const leftArm = new THREE.Mesh(armGeometry, fabricMaterial);
  leftArm.position.x = -0.9;
  leftArm.position.y = 0.2;
  leftArm.castShadow = true;
  couchGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeometry, fabricMaterial);
  rightArm.position.x = 0.9;
  rightArm.position.y = 0.2;
  rightArm.castShadow = true;
  couchGroup.add(rightArm);

  couchGroup.position.set(roomWidth / 2 - 1.5, 0.3, -roomDepth / 2 + 2);
  couchGroup.rotation.y = -Math.PI / 4;
  apartment.add(couchGroup);

  // Coffee table (center)
  const tableGroup = new THREE.Group();
  
  // Table top
  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.1, 0.8),
    woodMaterial
  );
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  tableGroup.add(tableTop);

  // Table legs
  const legGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5);
  const legPositions = [
    [-0.65, -0.3, -0.35],
    [0.65, -0.3, -0.35],
    [-0.65, -0.3, 0.35],
    [0.65, -0.3, 0.35],
  ];

  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeometry, woodMaterial);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    tableGroup.add(leg);
  });

  tableGroup.position.set(0.5, 0.55, 0);
  apartment.add(tableGroup);

  // Rug under table
  const rugGeometry = new THREE.PlaneGeometry(3, 2.5);
  const rugMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b7355,
    roughness: 1.0,
  });
  const rug = new THREE.Mesh(rugGeometry, rugMaterial);
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.01;
  rug.position.set(0.5, 0.01, 0);
  rug.receiveShadow = true;
  apartment.add(rug);

  // Lamp (on table)
  const lampGroup = new THREE.Group();
  
  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 0.15),
    woodMaterial
  );
  lampBase.castShadow = true;
  lampGroup.add(lampBase);

  const lampPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.4),
    woodMaterial
  );
  lampPole.position.y = 0.2;
  lampPole.castShadow = true;
  lampGroup.add(lampPole);

  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 0.25, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe4b5, emissive: 0xffcc66, emissiveIntensity: 0.3 })
  );
  lampShade.position.y = 0.45;
  lampShade.castShadow = true;
  lampGroup.add(lampShade);

  // Point light from lamp
  const lampLight = new THREE.PointLight(0xffcc66, 0.5, 3);
  lampLight.position.y = 0.5;
  lampLight.castShadow = true;
  lampGroup.add(lampLight);

  lampGroup.position.set(0.5, 0.65, 0);
  apartment.add(lampGroup);

  scene.add(apartment);
  return apartment;
}

/**
 * Setup apartment lighting
 */
export function setupApartmentLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  // Enable shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Ambient light (soft overall illumination)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Main window light (simulating daylight from window)
  const windowLight = new THREE.DirectionalLight(0xffffff, 0.8);
  windowLight.position.set(0, 3, -3);
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.width = 2048;
  windowLight.shadow.mapSize.height = 2048;
  windowLight.shadow.camera.near = 0.5;
  windowLight.shadow.camera.far = 15;
  windowLight.shadow.camera.left = -5;
  windowLight.shadow.camera.right = 5;
  windowLight.shadow.camera.top = 5;
  windowLight.shadow.camera.bottom = -5;
  scene.add(windowLight);

  // Ceiling light (fill light)
  const ceilingLight = new THREE.PointLight(0xfff5e1, 0.3, 10);
  ceilingLight.position.set(0, 3.5, 0);
  ceilingLight.castShadow = true;
  scene.add(ceilingLight);

  // Warm rim light (from behind/side)
  const rimLight = new THREE.DirectionalLight(0xffcc99, 0.3);
  rimLight.position.set(-3, 2, 2);
  scene.add(rimLight);

  return { ambientLight, windowLight, ceilingLight, rimLight };
}

/**
 * Setup apartment background (visible through window)
 */
export function setupApartmentBackground(scene: THREE.Scene) {
  // Create gradient sky
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 512;
  const context = canvas.getContext('2d')!;
  
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#87ceeb');    // Light blue (sky)
  gradient.addColorStop(0.5, '#b8d4e8'); // Lighter blue
  gradient.addColorStop(1, '#e8f4f8');    // Almost white (horizon)
  
  context.fillStyle = gradient;
  context.fillRect(0, 0, 2, 512);

  const gradientTexture = new THREE.CanvasTexture(canvas);
  gradientTexture.mapping = THREE.EquirectangularReflectionMapping;
  
  scene.background = gradientTexture;
  
  return gradientTexture;
}