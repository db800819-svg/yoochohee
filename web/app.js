/* ==================================================================
 * 마우스를 따라 기울고 각자 둥둥 떠다니는 3D 에셋
 *
 * 3D 모델 파일 없이 투명 PNG 만으로 동작한다. 재질에 따라 커서 반응이
 * 다르다 — 털은 실루엣 밖으로 잔상이 날리고, 크롬은 하이라이트가 움직인다.
 *
 * 조절할 곳
 *   MOTION    : 두 글리프가 공유하는 기본 움직임
 *   MATERIALS : 재질별 반응 (털 날림 / 금속 반짝임)
 *   GLYPHS    : 글리프 목록과 개별 편차
 * ================================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const row = document.getElementById('row');

/* ============================================================
 * 움직임 — 두 글리프가 공유하는 기준값
 * ============================================================ */
const MOTION = {
  ease: 0.07,       // 커서를 따라오는 속도 (작을수록 느긋함)
  tilt: 15,         // 최대 기울기 (deg)
  float: 16,        // 부유 진폭 (px)
  driftX: 34,
  driftY: 22,
  swayDeg: 1.6,
  speed: 0.8,
};

/* ============================================================
 * 재질 — 커서에 반응하는 방식이 재질마다 다르다
 *
 * fringe : 실루엣 "밖"으로 흘리는 잔상. 몸통은 건드리지 않으므로
 *          털이 뭉개지지 않고 털끝만 날리는 것처럼 보인다.
 * spec   : 캔버스 source-atop 하이라이트. 알파에 자동으로 잘려서
 *          CSS 마스크와 달리 사각형이 새어 나올 수 없다.
 * ============================================================ */
const MATERIALS = {
  fur: {
    pad: 0.09,           // 잔상이 번질 여백 (이미지 높이 대비)
    fringeSteps: 5,      // 잔상 겹수
    fringeReach: 44,     // 커서 속도 1 당 잔상이 뻗는 거리 (px)
    fringeIdle: 3.2,     // 가만히 있을 때도 흔들리는 폭 (px)
    fringeAlpha: 0.5,    // 잔상 진하기
    fringeBlur: 3,       // 잔상 흐림 (px)
    windDeg: 7,          // 커서 속도에 따라 기우는 전단각 (deg)
    spec: 0.16,          // 하이라이트 세기
    specR: 0.62,         // 하이라이트 반경 (캔버스 폭 대비)
  },
  chrome: {
    pad: 0.02,
    fringeSteps: 0,      // 매끈한 재질이라 잔상 없음
    fringeReach: 0,
    fringeIdle: 0,
    fringeAlpha: 0,
    fringeBlur: 0,
    windDeg: 0,
    spec: 0.62,          // 크롬은 하이라이트가 백색으로 터진다
    specR: 0.26,         // 좁고 날카롭게
  },
};

/* ============================================================
 * 글리프 정의
 *
 * 글리프별 편차 — 값을 같게 두면 한 덩어리처럼 움직여 어색해진다.
 * ============================================================ */
const GLYPHS = [
  { src: './images/asset-cutout.png', alt: '파란 털 질감의 M 형태 3D 에셋', material: 'fur',
    phase: 0.0, speedMul: 1.00, ampMul: 1.00,
    easeMul: 1.00, tiltMul: 1.00, driftMul: 1.00,
    baseRotY: -5, baseRotZ: -1.5, scale: 1.00 },

  { src: './images/asset-1-cutout.png', alt: '파란 얼룩무늬 크롬 재질의 숫자 1 형태 3D 에셋', material: 'chrome',
    phase: 2.1, speedMul: 0.84, ampMul: 1.24,
    easeMul: 0.55, tiltMul: 0.58, driftMul: 0.72,
    baseRotY: 10, baseRotZ: 2.5, scale: 1.02 },
];

// ctx.filter 은 아직 브라우저마다 다르다 — 없으면 잔상을 흐림 없이 그린다
const canBlur = (() => {
  const c = document.createElement('canvas').getContext('2d');
  return !!c && 'filter' in c;
})();

