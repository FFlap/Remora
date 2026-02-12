import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel, Doc } from "../_generated/dataModel";

export type ReadCtx = GenericQueryCtx<DataModel>;
export type WriteCtx = GenericMutationCtx<DataModel>;

type AnyCtx = ReadCtx | WriteCtx;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export async function requireIdentity(ctx: AnyCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

export async function getUserByClerkId(
  ctx: AnyCtx,
  clerkUserId: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
}

export async function getCurrentUser(ctx: AnyCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return await getUserByClerkId(ctx, identity.subject);
}

export async function ensureCurrentUser(ctx: WriteCtx): Promise<Doc<"users">> {
  const identity = await requireIdentity(ctx);
  const existing = await getUserByClerkId(ctx, identity.subject);
  const email = normalizeEmail(identity.email);
  const displayName =
    (identity.name ?? "").trim() ||
    [identity.givenName, identity.familyName].filter(Boolean).join(" ") ||
    email ||
    "Remora User";

  if (existing) {
    if (existing.email !== email || existing.displayName !== displayName) {
      await ctx.db.patch(existing._id, {
        email,
        displayName,
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new Error("Failed to fetch updated user");
      }
      return updated;
    }
    return existing;
  }

  const createdAt = Date.now();
  const userId = await ctx.db.insert("users", {
    clerkUserId: identity.subject,
    email,
    displayName,
    createdAt,
  });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("Failed to create user");
  }
  return user;
}
