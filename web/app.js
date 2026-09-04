/* ==================================================================
 * 마우스를 따라 기울고 각자 둥둥 떠다니는 3D 에셋
 *
 * 3D 모델 파일 없이 캡처 이미지만으로 동작한다.
 * 글리프를 추가하려면 CONFIG.assets 에 한 줄 더 넣으면 된다.
 * ================================================================== */

const CONFIG = {
  /* 화면에 나란히 놓을 글리프.

     글리프별 편차 — 값을 같게 두면 여러 오브젝트가 한 덩어리처럼
     움직여 어색해진다. 각자 떠 있는 느낌은 이 값들에서 나온다.
       phase / speedMul / ampMul : 부유 위상·주기·진폭
       easeMul                   : 커서를 따라오는 속도 (작을수록 늦게 따라옴)
       tiltMul / driftMul        : 마우스 반응의 크기
       baseRotY / baseRotZ       : 가만히 있을 때의 기본 각도 (deg)
       scale                     : 크기 미세 보정 */
  assets: [
    // M — 기준
    { url: './images/asset-cutout.png',
      alt: '격자 무늬로 부풀어 오른 M 형태의 3D 에셋',
      phase: 0.0, speedMul: 1.00, ampMul: 1.00,
      easeMul: 1.00, tiltMul: 1.00, driftMul: 1.00,
      baseRotY: -5, baseRotZ: -1.5, scale: 1.00 },

    // 1 — 더 느리게 따라오고, 덜 기울고, 기본 각도부터 다르다
    { url: './images/asset-1-cutout.png',
      alt: '파란 얼룩무늬로 부풀어 오른 숫자 1 형태의 3D 에셋',
      phase: 2.1, speedMul: 0.84, ampMul: 1.24,
      easeMul: 0.55, tiltMul: 0.58, driftMul: 0.72,
      baseRotY: 10, baseRotZ: 2.5, scale: 1.02 },
  ],

  /* 배경 제거 — 스크린샷의 단색 배경을 투명하게 만든다.
     위 *-cutout.png 는 배경을 미리 제거해 둔 파일이라 꺼 두었고,
     덕분에 index.html 을 더블클릭해서 열어도 동작한다.
     배경이 있는 새 캡처를 쓸 때만 true 로 바꾸고 로컬 서버로 연다.
     tolerance: 클수록 과감하게 지운다. M 은 34, 1 은 24가 가장 깨끗했다. */
  removeBackground: false,
  tolerance: 30,

  /* 움직임 */
  ease: 0.07,      // 커서를 따라오는 속도 (작을수록 느긋함)
  tilt: 15,        // 최대 기울기 (deg)
  float: 16,       // 부유 진폭 (px)
  driftX: 34,      // 마우스 좌우 → 이동 (px)
  driftY: 22,      // 마우스 상하 → 이동 (px)
  swayDeg: 1.6,    // 좌우로 살짝 흔들리는 각도 (deg)
  speed: 0.8,      // 부유 속도
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const root = document.documentElement;
const row = document.getElementById('row');
const notice = document.getElementById('notice');

function showNotice(html) {
  notice.innerHTML = html;
  notice.hidden = false;
}

/* ------------------------------------------------------------------
 * 배경 제거
 *
 * 테두리에서 시작해 배경색과 비슷한 픽셀을 번져나가며(flood fill)
 * 지운다. 색만 보고 지우는 방식과 달리, 에셋 안쪽에 배경과 같은
 * 색이 있어도 살아남는다.
 *
 * 반환값
 *   문자열 — 배경을 지운 data URL
 *   null   — 지울 필요가 없음 (이미 투명 배경)
 *   false  — 픽셀을 읽을 수 없음 (캔버스 오염). 원본을 그대로 써야 한다.
 * ------------------------------------------------------------------ */
function cutOutBackground(img, tolerance) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  let image;
  try {
    image = ctx.getImageData(0, 0, w, h);
  } catch (err) {
    return false;   // file:// 로 열면 여기로 온다
  }
  const px = image.data;

  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, (h * w - 1) * 4];
  if (corners.every((i) => px[i + 3] < 12)) return null;

  let br = 0, bg = 0, bb = 0;
  for (const i of corners) { br += px[i]; bg += px[i + 1]; bb += px[i + 2]; }
  br /= 4; bg /= 4; bb /= 4;

  const tol2 = tolerance * tolerance * 3;
  const dist2 = (i) => {
    const dr = px[i] - br, dg = px[i + 1] - bg, db = px[i + 2] - bb;
    return dr * dr + dg * dg + db * db;
  };

  const seen = new Uint8Array(w * h);
  const isBg = new Uint8Array(w * h);
  const stack = [];

  const push = (x, y) => {
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (dist2(p * 4) <= tol2) stack.push(p);
  };

  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (stack.length) {
    const p = stack.pop();
    isBg[p] = 1;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  // 경계를 부드럽게: 배경과 맞닿은 픽셀은 배경색에 가까운 만큼 반투명하게
  for (let p = 0; p < w * h; p++) {
    if (isBg[p]) { px[p * 4 + 3] = 0; continue; }
    const x = p % w;
    const y = (p - x) / w;
    const edge =
      (x > 0 && isBg[p - 1]) || (x < w - 1 && isBg[p + 1]) ||
      (y > 0 && isBg[p - w]) || (y < h - 1 && isBg[p + w]);
    if (!edge) continue;
    const d = Math.sqrt(dist2(p * 4));
    const a = Math.min(1, Math.max(0, (d - tolerance) / tolerance));
    px[p * 4 + 3] = Math.round(px[p * 4 + 3] * a);
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

/* ------------------------------------------------------------------
 * 글리프 만들기
 * ------------------------------------------------------------------ */
const slots = CONFIG.assets.map((asset) => {
  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.innerHTML =
    '<div class="cast" aria-hidden="true"></div>' +
    '<div class="floaty"><div class="glyph">' +
    '<img alt="" draggable="false" />' +
    '</div></div>';
  row.appendChild(slot);

  const img = slot.querySelector('img');
  img.alt = asset.alt || '';

  function apply(url) {
    img.src = url;
    img.classList.add('is-ready');
  }

  const probe = new Image();
  probe.onload = () => {
    let url = asset.url;
    if (CONFIG.removeBackground) {
      const cut = cutOutBackground(probe, CONFIG.tolerance);
      if (typeof cut === 'string') {
        url = cut;
      } else if (cut === false) {
        showNotice(
          '배경을 자동으로 지우지 못했습니다. ' +
          '<code>python3 -m http.server</code> 같은 로컬 서버로 열어주세요. ' +
          '(파일을 더블클릭해 열면 브라우저가 이미지 분석을 차단합니다.)'
        );
      }
    }
    apply(url);
  };
  probe.onerror = () => {
    slot.remove();
    showNotice(`이미지를 찾을 수 없습니다: <code>${asset.url}</code>`);
  };
  probe.src = asset.url;

  return {
    floaty: slot.querySelector('.floaty'),
    cast: slot.querySelector('.cast'),
    cur: { x: 0, y: 0 },   // 글리프마다 따로 감쇠 → 반응이 어긋나 각자 움직인다
    phase: asset.phase || 0,
    speedMul: asset.speedMul ?? 1,
    ampMul: asset.ampMul ?? 1,
    easeMul: asset.easeMul ?? 1,
    tiltMul: asset.tiltMul ?? 1,
    driftMul: asset.driftMul ?? 1,
    baseRotY: asset.baseRotY ?? 0,
    baseRotZ: asset.baseRotZ ?? 0,
    scale: asset.scale ?? 1,
  };
});

/* ------------------------------------------------------------------
 * 포인터 입력 — 화면 중심 기준 -1 ~ 1
 * ------------------------------------------------------------------ */
const target = { x: 0, y: 0 };
const current = { x: 0, y: 0 };

function setPointer(clientX, clientY) {
  target.x = (clientX / window.innerWidth) * 2 - 1;
  target.y = (clientY / window.innerHeight) * 2 - 1;
}

window.addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (t) setPointer(t.clientX, t.clientY);
}, { passive: true });

