import * as THREE from 'three';

const container = document.getElementById('canvas-container');

// Scene setup
const scene = new THREE.Scene();
// Fog to blend into background
scene.fog = new THREE.FogExp2(0x0a0e17, 0.05);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;
camera.position.y = 1;
camera.rotation.x = -0.2;

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Load Textures
const textureLoader = new THREE.TextureLoader();
const zcashTexture = textureLoader.load('/assets/zcash.png');
const bitcoinTexture = textureLoader.load('/assets/bitcoin.png');

// Create Floating Coins
const coinGeometry = new THREE.PlaneGeometry(1.5, 1.5);
const zcashMaterial = new THREE.MeshBasicMaterial({ map: zcashTexture, transparent: true, side: THREE.DoubleSide });
const bitcoinMaterial = new THREE.MeshBasicMaterial({ map: bitcoinTexture, transparent: true, side: THREE.DoubleSide });

const zcashCoin = new THREE.Mesh(coinGeometry, zcashMaterial);
zcashCoin.position.set(2, 2, -2);
scene.add(zcashCoin);

const bitcoinCoin = new THREE.Mesh(coinGeometry, bitcoinMaterial);
bitcoinCoin.position.set(-2, 1, -3);
scene.add(bitcoinCoin);

// Geometry - Floating Particles
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 2000;

const posArray = new Float32Array(particlesCount * 3);

for (let i = 0; i < particlesCount * 3; i++) {
    // Spread particles across a wide area
    posArray[i] = (Math.random() - 0.5) * 15;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

// Material - Zcash Gold
const material = new THREE.PointsMaterial({
    size: 0.02,
    color: 0xf3b72e,
    transparent: true,
    opacity: 0.8,
});

// Create Mesh
const particlesMesh = new THREE.Points(particlesGeometry, material);
scene.add(particlesMesh);

// Add a flowing wireframe terrain below
const terrainGeometry = new THREE.PlaneGeometry(30, 30, 64, 64);
const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    wireframe: true,
    roughness: 0.5,
    metalness: 0.8
});
const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrain.rotation.x = -Math.PI / 2;
terrain.position.y = -2;
scene.add(terrain);

// Lights
const pointLight = new THREE.PointLight(0xf3b72e, 2);
pointLight.position.set(2, 3, 4);
scene.add(pointLight);

const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
scene.add(ambientLight);


// Animation variables
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;

const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
});

const clock = new THREE.Clock();

function animate() {
    const elapsedTime = clock.getElapsedTime();

    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    // Smooth camera movement
    particlesMesh.rotation.y += 0.5 * (targetX - particlesMesh.rotation.y);
    particlesMesh.rotation.x += 0.05 * (targetY - particlesMesh.rotation.x);

    // Animate particles
    particlesMesh.rotation.y += 0.002;

    // Animate Coins
    zcashCoin.rotation.y = Math.sin(elapsedTime * 0.5) * 0.2;
    zcashCoin.position.y = 2 + Math.sin(elapsedTime * 0.8) * 0.2;

    bitcoinCoin.rotation.y = Math.sin(elapsedTime * 0.4 + 1) * 0.2;
    bitcoinCoin.position.y = 1 + Math.sin(elapsedTime * 0.7 + 1) * 0.2;


    // Animate terrain waves
    const positionAttribute = terrainGeometry.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i); // Note: in PlaneGeometry, y is the 2nd dim, but after rotation it acts as Z

        // Create wave effect
        const z = 0.5 * Math.sin(x * 0.5 + elapsedTime) + 0.3 * Math.cos(y * 0.3 + elapsedTime);
        positionAttribute.setZ(i, z);
    }
    positionAttribute.needsUpdate = true;
    terrainGeometry.computeVertexNormals();


    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
