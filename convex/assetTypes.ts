/**
 * The canonical commercial asset types.
 *
 * This list previously existed in five places that had drifted apart:
 * `settings.ts` seeded three ("Industrial", "Retail", "Office"), the comp
 * form and comp filters hardcoded six, and the comp-extraction prompt named
 * five — so a comp could be tagged "Mixed Use" in the form and never match
 * the filter, and the AI was told about types the UI didn't offer.
 *
 * Adding "Land" (Will, 2026-09-02: development sites need it) meant touching
 * all five, so they now import from here instead. `convex/` and `src/` can
 * both import this module — the frontend already imports from `convex/`.
 *
 * NOTE: `settings.assetTypes` is a stored, admin-editable row. This list is
 * the seed default and the source for the comps UI; changing it here does not
 * retroactively update an existing settings row — see
 * `migrations.addAssetType` for that.
 */
export const ASSET_TYPES = [
  "Industrial",
  "Retail",
  "Office",
  "Land",
  "Hybrid",
  "Mixed Use",
  "Other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

/** Comma-separated, for embedding in an extraction prompt. */
export const ASSET_TYPES_PROMPT = ASSET_TYPES.join(", ");
