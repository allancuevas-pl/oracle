import fs from 'fs';
import path from 'path';

const CONVEX_DIR = path.join(process.cwd(), 'convex');
let failed = false;

function checkFile(filePath) {
  if (!filePath.endsWith('.ts') || filePath.includes('_generated')) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract all exported queries and mutations
  const regex = /export const \w+ = (query|mutation)\(\{/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    // Find the handler block
    const functionStart = match.index;
    const handlerIndex = content.indexOf('handler:', functionStart);
    
    if (handlerIndex !== -1) {
      // Get the next 100 chars to see if they call an authz helper
      const handlerSnippet = content.substring(handlerIndex, handlerIndex + 150);
      
      let hasAuthz = false;
      
      // users.ts is the only file allowed to use requireAuthenticatedUser for now
      if (path.basename(filePath) === 'users.ts') {
        hasAuthz = handlerSnippet.includes('requireAuthenticatedUser');
      } else {
        hasAuthz = handlerSnippet.includes('requireStaffOrAdmin');
      }

      if (!hasAuthz) {
        console.error(`❌ SECURITY LINT FAILURE in ${path.basename(filePath)}`);
        if (path.basename(filePath) === 'users.ts') {
          console.error(`   Exported public function near index ${functionStart} is missing requireAuthenticatedUser check.`);
        } else {
          console.error(`   Exported public function near index ${functionStart} is missing requireStaffOrAdmin check. (requireAuthenticatedUser is not permitted for CRM files)`);
        }
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
