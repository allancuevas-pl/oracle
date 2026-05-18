import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    role: v.union(v.literal("staff"), v.literal("client"), v.literal("admin")),
  }).index("by_clerkId", ["clerkId"]),

  settings: defineTable({
    assetTypes: v.array(v.string()),
    strategies: v.array(v.string()),
    locations: v.array(v.string()),
    debtStructures: v.array(v.string()),
  }),

  briefs: defineTable({
    briefId: v.optional(v.string()), // e.g. "ORC-B0001"
    clientName: v.string(), // Denormalized for fast reads
    stage: v.string(), // e.g. "Triage", "Feasibility"
    priority: v.optional(v.string()), // "High", "Medium", "Low"
    
    // Structured Brief Fields
    capital: v.optional(v.number()), // e.g. 3500000
    budgetMin: v.optional(v.number()), // e.g. 5000000
    budgetMax: v.optional(v.number()), // e.g. 7000000
    durationMin: v.optional(v.number()), // e.g. 1
    durationMax: v.optional(v.number()), // e.g. 3
    assetTypes: v.optional(v.array(v.string())), // e.g. ["Retail", "Industrial"]
    strategies: v.optional(v.array(v.string())), // e.g. ["Rental Reversion Upside"]
    debtStructure: v.optional(v.array(v.string())), // e.g. ["Cash", "Lease Debt"]
    location: v.optional(v.array(v.string())), // e.g. ["VIC", "QLD"]
    
    // Kept as strings for now
    targets: v.optional(v.string()), // e.g. "Project Margin 17%-20% Net"
    others: v.optional(v.string()), // Notes on contamination, flood risk, etc.
    
    // Deprecated legacy fields
    duration: v.optional(v.string()),
    budget: v.optional(v.string()),
    assetType: v.optional(v.string()),
    assetTarget: v.optional(v.string()), 
    estimatedValue: v.optional(v.string()),
    requirements: v.optional(v.string()),

    status: v.union(v.literal("active"), v.literal("archived")),
    createdBy: v.string(), // clerkId of the creator
  }).index("by_status", ["status"]),
  properties: defineTable({
    propertyId: v.optional(v.string()), // e.g. "ORC-P0001"
    address: v.string(),
    assetType: v.string(), // e.g. "Retail", "Industrial"
    askingPrice: v.optional(v.number()), // e.g. 5000000
    estimatedYield: v.optional(v.number()), // e.g. 5.5
    status: v.union(
      v.literal("On Market"),
      v.literal("Off Market"),
      v.literal("Under Offer"),
      v.literal("Sold"),
      v.literal("Archived")
    ),
    location: v.optional(v.string()), // e.g. "VIC"
    description: v.optional(v.string()),
    landArea: v.optional(v.number()), // in sqm
    buildingArea: v.optional(v.number()), // in sqm
    wales: v.optional(v.number()), // Weighted Average Lease Expiry (years)
    createdBy: v.string(), // clerkId
  }).index("by_status", ["status"]),

  matches: defineTable({
    briefId: v.id("briefs"),
    propertyId: v.id("properties"),
    status: v.union(
      v.literal("Shortlisted"),
      v.literal("Under Review"),
      v.literal("Rejected"),
      v.literal("Offered"),
      v.literal("Accepted")
    ),
    notes: v.optional(v.string()),
    createdBy: v.string(), // clerkId
  })
    .index("by_brief", ["briefId"])
    .index("by_property", ["propertyId"])
    .index("by_brief_and_property", ["briefId", "propertyId"]),

  activities: defineTable({
    recordId: v.string(), // ID of the brief or property
    recordType: v.union(v.literal("brief"), v.literal("property")),
    type: v.union(v.literal("note"), v.literal("system")),
    content: v.string(), // e.g. "Changed stage to Due Diligence" or the user note text
    metadata: v.optional(v.string()), // Optional JSON string for tracking previous/new states
    createdBy: v.string(), // clerkId
  }).index("by_recordId", ["recordId"]),
});
