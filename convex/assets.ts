import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type MutationCtx, query } from "./_generated/server";
import { assertCanEditDeck, assertCanReadDeck } from "./lib/access";
import { ensureCurrentUser, getCurrentUser } from "./lib/auth";
import { assetDocValidator, assetWithResolvedUrlValidator } from "./lib/constants";

const UPLOAD_SESSION_TTL_MS = 1000 * 60 * 30;
const UPLOAD_SESSION_CONSUMED_RETENTION_MS = 1000 * 60 * 60 * 24;
const UPLOAD_URL_RATE_WINDOW_MS = 1000 * 60 * 10;
const MAX_UPLOAD_URLS_PER_WINDOW = 20;
const MAX_ACTIVE_UPLOAD_SESSIONS_PER_USER = 8;
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const ORPHAN_STORAGE_SWEEP_BATCH_SIZE = 25;
const ORPHAN_STORAGE_MIN_AGE_MS = UPLOAD_SESSION_TTL_MS + 1000 * 60 * 10;

function createUploadToken() {
  return crypto.randomUUID();
}

function resolveImageMime(
  storageMime: string | null,
  requestedMime: string | undefined,
): string {
  if (!storageMime || !storageMime.startsWith("image/")) {
    throw new Error("Only image uploads are allowed");
  }
  if (requestedMime && !requestedMime.startsWith("image/")) {
    throw new Error("Invalid image MIME type");
  }
  if (requestedMime && requestedMime !== storageMime) {
    throw new Error("Image MIME type does not match uploaded file");
  }
  return storageMime;
}

function assertValidImageSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Invalid image size");
  }
  if (size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error("Image file is too large");
  }
}

function assertValidImageDimensions(width: number | undefined, height: number | undefined) {
  if (width !== undefined && (!Number.isFinite(width) || width <= 0)) {
    throw new Error("Invalid image width");
  }

  if (height !== undefined && (!Number.isFinite(height) || height <= 0)) {
    throw new Error("Invalid image height");
  }
}

async function cleanupUploadSessionsForUser(
  ctx: MutationCtx,
  uploaderUserId: Id<"users">,
  now: number,
) {
  const sessions = await ctx.db
    .query("assetUploadSessions")
    .withIndex("by_uploader", (q) => q.eq("uploaderUserId", uploaderUserId))
    .collect();

  let activeSessions = 0;
  let issuedWithinWindow = 0;

  for (const session of sessions) {
    if (!session.consumedAt && session.expiresAt < now) {
      await ctx.db.delete(session._id);
      continue;
    }

    if (
      session.consumedAt &&
      now - session.consumedAt > UPLOAD_SESSION_CONSUMED_RETENTION_MS
    ) {
      await ctx.db.delete(session._id);
      continue;
    }

    if (!session.consumedAt && session.expiresAt >= now) {
      activeSessions += 1;
    }

    if (session.createdAt >= now - UPLOAD_URL_RATE_WINDOW_MS) {
      issuedWithinWindow += 1;
    }
  }

  return { activeSessions, issuedWithinWindow };
}

async function deleteStorageIfUnclaimed(ctx: MutationCtx, storageId: Id<"_storage">) {
  const existingAsset = await ctx.db
    .query("assets")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .first();
  if (existingAsset) {
    return;
  }

  try {
    await ctx.storage.delete(storageId);
  } catch {
    // Best-effort cleanup to avoid orphaned storage blobs.
  }
}

