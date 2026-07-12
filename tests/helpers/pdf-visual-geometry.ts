export type RasterGeometry = {
  darkPixels: number;
  darkPixelsPerCharacter: number;
  occupiedBucketRatio: number;
};

export function measureRasterGeometry(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  characterCount: number
): RasterGeometry {
  if (width <= 0 || height <= 0 || characterCount <= 0 || pixels.length !== width * height * 4) {
    throw new Error("Invalid raster geometry input");
  }
  const bucketDarkPixels = Array.from({ length: characterCount }, () => 0);
  let darkPixels = 0;

  for (let pixelY = 0; pixelY < height; pixelY += 1) {
    for (let pixelX = 0; pixelX < width; pixelX += 1) {
      const offset = (pixelY * width + pixelX) * 4;
      if (
        pixels[offset + 3] > 0
        && (pixels[offset] < 200 || pixels[offset + 1] < 200 || pixels[offset + 2] < 200)
      ) {
        darkPixels += 1;
        const bucket = Math.min(characterCount - 1, Math.floor(pixelX * characterCount / width));
        bucketDarkPixels[bucket] += 1;
      }
    }
  }

  return {
    darkPixels,
    darkPixelsPerCharacter: darkPixels / characterCount,
    occupiedBucketRatio: bucketDarkPixels.filter((count) => count >= 3).length / characterCount
  };
}
