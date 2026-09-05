#!/usr/bin/env node
/* eslint-env node */
/**
 * Interaction audit — finds the class of bug that unit tests cannot see.
 *
 * WHY THIS EXISTS
 * The 2026-09-05 test audit ran six groups and found eleven real defects, but
 * every one came from reading code paths or querying data. It was structurally
 * blind to "this looks clickable and isn't" — and the first thing a user
 * reported afterwards was exactly that: on the pipeline board the property
 * address is the biggest thing on a deal card and it opened nothing, because
 * the card's only link was a 12px arrow pointing at the brief.
 *
 * That is not a logic bug. No assertion would have caught it. It is found by
 * asking structural questions about the UI, which is what this does.
 *
 * WHAT IT IS NOT
 * This is a FINDING GENERATOR, not a gate. It reports things worth looking at
 * and it will produce false positives — a card is allowed to be non-navigable,
 * a list page is allowed to have no back button. Do not wire it into `build`.
 * Read the output, dismiss what is deliberate, fix what isn't.
 *
 *   node scripts/check-interactions.js            # all findings
 *   node scripts/check-interactions.js --rule=X   # one rule
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as parser from "@babel/parser";
import _traverse from "@babel/traverse";

const traverse = _traverse.default ?? _traverse;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "src");
const only = (process.argv.find((a) => a.startsWith("--rule=")) || "").split("=")[1];

// Elements that are already interactive: a click on them is expected and
// keyboard-operable for free.
const NATIVE_INTERACTIVE = new Set([
  "button", "a", "input", "select", "textarea", "Link", "NavLink",
  // A <label> forwards its click to the control it wraps, and Headless UI's
  // primitives render real buttons. Flagging them is noise.
  "label", "Listbox.Button", "Listbox.Option", "Disclosure.Button", "Menu.Button", "Menu.Item",
]);

/**
 * A modal backdrop is a click-to-dismiss convenience layered over a real close
 * button. It is not a control, has no business being tabbable, and flagging
 * every one of them buried the findings that mattered.
 */
function isDismissBackdrop(node, cls) {
  const onClick = node.openingElement?.attributes?.find(
    (a) => a.type === "JSXAttribute" && a.name?.name === "onClick");
  // Handles both `onClick={onClose}` and `onClick={() => onClose()}`.
  const expr = onClick?.value?.type === "JSXExpressionContainer" ? onClick.value.expression : null;
  const handler = expr?.type === "ArrowFunctionExpression"
    ? JSON.stringify(expr.body ?? {}).slice(0, 400)
    : String(expr?.name ?? "");
  const looksLikeClose = /close|dismiss|cancel/i.test(handler);
  return /\bfixed\b/.test(cls) && /\binset-0\b/.test(cls) && looksLikeClose;
}

// The fields a record is displayed by. A user who sees one of these expects to
// be able to open the thing it names.
const ENTITY_FIELDS = new Set([
  "address", "propertyAddress", "clientName", "name", "fileName", "title",
]);

const findings = [];
const add = (rule, file, line, message, detail) =>
  findings.push({ rule, file, line, message, detail });

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(p, out);
    else if (/\.jsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(p);
  }
  return out;
}

const rel = (f) => path.relative(path.join(__dirname, ".."), f);

function parse(code) {
  return parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator"],
  });
}

// ─── JSX helpers ─────────────────────────────────────────────────────────────

const elementName = (node) => {
  const n = node.openingElement?.name;
  if (!n) return "";
  if (n.type === "JSXIdentifier") return n.name;
  if (n.type === "JSXMemberExpression") return `${n.object.name}.${n.property.name}`;
  return "";
};

const attr = (node, name) =>
  node.openingElement?.attributes?.find((a) => a.type === "JSXAttribute" && a.name?.name === name);

/** The literal parts of a className, ignoring interpolated expressions. */
function classNameOf(node) {
  const a = attr(node, "className");
  if (!a) return "";
  if (a.value?.type === "StringLiteral") return a.value.value;
  if (a.value?.type === "JSXExpressionContainer") {
    const chunks = [];
    const visit = (n) => {
      if (!n) return;
      if (n.type === "StringLiteral") chunks.push(n.value);
      else if (n.type === "TemplateLiteral") {
        n.quasis.forEach((q) => chunks.push(q.value.raw));
        n.expressions.forEach(visit);
      } else if (n.type === "ConditionalExpression") { visit(n.consequent); visit(n.alternate); }
      else if (n.type === "LogicalExpression") { visit(n.left); visit(n.right); }
      else if (n.type === "BinaryExpression") { visit(n.left); visit(n.right); }
    };
    visit(a.value.expression);
    return chunks.join(" ");
  }
  return "";
}

