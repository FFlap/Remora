import { useLayoutEffect, useRef, useState } from "react";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LexicalRichTextView } from "./LexicalRichTextView";
import type { SideIR, SideElement, StrokePath } from "@/features/cards/side-ir/types";

function strokePath(points: Array<[number, number]>) {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first[0]} ${first[1]} ${rest.map((p) => `L ${p[0]} ${p[1]}`).join(" ")}`;
}

function getPreviewStrokePoints(element: StrokePath) {
  const strokePadding = Math.max(0, element.style.width) / 2;
  const baseWidthFromLayout = Math.max(1, element.baseWidth ?? element.creative.width);
  const baseHeightFromLayout = Math.max(1, element.baseHeight ?? element.creative.height);
  if (element.points.length === 0) {
    return {
      points: [],
      width: baseWidthFromLayout + strokePadding * 2,
      height: baseHeightFromLayout + strokePadding * 2,
    };
  }

  const xs = element.points.map(([x]) => x);
  const ys = element.points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const sourceWidth = Math.max(1, maxX - minX, baseWidthFromLayout);
  const sourceHeight = Math.max(1, maxY - minY, baseHeightFromLayout);

  return {
    points: element.points.map(
      ([x, y]) => [x - minX + strokePadding, y - minY + strokePadding] as [number, number],
    ),
    width: sourceWidth + strokePadding * 2,
    height: sourceHeight + strokePadding * 2,
  };
}

function renderStroke(element: StrokePath) {
  const normalized = getPreviewStrokePoints(element);
  const strokeWidth = Math.max(1, element.style.width);
  const strokeD = element.svgPath?.trim() ? element.svgPath : strokePath(normalized.points);

  return (
    <svg
      className="h-full w-full overflow-visible"
      viewBox={`0 0 ${normalized.width} ${normalized.height}`}
      preserveAspectRatio="none"
      overflow="visible"
      aria-label="Drawing stroke"
    >
      <path
        d={strokeD}
        stroke={element.style.color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function sortedElements(side: SideIR) {
  return [...side.elements].sort((a, b) => (a.quick.order ?? 0) - (b.quick.order ?? 0));
}

export function SideCardPreview({
  side,
  className,
  compact = false,
  dataTestId,
  ariaHidden = false,
}: {
  side: SideIR;
  className?: string;
  compact?: boolean;
  dataTestId?: string;
  ariaHidden?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const { quickLayout, creativeLayout } = side.layout;
  const ratio = quickLayout.cardRatio > 0 ? quickLayout.cardRatio : 1.6;
  const canvasWidth = Math.max(1, creativeLayout.width);
  const canvasHeight = Math.max(1, creativeLayout.height);
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateScale = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 1 || rect.height <= 1) {
        return;
      }

      const nextScale = Math.min(rect.width / canvasWidth, rect.height / canvasHeight);
      const scaledWidth = canvasWidth * nextScale;
      const scaledHeight = canvasHeight * nextScale;
      const nextOffsetX = Math.max(0, (rect.width - scaledWidth) / 2);
      const nextOffsetY = Math.max(0, (rect.height - scaledHeight) / 2);

      setScale((current) => (Math.abs(current - nextScale) < 0.0005 ? current : nextScale));
      setOffset((current) => {
        if (Math.abs(current.x - nextOffsetX) < 0.25 && Math.abs(current.y - nextOffsetY) < 0.25) {
          return current;
        }
        return { x: nextOffsetX, y: nextOffsetY };
      });
    };

    updateScale();
    const rafId = window.requestAnimationFrame(updateScale);
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    window.addEventListener("resize", updateScale);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateScale);
      observer.disconnect();
    };
  }, [canvasWidth, canvasHeight]);

  return (
    <div
      ref={containerRef}
      data-testid={dataTestId}
      aria-hidden={ariaHidden || undefined}
      className={cn(
        "relative overflow-hidden rounded-xl border border-zinc-300/80 bg-white shadow-sm",
        compact ? "rounded-lg" : "rounded-2xl",
        className,
      )}
      style={{
        aspectRatio: String(ratio),
        backgroundColor: creativeLayout.background,
      }}
    >
      <div
        className="absolute left-0 top-0"
        data-testid={dataTestId ? `${dataTestId}-content` : undefined}
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {sortedElements(side).map((element) => (
          <div
            key={element.id}
            className={cn(
              "absolute",
              element.type === "stroke" ? "pointer-events-none overflow-visible" : "overflow-hidden",
            )}
            style={{
              left: element.creative.x,
              top: element.creative.y,
              width: element.creative.width,
              height: element.creative.height,
              transform: `rotate(${element.creative.rotation ?? 0}deg)`,
              transformOrigin: "top left",
            }}
          >
            {element.type === "richText" && (
              <LexicalRichTextView
                lexical={element.lexical}
                scale={1}
                scrollOnHover
                className="h-full w-full leading-[1.35]"
                dataTestId={dataTestId ? `${dataTestId}-richtext-${element.id}` : undefined}
              />
            )}

            {element.type === "image" && element.url && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img
                src={element.url}
                className="h-full w-full object-cover"
                alt={element.alt ?? "Card image"}
                draggable={false}
              />
            )}

            {element.type === "embed" && (
              <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-[10px] font-medium text-zinc-600">
                <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                YouTube
              </div>
            )}

            {element.type === "stroke" && renderStroke(element)}
          </div>
        ))}
      </div>

      {side.elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
          Empty
        </div>
      )}
    </div>
  );
}
