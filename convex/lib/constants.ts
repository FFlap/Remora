import { v } from "convex/values";
import {
  ACCESS_REQUEST_STATUS_VALUES,
  DECK_VISIBILITY_VALUES,
  EDIT_MODE_VALUES,
} from "../../shared/contracts/deckConstants";

export const DECK_VISIBILITIES = DECK_VISIBILITY_VALUES;

export type DeckVisibility = (typeof DECK_VISIBILITIES)[number];

export const deckVisibilityValidator = v.union(
  v.literal("public"),
  v.literal("unlisted"),
  v.literal("private"),
  v.literal("whitelist"),
);

export const EDIT_MODES = EDIT_MODE_VALUES;
export type EditMode = (typeof EDIT_MODES)[number];

export const editModeValidator = v.union(v.literal("quick"), v.literal("creative"));

export const ACCESS_REQUEST_STATUSES = ACCESS_REQUEST_STATUS_VALUES;

export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

export const accessRequestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

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
export const sideModelValidator = v.object({
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

export const userDocValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  clerkUserId: v.string(),
  email: v.string(),
  displayName: v.string(),
  createdAt: v.number(),
});

export const deckDocValidator = v.object({
  _id: v.id("decks"),
  _creationTime: v.number(),
  ownerUserId: v.id("users"),
  title: v.string(),
  description: v.string(),
  visibility: deckVisibilityValidator,
  whitelistEmails: v.array(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
});

export const sectionDocValidator = v.object({
  _id: v.id("sections"),
  _creationTime: v.number(),
  deckId: v.id("decks"),
  title: v.string(),
  order: v.number(),
});

export const cardDocValidator = v.object({
  _id: v.id("cards"),
  _creationTime: v.number(),
  deckId: v.id("decks"),
  sectionId: v.id("sections"),
  order: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  lastEditedMode: editModeValidator,
});

export const cardSideDocValidator = v.object({
  _id: v.id("cardSides"),
  _creationTime: v.number(),
  deckId: v.optional(v.id("decks")),
  cardId: v.id("cards"),
  index: v.number(),
  sideModel: sideModelValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const deckAccessRequestDocValidator = v.object({
  _id: v.id("deckAccessRequests"),
  _creationTime: v.number(),
  deckId: v.id("decks"),
  requesterUserId: v.id("users"),
  requesterEmail: v.string(),
  message: v.optional(v.string()),
  status: accessRequestStatusValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  resolvedByUserId: v.optional(v.id("users")),
});

export const assetDocValidator = v.object({
  _id: v.id("assets"),
  _creationTime: v.number(),
  ownerUserId: v.id("users"),
  deckId: v.optional(v.id("decks")),
  type: v.literal("image"),
  storageId: v.optional(v.id("_storage")),
  url: v.optional(v.string()),
  metadata: v.object({
    mime: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  }),
  createdAt: v.number(),
});

export const assetWithResolvedUrlValidator = v.object({
  _id: v.id("assets"),
  _creationTime: v.number(),
  ownerUserId: v.id("users"),
  deckId: v.optional(v.id("decks")),
  type: v.literal("image"),
  storageId: v.optional(v.id("_storage")),
  url: v.optional(v.string()),
  metadata: v.object({
    mime: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  }),
  createdAt: v.number(),
  resolvedUrl: v.union(v.string(), v.null()),
});

export const editorCardPayloadValidator = v.union(
  v.null(),
  v.object({
    card: cardDocValidator,
    sides: v.array(cardSideDocValidator),
  }),
);

export const editShellCardValidator = v.object({
  _id: v.id("cards"),
  _creationTime: v.number(),
  deckId: v.id("decks"),
  sectionId: v.id("sections"),
  order: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  lastEditedMode: editModeValidator,
  frontSide: v.union(cardSideDocValidator, v.null()),
});

export const editShellSectionValidator = v.object({
  _id: v.id("sections"),
  _creationTime: v.number(),
  deckId: v.id("decks"),
  title: v.string(),
  order: v.number(),
  cards: v.array(editShellCardValidator),
});

export const getEditShellReturnValidator = v.object({
  deck: deckDocValidator,
  sections: v.array(editShellSectionValidator),
  viewer: v.object({
    isOwner: v.literal(true),
    user: userDocValidator,
  }),
});

export const viewerCardValidator = v.object({
  _id: v.id("cards"),
  _creationTime: v.number(),
  deckId: v.id("decks"),
  sectionId: v.id("sections"),
  order: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  lastEditedMode: editModeValidator,
  sides: v.array(cardSideDocValidator),
});

export const viewerSectionValidator = v.object({
  _id: v.id("sections"),
  _creationTime: v.number(),
  deckId: v.id("decks"),
  title: v.string(),
  order: v.number(),
  cards: v.array(viewerCardValidator),
});

export const viewerAccessReasonValidator = v.union(
  v.literal("private"),
  v.literal("whitelist_sign_in_required"),
  v.literal("whitelist_pending"),
  v.literal("whitelist_requestable"),
);

export const deniedViewerDeckValidator = v.object({
  _id: v.id("decks"),
  visibility: deckVisibilityValidator,
});

export const getForViewerReturnValidator = v.union(
  v.object({
    access: v.literal("granted"),
    deck: deckDocValidator,
    sections: v.array(viewerSectionValidator),
    viewer: v.object({
      isOwner: v.boolean(),
    }),
  }),
  v.object({
    access: viewerAccessReasonValidator,
    deck: deniedViewerDeckValidator,
  }),
);
