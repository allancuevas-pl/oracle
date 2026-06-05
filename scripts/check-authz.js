import fs from 'fs';
import path from 'path';

const CONVEX_DIR = path.join(process.cwd(), 'convex');
let failed = false;

// Bootstrap endpoints in users.ts that pre-date a user record and therefore
// can't use requireAuthenticatedUser (which itself requires the user row to
// exist). They must still do an inline ctx.auth.getUserIdentity() check —
// the lint enforces that below so this allowlist can't be used to skip auth.
const USERS_BOOTSTRAP_ALLOWLIST = new Set(['getCurrentUser', 'storeUser']);

function checkFile(filePath) {
  if (!filePath.endsWith('.ts') || filePath.includes('_generated')) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  // Extract all exported queries and mutations along with their name
  const regex = /export const (\w+) = (query|mutation)\(\{/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const fnName = match[1];
    const functionStart = match.index;
    const handlerIndex = content.indexOf('handler:', functionStart);

    if (handlerIndex !== -1) {
      // Widen the window — handlers with arg destructuring push the auth
      // call past the original 150-char cutoff.
      const handlerSnippet = content.substring(handlerIndex, handlerIndex + 250);

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
