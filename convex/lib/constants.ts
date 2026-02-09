import { v } from "convex/values";

function literalUnion<T extends readonly [string, ...string[]]>(values: T) {
  const literals = values.map((value) => v.literal(value)) as [
    ReturnType<typeof v.literal>,
    ...ReturnType<typeof v.literal>[],
  ];
  return v.union(...literals);
}

export const DECK_VISIBILITIES = [
  "public",
  "unlisted",
  "private",
  "whitelist",
] as const;

export type DeckVisibility = (typeof DECK_VISIBILITIES)[number];

export const deckVisibilityValidator = literalUnion(DECK_VISIBILITIES);

export const EDIT_MODES = ["quick", "creative"] as const;
export type EditMode = (typeof EDIT_MODES)[number];

export const editModeValidator = literalUnion(EDIT_MODES);

export const ACCESS_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

export const accessRequestStatusValidator = literalUnion(ACCESS_REQUEST_STATUSES);

const creativeTransformValidator = v.object({
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
  rotation: v.number(),
});

const sideElementTypeValidator = v.union(
  v.literal("richText"),
  v.literal("image"),
  v.literal("embed"),
  v.literal("stroke"),
);

// Canonical side payload validator used at persistence boundaries.
// Keep lexical payload flexible, while constraining top-level structure.
export const sideIRValidator = v.object({
  version: v.literal(1),
  elements: v.array(
    v.object({
      id: v.string(),
      type: sideElementTypeValidator,
      quick: v.object({
        order: v.number(),
      }),
      creative: creativeTransformValidator,
      lexical: v.optional(v.any()),
      assetId: v.optional(v.string()),
      url: v.optional(v.string()),
      alt: v.optional(v.string()),
      points: v.optional(v.array(v.array(v.number()))),
      svgPath: v.optional(v.string()),
      baseWidth: v.optional(v.number()),
      baseHeight: v.optional(v.number()),
      style: v.optional(
        v.object({
          color: v.string(),
          width: v.number(),
        }),
      ),
    }),
  ),
  layout: v.object({
    quickLayout: v.object({
      mode: v.literal("centered"),
      cardRatio: v.number(),
      previewScale: v.number(),
    }),
    creativeLayout: v.object({
      width: v.number(),
      height: v.number(),
      background: v.string(),
      fixedViewport: v.literal(true),
      padding: v.number(),
    }),
  }),
});