const slots = GLYPHS.map((g) => {
  const mat = MATERIALS[g.material];

  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.innerHTML =
    '<div class="cast" aria-hidden="true"></div>' +
    '<div class="floaty"><div class="glyph"><canvas></canvas></div></div>';
  row.appendChild(slot);

  const canvas = slot.querySelector('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', g.alt);
  const ctx = canvas.getContext('2d');

  const s = {
    floaty: slot.querySelector('.floaty'),
    cast: slot.querySelector('.cast'),
    canvas, ctx, mat,
    img: null,
    soft: null,   // 잔상용 흐린 사본 (로드 시 1회 생성)
    pad: 0,
    cur: { x: 0, y: 0 },   // 글리프마다 따로 감쇠 → 반응이 어긋나 각자 움직인다
    vel: { x: 0, y: 0 },   // 커서를 얼마나 뒤쫓고 있는지 = 체감 속도
    ...g,
  };

  const img = new Image();
  img.onload = () => {
    s.img = img;
    s.pad = Math.round(img.naturalHeight * mat.pad);
    canvas.width = img.naturalWidth + s.pad * 2;
    canvas.height = img.naturalHeight + s.pad * 2;
    // 여백이 붙어도 글리프 자체 크기는 --glyph-h 를 유지하도록 보정
    const grow = canvas.height / img.naturalHeight;
    canvas.style.height = `calc(var(--glyph-h) * ${grow.toFixed(4)})`;

    /* 잔상용 흐린 사본을 여기서 한 번만 만든다.
       매 프레임 ctx.filter 로 블러를 걸면 겹수만큼 비용이 붙어
       프레임이 떨어진다. */
    if (mat.fringeSteps > 0 && mat.fringeBlur > 0 && canBlur) {
      const off = document.createElement('canvas');
      off.width = canvas.width;
      off.height = canvas.height;
      const octx = off.getContext('2d');
      octx.filter = `blur(${mat.fringeBlur}px)`;
      octx.drawImage(img, s.pad, s.pad);
      s.soft = off;
    }
  };
  img.src = g.src;

  return s;
});

/* ============================================================
 * 글리프 한 장 그리기
 * ============================================================ */
function paint(s, t) {
  if (!s.img) return;
  const { ctx, canvas, mat, img, pad } = s;
  const W = canvas.width, H = canvas.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';

  // 1) 몸통 — 원본 그대로. 이 위에 아무것도 덧그리지 않아 질감이 살아 있다.
  ctx.drawImage(img, pad, pad);

  // 2) 잔상 — 실루엣 밖에만 남도록 destination-over 로 "뒤에" 깐다
  if (mat.fringeSteps > 0 && !reduceMotion) {
    const speed = Math.hypot(s.vel.x, s.vel.y);
    // 여백(pad)을 넘으면 잔상이 직선으로 잘려 보이므로 속도를 1 로 묶는다
    const reach = Math.min(speed, 1) * mat.fringeReach;

    // 커서가 멈춰 있어도 천천히 흔들린다
    const idleX = Math.sin(t * 1.7 + s.phase) * mat.fringeIdle;
    const idleY = Math.cos(t * 1.3 + s.phase) * mat.fringeIdle * 0.6;

    // 털은 진행 방향의 반대로 끌린다
    const dirX = speed > 0.001 ? -s.vel.x / speed : 0;
    const dirY = speed > 0.001 ? -s.vel.y / speed : 0;

    // 흐린 사본은 이미 pad 만큼 옮겨 그려져 있으므로 기준점이 0 이다
    const src = s.soft || img;
    const baseX = s.soft ? 0 : pad;
    const baseY = s.soft ? 0 : pad;

    ctx.globalCompositeOperation = 'destination-over';

    for (let i = 1; i <= mat.fringeSteps; i++) {
      const k = i / mat.fringeSteps;
      ctx.globalAlpha = mat.fringeAlpha * (1 - k) ** 1.4;
      ctx.drawImage(
        src,
        baseX + dirX * reach * k + idleX * k,
        baseY + dirY * reach * k + idleY * k
      );
    }

    ctx.globalAlpha = 1;
  }

  // 3) 하이라이트 — source-atop 이라 글리프 알파 안쪽에만 칠해진다
  if (mat.spec > 0) {
    const cx = W * (0.5 + s.cur.x * 0.42);
    const cy = H * (0.5 + s.cur.y * 0.42);
    const r = W * mat.specR;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(255,255,255,${mat.spec})`);
    grad.addColorStop(0.32, `rgba(226,238,255,${mat.spec * 0.3})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
}

/* ============================================================
 * 포인터
 * ============================================================ */
const target = { x: 0, y: 0 };
const current = { x: 0, y: 0 };

function setPointer(clientX, clientY) {
  target.x = (clientX / window.innerWidth) * 2 - 1;
  target.y = (clientY / window.innerHeight) * 2 - 1;
}

window.addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
window.addEventListener('touchmove', (e) => {
  const p = e.touches[0];
  if (p) setPointer(p.clientX, p.clientY);
}, { passive: true });
document.addEventListener('mouseleave', () => { target.x = 0; target.y = 0; });

// 모바일: 기기 기울기에도 반응
window.addEventListener('deviceorientation', (e) => {
  if (e.gamma == null || e.beta == null) return;
  target.x = Math.max(-1, Math.min(1, e.gamma / 35));
  target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 35));
}, { passive: true });

