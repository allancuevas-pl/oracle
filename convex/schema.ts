import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    role: v.union(v.literal("staff"), v.literal("client"), v.literal("admin")),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_role", ["role"]),

  settings: defineTable({
    assetTypes: v.array(v.string()),
    strategies: v.array(v.string()),
    locations: v.array(v.string()),
    debtStructures: v.array(v.string()),
  }),

  clients: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    company: v.optional(v.string()),
    role: v.optional(v.union(
      v.literal("buyer"),
      v.literal("seller"),
      v.literal("vendor"),
      v.literal("other")
    )),
    notes: v.optional(v.string()),
    createdBy: v.string(),
  }).index("by_name", ["name"]),

  briefs: defineTable({
    briefId: v.optional(v.string()), // e.g. "ORC-B0001"
    clientId: v.optional(v.id("clients")), // Link to clients table
    clientName: v.string(), // Denormalized for fast reads
    startDate: v.optional(v.number()), // Explicit brief open date (ms timestamp)
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

    assignees: v.optional(v.array(v.object({
      userId: v.id("users"),
      role: v.string(), // "Lead Agent" | "Support" | "Admin"
    }))),

    status: v.union(v.literal("active"), v.literal("archived")),
    createdBy: v.string(), // clerkId of the creator
  })
    .index("by_status", ["status"])
    .index("by_clientId", ["clientId"]),
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

    // Tenancy Schedule
    tenants: v.optional(v.array(v.object({
      id: v.string(),
      tenantName: v.string(),
      suite: v.optional(v.string()),
      lettableArea: v.optional(v.number()),      // sqm
      leaseStart: v.optional(v.string()),        // "YYYY-MM-DD"
      leaseEnd: v.optional(v.string()),          // "YYYY-MM-DD"
      netFaceRent: v.optional(v.number()),       // $/pa
      leaseType: v.optional(v.string()),         // "Net" | "Gross" | "Semi-Gross"
      reviewType: v.optional(v.string()),        // "CPI" | "Fixed %" | "Market"
      reviewRate: v.optional(v.number()),        // e.g. 3.5 for 3.5%
      nextReviewDate: v.optional(v.string()),    // "YYYY-MM-DD"
      options: v.optional(v.string()),           // e.g. "2 x 3yr"
    }))),

    // Outgoings Schedule
    outgoings: v.optional(v.array(v.object({
      id: v.string(),
      category: v.string(),   // e.g. "Land Tax", "Council Rates"
      amount: v.number(),     // $/pa
      notes: v.optional(v.string()),
    }))),
  }).index("by_status", ["status"]),

  matches: defineTable({
    briefId: v.id("briefs"),
    propertyId: v.id("properties"),
    // Full commercial deal lifecycle — 11 stages
    status: v.union(
      v.literal("Shortlisted"),        // 1.  Initial match shortlist
      v.literal("Prepping"),           // 2.  Team preparing analysis / IM
      v.literal("Report Ready"),       // 3.  Report ready to present to client
      v.literal("Under Review"),       // 4.  Client reviewing
      v.literal("Client Approved"),    // 3.  Client green-lit for pursuit
      v.literal("Offer Submitted"),    // 4.  Offer submitted to vendor
      v.literal("Under Offer"),        // 5.  Property under offer (vendor side)
      v.literal("Negotiating"),        // 6.  Active commercial negotiation
      v.literal("Offer Accepted"),     // 7.  Vendor accepted offer
      v.literal("Contract Execution"), // 8.  Contracts being executed
      v.literal("Due Diligence"),      // 9.  DD period underway
      v.literal("Unconditional"),      // 10. Conditions satisfied
      v.literal("Settlement"),         // 11. Deal settled (terminal win)
      v.literal("Client Rejected"),    // 11. Client passed (terminal loss)
      // Legacy — kept for backward compat with existing records
      v.literal("Client Accepted"),
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
    recordType: v.union(v.literal("brief"), v.literal("property"), v.literal("client")),
    type: v.union(v.literal("note"), v.literal("system")),
    content: v.string(), // e.g. "Changed stage to Due Diligence" or the user note text
    metadata: v.optional(v.string()), // Optional JSON string for tracking previous/new states
    createdBy: v.string(), // clerkId
  }).index("by_recordId", ["recordId"]),

  idCounters: defineTable({
    prefix: v.string(), // e.g. "B" for Briefs, "P" for Properties
    count: v.number(),
  }).index("by_prefix", ["prefix"]),

  pendingInvitations: defineTable({
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("staff")),
    invitedBy: v.string(), // clerkId of the inviting admin
    clerkInvitationId: v.optional(v.string()), // Clerk's invitation ID for revocation
  }).index("by_email", ["email"]),

  // IM extractions — one record per PDF upload, result stored as JSON string
  imExtractions: defineTable({
    propertyId: v.optional(v.id("properties")), // optional link to a property record
    storageId: v.optional(v.string()),           // Convex file storage ID
    filename: v.string(),
    status: v.union(
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed")
    ),
    result: v.optional(v.string()),  // JSON-stringified extraction payload
    error: v.optional(v.string()),
    model: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    createdBy: v.string(),
  })
    .index("by_propertyId", ["propertyId"])
    .index("by_status", ["status"]),
});
