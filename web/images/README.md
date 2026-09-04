# images

| 파일 | 설명 |
|------|------|
| `asset.png` | Tripo 캡처 원본 (M, 배경 `#EBEBEB`) |
| `asset-cutout.png` | 위 파일의 배경 제거본. **페이지가 쓰는 파일** |
| `asset-1.png` | Tripo 캡처 원본 (숫자 1, 배경 흰색) |
| `asset-1-cutout.png` | 위 파일의 배경 제거본. **페이지가 쓰는 파일** |

`*-cutout.png` 는 이미 투명하므로 `app.js` 의 `removeBackground` 가 꺼져 있고,
그래서 `index.html` 을 더블클릭해도 바로 동작한다.

cutout 은 배경 제거 후 **글리프에 딱 맞게 잘라 두었다.** 캡처 원본에는
투명 여백이 많은데(숫자 1은 좌우 여백이 이미지 폭의 40% 넘었다), 그대로 쓰면
`gap` 을 0으로 줘도 글자가 붙지 않는다.

## 새 글리프 추가하기

1. 캡처 이미지를 이 폴더에 넣는다 (배경 있는 원본 그대로 괜찮다).
2. `app.js` 의 `CONFIG.assets` 에 한 줄 추가한다.

```js
{ url: './images/asset-2.png', alt: '설명',
  phase: 4.2, speedMul: 0.93, ampMul: 0.90,
  easeMul: 0.8, tiltMul: 0.75, driftMul: 0.85,
  baseRotY: -8, baseRotZ: 1.5, scale: 1.00 },
```

3. 배경이 남아 있으면 `removeBackground: true` 로 바꾸고 로컬 서버로 연다.
   `tolerance` 는 배경이 남으면 올리고, 에셋이 깎이면 내린다.
   (M 은 34, 1 은 24가 가장 깨끗했다)

4. 새 글리프도 배경 제거 후 **알파 경계에 맞춰 잘라야** 자간이 제대로 먹는다.

글리프별 편차 값은 모두 다르게 줘야 한다. 같게 두면 여러 오브젝트가
한 덩어리처럼 움직여 어색해진다.

| 값 | 의미 |
|----|------|
| `phase` / `speedMul` / `ampMul` | 부유 위상 · 주기 · 진폭 |
| `easeMul` | 커서를 따라오는 속도. 작을수록 늦게 따라온다 |
| `tiltMul` / `driftMul` | 마우스 반응의 크기 |
| `baseRotY` / `baseRotZ` | 가만히 있을 때의 기본 각도(deg) |
| `scale` | 크기 미세 보정 |
