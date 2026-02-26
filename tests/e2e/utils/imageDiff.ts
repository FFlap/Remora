import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

type InkBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

function readPng(buffer: Buffer): PNG {
  return PNG.sync.read(buffer);
}

function resizeNearest(source: PNG, targetWidth: number, targetHeight: number): PNG {
  const output = new PNG({ width: targetWidth, height: targetHeight });

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(
        source.width - 1,
        Math.floor((x / Math.max(1, targetWidth - 1)) * Math.max(1, source.width - 1)),
      );
      const sourceY = Math.min(
        source.height - 1,
        Math.floor((y / Math.max(1, targetHeight - 1)) * Math.max(1, source.height - 1)),
      );

      const srcIndex = (sourceY * source.width + sourceX) * 4;
      const dstIndex = (y * targetWidth + x) * 4;

      output.data[dstIndex] = source.data[srcIndex];
      output.data[dstIndex + 1] = source.data[srcIndex + 1];
      output.data[dstIndex + 2] = source.data[srcIndex + 2];
      output.data[dstIndex + 3] = source.data[srcIndex + 3];
    }
  }

  return output;
}

function rgbaToLuma(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function extractInkBounds(
  image: PNG,
  {
    alphaMin = 10,
    lumaMax = 250,
  }: {
    alphaMin?: number;
    lumaMax?: number;
  } = {},
): InkBounds | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      const r = image.data[index] ?? 255;
      const g = image.data[index + 1] ?? 255;
      const b = image.data[index + 2] ?? 255;
      const a = image.data[index + 3] ?? 255;

      const luma = rgbaToLuma(r, g, b);
      const isInk = a >= alphaMin && luma <= lumaMax;
      if (!isInk) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function comparePngBuffers(
  aBuffer: Buffer,
  bBuffer: Buffer,
  {
    width,
    height,
    threshold = 0.14,
    inkAlphaMin = 20,
    inkLumaMax = 220,
  }: {
    width: number;
    height: number;
    threshold?: number;
    inkAlphaMin?: number;
    inkLumaMax?: number;
  },
) {
  const a = resizeNearest(readPng(aBuffer), width, height);
  const b = resizeNearest(readPng(bBuffer), width, height);
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold,
    includeAA: false,
  });

  return {
    diffPixels,
    totalPixels: width * height,
    diffRatio: diffPixels / (width * height),
    aInkBounds: extractInkBounds(a, { alphaMin: inkAlphaMin, lumaMax: inkLumaMax }),
    bInkBounds: extractInkBounds(b, { alphaMin: inkAlphaMin, lumaMax: inkLumaMax }),
    diffImage: diff,
  };
}
