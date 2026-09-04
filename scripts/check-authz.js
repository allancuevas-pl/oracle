import fs from 'fs';
import path from 'path';

const CONVEX_DIR = path.join(process.cwd(), 'convex');
let failed = false;

// Bootstrap endpoints in users.ts that pre-date a user record and therefore
// can't use requireAuthenticatedUser (which itself requires the user row to
// exist). They must still do an inline ctx.auth.getUserIdentity() check —
// the lint enforces that below so this allowlist can't be used to skip auth.
const USERS_BOOTSTRAP_ALLOWLIST = new Set(['getCurrentUser', 'storeUser']);

// Client-portal queries in clientPortal.ts.
// These check role === "client" internally via ctx.auth — not staff/admin gated.
const CLIENT_PORTAL_ALLOWLIST = new Set(['getMyPortalData', 'getMyReport', 'getMyDocuments']);

// Public token-gated endpoints in dealReports.ts.
// These are intentionally unauthenticated — the UUID report token IS the
// credential. Accessible at /report/:token with no Clerk session.
// No CRM data is exposed; only the specific report bundle for that token.
const DEAL_REPORTS_PUBLIC_ALLOWLIST = new Set([
  'getReportByToken',    // Client portal query — token = credential
  'markReportViewed',    // Client marks report as viewed
  'submitClientDecision', // Client submits approve/decline
]);

function checkFile(filePath) {
  if (!filePath.endsWith('.ts') || filePath.includes('_generated')) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  // Extract all exported queries and mutations along with their name
  // Actions were outside this gate entirely, which is how imExtractionAction
  // shipped with no auth check at all — and actions are where the Anthropic,
  // Clerk and Google Drive calls live.
  const regex = /export const (\w+) = (query|mutation|action)\(\{/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const fnName = match[1];
    const fnKind = match[2];
    const functionStart = match.index;
    const handlerIndex = content.indexOf('handler:', functionStart);

    if (handlerIndex !== -1) {
      // Widen the window — handlers with arg destructuring push the auth
      // call past the original 150-char cutoff.
      // Actions often destructure several args before the guard, so give them
      // a wider window than queries/mutations.
      const windowSize = fnKind === 'action' ? 600 : 250;
      const handlerSnippet = content.substring(handlerIndex, handlerIndex + windowSize);

      let hasAuthz;
      let reason;

      if (fileName === 'users.ts') {
        if (USERS_BOOTSTRAP_ALLOWLIST.has(fnName)) {
          // Bootstrap endpoint — must still check identity inline.
          hasAuthz = handlerSnippet.includes('ctx.auth.getUserIdentity');
          reason = `Bootstrap endpoint '${fnName}' is missing inline ctx.auth.getUserIdentity() check.`;
        } else {
          // requireStaffOrAdmin is a superset of requireAuthenticatedUser — both valid here
          hasAuthz = handlerSnippet.includes('requireAuthenticatedUser') || handlerSnippet.includes('requireStaffOrAdmin');
          reason = `'${fnName}' in users.ts is missing requireAuthenticatedUser or requireStaffOrAdmin check. (Add to USERS_BOOTSTRAP_ALLOWLIST only if it must run before user provisioning.)`;
        }
      } else if (fileName === 'clientPortal.ts' && CLIENT_PORTAL_ALLOWLIST.has(fnName)) {
        // Client-role gated internally — not staff/admin. Skip standard check.
        hasAuthz = true;
        reason = '';
      } else if (fileName === 'dealReports.ts' && DEAL_REPORTS_PUBLIC_ALLOWLIST.has(fnName)) {
        // Intentionally public — token-gated, not Clerk-gated. Skip auth check.
        hasAuthz = true;
        reason = '';
      } else if (fnKind === 'action') {
        // Actions have no ctx.db, so they cannot call requireStaffOrAdmin.
        // The established pattern here is to fetch the caller via a query and
        // check the role explicitly — that must be present and must actually
        // compare a role, not merely look the user up.
        const looksUpCaller = handlerSnippet.includes('getCurrentUser');
        const checksRole = /role\s*!==?\s*["'](admin|staff)["']/.test(handlerSnippet)
          || handlerSnippet.includes('requireStaffOrAdmin')
          || handlerSnippet.includes('requireAdmin');
        hasAuthz = looksUpCaller && checksRole;
        reason = `action '${fnName}' is missing an auth gate. Actions cannot use requireStaffOrAdmin (no ctx.db) — fetch the caller with api.users.getCurrentUser and reject unless role is admin/staff.`;
      } else {
        // requireAdmin is a superset restriction of requireStaffOrAdmin — both are valid.
        hasAuthz = handlerSnippet.includes('requireStaffOrAdmin') || handlerSnippet.includes('requireAdmin');
        reason = `'${fnName}' is missing requireStaffOrAdmin (or requireAdmin) check. (requireAuthenticatedUser is not permitted for CRM files)`;
      }

      if (!hasAuthz) {
        console.error(`❌ SECURITY LINT FAILURE in ${fileName}`);
        console.error(`   ${reason}`);
        failed = true;
      }
    }
  }
}

function run() {
  const files = fs.readdirSync(CONVEX_DIR);
  files.forEach(f => checkFile(path.join(CONVEX_DIR, f)));

  if (failed) {
    console.error("\nBuild Failed: All public Convex CRM queries and mutations must begin with a requireStaffOrAdmin check.");
    process.exit(1);
  } else {
    console.log("✅ Security Lint Passed: All public endpoints are locked down.");
  }
}

run();
