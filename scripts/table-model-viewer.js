import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const container = document.getElementById('model');
const status = document.getElementById('status');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#20271f');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label', '可拖动旋转、缩放的中式台球桌三维模型');
container.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, .008, 80);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.minDistance = .08;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * .495;
controls.target.set(0, .45, 0);
const environment = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(environment, .04).texture;
environment.dispose();
pmrem.dispose();
scene.environmentIntensity = .55;
scene.add(new THREE.HemisphereLight('#f4eedc', '#1e3022', 1.15));
const key = new THREE.DirectionalLight('#fff2d7', 2.1);
key.position.set(-2, 5, 2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: .1, far: 12 });
key.shadow.bias = -.0001;
key.shadow.normalBias = .003;
scene.add(key);
const fill = new THREE.DirectionalLight('#d9e3e4', .6);
fill.position.set(3, 2, -3);
scene.add(fill);
const legFill = new THREE.DirectionalLight('#eee1cd', .65);
legFill.position.set(2.6, 1.15, -3.1);
scene.add(legFill);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#34392f', roughness: .95 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -.002;
floor.receiveShadow = true;
scene.add(floor);

const views = {
    overview: { position: [3.1, 2.65, -3.5], target: [0, .45, 0], fov: 42 },
    aiming: { position: [0, .99, -1.17], target: [0, .81, .55], fov: 62 },
    corner: { position: [.38, 1.05, -1.02], target: [.65, .815, -1.30], fov: 53 },
    legs: { position: [1.48, .82, -2.02], target: [.58, .35, -1.11], fov: 48 },
    wood: { position: [1.05, 1.19, -.82], target: [.715, .835, -.44], fov: 42 },
    side: { position: [.35, .99, 0], target: [.68, .80, 0], fov: 48 },
};
function selectView(name) {
    const view = views[name];
    camera.position.fromArray(view.position);
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    if (name === 'overview' && model) {
        const bounds = new THREE.Box3().setFromObject(model);
        const target = new THREE.Vector3(...view.target);
        const direction = camera.position.clone().sub(target).normalize();
        const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
        const up = direction.clone().cross(right).normalize();
        const vertical = Math.tan(21 * Math.PI / 180) * .88;
        const horizontal = vertical * camera.aspect;
        let distance = 0;
        for (const x of [bounds.min.x, bounds.max.x]) {
            for (const y of [bounds.min.y, bounds.max.y]) {
                for (const z of [bounds.min.z, bounds.max.z]) {
                    const corner = new THREE.Vector3(x, y, z).sub(target);
                    const depth = corner.dot(direction);
                    distance = Math.max(distance, Math.abs(corner.dot(right)) / horizontal + depth,
                        Math.abs(corner.dot(up)) / vertical + depth);
                }
            }
        }
        camera.position.copy(target).addScaledVector(direction, distance);
        controls.maxDistance = Math.max(12, distance * 1.3);
    }
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
    controls.target.fromArray(view.target);
    controls.update();
    controls.enableDamping = damping;
    for (const button of document.querySelectorAll('[data-view]')) {
        button.setAttribute('aria-pressed', String(button.dataset.view === name));
    }
}
let model;
selectView('overview');
for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => selectView(button.dataset.view));
}
new GLTFLoader().load('./chinese-pool-table.glb?v=sketch-matched-legs-v8', gltf => {
    model = gltf.scene;
    model.traverse(object => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });
    scene.add(model);
    selectView('overview');
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const tableBox = new THREE.Box3();
    model.traverse(object => {
        if (object.isMesh && !object.name.includes('Reference_cue_ball')) tableBox.expandByObject(object);
    });
    let triangles = 0;
    let meshes = 0;
    model.traverse(object => {
        if (!object.isMesh) return;
        meshes++;
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    });
    status.textContent = '模型已加载';
    window.modelReview = { model, renderer, scene, camera, controls, selectView,
        stats: { dimensions: size.toArray(), tableDimensions: tableBox.getSize(new THREE.Vector3()).toArray(), minimum: box.min.toArray(), maximum: box.max.toArray(), meshes, triangles } };
}, progress => {
    status.textContent = progress.total ? `正在加载模型 ${Math.round(progress.loaded / progress.total * 100)}%` : '正在加载模型';
}, error => {
    status.textContent = '模型加载失败，请刷新页面重试';
    console.error(error);
});
document.getElementById('wireframe').addEventListener('change', event => {
    model?.traverse(object => {
        if (!object.isMesh) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.wireframe = event.target.checked;
    });
});
document.getElementById('ball').addEventListener('change', event => {
    model?.traverse(object => {
        if (object.name.includes('Reference_cue_ball')) object.visible = event.target.checked;
    });
});
new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}).observe(container);
renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
});
