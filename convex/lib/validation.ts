import type { Infer } from "convex/values";
import type { sideModelValidator } from "./constants";

type SideModel = Infer<typeof sideModelValidator>;

const ALLOWED_URL_PROTOCOLS = ["http:", "https:"];

function extractCssUrl(value: string): string | null {
  const match = /^url\(\s*(['"]?)(.*?)\1\s*\)$/i.exec(value.trim());
  if (!match) {
    return null;
  }
  return match[2].trim();
}

export function assertSafeUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(`Disallowed URL protocol: ${parsed.protocol}`);
  }
}

export function assertSafeSideModel(sideModel: SideModel): void {
  for (const element of sideModel.elements) {
    if (element.url) {
      assertSafeUrl(element.url);
    }
  }

  const bg = sideModel.layout.creativeLayout.background;
  if (bg) {
    const bgUrl = extractCssUrl(bg);
    if (bgUrl !== null) {
      assertSafeUrl(bgUrl);
    }
  }
}
