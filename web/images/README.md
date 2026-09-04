# images

| 파일 | 설명 |
|------|------|
| `asset.png` | M 원본 (털 질감, 투명 PNG) |
| `asset-cutout.png` | 위 파일을 글리프에 맞춰 크롭. **페이지가 쓰는 파일** |
| `asset-1.png` | 숫자 1 원본 (크롬 얼룩무늬, 투명 PNG) |
| `asset-1-cutout.png` | 위 파일을 글리프에 맞춰 크롭. **페이지가 쓰는 파일** |

## 크롭이 필요한 이유

원본에는 투명 여백이 많다. 지금 에셋도 좌우로 100px 넘게 비어 있었다.
그대로 쓰면 `app.css` 의 `gap` 을 0으로 줘도 글자가 붙지 않는다.
그래서 알파 경계에 맞춰 잘라낸 `*-cutout.png` 를 만들어 쓴다.

## 배경 제거

지금 에셋은 원본이 이미 투명해서 `app.js` 의 `removeBackground` 가 꺼져 있고,
그래서 `index.html` 을 더블클릭해도 바로 동작한다.

배경이 있는 캡처(예: Tripo 뷰어 스크린샷)를 쓸 때만 `true` 로 바꾸고
로컬 서버로 연다. 테두리에서 배경색과 비슷한 픽셀을 번져나가며(flood fill)
지우는 방식이라, 에셋 **안쪽**에 같은 색이 있어도 남는다.

**털처럼 경계가 부드러운 에셋에는 쓰지 말 것.** flood fill 은 반투명한
털끝을 뭉갠다. 그런 에셋은 처음부터 투명 PNG 로 받는 게 맞다.

## 새 글리프 추가 / 교체

1. 이미지를 이 폴더에 넣는다 (투명 PNG 가 가장 좋다).
2. 알파 경계에 맞춰 크롭한 `*-cutout.png` 를 만든다.
3. `app.js` 의 `CONFIG.assets` 에 항목을 추가하거나 `url` 을 바꾼다.

```js
{ url: './images/asset-2-cutout.png', alt: '설명',
  phase: 4.2, speedMul: 0.93, ampMul: 0.90,
  easeMul: 0.8, tiltMul: 0.75, driftMul: 0.85,
  baseRotY: -8, baseRotZ: 1.5, scale: 1.00 },
```

글리프별 편차 값은 모두 다르게 줘야 한다. 같게 두면 여러 오브젝트가
한 덩어리처럼 움직여 어색해진다.

| 값 | 의미 |
|----|------|
| `phase` / `speedMul` / `ampMul` | 부유 위상 · 주기 · 진폭 |
| `easeMul` | 커서를 따라오는 속도. 작을수록 늦게 따라온다 |
| `tiltMul` / `driftMul` | 마우스 반응의 크기 |
| `baseRotY` / `baseRotZ` | 가만히 있을 때의 기본 각도(deg) |
| `scale` | 크기 미세 보정 |
