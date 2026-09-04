/* ==================================================================
 * 마우스를 따라 기울고 둥둥 떠다니는 3D 에셋
 *
 * 캡처 이미지 한 장이면 동작한다. 밝은 단색 배경(스크린샷)은
 * 브라우저에서 자동으로 투명하게 잘라내므로 별도 도구가 필요 없다.
 * ================================================================== */

const CONFIG = {
  /* 에셋 이미지 경로. 없으면 placeholder.svg 로 대체된다. */
  assetUrl: './images/asset.png',
  fallbackUrl: './images/placeholder.svg',

  /* 배경 제거 — 스크린샷의 단색 배경을 투명하게 만든다.
     enabled: false 로 두면 원본을 그대로 쓴다(이미 투명 PNG인 경우).
     tolerance: 클수록 과감하게 지운다. 배경이 남으면 올리고,
                에셋이 깎이면 내린다. (기본 30, 범위 10~60) */
  removeBackground: true,
  tolerance: 30,

  /* 움직임 */
  tiltX: 11,      // 마우스 상하 → 기울기 (deg)
  tiltY: 15,      // 마우스 좌우 → 회전 (deg)
  driftX: 34,     // 마우스 좌우 → 이동 (px)
  driftY: 22,     // 마우스 상하 → 이동 (px)
  ease: 0.07,     // 따라오는 속도. 작을수록 느긋하고 부드럽다 (0.02~0.15)
  floatAmp: 16,   // 둥둥 뜨는 진폭 (px)
  floatSpeed: 0.8,// 둥둥 뜨는 속도
  swayDeg: 1.6,   // 좌우로 살짝 흔들리는 각도 (deg)
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const root = document.documentElement;
const floaty = document.getElementById('floaty');
const shadow = document.getElementById('shadow');
const sheen = document.getElementById('sheen');
const assetImg = document.getElementById('asset');
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

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  // file:// 로 열면 캔버스가 오염돼 픽셀을 읽을 수 없다 → 원본 사용
  let image;
  try {
    image = ctx.getImageData(0, 0, w, h);
  } catch (err) {
    return false;   // file:// 로 열면 여기로 온다
  }
  const px = image.data;

  // 이미 투명 배경이면 건드리지 않는다
  const cornerAlpha = [0, (w - 1) * 4, (h - 1) * w * 4, (h * w - 1) * 4];
  if (cornerAlpha.every((i) => px[i + 3] < 12)) return null;

  // 네 모서리 색의 평균을 배경색으로 본다
  let br = 0, bg = 0, bb = 0;
  for (const i of cornerAlpha) {
    br += px[i]; bg += px[i + 1]; bb += px[i + 2];
  }
  br /= 4; bg /= 4; bb /= 4;

  const tol2 = tolerance * tolerance * 3;
  const dist2 = (i) => {
    const dr = px[i] - br, dg = px[i + 1] - bg, db = px[i + 2] - bb;
    return dr * dr + dg * dg + db * db;
  };

  // 테두리 픽셀을 씨앗으로 flood fill
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (dist2(p * 4) <= tol2) stack.push(p);
  };

  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  const isBg = new Uint8Array(w * h);
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

  // 경계를 부드럽게: 배경과 맞닿은 픽셀은 색이 배경에 가까운 만큼 반투명하게
  const softened = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    if (isBg[p]) { softened[p] = 0; continue; }
    const x = p % w;
    const y = (p - x) / w;
    const touchesBg =
      (x > 0 && isBg[p - 1]) ||
      (x < w - 1 && isBg[p + 1]) ||
      (y > 0 && isBg[p - w]) ||
      (y < h - 1 && isBg[p + w]);

    if (!touchesBg) { softened[p] = 1; continue; }
    const d = Math.sqrt(dist2(p * 4));
    softened[p] = Math.min(1, Math.max(0, (d - tolerance) / tolerance));
  }

  for (let p = 0; p < w * h; p++) {
    px[p * 4 + 3] = Math.round(px[p * 4 + 3] * softened[p]);
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

/* ------------------------------------------------------------------
 * 에셋 로드
 * ------------------------------------------------------------------ */
function applyAsset(url) {
  assetImg.src = url;
  // 하이라이트가 에셋 실루엣 안에만 보이도록 같은 이미지를 마스크로 쓴다
  root.style.setProperty('--asset-mask', `url("${url}")`);
  assetImg.classList.add('is-ready');
  sheen.classList.add('is-ready');
}

function loadAsset(url, isFallback) {
  const probe = new Image();
  probe.crossOrigin = 'anonymous';

  probe.onload = () => {
    let finalUrl = url;
    if (CONFIG.removeBackground) {
      const cut = cutOutBackground(probe, CONFIG.tolerance);
      if (typeof cut === 'string') {
        finalUrl = cut;
      } else if (cut === false) {
        showNotice(
          '배경을 자동으로 지우지 못했습니다. ' +
          '<code>python3 -m http.server</code> 같은 로컬 서버로 열어주세요. ' +
          '(파일을 더블클릭해 열면 브라우저가 이미지 분석을 차단합니다.)'
        );
      }
    }
    applyAsset(finalUrl);

    if (isFallback) {
      showNotice(
        '지금 보이는 건 임시 에셋입니다. Tripo에서 캡처한 이미지를 ' +
        '<code>web/images/asset.png</code> 로 저장하면 바로 교체됩니다.'
      );
    }
  };

  probe.onerror = () => {
    if (isFallback) return;   // 대체 이미지까지 실패하면 조용히 포기
    loadAsset(CONFIG.fallbackUrl, true);
  };

  probe.src = url;
}

loadAsset(CONFIG.assetUrl, false);

/* ------------------------------------------------------------------
 * 이미지 바로 넣어보기
 *
 * asset.png 로 저장하기 전에 결과를 미리 보고 싶을 때,
 * 파일을 창에 끌어다 놓거나 Ctrl+V 로 붙여넣으면 바로 반영된다.
 * (새로고침하면 다시 asset.png 를 읽는다)
 * ------------------------------------------------------------------ */
function useLocalFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    notice.hidden = true;
    loadAsset(reader.result, false);
  };
  reader.readAsDataURL(file);
}

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  useLocalFile(e.dataTransfer && e.dataTransfer.files[0]);
});

