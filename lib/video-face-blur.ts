/**
 * 동영상 위험 점검 v0 — 얼굴 흐림 순수 함수.
 *
 * 얼굴 위치 찾기는 브라우저 어댑터가 맡는다(내장 FaceDetector 가 있을 때만).
 * 여기서는 찾은 영역을 넉넉히 넓혀 모자이크로 덮는 일만 한다.
 * FaceDetector 가 없으면 흐림을 할 수 없으므로, 화면은 업로드 전에 사용자 확인을 받는다
 * (조용히 건너뛰지 않는다 — components/VideoHazardCheck.tsx).
 */

export type BlurRect = { x: number; y: number; width: number; height: number };

/** 얼굴 상자를 머리·목까지 덮도록 넓히고 이미지 경계 안으로 자른다. */
export function expandBlurRect(rect: BlurRect, imageWidth: number, imageHeight: number, ratio = 0.35): BlurRect | null {
  const padX = rect.width * ratio;
  const padY = rect.height * ratio;
  const x0 = Math.max(0, Math.floor(rect.x - padX));
  const y0 = Math.max(0, Math.floor(rect.y - padY));
  const x1 = Math.min(imageWidth, Math.ceil(rect.x + rect.width + padX));
  const y1 = Math.min(imageHeight, Math.ceil(rect.y + rect.height + padY * 1.4));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * RGBA 버퍼의 지정 영역을 모자이크로 덮는다(제자리 수정).
 * 블록 크기는 영역 크기에 맞춰 키운다 — 큰 얼굴도 알아볼 수 없게.
 */
export function pixelateRects(
  rgba: { [index: number]: number; length: number },
  width: number,
  height: number,
  rects: readonly BlurRect[],
  minBlock = 8
): number {
  let applied = 0;
  for (const raw of rects) {
    const rect = expandBlurRect(raw, width, height);
    if (!rect) continue;
    const block = Math.max(minBlock, Math.ceil(Math.max(rect.width, rect.height) / 6));
    for (let by = rect.y; by < rect.y + rect.height; by += block) {
      for (let bx = rect.x; bx < rect.x + rect.width; bx += block) {
        const bw = Math.min(block, rect.x + rect.width - bx);
        const bh = Math.min(block, rect.y + rect.height - by);
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let y = by; y < by + bh; y += 1) {
          for (let x = bx; x < bx + bw; x += 1) {
            const offset = (y * width + x) * 4;
            r += rgba[offset];
            g += rgba[offset + 1];
            b += rgba[offset + 2];
            n += 1;
          }
        }
        if (!n) continue;
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        for (let y = by; y < by + bh; y += 1) {
          for (let x = bx; x < bx + bw; x += 1) {
            const offset = (y * width + x) * 4;
            rgba[offset] = r;
            rgba[offset + 1] = g;
            rgba[offset + 2] = b;
          }
        }
      }
    }
    applied += 1;
  }
  return applied;
}

export type SceneFaceStatus = "blurred" | "none_found" | "unavailable";

/** 업로드 전 사용자 확인이 필요한가 — 얼굴 찾기를 못 한 장면이 하나라도 있으면 필요하다. */
export function requiresFaceConsent(statuses: readonly SceneFaceStatus[]): boolean {
  return statuses.some((status) => status === "unavailable");
}
