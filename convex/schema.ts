import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    // "blocked" = signed up without an invite — zero access anywhere
    role: v.union(v.literal("staff"), v.literal("client"), v.literal("admin"), v.literal("blocked")),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_role", ["role"])
    .index("by_email", ["email"]),

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
    portalInvitedAt: v.optional(v.number()),  // when they were invited to the client portal
    createdBy: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_email", ["email"]),

  // Directory of non-client contacts (agents, contractors/inspectors,
  // solicitors, brokers). Clients live in `clients`; the Directory page
  // aggregates both. Kept deliberately simple — a searchable address book.
  contacts: defineTable({
    name: v.string(),
    category: v.union(
      v.literal("agent"),
      v.literal("contractor"),
      v.literal("solicitor"),
      v.literal("broker"),
      v.literal("other")
    ),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    state: v.optional(v.string()),        // NSW / VIC / QLD / ... (uppercase)
    suburb: v.optional(v.string()),
    specialty: v.optional(v.string()),    // e.g. "Building & Pest", "Conveyancer"
    notes: v.optional(v.string()),
    createdBy: v.string(),                // clerkId
    updatedAt: v.optional(v.number()),    // ms timestamp of last edit
  })
    .index("by_category", ["category"])
    .index("by_name", ["name"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["category", "state"],
    }),

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
    photoIds: v.optional(v.array(v.string())), // Convex storage IDs of property photos (from IM scan)

    // Walkthrough / marketing videos — hosted links (YouTube/Vimeo/Loom) or uploaded files
    videos: v.optional(v.array(v.object({
      id: v.string(),                                          // client-generated row id
      kind: v.union(v.literal("link"), v.literal("upload")),
      url: v.optional(v.string()),                            // link kind: original URL
      storageId: v.optional(v.string()),                      // upload kind: Convex storage ID
      title: v.optional(v.string()),
      addedAt: v.number(),
    }))),

    // FISO Google Sheet (generated export — see convex/googleSheets.ts)
    fisoSheetUrl: v.optional(v.string()),
    fisoSheetId: v.optional(v.string()),
    fisoSheetAt: v.optional(v.number()),     // ms timestamp of last generation

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
    postcode: v.optional(v.string()),   // AU 4-digit; kept as string to preserve leading zeros

    // Property characteristics (key for smart matching)
    assetType: v.optional(v.string()),  // Industrial / Retail / Office / Hybrid / Other
    grade: v.optional(v.union(          // building grade (commercial classification)
      v.literal("Prime"),
      v.literal("A"),
      v.literal("B"),
      v.literal("C")
    )),
    nlaSqm: v.optional(v.number()),     // Net Lettable Area
    landAreaSqm: v.optional(v.number()),

    // ── Lease fields (type = "lease") ──
    tenant: v.optional(v.string()),          // lessee / tenant name
    rentPa: v.optional(v.number()),          // always stored as $/pa
    rentInputFormat: v.optional(v.union(     // what the user typed in
      v.literal("annual"),
      v.literal("monthly")
    )),
    rentPerSqm: v.optional(v.number()),      // auto-calc: rentPa / nlaSqm
    leaseType: v.optional(v.string()),       // Net | Gross | Semi-Gross
    leaseDate: v.optional(v.string()),       // "YYYY-MM-DD"
    leaseExpiry: v.optional(v.string()),     // "YYYY-MM-DD" — lease expiry / end of term
    leaseTerm: v.optional(v.string()),       // e.g. "3yr", "5 + 5yr"
    leaseTermYears: v.optional(v.number()),  // numeric term in years (e.g. 5)
    incentives: v.optional(v.string()),      // e.g. "6 months rent-free, $50K fitout"
    incentivePct: v.optional(v.number()),    // incentive as a % (e.g. 17.5)
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
      v.literal("comp_scan"),          // extracted from an agent-supplied comp table via the comp scanner
      v.literal("historical_import"),  // bulk-imported from the team's state comp sheets
      v.literal("arealytics"),         // bulk-imported from the Arealytics transaction archive
      v.literal("property_lions"),     // curated comps supplied by Property Lions (Will)
      v.literal("other")
    )),
    verified: v.optional(v.boolean()),       // verbally confirmed
    agentName: v.optional(v.string()),
    agentPhone: v.optional(v.string()),
    agentCompany: v.optional(v.string()),
    notes: v.optional(v.string()),

    // ── Audit ──
    updatedAt: v.optional(v.number()),     // ms timestamp of last edit
    updatedBy: v.optional(v.string()),     // clerkId of last editor

    // ── Links ──
    linkedPropertyId: v.optional(v.id("properties")),
    linkedExtractionId: v.optional(v.id("imExtractions")),
    createdBy: v.string(), // clerkId
  })
    .index("by_type", ["type"])
    .index("by_suburb", ["suburb"])
    .index("by_suburb_and_type", ["suburb", "type"])
    .index("by_suburb_assetType_type", ["suburb", "assetType", "type"])
    .index("by_source", ["source"])
    .index("by_linkedProperty", ["linkedPropertyId"])
    // Full-text search over address so the Comps browse can find a comp across
    // the ~260k-row table instantly, filterable by type/source.
    .searchIndex("search_address", {
      searchField: "address",
      filterFields: ["type", "source"],
    }),

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
    role: v.union(v.literal("admin"), v.literal("staff"), v.literal("client")),
    invitedBy: v.string(), // clerkId of the inviting admin
    clerkInvitationId: v.optional(v.string()), // Clerk's invitation ID for revocation
    clientRecordId: v.optional(v.id("clients")), // set when inviting a client
  }).index("by_email", ["email"]),

  // AML / compliance documents the team uploads for a client. The client sees
  // only their own docs in the portal (scoped by email -> clients record). Staff
  // upload + delete; clients are view/download-only. (No property access here.)
  clientDocuments: defineTable({
    clientId: v.id("clients"),
    storageId: v.id("_storage"),        // Convex file storage id (the uploaded file)
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),       // bytes
    label: v.optional(v.string()),      // optional free-text note (e.g. "Passport")
    uploadedBy: v.string(),             // clerkId of the uploading staff member
    uploadedAt: v.number(),
  }).index("by_clientId", ["clientId"]),

  // IM extractions — one record per PDF upload, result stored as JSON string
  imExtractions: defineTable({
    propertyId: v.optional(v.id("properties")), // optional link to a property record
    storageId: v.optional(v.string()),           // Convex file storage ID (the PDF)
    photoIds: v.optional(v.array(v.string())),   // storage IDs of photos pulled from the IM
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

  // ─── Client Deal Reports ──────────────────────────────────────────────────
  // One record per "Send to Client" action on a brief+property match.
  // Accessed publicly at /report/:token — token IS the credential.
  dealReports: defineTable({
    briefId: v.id("briefs"),
    propertyId: v.id("properties"),
    matchId: v.optional(v.id("matches")),

    // Denormalized for fast public reads (no joins on the client page)
    clientName: v.string(),
    clientEmail: v.optional(v.string()),
    propertyAddress: v.string(),

    // UUID v4 — the share token, generated client-side
    token: v.string(),

    // Status lifecycle
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("viewed"),
      v.literal("approved"),
      v.literal("declined")
    ),

    // Optional message from the analyst
    analystMessage: v.optional(v.string()),

    // Timestamps
    sentAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
    respondedAt: v.optional(v.number()),

    // Client response
    clientDecision: v.optional(v.union(v.literal("approved"), v.literal("declined"))),
    clientNote: v.optional(v.string()),

    createdBy: v.string(), // clerkId
  })
    .index("by_token", ["token"])
    .index("by_briefId", ["briefId"])
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
