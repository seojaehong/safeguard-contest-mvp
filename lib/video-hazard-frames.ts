/**
 * 동영상 위험 점검 v0 — 장면 선별 순수 함수.
 *
 * 브라우저 어댑터(lib/video-hazard-browser.ts)가 <video>+canvas 로 뽑은 표본 프레임을
 * 작은 회색조 서명으로 줄여 넘기면, 여기서 「장면 변화」 기준으로 대표 장면을 고른다.
 * 원본 영상은 서버로 보내지 않는다. 서버로 가는 것은 여기서 고른 장면 사진뿐이다.
 */

/** 영상 길이 상한(초). 설계 v0 = 1~3분. */
export const VIDEO_MAX_DURATION_SEC = 180;
/** 너무 짧은 영상은 장면 비교가 안 된다. */
export const VIDEO_MIN_DURATION_SEC = 3;
/** 한 영상에서 고르는 장면 수 상한. */
export const VIDEO_MAX_SCENES = 10;
/**
 * 요청 1회에 싣는 장면 수.
 * 사진 분석은 동시처리 2·장당 제한시간 20초라 4장이면 최악 40초로 maxDuration 60초 안에 든다.
 * 10장을 한 번에 보내면 최악 100초라 함수 제한시간을 넘는다.
 */
export const VIDEO_SCENES_PER_REQUEST = 4;
/** 장면 사진 긴 변(px). 브라우저에서 줄여서 보낸다. */
export const VIDEO_SCENE_MAX_EDGE_PX = 1024;
/** 장면 사진 1장 용량 상한. 브라우저에서 JPEG 품질을 낮춰 맞춘다. */
export const VIDEO_SCENE_MAX_BYTES = 450 * 1024;
/**
 * 요청 본문 상한. Vercel 함수 요청 본문 제한(약 4.5MB)보다 낮게 둔다.
 * 기존 사진 경로 상한(41MB)은 운영 함수에서 닿을 수 없는 값이라 영상 경로는 따로 둔다.
 */
export const VIDEO_REQUEST_MAX_BYTES = 4 * 1024 * 1024;
/** 서명 한 변 크기(16×16 회색조). */
export const FRAME_SIGNATURE_SIZE = 16;

export type FrameSignature = {
  size: number;
  /** 0~255 휘도, 길이 size*size */
  luma: number[];
};

export type FrameSample = {
  time: number;
  signature: FrameSignature;
};

export type SelectedScene = {
  time: number;
  /** 그 장면이 대표하는 구간 */
  segmentStart: number;
  segmentEnd: number;
};

export type SceneSelectionOptions = {
  maxScenes?: number;
  /** 구간 첫 프레임과 이만큼 달라지면 새 장면으로 본다(0~1). */
  changeThreshold?: number;
  /** 이미 고른 장면과 이보다 가까우면 유사 장면으로 버린다(0~1). */
  duplicateThreshold?: number;
};

export type VideoDurationCheck =
  | { ok: true }
  | { ok: false; reason: "unknown" | "too_short" | "too_long"; message: string };

export function checkVideoDuration(durationSec: number): VideoDurationCheck {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { ok: false, reason: "unknown", message: "영상 길이를 읽지 못했습니다. 다른 형식(mp4)으로 저장해 다시 올려 주세요." };
  }
  if (durationSec < VIDEO_MIN_DURATION_SEC) {
    return { ok: false, reason: "too_short", message: `영상이 너무 짧습니다. ${VIDEO_MIN_DURATION_SEC}초 이상 영상을 올려 주세요.` };
  }
  if (durationSec > VIDEO_MAX_DURATION_SEC + 0.5) {
    return { ok: false, reason: "too_long", message: "영상은 3분까지 점검합니다. 3분 이내로 잘라 올려 주세요." };
  }
  return { ok: true };
}

/** 표본 시각. 1분 이하는 0.5초, 그보다 길면 1초 간격. 마지막 프레임 직전까지. */
export function planSampleTimes(durationSec: number): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [];
  const interval = durationSec <= 60 ? 0.5 : 1;
  const end = Math.max(0, durationSec - 0.05);
  const times: number[] = [];
  for (let t = 0; t <= end + 1e-9; t += interval) {
    times.push(Math.round(t * 1000) / 1000);
  }
  return times;
}

/** RGBA 픽셀을 size×size 회색조 평균으로 줄인다. */
export function computeFrameSignature(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  size = FRAME_SIGNATURE_SIZE
): FrameSignature {
  const sums = new Array<number>(size * size).fill(0);
  const counts = new Array<number>(size * size).fill(0);
  for (let y = 0; y < height; y += 1) {
    const cellY = Math.min(size - 1, Math.floor((y * size) / height));
    for (let x = 0; x < width; x += 1) {
      const cellX = Math.min(size - 1, Math.floor((x * size) / width));
      const offset = (y * width + x) * 4;
      const luma = 0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2];
      const cell = cellY * size + cellX;
      sums[cell] += luma;
      counts[cell] += 1;
    }
  }
  return {
    size,
    luma: sums.map((sum, index) => (counts[index] ? sum / counts[index] : 0))
  };
}

