import { mutation, query } from "./_generated/server";
import { ensureCurrentUser, getCurrentUser } from "./lib/auth";

export const me = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const ensureMe = mutation({
  args: {},
  handler: async (ctx) => {
    return await ensureCurrentUser(ctx);
  },
});