// 커서가 창을 벗어나면 천천히 제자리로
document.addEventListener('mouseleave', () => { target.x = 0; target.y = 0; });

// 모바일: 기기 기울기에도 반응 (권한이 필요한 환경에서는 그냥 무시된다)
window.addEventListener('deviceorientation', (e) => {
  if (e.gamma == null || e.beta == null) return;
  target.x = Math.max(-1, Math.min(1, e.gamma / 35));
  target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 35));
}, { passive: true });

/* ------------------------------------------------------------------
 * 렌더 루프
 * ------------------------------------------------------------------ */
const start = performance.now();

function frame(now) {
  const t = (now - start) / 1000;

  // 배경·워드마크용 기준 좌표 (첫 글리프와 같은 속도)
  const ease = reduceMotion ? 1 : CONFIG.ease;
  current.x += (target.x - current.x) * ease;
  current.y += (target.y - current.y) * ease;

  root.style.setProperty('--mx', current.x.toFixed(4));
  root.style.setProperty('--my', current.y.toFixed(4));

  for (const s of slots) {
    // 글리프마다 감쇠 속도가 달라 커서를 따라오는 타이밍이 어긋난다
    const e = reduceMotion ? 1 : CONFIG.ease * s.easeMul;
    s.cur.x += (target.x - s.cur.x) * e;
    s.cur.y += (target.y - s.cur.y) * e;

    const amp = reduceMotion ? 0 : CONFIG.float * s.ampMul;
    const w = CONFIG.speed * s.speedMul;
    const bobY = Math.sin(t * w + s.phase) * amp;
    const bobX = Math.cos(t * w * 0.7 + s.phase) * amp * 0.35;
    const sway = reduceMotion ? 0 : Math.sin(t * w * 0.5 + s.phase) * CONFIG.swayDeg;

    const dx = s.cur.x * CONFIG.driftX * s.driftMul + bobX;
    const dy = s.cur.y * CONFIG.driftY * s.driftMul + bobY;
    const rx = -s.cur.y * CONFIG.tilt * 0.73 * s.tiltMul;
    const ry = s.cur.x * CONFIG.tilt * s.tiltMul + s.baseRotY;
    const rz = sway + s.baseRotZ;

    s.floaty.style.transform =
      `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)` +
      ` rotateX(${rx.toFixed(2)}deg)` +
      ` rotateY(${ry.toFixed(2)}deg)` +
      ` rotateZ(${rz.toFixed(2)}deg)` +
      ` scale(${s.scale})`;

    // 뜨는 높이: 0(가장 높음) ~ 1(가장 낮음). 그림자는 반대로 반응한다.
    const lift = amp > 0 ? (bobY + amp) / (amp * 2) : 0.5;

    s.cast.style.transform =
      `translateX(-50%)` +
      ` translate(${(-s.cur.x * 20 - bobX * 0.6).toFixed(2)}px, ${(s.cur.y * 6).toFixed(2)}px)` +
      ` scale(${(0.8 + lift * 0.22).toFixed(3)})`;
    s.cast.style.opacity = (0.3 + lift * 0.28).toFixed(3);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