const hasInteractiveAncestor = (nodePath) =>
  !!nodePath.findParent(
    (p) => p.isJSXElement() && (NATIVE_INTERACTIVE.has(elementName(p.node)) || !!attr(p.node, "onClick")),
  );

/**
 * Does this subtree contain anything a user can click or tab to?
 *
 * `localComponents` lets it follow a reference like <DealCard /> into the
 * component defined beside it — without that, a wrapper whose whole job is to
 * render one child always looked inert, which is a false positive that would
 * have masked the real pipeline finding rather than surfaced it.
 */
function subtreeHasInteractive(node, localComponents = new Map(), seen = new Set()) {
  let found = false;
  const visit = (n) => {
    if (found || !n || typeof n !== "object") return;
    if (n.type === "JSXElement") {
      const nm = elementName(n);
      if (NATIVE_INTERACTIVE.has(nm) || attr(n, "onClick")) { found = true; return; }
      if (localComponents.has(nm) && !seen.has(nm)) {
        seen.add(nm);
        if (subtreeHasInteractive(localComponents.get(nm), localComponents, seen)) { found = true; return; }
      }
    }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object" && v.type) visit(v);
    }
  };
  visit(node);
  return found;
}

// ─── Rules ───────────────────────────────────────────────────────────────────

function auditFile(file, code) {
  let ast;
  try { ast = parse(code); } catch { return; }

  const usesDrag = /useSortable|useDraggable/.test(code);

  traverse(ast, {
    JSXElement(p) {
      const node = p.node;
      const name = elementName(node);
      const line = node.loc?.start.line ?? 0;
      const cls = classNameOf(node);
      const onClick = attr(node, "onClick");
      const isNative = NATIVE_INTERACTIVE.has(name);

      // 1. Dressed as clickable, does nothing.
      if (/\bcursor-pointer\b/.test(cls) && !onClick && !isNative && !hasInteractiveAncestor(p)) {
        add("looks-clickable", file, line,
          `<${name}> has cursor-pointer but no onClick and no interactive ancestor`,
          "A pointer cursor is a promise. Either wire it up or drop the class.");
      }

      // 2. Clickable, but nothing says so.
      if (onClick && !isNative && !isDismissBackdrop(node, cls) && !/\bcursor-(pointer|grab|grabbing)\b/.test(cls)) {
        add("no-affordance", file, line,
          `<${name}> has onClick but no cursor affordance`,
          "Users don't discover clickable things that look inert.");
      }

      // 3. Mouse-only.
      if (onClick && !isNative && !isDismissBackdrop(node, cls)) {
        const keyboard = attr(node, "onKeyDown") || attr(node, "onKeyPress") || attr(node, "tabIndex");
        if (!keyboard) {
          add("keyboard-unreachable", file, line,
            `<${name}> is clickable but has no tabIndex or key handler`,
            "Cannot be reached by keyboard or announced as actionable.");
        }
      }

      // 4. A record is named but not openable.
      if (!isNative && !hasInteractiveAncestor(p)) {
        for (const child of node.children || []) {
          if (child.type !== "JSXExpressionContainer") continue;
          const src = code.slice(child.start, child.end);
          const m = src.match(/\b(\w+)\??\.(\w+)\b/);
          // `errors.name` is a validation message, not a record. Same for the
          // form/settings objects that happen to carry a `name` field.
          const isFormNoise = /^(errors|formState|field|settings|stage|option|item|cfg)$/.test(m?.[1] ?? "");
          if (m && ENTITY_FIELDS.has(m[2]) && !isFormNoise && !/=>|\bmap\(/.test(src)) {
            add("unlinked-record", file, line,
              `${m[1]}.${m[2]} rendered as plain text with no way to open it`,
              "Seeing a record named and not being able to open it is the pipeline bug.");
            break;
          }
        }
      }
    },
  });

  // 5. Drag-only surfaces.
  if (usesDrag) {
    const localComponents = new Map();
    traverse(ast, {
      "FunctionDeclaration|ArrowFunctionExpression"(p) {
        const nm = p.node.id?.name || p.parent?.id?.name || "";
        if (!/^[A-Z]/.test(nm)) return;
        let jsx = null;
        p.traverse({ JSXElement(j) { if (!jsx) jsx = j.node; } });
        if (jsx) localComponents.set(nm, jsx);
      },
    });
    traverse(ast, {
      "FunctionDeclaration|ArrowFunctionExpression"(p) {
        const fnName = p.node.id?.name || p.parent?.id?.name || "";
        if (!/Card|Item|Row|Tile/.test(fnName)) return;
        let jsx = null;
        p.traverse({ JSXElement(j) { if (!jsx) jsx = j.node; } });
        if (jsx && !subtreeHasInteractive(jsx, localComponents)) {
          add("drag-only", file, jsx.loc?.start.line ?? 0,
            `<${fnName}> is draggable but contains nothing clickable`,
            "Drag is the only way to use it; there is no click path and no keyboard path.");
        }
      },
    });
  }
}

// ─── Route-level rules ───────────────────────────────────────────────────────

function auditRoutes(files) {
  const appFile = files.find((f) => /App\.jsx$/.test(f));
  if (!appFile) return;
  const app = fs.readFileSync(appFile, "utf8");

  // Nested routes are declared relative ("deal/:token" inside "/client"), so
  // compare full paths or every child route reads as unreachable.
  const parents = [...app.matchAll(/path="(\/[^"]*)"/g)].map((m) => m[1]);
  const routes = [...app.matchAll(/path="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((r) => r !== "*")
    .map((r) => {
      if (r.startsWith("/")) return r;
      // The NEAREST preceding parent, not the first one declared — "/clients/:id"
      // sits above "/client" in the file and would otherwise adopt its children.
      const at = app.indexOf(`path="${r}"`);
      const parent = parents
        .filter((p) => p !== "/" && app.indexOf(`path="${p}"`) < at)
        .sort((a, b) => app.indexOf(`path="${b}"`) - app.indexOf(`path="${a}"`))[0];
      return parent ? `${parent}/${r}` : r;
    });
  const linked = new Set();
  for (const f of files) {
    const code = fs.readFileSync(f, "utf8");
    for (const m of code.matchAll(/(?:to|href)=(?:"([^"]+)"|\{`([^`]+)`\})/g)) linked.add(m[1] || m[2]);
    for (const m of code.matchAll(/navigate\((?:'([^']+)'|`([^`]+)`|"([^"]+)")/g)) linked.add(m[1] || m[2] || m[3]);
    // Nav configs declare routes as data, not JSX: { label: 'Pipeline', path: '/pipeline' }.
    // Missing these made every sidebar destination look like an orphan.
    for (const m of code.matchAll(/\b(?:path|to|href|route)\s*:\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)/g))
      linked.add(m[1] || m[2] || m[3]);
  }
  // Compare shapes, not literals: `/briefs/${id}` and `/briefs/:id` are the same route.
  const shape = (s) => s.replace(/\$\{[^}]+\}/g, "*").replace(/:[^/]+/g, "*").replace(/\/+$/, "") || "/";
  const linkedShapes = new Set([...linked].map(shape));

  for (const r of routes) {
    if (!linkedShapes.has(shape(r))) {
      add("orphan-route", rel(appFile), 0, `Route "${r}" has no link or navigate() anywhere in src/`,
        "Reachable only by typing the URL.");
    }
  }

  // A detail route the user can land on should offer a way back out.
  for (const f of files) {
    if (!/pages\//.test(f)) continue;
    const code = fs.readFileSync(f, "utf8");
    const isDetail = /useParams\(\)/.test(code);
    const hasBack = /useGoBack|onBack|ArrowLeft|navigate\(-1\)/.test(code);
    if (isDetail && !hasBack) {
      add("no-back", f, 0, "Detail page reads useParams() but offers no back affordance",
        "Deep links and refreshes land here with no way out but the sidebar.");
    }
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const files = walkFiles(SRC);
for (const f of files) auditFile(f, fs.readFileSync(f, "utf8"));
auditRoutes(files);

const shown = only ? findings.filter((f) => f.rule === only) : findings;
const byRule = shown.reduce((acc, f) => ((acc[f.rule] ||= []).push(f), acc), {});

const RULES = [
  "looks-clickable", "unlinked-record", "drag-only",
  "no-affordance", "keyboard-unreachable", "orphan-route", "no-back",
];

console.log(`\nInteraction audit — ${shown.length} findings across ${files.length} files\n`);
for (const rule of RULES) {
  const list = byRule[rule];
  if (!list?.length) continue;
  console.log(`── ${rule} (${list.length}) ─────────────────────────────`);
  console.log(`   ${list[0].detail}`);
  for (const f of list.slice(0, 12)) {
    console.log(`   ${rel(f.file)}${f.line ? `:${f.line}` : ""}  ${f.message}`);
  }
  if (list.length > 12) console.log(`   … and ${list.length - 12} more`);
  console.log("");
}
console.log("Heuristic by design — expect false positives. Triage, don't obey.\n");