/** 두 서명의 차이(0=같음, 1=완전히 다름). 밝기 전체 변화에 덜 흔들리도록 평균을 빼고 비교한다. */
export function signatureDistance(a: FrameSignature, b: FrameSignature): number {
  const length = Math.min(a.luma.length, b.luma.length);
  if (!length) return 1;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < length; i += 1) {
    meanA += a.luma[i];
    meanB += b.luma[i];
  }
  meanA /= length;
  meanB /= length;
  let structural = 0;
  for (let i = 0; i < length; i += 1) {
    structural += Math.abs((a.luma[i] - meanA) - (b.luma[i] - meanB));
  }
  const structuralDistance = structural / length / 255;
  const brightnessDistance = Math.abs(meanA - meanB) / 255;
  return Math.min(1, structuralDistance + brightnessDistance * 0.5);
}

/**
 * 장면 변화 기준 선별.
 * 1) 구간 첫 프레임과의 차이가 changeThreshold 를 넘으면 새 구간(천천히 걸으며 찍은 영상도 누적 변화로 잡힌다).
 * 2) 구간마다 가운데 프레임을 대표로 둔다(전환 순간의 흐린 프레임을 피한다).
 * 3) 이미 고른 대표와 duplicateThreshold 보다 가까우면 유사 장면으로 버린다.
 * 4) 그래도 maxScenes 를 넘으면 시간축 전체를 고르게 덮도록 솎는다.
 */
export function selectScenes(samples: readonly FrameSample[], options: SceneSelectionOptions = {}): SelectedScene[] {
  const maxScenes = Math.max(1, options.maxScenes ?? VIDEO_MAX_SCENES);
  const changeThreshold = options.changeThreshold ?? 0.09;
  const duplicateThreshold = options.duplicateThreshold ?? 0.05;
  const ordered = [...samples].sort((a, b) => a.time - b.time);
  if (!ordered.length) return [];

  const segments: FrameSample[][] = [];
  let current: FrameSample[] = [ordered[0]];
  let anchor = ordered[0];
  for (let i = 1; i < ordered.length; i += 1) {
    const sample = ordered[i];
    if (signatureDistance(anchor.signature, sample.signature) > changeThreshold) {
      segments.push(current);
      current = [sample];
      anchor = sample;
    } else {
      current.push(sample);
    }
  }
  segments.push(current);

  const representatives = segments.map((segment) => ({
    sample: segment[Math.floor((segment.length - 1) / 2)],
    segmentStart: segment[0].time,
    segmentEnd: segment[segment.length - 1].time
  }));

  const kept: typeof representatives = [];
  for (const candidate of representatives) {
    const duplicate = kept.find((item) => (
      signatureDistance(item.sample.signature, candidate.sample.signature) < duplicateThreshold
    ));
    if (duplicate) {
      duplicate.segmentEnd = Math.max(duplicate.segmentEnd, candidate.segmentEnd);
      continue;
    }
    kept.push({ ...candidate });
  }

  const thinned = kept.length <= maxScenes ? kept : evenlyPick(kept, maxScenes);
  return thinned.map((item) => ({
    time: item.sample.time,
    segmentStart: item.segmentStart,
    segmentEnd: item.segmentEnd
  }));
}

function evenlyPick<T>(items: readonly T[], count: number): T[] {
  if (count >= items.length) return [...items];
  if (count === 1) return [items[0]];
  const picked: T[] = [];
  for (let i = 0; i < count; i += 1) {
    picked.push(items[Math.round((i * (items.length - 1)) / (count - 1))]);
  }
  return picked;
}

export function chunkScenes<T>(items: readonly T[], size = VIDEO_SCENES_PER_REQUEST): T[][] {
  const chunkSize = Math.max(1, size);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
  return chunks;
}

/** 0:42 · 1:05 형식 */
export function formatVideoTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** 장면 파일 이름에 시각을 박는다. 후보의 sourcePhotoNames 로 시각이 따라간다. */
export function sceneFileName(order: number, seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `scene-${String(order).padStart(2, "0")}_${String(minutes).padStart(2, "0")}m${String(rest).padStart(2, "0")}s.jpg`;
}

export function parseSceneTimeFromName(name: string): number | null {
  const match = /scene-\d+_(\d+)m(\d+)s/u.exec(name);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 긴 변을 maxEdge 이하로 줄인 크기 */
export function fitWithinEdge(width: number, height: number, maxEdge = VIDEO_SCENE_MAX_EDGE_PX): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