/* ============================================================
 * 렌더 루프
 * ============================================================ */
const start = performance.now();

function frame(now) {
  const t = (now - start) / 1000;

  // 배경·워드마크용 기준 좌표
  const ease = reduceMotion ? 1 : MOTION.ease;
  current.x += (target.x - current.x) * ease;
  current.y += (target.y - current.y) * ease;
  root.style.setProperty('--mx', current.x.toFixed(4));
  root.style.setProperty('--my', current.y.toFixed(4));

  for (const s of slots) {
    // 글리프마다 감쇠 속도가 달라 커서를 따라오는 타이밍이 어긋난다
    const e = reduceMotion ? 1 : MOTION.ease * s.easeMul;
    // 목표까지 남은 거리 = 체감 속도. 커서를 멈추면 자연히 0 으로 잦아든다.
    s.vel.x = target.x - s.cur.x;
    s.vel.y = target.y - s.cur.y;
    s.cur.x += s.vel.x * e;
    s.cur.y += s.vel.y * e;

    const amp = reduceMotion ? 0 : MOTION.float * s.ampMul;
    const w = MOTION.speed * s.speedMul;
    const bobY = Math.sin(t * w + s.phase) * amp;
    const bobX = Math.cos(t * w * 0.7 + s.phase) * amp * 0.35;
    const sway = reduceMotion ? 0 : Math.sin(t * w * 0.5 + s.phase) * MOTION.swayDeg;

    const dx = s.cur.x * MOTION.driftX * s.driftMul + bobX;
    const dy = s.cur.y * MOTION.driftY * s.driftMul + bobY;
    const rx = -s.cur.y * MOTION.tilt * 0.73 * s.tiltMul;
    const ry = s.cur.x * MOTION.tilt * s.tiltMul + s.baseRotY;
    const rz = sway + s.baseRotZ;
    // 털은 움직이는 방향으로 몸통까지 살짝 기운다 (바람 맞은 것처럼)
    const skew = reduceMotion ? 0 : -s.vel.x * s.mat.windDeg;

    s.floaty.style.transform =
      `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)` +
      ` rotateX(${rx.toFixed(2)}deg)` +
      ` rotateY(${ry.toFixed(2)}deg)` +
      ` rotateZ(${rz.toFixed(2)}deg)` +
      ` skewX(${skew.toFixed(2)}deg)` +
      ` scale(${s.scale})`;

    // 뜨는 높이: 0(가장 높음) ~ 1(가장 낮음). 그림자는 반대로 반응한다.
    const lift = amp > 0 ? (bobY + amp) / (amp * 2) : 0.5;
    s.cast.style.transform =
      `translateX(-50%)` +
      ` translate(${(-s.cur.x * 20 - bobX * 0.6).toFixed(2)}px, ${(s.cur.y * 6).toFixed(2)}px)` +
      ` scale(${(0.8 + lift * 0.22).toFixed(3)})`;
    s.cast.style.opacity = (0.3 + lift * 0.28).toFixed(3);

    paint(s, t);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
