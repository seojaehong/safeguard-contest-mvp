import { describe, expect, it } from "vitest";

import { pixelateRects, expandBlurRect, requiresFaceConsent } from "@/lib/video-face-blur";
import {
  checkVideoDuration,
  chunkScenes,
  computeFrameSignature,
  fitWithinEdge,
  formatVideoTime,
  parseSceneTimeFromName,
  planSampleTimes,
  sceneFileName,
  selectScenes,
  signatureDistance,
  VIDEO_MAX_SCENES,
  VIDEO_REQUEST_MAX_BYTES,
  VIDEO_SCENE_MAX_BYTES,
  VIDEO_SCENES_PER_REQUEST,
  type FrameSample
} from "@/lib/video-hazard-frames";

function solidFrame(width: number, height: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return data;
}

/** 왼쪽 split 비율만큼 밝고 나머지는 어두운 프레임 — 카메라가 옆으로 움직이는 효과 */
function splitFrame(width: number, height: number, split: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = x < width * split ? 220 : 30;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return data;
}

function sample(time: number, data: Uint8ClampedArray, width = 32, height = 32): FrameSample {
  return { time, signature: computeFrameSignature(data, width, height) };
}

describe("video scene selection (pure)", () => {
  it("keeps request size under the Vercel body limit by construction", () => {
    expect(VIDEO_SCENES_PER_REQUEST * VIDEO_SCENE_MAX_BYTES + 64 * 1024).toBeLessThan(VIDEO_REQUEST_MAX_BYTES);
    expect(VIDEO_REQUEST_MAX_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });

  it("checks the 3-minute cap and short clips", () => {
    expect(checkVideoDuration(60).ok).toBe(true);
    expect(checkVideoDuration(180).ok).toBe(true);
    expect(checkVideoDuration(181)).toMatchObject({ ok: false, reason: "too_long" });
    expect(checkVideoDuration(1)).toMatchObject({ ok: false, reason: "too_short" });
    expect(checkVideoDuration(Number.NaN)).toMatchObject({ ok: false, reason: "unknown" });
  });

  it("plans 0.5s samples up to one minute and 1s beyond", () => {
    expect(planSampleTimes(60)).toHaveLength(120);
    expect(planSampleTimes(120)).toHaveLength(120);
    expect(planSampleTimes(10).at(-1)).toBeLessThan(10);
  });

  it("treats identical frames as distance 0 and different scenes as far apart", () => {
    const a = computeFrameSignature(splitFrame(32, 32, 0.5), 32, 32);
    const b = computeFrameSignature(splitFrame(32, 32, 0.5), 32, 32);
    const c = computeFrameSignature(splitFrame(32, 32, 0.1), 32, 32);
    expect(signatureDistance(a, b)).toBe(0);
    expect(signatureDistance(a, c)).toBeGreaterThan(0.2);
  });

  it("picks one representative per scene cut and drops repeated scenes", () => {
    const red = solidFrame(32, 32, [200, 40, 40]);
    const left = splitFrame(32, 32, 0.3);
    const right = splitFrame(32, 32, 0.8);
    const samples: FrameSample[] = [];
    // 0~9.5s 장면 A, 10~19.5s 장면 B, 20~29.5s 장면 A 다시(유사 장면), 30~39.5s 장면 C
    for (let t = 0; t < 40; t += 0.5) {
      const data = t < 10 ? left : t < 20 ? right : t < 30 ? left : red;
      samples.push(sample(t, data));
    }
    const scenes = selectScenes(samples);
    expect(scenes.map((scene) => scene.time)).toEqual([4.5, 14.5, 34.5]);
    expect(scenes[0].segmentEnd).toBeGreaterThanOrEqual(29.5);
  });

  it("detects gradual change (slow pan) by comparing to the segment anchor", () => {
    const samples: FrameSample[] = [];
    for (let i = 0; i <= 60; i += 1) samples.push(sample(i, splitFrame(32, 32, i / 60)));
    const scenes = selectScenes(samples);
    expect(scenes.length).toBeGreaterThan(2);
    expect(scenes.length).toBeLessThanOrEqual(VIDEO_MAX_SCENES);
  });

  it("thins to the scene cap while covering the whole timeline", () => {
    const samples: FrameSample[] = [];
    for (let i = 0; i < 30; i += 1) {
      samples.push(sample(i, splitFrame(32, 32, (i % 15) / 15 + 0.02)));
    }
    const scenes = selectScenes(samples, { maxScenes: 4, duplicateThreshold: 0 });
    expect(scenes).toHaveLength(4);
    expect(scenes[0].time).toBeLessThan(5);
    expect(scenes.at(-1)!.time).toBeGreaterThan(20);
  });

  it("chunks scenes per request and encodes the time into the file name", () => {
    expect(chunkScenes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map((chunk) => chunk.length)).toEqual([4, 4, 2]);
    expect(sceneFileName(3, 42.7)).toBe("scene-03_00m42s.jpg");
    expect(parseSceneTimeFromName("scene-03_01m05s.jpg")).toBe(65);
    expect(parseSceneTimeFromName("site.jpg")).toBeNull();
    expect(formatVideoTime(65.9)).toBe("1:05");
    expect(fitWithinEdge(1920, 1080)).toEqual({ width: 1024, height: 576 });
    expect(fitWithinEdge(640, 360)).toEqual({ width: 640, height: 360 });
  });
});

describe("video face blur (pure)", () => {
  it("pixelates only inside the (expanded) face rectangle", () => {
    const width = 40;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      data[i * 4] = (i * 37) % 256;
      data[i * 4 + 1] = (i * 91) % 256;
      data[i * 4 + 2] = (i * 13) % 256;
      data[i * 4 + 3] = 255;
    }
    const before = data.slice();
    const applied = pixelateRects(data, width, height, [{ x: 10, y: 10, width: 10, height: 10 }], 4);
    expect(applied).toBe(1);
    const at = (x: number, y: number) => (y * width + x) * 4;
    // 영역 밖 픽셀은 그대로
    expect(data[at(0, 0)]).toBe(before[at(0, 0)]);
    expect(data[at(39, 39)]).toBe(before[at(39, 39)]);
    // 영역 안 블록은 한 색으로 평균화되어 원래 값과 달라진다
    expect(data[at(12, 12)]).toBe(data[at(13, 13)]);
    let changed = 0;
    for (let y = 10; y < 20; y += 1) for (let x = 10; x < 20; x += 1) if (data[at(x, y)] !== before[at(x, y)]) changed += 1;
    expect(changed).toBeGreaterThan(50);
  });

  it("clips expanded rectangles to the image and ignores empty ones", () => {
    expect(expandBlurRect({ x: -5, y: -5, width: 10, height: 10 }, 20, 20)).toMatchObject({ x: 0, y: 0 });
    expect(expandBlurRect({ x: 50, y: 50, width: 10, height: 10 }, 20, 20)).toBeNull();
  });

  it("requires explicit consent when face detection is unavailable for any scene", () => {
    expect(requiresFaceConsent(["blurred", "none_found"])).toBe(false);
    expect(requiresFaceConsent(["blurred", "unavailable"])).toBe(true);
  });
});
