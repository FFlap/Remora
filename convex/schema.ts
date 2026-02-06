import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Example table - replace with your own schema
  tasks: defineTable({
    text: v.string(),
    completed: v.boolean(),
    userId: v.string(),
  }).index("by_user", ["userId"]),
});
