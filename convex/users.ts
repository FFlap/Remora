import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ensureCurrentUser, getCurrentUser } from "./lib/auth";
import { userDocValidator } from "./lib/constants";

export const me = query({
  args: {},
  returns: v.union(userDocValidator, v.null()),
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const ensureMe = mutation({
  args: {},
  returns: userDocValidator,
  handler: async (ctx) => {
    return await ensureCurrentUser(ctx);
  },
});
