# 3D 에셋 인터랙티브 씬

3D 에셋이 화면에 둥둥 떠 있고, 마우스를 움직이는 방향으로 기울며 따라오는 웹 페이지.
두 가지 버전이 들어 있다.

| 파일 | 필요한 것 | 특징 |
|------|-----------|------|
| **`index.html`** | 캡처 이미지 (PNG/JPG) | 가볍고 즉시 동작. 여러 글리프 지원. 뒷면은 볼 수 없음 |
| `model-3d.html` | GLB 모델 파일 | 진짜 3D. 마우스로 돌리면 뒷면까지 보임 |

Tripo 무료 플랜에서 GLB 내보내기가 막히면 `index.html` 쪽을 쓰면 된다.
나중에 GLB를 구하면 `model-3d.html` 로 넘어가면 되고, 두 파일은 서로 독립적이다.

## 이미지 버전 (index.html)

### 1. 이미지

`web/images/` 에 M 과 숫자 1 이 들어 있다. 각각 Tripo 캡처 원본과,
배경을 제거해 둔 `*-cutout.png` 가 한 쌍이다. 페이지는 cutout 쪽을 읽는다.

배경 제거는 이미지 테두리에서 시작해 배경색과 비슷한 픽셀만 번져나가며
지우는 방식(flood fill)이라, 에셋 **안쪽**에 같은 색이 있어도 남는다.
M 은 강도 34, 1 은 24가 가장 깨끗했다.

글리프를 추가하거나 바꾸는 방법은 `web/images/README.md` 에 있다.

### 2. 실행

배경 제거가 꺼져 있으므로 `index.html` 을 그냥 열면 된다.

배경이 있는 새 캡처를 쓰려고 `removeBackground: true` 로 바꿨을 때만
로컬 서버가 필요하다. 이미지 픽셀을 읽어야 하는데, 파일을 더블클릭해 열면
브라우저 보안 정책이 이를 막기 때문이다.

```bash
cd web
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
```

### 3. 움직임 조절

`app.js` 상단 `CONFIG` 값만 바꾸면 된다.

| 값 | 의미 |
|----|------|
| `tiltX` / `tiltY` | 마우스 상하·좌우에 따라 기울어지는 각도(deg) |
| `driftX` / `driftY` | 마우스를 따라 이동하는 거리(px) |
| `ease` | 따라오는 속도. 작을수록 느긋하고 부드럽다 (0.02~0.15) |
| `floatAmp` / `floatSpeed` | 둥둥 떠다니는 진폭과 속도 |
| `swayDeg` | 좌우로 흔들리는 각도 |
| `speed` | 부유 속도 |
| `removeBackground` | 배경 자동 제거 on/off (`*-cutout.png` 쓸 때는 off) |

마우스 반응은 모든 글리프가 함께, 부유는 각자다. 글리프별 `phase` /
`speedMul` / `ampMul` 로 위상과 주기를 어긋나게 두는데, 이 값을 같게 하면
나란히 놓인 글리프들이 한 덩어리처럼 흔들려 어색해진다.

에셋 크기는 `app.css` 의 `--glyph-h`, 글리프 간격은 `.row` 의 `gap`,
제목 문구는 각 HTML 의 `.wordmark` 에서 바꾼다.

## GLB 버전 (model-3d.html)

### Tripo 내보내기 설정

| 항목 | 선택 |
|------|------|
| 포맷 | **GLB** (메시 + 재질 + 텍스처가 한 파일에 들어감) |
| 텍스처 해상도 | **2k 권장**. 4k는 유료로 막히는 경우가 있고 로딩도 느리다 |

내려받은 파일을 `web/models/model.glb` 로 저장하고 위와 같이 로컬 서버로 열면 된다.
움직임 값은 `main.js` 상단 `CONFIG` 에 있다.

three.js는 CDN(jsDelivr)에서 불러오므로 `npm install` 이 필요 없다.

## 제목 서체

`M1 TFT` 워드마크는 **Montserrat** 로 그린다. 원래 요청은 고담(Gotham)이었지만
고담은 Hoefler & Co. 의 유료 상업 서체라 Google Fonts 에 없고, 라이선스 없이
웹에 올릴 수 없다. Montserrat 은 고담 대체로 가장 널리 쓰이는 무료 서체다.

고담 라이선스(웹폰트 키트)를 보유했다면 폰트 파일을 `web/fonts/` 에 넣고
`app.css` 위쪽에 아래를 추가한 뒤, `.wordmark` 의 `font-family` 맨 앞을
`"Gotham"` 으로 바꾸면 된다.

```css
@font-face {
  font-family: "Gotham";
  src: url("./fonts/Gotham-Bold.woff2") format("woff2");
  font-weight: 700;
  font-display: swap;
}
```

## 공통 사항

- 모바일에서는 터치 이동과 기기 기울기에도 반응한다.
- OS의 "동작 줄이기(prefers-reduced-motion)" 설정을 켜면 부유 애니메이션이 멈춘다.
- 배포는 `web/` 폴더를 GitHub Pages / Netlify / Vercel 에 그대로 올리면 된다.
