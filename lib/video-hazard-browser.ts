/**
 * 동영상 위험 점검 v0 — 브라우저 어댑터.
 *
 * <video> + canvas 로 표본 프레임을 뽑아 장면을 고르고(lib/video-hazard-frames.ts),
 * 고른 장면만 긴 변 1024px 이하 JPEG 로 줄이고, 얼굴을 흐린다(lib/video-face-blur.ts).
 * 원본 영상은 이 브라우저 밖으로 나가지 않는다.
 *
 * 얼굴 찾기: 브라우저 내장 FaceDetector(Shape Detection API)가 있을 때만 쓴다.
 * 지금 대부분의 브라우저에는 없다. 없으면 장면별 상태를 "unavailable" 로 두고,
 * 화면이 업로드 전에 사용자 확인을 받는다. 외부 모델을 내려받지 않는다.
 */
import { pixelateRects, type BlurRect, type SceneFaceStatus } from "@/lib/video-face-blur";
import {
  checkVideoDuration,
  computeFrameSignature,
  fitWithinEdge,
  FRAME_SIGNATURE_SIZE,
  planSampleTimes,
  sceneFileName,
  selectScenes,
  VIDEO_SCENE_MAX_BYTES,
  VIDEO_SCENE_MAX_EDGE_PX,
  type FrameSample
} from "@/lib/video-hazard-frames";

export type ExtractedScene = {
  order: number;
  time: number;
  name: string;
  file: File;
  previewUrl: string;
  faceStatus: SceneFaceStatus;
  faceCount: number;
};

export type SceneExtractionResult = {
  durationSec: number;
  sampleCount: number;
  scenes: ExtractedScene[];
  faceDetectorAvailable: boolean;
};

type FaceDetectorLike = {
  detect: (image: CanvasImageSource) => Promise<Array<{ boundingBox: { x: number; y: number; width: number; height: number } }>>;
};

function createFaceDetector(): FaceDetectorLike | null {
  const ctor = (globalThis as { FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike }).FaceDetector;
  if (typeof ctor !== "function") return null;
  try {
    return new ctor({ fastMode: false, maxDetectedFaces: 20 });
  } catch {
    return null;
  }
}

export function isFaceDetectorAvailable(): boolean {
  return createFaceDetector() !== null;
}

function waitFor(target: HTMLVideoElement, event: "loadedmetadata" | "seeked" | "loadeddata", timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("영상 프레임을 읽는 시간이 너무 오래 걸립니다."));
    }, timeoutMs);
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("이 브라우저에서 영상을 열지 못했습니다. mp4(H.264)로 저장해 다시 올려 주세요."));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

async function seek(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.001) return;
  const done = waitFor(video, "seeked");
  video.currentTime = time;
  await done;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("장면 사진을 만들지 못했습니다."))), "image/jpeg", quality);
  });
}

/** 450KB 이하가 될 때까지 품질을 낮추고, 그래도 크면 크기를 줄인다. */
async function encodeWithinBudget(canvas: HTMLCanvasElement): Promise<Blob> {
  for (const quality of [0.8, 0.7, 0.6, 0.5, 0.42]) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= VIDEO_SCENE_MAX_BYTES) return blob;
  }
  const smaller = document.createElement("canvas");
  const size = fitWithinEdge(canvas.width, canvas.height, 768);
  smaller.width = size.width;
  smaller.height = size.height;
  smaller.getContext("2d")?.drawImage(canvas, 0, 0, size.width, size.height);
  return canvasToBlob(smaller, 0.5);
}

export async function extractVideoScenes(
  file: File,
  options: { onProgress?: (message: string) => void; signal?: AbortSignal } = {}
): Promise<SceneExtractionResult> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await waitFor(video, "loadedmetadata");
    const durationSec = video.duration;
    const durationCheck = checkVideoDuration(durationSec);
    if (!durationCheck.ok) throw new Error(durationCheck.message);
    if (video.readyState < 2) await waitFor(video, "loadeddata");

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = FRAME_SIGNATURE_SIZE * 4;
    sampleCanvas.height = FRAME_SIGNATURE_SIZE * 4;
    const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleContext) throw new Error("이 브라우저에서 영상 장면을 그릴 수 없습니다.");

    const times = planSampleTimes(durationSec);
    const samples: FrameSample[] = [];
    for (let i = 0; i < times.length; i += 1) {
      options.signal?.throwIfAborted();
      await seek(video, times[i]);
      sampleContext.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
      const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
      samples.push({ time: times[i], signature: computeFrameSignature(pixels.data, pixels.width, pixels.height) });
      if (i % 10 === 0) options.onProgress?.(`장면 비교 중 ${i + 1}/${times.length}`);
    }

    const selected = selectScenes(samples);
    const detector = createFaceDetector();
    const size = fitWithinEdge(video.videoWidth, video.videoHeight, VIDEO_SCENE_MAX_EDGE_PX);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("이 브라우저에서 영상 장면을 그릴 수 없습니다.");

    const scenes: ExtractedScene[] = [];
    for (let index = 0; index < selected.length; index += 1) {
      options.signal?.throwIfAborted();
      const time = selected[index].time;
      options.onProgress?.(`장면 사진 만드는 중 ${index + 1}/${selected.length}`);
      await seek(video, time);
      context.drawImage(video, 0, 0, size.width, size.height);

      let faceStatus: SceneFaceStatus = "unavailable";
      let faceCount = 0;
      if (detector) {
        try {
          const faces = await detector.detect(canvas);
          const rects: BlurRect[] = faces.map((face) => face.boundingBox);
          faceCount = rects.length;
          if (rects.length) {
            const image = context.getImageData(0, 0, size.width, size.height);
            pixelateRects(image.data, size.width, size.height, rects);
            context.putImageData(image, 0, 0);
            faceStatus = "blurred";
          } else {
            faceStatus = "none_found";
          }
        } catch {
          faceStatus = "unavailable";
        }
      }

      const blob = await encodeWithinBudget(canvas);
      const name = sceneFileName(index + 1, time);
      const sceneFile = new File([blob], name, { type: "image/jpeg" });
      scenes.push({
        order: index + 1,
        time,
        name,
        file: sceneFile,
        previewUrl: URL.createObjectURL(sceneFile),
        faceStatus,
        faceCount
      });
    }
    return { durationSec, sampleCount: samples.length, scenes, faceDetectorAvailable: Boolean(detector) };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
