# M1 TFT — 부유 에셋 씬

3D 에셋이 화면에 둥둥 떠 있고, 마우스를 움직이는 방향으로 기울며 따라오는 웹 페이지.
두 가지 버전이 들어 있다.

| 파일 | 필요한 것 | 특징 |
|------|-----------|------|
| **`index.html`** | 투명 PNG | 가볍고 즉시 동작. 여러 글리프, 재질별 반응. 뒷면은 볼 수 없음 |
| `model-3d.html` | GLB 모델 파일 | 진짜 3D. 마우스로 돌리면 뒷면까지 보임 |

Tripo 무료 플랜에서 GLB 내보내기가 막히면 `index.html` 쪽을 쓴다.
두 파일은 서로 독립적이다.

## 이미지 버전 (index.html)

### 실행

`index.html` 을 그냥 열면 된다. 서버가 필요 없다.

```bash
# 서버로 열고 싶으면
python3 -m http.server 8000
```

캔버스를 쓰지만 픽셀을 **읽지 않고 그리기만** 하므로 `file://` 에서도
오염(`SecurityError`) 문제가 없다. 픽셀을 읽던 이전 버전(배경 자동 제거)은
로컬 서버가 필요했는데, 지금 에셋은 원본이 이미 투명 PNG 라서 그 코드를 빼고
캔버스는 합성에만 쓴다.

### 이미지

`web/images/` 에 M(털)과 1(크롬)이 있다. 원본과, 글리프 경계에 맞춰 크롭한
`*-cutout.png` 가 한 쌍이고 페이지는 cutout 을 읽는다. 자세한 규칙은
`web/images/README.md` 참고.

### 재질 반응

정지 이미지 한 장이라 진짜 물리 시뮬레이션은 아니다. 다음 두 가지로 흉내낸다.

**털 (`material: 'fur'`)** — 커서를 움직이면 진행 방향의 반대로 잔상을 흘린다.
캔버스 `destination-over` 로 **실루엣 바깥에만** 깔리므로 몸통 질감은 그대로 남고
털끝만 날리는 것처럼 보인다. 몸통도 `skewX` 로 살짝 기운다.

**크롬 (`material: 'chrome'`)** — 커서 위치에 따라 하이라이트가 움직인다.
캔버스 `source-atop` 이라 글리프 알파에 자동으로 잘린다. CSS `mask-image` 로
같은 걸 하면 마스크가 안 먹는 환경에서 사각형이 새어 나온다(실제로 겪었다).

| 값 (`MATERIALS`) | 의미 |
|------|------|
| `pad` | 잔상이 번질 여백. 이미지 높이 대비 비율 |
| `fringeSteps` / `fringeAlpha` / `fringeBlur` | 잔상 겹수 · 진하기 · 흐림 |
| `fringeReach` | 커서 속도에 비례해 잔상이 뻗는 거리(px) |
| `fringeIdle` | 커서를 멈춰도 흔들리는 폭(px) |
| `windDeg` | 커서 속도에 따라 몸통이 기우는 전단각(deg) |
| `spec` / `specR` | 하이라이트 세기 · 반경(캔버스 폭 대비) |

`pad` 를 늘리면 `app.css` 의 `.row { gap }` 음수값도 같이 조여야 자간이 맞는다.

### 움직임

`app.js` 의 `MOTION` 이 두 글리프의 공통 기준이다.

| 값 | 의미 |
|----|------|
| `ease` | 커서를 따라오는 속도. 작을수록 느긋하다 (0.02~0.15) |
| `tilt` | 최대 기울기(deg) |
| `float` / `speed` | 부유 진폭과 속도 |
| `driftX` / `driftY` | 마우스를 따라 이동하는 거리(px) |
| `swayDeg` | 좌우로 흔들리는 각도 |

글리프별 편차는 `GLYPHS` 에 있다. 마우스 반응은 모두 함께, 부유는 각자다.
`phase` / `speedMul` / `ampMul` / `easeMul` / `tiltMul` / `driftMul` /
`baseRotY` / `baseRotZ` / `scale` 을 글리프마다 다르게 줘야 한 덩어리처럼
흔들리지 않는다.

에셋 크기는 `app.css` 의 `--glyph-h`, 제목 문구는 `index.html` 의 `.wordmark`.

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

## GLB 버전 (model-3d.html)

Tripo 에서 **GLB** 로 내보내(텍스처는 2k 권장) `web/models/model.glb` 로 저장하면
동작한다. GLB 는 로컬 서버로 열어야 한다. 움직임 값은 `main.js` 상단 `CONFIG`.

three.js 는 CDN(jsDelivr)에서 불러오므로 `npm install` 이 필요 없다.

## 공통 사항

- **다크 한 가지로 확정했다.** 보는 사람이 OS 라이트 모드를 쓰더라도 같은
  어두운 톤으로 보인다. `prefers-color-scheme` 분기를 두지 않고 `:root` 에
  값을 직접 박고 `color-scheme: dark` 를 선언해 두었다. 색을 바꿀 일이 있으면
  `app.css` 의 `:root` 한 곳만 고치면 된다.
- 모바일에서는 터치 이동과 기기 기울기에도 반응한다.
- OS 의 "동작 줄이기(prefers-reduced-motion)" 설정을 켜면 부유·잔상이 멈춘다.
- 배포는 `web/` 폴더를 GitHub Pages / Netlify / Vercel 에 그대로 올리면 된다.
