import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ------------------------------------------------------------------
 * 설정 — 여기 값만 바꾸면 움직임 성격이 달라집니다.
 * ------------------------------------------------------------------ */
const CONFIG = {
  modelUrl: './models/model.glb',
  fitSize: 2.2,        // 모델을 이 크기로 정규화 (화면 대비 크기)
  tiltX: 0.45,         // 마우스 상하 → 기울기(rad)
  tiltY: 0.75,         // 마우스 좌우 → 회전(rad)
  driftX: 0.55,        // 마우스 좌우 → 좌우 이동
  driftY: 0.35,        // 마우스 상하 → 상하 이동
  parallax: 0.25,      // 카메라가 반대로 살짝 따라가는 양
  ease: 0.055,         // 0에 가까울수록 더 느리고 부드럽게 따라옴
  floatAmp: 0.14,      // 둥둥 뜨는 진폭
  floatSpeed: 0.9,     // 둥둥 뜨는 속도
  spin: 0.06,          // 가만히 둬도 도는 속도(rad/s), 0이면 정지
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('scene');
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');
const hintEl = document.getElementById('hint');

/* ------------------------------------------------------------------
 * 렌더러 / 씬 / 카메라
 * ------------------------------------------------------------------ */
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6);

// HDR 파일 없이도 PBR 재질이 예쁘게 나오도록 절차적 환경맵 사용
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

// 보조 조명 (환경맵만으로는 밋밋할 때 형태를 살려줌)
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(3, 4, 5);
scene.add(key);

const rim = new THREE.DirectionalLight(0x8f7cff, 1.4);
rim.position.set(-4, -1, -3);
scene.add(rim);

scene.add(new THREE.AmbientLight(0xffffff, 0.25));

/* ------------------------------------------------------------------
 * 모델을 담을 그룹
 *  - pivot: 마우스 입력에 반응 (회전/이동)
 *  - inner: 모델의 원점을 바운딩박스 중심으로 옮겨 담는 용도
 * ------------------------------------------------------------------ */
const pivot = new THREE.Group();
scene.add(pivot);

function frameObject(object3d) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const scale = CONFIG.fitSize / maxAxis;

  object3d.position.sub(center);          // 원점을 중심으로
  const inner = new THREE.Group();
  inner.add(object3d);
  inner.scale.setScalar(scale);           // 화면에 맞게 정규화
  pivot.add(inner);
  return inner;
}

/* 모델을 못 찾았을 때 보여줄 임시 도형 (자리 확인용) */
function addPlaceholder() {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x3b6ef5, roughness: 0.35, metalness: 0.1,
  })));
  group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xffffff, wireframe: true, transparent: true, opacity: 0.25,
  })));
  frameObject(group);
}

/* ------------------------------------------------------------------
 * GLB 로드
 * ------------------------------------------------------------------ */
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

let mixer = null;

function hideLoader() {
  loaderEl.classList.add('is-hidden');
}

function showHint(html) {
  hintEl.innerHTML = html;
  hintEl.hidden = false;
}

gltfLoader.load(
  CONFIG.modelUrl,
  (gltf) => {
    frameObject(gltf.scene);

    // Tripo 모델에 애니메이션이 들어있다면 함께 재생
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(gltf.scene);
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    }
    hideLoader();
  },
  (event) => {
    if (event.lengthComputable) {
      const pct = Math.round((event.loaded / event.total) * 100);
      loaderFill.style.width = `${pct}%`;
      loaderText.textContent = `모델 불러오는 중… ${pct}%`;
    }
  },
  () => {
    // 파일이 없거나 file:// 로 열어서 차단된 경우
    addPlaceholder();
    hideLoader();
    showHint(
      'GLB를 아직 못 찾았어요. Tripo에서 내보낸 파일을 ' +
      '<code>web/models/model.glb</code> 로 저장하고, ' +
      '<code>python3 -m http.server</code> 같은 로컬 서버로 열어주세요. ' +
      '(파일을 더블클릭해 열면 브라우저가 GLB 로드를 막습니다.)'
    );
  }
);

/* ------------------------------------------------------------------
 * 포인터 입력 — 화면 중심 기준 -1 ~ 1 로 정규화
 * ------------------------------------------------------------------ */
const target = { x: 0, y: 0 };   // 목표값 (마우스 위치)
const current = { x: 0, y: 0 };  // 실제 적용값 (부드럽게 따라감)

function setPointer(clientX, clientY) {
  target.x = (clientX / window.innerWidth) * 2 - 1;
  target.y = (clientY / window.innerHeight) * 2 - 1;
}

window.addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (t) setPointer(t.clientX, t.clientY);
}, { passive: true });

// 커서가 창을 벗어나면 천천히 원위치
window.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });

// 모바일: 기기 기울기로도 반응 (권한이 필요한 iOS는 조용히 무시)
window.addEventListener('deviceorientation', (e) => {
  if (e.gamma == null || e.beta == null) return;
  target.x = THREE.MathUtils.clamp(e.gamma / 35, -1, 1);
  target.y = THREE.MathUtils.clamp((e.beta - 45) / 35, -1, 1);
}, { passive: true });

/* ------------------------------------------------------------------
 * 리사이즈
 * ------------------------------------------------------------------ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------------
 * 렌더 루프
 * ------------------------------------------------------------------ */
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // 목표값으로 감쇠 이동 → 마우스를 "따라오는" 느낌의 핵심
  const ease = reduceMotion ? 1 : CONFIG.ease;
  current.x += (target.x - current.x) * ease;
  current.y += (target.y - current.y) * ease;

  // 마우스 방향으로 기울이고 이동
  pivot.rotation.y = current.x * CONFIG.tiltY;
  pivot.rotation.x = current.y * CONFIG.tiltX;
  pivot.position.x = current.x * CONFIG.driftX;
  pivot.position.y = -current.y * CONFIG.driftY;

  if (!reduceMotion) {
    pivot.position.y += Math.sin(t * CONFIG.floatSpeed) * CONFIG.floatAmp;      // 둥둥
    pivot.position.x += Math.cos(t * CONFIG.floatSpeed * 0.7) * CONFIG.floatAmp * 0.4;
    pivot.rotation.y += t * CONFIG.spin;                                        // 은근한 자전
    pivot.rotation.z = Math.sin(t * CONFIG.floatSpeed * 0.5) * 0.05;
  }

  // 카메라는 반대로 살짝 — 깊이감(패럴랙스)
  camera.position.x = -current.x * CONFIG.parallax;
  camera.position.y = current.y * CONFIG.parallax;
  camera.lookAt(0, 0, 0);

  if (mixer) mixer.update(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
