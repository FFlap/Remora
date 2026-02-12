import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  accessRequestStatusValidator,
  deckVisibilityValidator,
  editModeValidator,
  sideModelValidator,
} from "./lib/constants";

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    displayName: v.string(),
    createdAt: v.number(),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_email", ["email"]),

  decks: defineTable({
    ownerUserId: v.id("users"),
    title: v.string(),
    description: v.string(),
    visibility: deckVisibilityValidator,
    whitelistEmails: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_visibility", ["visibility"]),

  sections: defineTable({
    deckId: v.id("decks"),
    title: v.string(),
    order: v.number(),
  })
    .index("by_deck", ["deckId"])
    .index("by_deck_order", ["deckId", "order"]),

  cards: defineTable({
    deckId: v.id("decks"),
    sectionId: v.id("sections"),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastEditedMode: editModeValidator,
  })
    .index("by_deck", ["deckId"])
    .index("by_deck_order", ["deckId", "order"])
    .index("by_section", ["sectionId"])
    .index("by_section_order", ["sectionId", "order"]),

  cardSides: defineTable({
    cardId: v.id("cards"),
    index: v.number(),
    sideModel: sideModelValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_card", ["cardId"])
    .index("by_card_index", ["cardId", "index"]),

  deckAccessRequests: defineTable({
    deckId: v.id("decks"),
    requesterUserId: v.id("users"),
    requesterEmail: v.string(),
    message: v.optional(v.string()),
    status: accessRequestStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedByUserId: v.optional(v.id("users")),
  })
    .index("by_deck", ["deckId"])
    .index("by_deck_status", ["deckId", "status"])
    .index("by_requester_and_deck", ["requesterUserId", "deckId"]),

  assets: defineTable({
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
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_deck", ["deckId"])
    .index("by_storage", ["storageId"]),

  assetUploadSessions: defineTable({
    uploaderUserId: v.id("users"),
    uploadToken: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
  })
    .index("by_token", ["uploadToken"])
    .index("by_uploader", ["uploaderUserId"]),
});
