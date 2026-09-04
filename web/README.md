# 3D 에셋 인터랙티브 씬

3D 에셋이 화면에 둥둥 떠 있고, 마우스를 움직이는 방향으로 기울며 따라오는 웹 페이지.
두 가지 버전이 들어 있다.

| 파일 | 필요한 것 | 특징 |
|------|-----------|------|
| **`index.html`** | 캡처 이미지 1장 (PNG/JPG) | 가볍고 즉시 동작. 배경 자동 제거. 뒷면은 볼 수 없음 |
| `model-3d.html` | GLB 모델 파일 | 진짜 3D. 마우스로 돌리면 뒷면까지 보임 |

Tripo 무료 플랜에서 GLB 내보내기가 막히면 `index.html` 쪽을 쓰면 된다.
나중에 GLB를 구하면 `model-3d.html` 로 넘어가면 되고, 두 파일은 서로 독립적이다.

## 이미지 버전 (index.html)

### 1. 이미지 넣기

`web/images/` 에 두 개가 들어 있다.

| 파일 | 설명 |
|------|------|
| `asset-cutout.png` | 배경을 미리 제거해 둔 버전. **기본값으로 이걸 쓴다** |
| `asset.png` | Tripo 캡처 원본 (배경 `#EBEBEB`) |

기본 설정은 `asset-cutout.png` 를 읽고 배경 제거를 건너뛰므로,
**`index.html` 을 더블클릭해서 열어도 바로 동작한다.**

다른 에셋으로 바꿀 때는 새로 캡처한 이미지를 `web/images/asset.png` 로 저장하고
`app.js` 에서 아래처럼 바꾼 뒤 로컬 서버로 열면 된다.

```js
assetUrl: './images/asset.png',
removeBackground: true,
```

배경이 단색(흰색·회색 등)이면 페이지가 **브라우저에서 자동으로 배경을 지운다.**
별도 프로그램이나 배경 제거 사이트가 필요 없다.

원리: 이미지 테두리에서 시작해 배경색과 비슷한 픽셀을 번져나가며(flood fill) 투명하게
만든다. 색만 비교하는 방식과 달리 에셋 안쪽에 배경과 같은 색이 있어도 지워지지 않는다.

배경이 조금 남거나 에셋이 깎이면 `app.js` 의 `CONFIG.tolerance` 를 조절한다.

| 증상 | 조치 |
|------|------|
| 배경이 남는다 | `tolerance` 를 올린다 (30 → 42) |
| 에셋 가장자리가 깎인다 | `tolerance` 를 내린다 (30 → 20) |
| 이미 투명 PNG다 | 그대로 두면 자동으로 건너뛴다 |

저장하기 전에 결과를 먼저 보고 싶으면, 페이지를 열어둔 상태에서 이미지 파일을
**창에 끌어다 놓거나 `Ctrl+V` 로 붙여넣으면** 바로 반영된다. 새로고침하면
다시 `images/asset.png` 를 읽는다.

### 2. 실행

기본 설정(`asset-cutout.png`)이면 `index.html` 을 그냥 열면 된다.

배경 제거를 켤 때만 로컬 서버가 필요하다. 이미지 픽셀을 읽어야 하는데,
파일을 더블클릭해 열면 브라우저 보안 정책이 이를 막기 때문이다.

```bash
cd web
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
```

Node가 있으면 `npx serve web` 도 동일하다.

### 3. 움직임 조절

`app.js` 상단 `CONFIG` 값만 바꾸면 된다.

| 값 | 의미 |
|----|------|
| `tiltX` / `tiltY` | 마우스 상하·좌우에 따라 기울어지는 각도(deg) |
| `driftX` / `driftY` | 마우스를 따라 이동하는 거리(px) |
| `ease` | 따라오는 속도. 작을수록 느긋하고 부드럽다 (0.02~0.15) |
| `floatAmp` / `floatSpeed` | 둥둥 떠다니는 진폭과 속도 |
| `swayDeg` | 좌우로 흔들리는 각도 |
| `removeBackground` | 배경 자동 제거 on/off (`asset-cutout.png` 쓸 때는 off) |

에셋 크기는 `app.css` 의 `#asset { width: ... }`, 제목 문구는 각 HTML 의
`.wordmark` 에서 바꾼다.

## GLB 버전 (model-3d.html)

### Tripo 내보내기 설정

| 항목 | 선택 |
|------|------|
| 포맷 | **GLB** (메시 + 재질 + 텍스처가 한 파일에 들어감) |
| 텍스처 해상도 | **2k 권장**. 4k는 유료로 막히는 경우가 있고 로딩도 느리다 |

내려받은 파일을 `web/models/model.glb` 로 저장하고 위와 같이 로컬 서버로 열면 된다.
움직임 값은 `main.js` 상단 `CONFIG` 에 있다.

three.js는 CDN(jsDelivr)에서 불러오므로 `npm install` 이 필요 없다.

## 공통 사항

- 모바일에서는 터치 이동과 기기 기울기에도 반응한다.
- OS의 "동작 줄이기(prefers-reduced-motion)" 설정을 켜면 부유 애니메이션이 멈춘다.
- 배포는 `web/` 폴더를 GitHub Pages / Netlify / Vercel 에 그대로 올리면 된다.
