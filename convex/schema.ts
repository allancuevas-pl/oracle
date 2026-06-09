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
    oracleModel: v.optional(v.string()),
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
    suburb: v.optional(v.string()),     // stored separately for comp recommendations
    assetType: v.string(),              // e.g. "Retail", "Industrial"
    askingPrice: v.optional(v.number()),
    estimatedYield: v.optional(v.number()),
    status: v.union(
      v.literal("On Market"),
      v.literal("Off Market"),
      v.literal("Under Offer"),
      v.literal("Sold"),
      v.literal("Archived")
    ),
    location: v.optional(v.string()),   // e.g. "VIC"
    description: v.optional(v.string()),
    landArea: v.optional(v.number()),   // sqm
    buildingArea: v.optional(v.number()), // sqm (NLA)
    wales: v.optional(v.number()),      // Weighted Average Lease Expiry (years)

    // Market benchmarks (from feaso / manual)
    vacancyRate: v.optional(v.number()),     // current vacancy %
    marketRentLow: v.optional(v.number()),  // $/sqm low estimate
    marketRentHigh: v.optional(v.number()), // $/sqm high estimate
    strategy: v.optional(v.string()),       // e.g. "Rental Reversion Upside"

    // Provenance
    sourceExtractionId: v.optional(v.id("imExtractions")), // IM scan this came from
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
      recoverable: v.optional(v.boolean()),
      notes: v.optional(v.string()),
    }))),
  })
    .index("by_status", ["status"])
    .index("by_suburb", ["suburb"]),

  // ─── Comps Database ───────────────────────────────────────────────────────
  // Independent comp records — lease and sale evidence.
  // Populated from IM scans or quick manual entry (e.g. agent phone calls).
  // Core vectors for AI recommendations: suburb + assetType + nlaSqm + type.
  comps: defineTable({
    type: v.union(v.literal("lease"), v.literal("sale")),

    // Location (suburb indexed for geo-filtering in recommendations)
    address: v.string(),
    suburb: v.string(),
    state: v.optional(v.string()),

    // Property characteristics (key for smart matching)
    assetType: v.optional(v.string()),  // Industrial / Retail / Office / Hybrid / Other
    nlaSqm: v.optional(v.number()),     // Net Lettable Area
    landAreaSqm: v.optional(v.number()),

    // ── Lease fields (type = "lease") ──
    rentPa: v.optional(v.number()),          // always stored as $/pa
    rentInputFormat: v.optional(v.union(     // what the user typed in
      v.literal("annual"),
      v.literal("monthly")
    )),
    rentPerSqm: v.optional(v.number()),      // auto-calc: rentPa / nlaSqm
    leaseType: v.optional(v.string()),       // Net | Gross | Semi-Gross
    leaseDate: v.optional(v.string()),       // "YYYY-MM-DD"
    leaseTerm: v.optional(v.string()),       // e.g. "3yr", "5 + 5yr"
    reviewType: v.optional(v.string()),      // CPI | Fixed % | Market
    reviewRate: v.optional(v.number()),      // e.g. 3.5

    // ── Sale fields (type = "sale") ──
    salePrice: v.optional(v.number()),
    pricePerSqmBuild: v.optional(v.number()), // auto-calc
    pricePerSqmLand: v.optional(v.number()),
    capRate: v.optional(v.number()),
    saleDate: v.optional(v.string()),        // "YYYY-MM-DD"

    // ── Source & trust ──
    source: v.optional(v.union(
      v.literal("agent_call"),
      v.literal("real_commercial"),
      v.literal("loopnet"),
      v.literal("im_scan"),
      v.literal("other")
    )),
    verified: v.optional(v.boolean()),       // verbally confirmed
    agentName: v.optional(v.string()),
    agentPhone: v.optional(v.string()),
    agentCompany: v.optional(v.string()),
    notes: v.optional(v.string()),

    // ── Links ──
    linkedPropertyId: v.optional(v.id("properties")),
    linkedExtractionId: v.optional(v.id("imExtractions")),
    createdBy: v.string(), // clerkId
  })
    .index("by_type", ["type"])
    .index("by_suburb", ["suburb"])
    .index("by_suburb_and_type", ["suburb", "type"])
    .index("by_suburb_assetType_type", ["suburb", "assetType", "type"])
    .index("by_linkedProperty", ["linkedPropertyId"]),

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

  // ─── Feasibility Analysis ─────────────────────────────────────────────────
  // One feaso record per property — stores analyst inputs.
  // Evidence (linked comps) lives on the comps table via linkedPropertyId.
  // All outputs (new value, ROI, IRR) are calculated client-side from these inputs.
  feasos: defineTable({
    propertyId: v.id("properties"),

    // Market benchmarks (analyst-adopted ranges from evidence)
    marketRentLow: v.optional(v.number()),          // $/sqm
    marketRentHigh: v.optional(v.number()),         // $/sqm
    salePricePerSqmBuildLow: v.optional(v.number()),
    salePricePerSqmBuildHigh: v.optional(v.number()),
    salePricePerSqmLandLow: v.optional(v.number()),
    salePricePerSqmLandHigh: v.optional(v.number()),
    adoptedCapRate: v.optional(v.number()),         // % e.g. 5.5 — drives new value calc

    // Project inputs
    offerPrice: v.optional(v.number()),
    projectDurationYears: v.optional(v.number()),   // e.g. 1.5

    // Acquisition costs
    stampDutyPct: v.optional(v.number()),           // % e.g. 5.5 (0 for SA via scheme)
    closingCosts: v.optional(v.number()),           // $ flat
    baFeePct: v.optional(v.number()),               // % of offer price e.g. 2.5

    // Project costs
    leasingCostsPct: v.optional(v.number()),        // % of market rent e.g. 11
    incentivesPct: v.optional(v.number()),          // % of market rent e.g. 15
    incentiveTermYears: v.optional(v.number()),     // lease term for incentive calc e.g. 5
    interestRatePct: v.optional(v.number()),        // % p.a. e.g. 6.5
    ltvRatio: v.optional(v.number()),               // loan-to-value e.g. 0.5
    works: v.optional(v.number()),                  // $ makegood / capex works
    vacancyMonths: v.optional(v.number()),          // months of vacancy allowance

    notes: v.optional(v.string()),
    createdBy: v.string(),
  }).index("by_propertyId", ["propertyId"]),
});