async function sweepOrphanedStorage(ctx: MutationCtx, now: number) {
  const cutoff = now - ORPHAN_STORAGE_MIN_AGE_MS;
  const candidates = await ctx.db.system
    .query("_storage")
    .order("asc")
    .take(ORPHAN_STORAGE_SWEEP_BATCH_SIZE);

  for (const candidate of candidates) {
    if (candidate._creationTime > cutoff) {
      continue;
    }

    const claimedAsset = await ctx.db
      .query("assets")
      .withIndex("by_storage", (q) => q.eq("storageId", candidate._id))
      .first();
    if (claimedAsset) {
      continue;
    }

    try {
      await ctx.storage.delete(candidate._id);
    } catch {
      // Best-effort sweep. Keep mutation resilient when blob is already gone.
    }
  }
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.object({
    uploadUrl: v.string(),
    uploadToken: v.string(),
  }),
  handler: async (ctx) => {
    const user = await ensureCurrentUser(ctx);
    const now = Date.now();
    const { activeSessions, issuedWithinWindow } = await cleanupUploadSessionsForUser(
      ctx,
      user._id,
      now,
    );
    await sweepOrphanedStorage(ctx, now);

    if (activeSessions >= MAX_ACTIVE_UPLOAD_SESSIONS_PER_USER) {
      throw new Error("Too many active uploads. Please finish or wait for existing uploads to expire.");
    }

    if (issuedWithinWindow >= MAX_UPLOAD_URLS_PER_WINDOW) {
      throw new Error("Upload rate limit exceeded. Please wait a few minutes.");
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    const uploadToken = createUploadToken();

    await ctx.db.insert("assetUploadSessions", {
      uploaderUserId: user._id,
      uploadToken,
      createdAt: now,
      expiresAt: now + UPLOAD_SESSION_TTL_MS,
    });

    return {
      uploadUrl,
      uploadToken,
    };
  },
});

export const saveUploadedImage = mutation({
  args: {
    uploadToken: v.string(),
    storageId: v.id("_storage"),
    deckId: v.optional(v.id("decks")),
    mime: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  returns: v.object({
    assetId: v.id("assets"),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await ensureCurrentUser(ctx);
    const normalizedMime = args.mime?.trim().toLowerCase();
    const now = Date.now();
    const storageMetadata = await ctx.storage.getMetadata(args.storageId);
    if (!storageMetadata) {
      throw new Error("Uploaded file not found");
    }
    const storageMime = resolveImageMime(
      storageMetadata.contentType?.trim().toLowerCase() ?? null,
      normalizedMime,
    );

    const uploadSession = await ctx.db
      .query("assetUploadSessions")
      .withIndex("by_token", (q) => q.eq("uploadToken", args.uploadToken))
      .first();
    if (!uploadSession) {
      throw new Error("Upload session not found");
    }
    if (uploadSession.uploaderUserId !== user._id) {
      throw new Error("Forbidden");
    }
    if (uploadSession.consumedAt) {
      throw new Error("Upload session already used");
    }
    if (uploadSession.expiresAt < now) {
      await ctx.db.delete(uploadSession._id);
      await deleteStorageIfUnclaimed(ctx, args.storageId);
      throw new Error("Upload session expired");
    }

    await ctx.db.patch(uploadSession._id, {
      consumedAt: now,
    });

    try {
      assertValidImageSize(storageMetadata.size);
      assertValidImageDimensions(args.width, args.height);

      if (args.deckId) {
        await assertCanEditDeck(ctx, args.deckId);
      }

      const existingAsset = await ctx.db
        .query("assets")
        .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
        .first();
      if (existingAsset) {
        throw new Error("Uploaded image already claimed");
      }

      const url = await ctx.storage.getUrl(args.storageId);

      const assetId = await ctx.db.insert("assets", {
        ownerUserId: user._id,
        deckId: args.deckId,
        type: "image",
        storageId: args.storageId,
        url: url ?? undefined,
        metadata: {
          mime: storageMime,
          width: args.width,
          height: args.height,
        },
        createdAt: now,
      });

      return {
        assetId,
        url,
      };
    } catch (error) {
      await deleteStorageIfUnclaimed(ctx, args.storageId);
      throw error;
    }
  },
});

export const getAsset = query({
  args: { assetId: v.id("assets") },
  returns: assetWithResolvedUrlValidator,
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }

    if (asset.deckId) {
      await assertCanReadDeck(ctx, asset.deckId);
    } else {
      const user = await getCurrentUser(ctx);
      if (!user || user._id !== asset.ownerUserId) {
        throw new Error("Forbidden");
      }
    }

    const resolvedUrl = asset.storageId
      ? ((await ctx.storage.getUrl(asset.storageId)) ?? null)
      : (asset.url ?? null);

    return {
      ...asset,
      resolvedUrl,
    };
  },
});

export const listByDeck = query({
  args: { deckId: v.id("decks") },
  returns: v.array(assetDocValidator),
  handler: async (ctx, args) => {
    await assertCanReadDeck(ctx, args.deckId);
    return await ctx.db
      .query("assets")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .order("desc")
      .collect();
  },
});
