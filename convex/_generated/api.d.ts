/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as assetTypes from "../assetTypes.js";
import type * as authz from "../authz.js";
import type * as briefs from "../briefs.js";
import type * as clientDocuments from "../clientDocuments.js";
import type * as clientPortal from "../clientPortal.js";
import type * as clients from "../clients.js";
import type * as compDates from "../compDates.js";
import type * as compExtractionAction from "../compExtractionAction.js";
import type * as comps from "../comps.js";
import type * as contacts from "../contacts.js";
import type * as dashboard from "../dashboard.js";
import type * as dealFiles from "../dealFiles.js";
import type * as dealReports from "../dealReports.js";
import type * as extractionPrompt from "../extractionPrompt.js";
import type * as feasos from "../feasos.js";
import type * as googleSheets from "../googleSheets.js";
import type * as imExtraction from "../imExtraction.js";
import type * as imExtractionAction from "../imExtractionAction.js";
import type * as matches from "../matches.js";
import type * as migrations from "../migrations.js";
import type * as properties from "../properties.js";
import type * as settings from "../settings.js";
import type * as team from "../team.js";
import type * as testing from "../testing.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as wale from "../wale.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  assetTypes: typeof assetTypes;
  authz: typeof authz;
  briefs: typeof briefs;
  clientDocuments: typeof clientDocuments;
  clientPortal: typeof clientPortal;
  clients: typeof clients;
  compDates: typeof compDates;
  compExtractionAction: typeof compExtractionAction;
  comps: typeof comps;
  contacts: typeof contacts;
  dashboard: typeof dashboard;
  dealFiles: typeof dealFiles;
  dealReports: typeof dealReports;
  extractionPrompt: typeof extractionPrompt;
  feasos: typeof feasos;
  googleSheets: typeof googleSheets;
  imExtraction: typeof imExtraction;
  imExtractionAction: typeof imExtractionAction;
  matches: typeof matches;
  migrations: typeof migrations;
  properties: typeof properties;
  settings: typeof settings;
  team: typeof team;
  testing: typeof testing;
  users: typeof users;
  utils: typeof utils;
  wale: typeof wale;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