window.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      useLocalFile(item.getAsFile());
      e.preventDefault();
      return;
    }
  }
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
window.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });
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
const SHADOW_OFFSET_VMIN = 26;   // 에셋 중심에서 그림자까지의 거리
const start = performance.now();

function frame(now) {
  const t = (now - start) / 1000;

  // 목표값으로 감쇠 이동 → "따라오는" 느낌의 핵심
  const ease = reduceMotion ? 1 : CONFIG.ease;
  current.x += (target.x - current.x) * ease;
  current.y += (target.y - current.y) * ease;

  root.style.setProperty('--mx', current.x.toFixed(4));
  root.style.setProperty('--my', current.y.toFixed(4));

  // 둥둥 떠다니는 성분
  const bobY = reduceMotion ? 0 : Math.sin(t * CONFIG.floatSpeed) * CONFIG.floatAmp;
  const bobX = reduceMotion ? 0 : Math.cos(t * CONFIG.floatSpeed * 0.7) * CONFIG.floatAmp * 0.35;
  const sway = reduceMotion ? 0 : Math.sin(t * CONFIG.floatSpeed * 0.5) * CONFIG.swayDeg;

  const dx = current.x * CONFIG.driftX + bobX;
  const dy = current.y * CONFIG.driftY + bobY;

  floaty.style.transform =
    `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)` +
    ` rotateX(${(-current.y * CONFIG.tiltX).toFixed(2)}deg)` +
    ` rotateY(${(current.x * CONFIG.tiltY).toFixed(2)}deg)` +
    ` rotateZ(${sway.toFixed(2)}deg)`;

  // 그림자는 반대 방향으로 흐르고, 에셋이 높이 뜰수록 작고 옅어진다
  const lift = (bobY + CONFIG.floatAmp) / (CONFIG.floatAmp * 2); // 0(위) ~ 1(아래)
  const shadowScale = 0.82 + lift * 0.2;
  const shadowX = -current.x * 26 - bobX * 0.6;          // px
  const shadowY = SHADOW_OFFSET_VMIN + current.y * 2.5;  // vmin

  shadow.style.transform =
    `translate(-50%, -50%)` +
    ` translate(${shadowX.toFixed(2)}px, ${shadowY.toFixed(2)}vmin)` +
    ` scale(${shadowScale.toFixed(3)})`;
  shadow.style.opacity = (0.34 + lift * 0.26).toFixed(3);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
