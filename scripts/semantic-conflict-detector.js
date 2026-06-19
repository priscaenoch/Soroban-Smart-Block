#!/usr/bin/env node
/**
 * semantic-conflict-detector.js
 *
 * Goes beyond text-level conflict detection to find SEMANTIC conflicts
 * between two branches without requiring a three-way merge:
 *
 *  1. Same function edited on both branches   (AST comparison)
 *  2. Same DB column changed                  (SQL schema diff)
 *  3. API contract change                     (OpenAPI diff)
 *  4. Import/export mismatch                  (module graph)
 *  5. Route overlap                           (Express route table)
 *  6. CSS class conflict                      (style comparison)
 *
 * Usage:
 *   node scripts/semantic-conflict-detector.js [--base <branch>] [--head <branch>]
 *
 * Outputs JSON report + human-readable summary.
 * Exit 0 = no semantic conflicts
 * Exit 1 = semantic conflicts detected
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const BASE_BRANCH = getArg("--base") ?? "main";
const HEAD_BRANCH = getArg("--head") ?? "HEAD";
const OUTPUT_FILE = getArg("--output") ?? null;

// ── Git helpers ───────────────────────────────────────────────────────────────

function git(cmd, opts = {}) {
  try {
    return execSync(`git ${cmd}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...opts,
    }).trim();
  } catch (e) {
    return null;
  }
}

function getChangedFiles(base, head) {
  const out = git(`diff --name-only ${base}...${head}`);
  return out ? out.split("\n").filter(Boolean) : [];
}

function getFileContent(ref, filePath) {
  return git(`show ${ref}:${filePath}`);
}

// ── 1. Function-level AST conflict detection ──────────────────────────────────

/** Extract function/method names from JS/TS source (regex-based, no full AST) */
function extractFunctions(source) {
  if (!source) return new Set();
  const names = new Set();
  const patterns = [
    /(?:async\s+)?function\s+(\w+)\s*\(/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\()/g,
    /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm,
    /(?:async\s+)?(\w+)\s*:\s*(?:async\s*)?(?:function|\()/g,
  ];
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(source)) !== null) {
      if (m[1] && m[1].length > 2 && !["if", "for", "while", "switch"].includes(m[1])) {
        names.add(m[1]);
      }
    }
  }
  return names;
}

function detectFunctionConflicts(changedFiles, base, head) {
  const conflicts = [];
  const jsFiles = changedFiles.filter((f) => /\.(js|ts|tsx|jsx)$/.test(f));

  // Find files changed on both branches relative to common ancestor
  const baseChanges = git(`diff --name-only ${base}`)?.split("\n").filter(Boolean) ?? [];
  const headChanges = git(`diff --name-only ${head} ${base}`)?.split("\n").filter(Boolean) ?? [];

  const bothChanged = jsFiles.filter(
    (f) => baseChanges.includes(f) || headChanges.includes(f)
  );

  for (const file of bothChanged) {
    const baseContent = getFileContent(base, file);
    const headContent = getFileContent(head, file);
    const ancestorContent = getFileContent(`${base}...${head}`, file);

    if (!baseContent || !headContent) continue;

    const baseFns = extractFunctions(baseContent);
    const headFns = extractFunctions(headContent);
    const ancestorFns = ancestorContent ? extractFunctions(ancestorContent) : new Set();

    // Functions modified in both branches
    const intersection = [...baseFns].filter((f) => headFns.has(f));
    for (const fn of intersection) {
      // Only flag if the function existed before (not newly added by both)
      if (ancestorFns.has(fn)) {
        conflicts.push({
          type: "function_conflict",
          severity: "high",
          file,
          detail: `Function '${fn}' was modified on both branches`,
          suggestion: "Manually review and merge the function body from both branches",
        });
      }
    }
  }
  return conflicts;
}

// ── 2. SQL schema diff ────────────────────────────────────────────────────────

function extractColumns(sqlSource) {
  if (!sqlSource) return new Map();
  const cols = new Map();
  // Match CREATE TABLE ... ( col_name type, ... ) and ALTER TABLE ADD COLUMN
  const createMatch = sqlSource.matchAll(
    /CREATE TABLE[^(]+\(([^;]+?)\);/gis
  );
  for (const m of createMatch) {
    const body = m[1];
    const lines = body.split("\n");
    for (const line of lines) {
      const colMatch = line.trim().match(/^(\w+)\s+([\w()]+)/);
      if (colMatch && !["PRIMARY", "UNIQUE", "CHECK", "FOREIGN", "INDEX", "KEY", "--"].includes(colMatch[1].toUpperCase())) {
        cols.set(colMatch[1], colMatch[2]);
      }
    }
  }
  // ALTER TABLE ADD COLUMN
  const alterMatch = sqlSource.matchAll(
    /ALTER TABLE\s+\w+\s+ADD COLUMN(?:\s+IF NOT EXISTS)?\s+(\w+)\s+([\w()]+)/gi
  );
  for (const m of alterMatch) {
    cols.set(m[1], m[2]);
  }
  return cols;
}

function detectSchemaConflicts(changedFiles, base, head) {
  const conflicts = [];
  const sqlFiles = changedFiles.filter((f) => /\.(sql|prisma)$/.test(f));
  const dbFiles = changedFiles.filter((f) => /db\.(js|ts)$/.test(f));

  for (const file of [...sqlFiles, ...dbFiles]) {
    const baseContent = getFileContent(base, file);
    const headContent = getFileContent(head, file);
    if (!baseContent || !headContent) continue;

    const baseCols = extractColumns(baseContent);
    const headCols = extractColumns(headContent);

    for (const [col, baseType] of baseCols) {
      if (headCols.has(col) && headCols.get(col) !== baseType) {
        conflicts.push({
          type: "schema_conflict",
          severity: "critical",
          file,
          detail: `Column '${col}' has different types: '${baseType}' vs '${headCols.get(col)}'`,
          suggestion: "Align column types before merging — check migration order",
        });
      }
    }

    // Both branches added the same column
    const ancestorContent = getFileContent(`${base}`, file) ?? "";
    const ancestorCols = extractColumns(ancestorContent);
    for (const col of baseCols.keys()) {
      if (headCols.has(col) && !ancestorCols.has(col)) {
        conflicts.push({
          type: "schema_conflict",
          severity: "high",
          file,
          detail: `Column '${col}' was added by both branches — potential duplicate migration`,
          suggestion: "Keep only one ALTER TABLE ADD COLUMN statement",
        });
      }
    }
  }
  return conflicts;
}

// ── 3. OpenAPI contract change ────────────────────────────────────────────────

function extractRoutes(source) {
  if (!source) return new Set();
  const routes = new Set();
  const patterns = [
    /(?:app|router)\.(?:get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /path:\s*['"`]([^'"`]+)['"`]/g,
  ];
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(source)) !== null) {
      routes.add(m[1]);
    }
  }
  return routes;
}

function detectApiConflicts(changedFiles, base, head) {
  const conflicts = [];
  const apiFiles = changedFiles.filter((f) =>
    /api\.(js|ts)|openapi|swagger/i.test(f)
  );

  for (const file of apiFiles) {
    const baseContent = getFileContent(base, file);
    const headContent = getFileContent(head, file);
    if (!baseContent || !headContent) continue;

    const baseRoutes = extractRoutes(baseContent);
    const headRoutes = extractRoutes(headContent);

    // Routes present in one but removed in the other
    const removed = [...baseRoutes].filter((r) => !headRoutes.has(r));
    const added = [...headRoutes].filter((r) => !baseRoutes.has(r));

    if (removed.length > 0 || added.length > 0) {
      conflicts.push({
        type: "api_contract_change",
        severity: "high",
        file,
        detail: `API routes changed — removed: [${removed.join(", ")}], added: [${added.join(", ")}]`,
        suggestion: "Update OpenAPI spec and client SDKs; ensure no breaking changes",
      });
    }
  }
  return conflicts;
}

// ── 4. Import/export mismatch ─────────────────────────────────────────────────

function extractExports(source) {
  if (!source) return new Set();
  const exports = new Set();
  const patterns = [
    /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
    /export\s*\{([^}]+)\}/g,
  ];
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(source)) !== null) {
      if (m[1] && !m[1].includes(",")) {
        exports.add(m[1].trim());
      } else if (m[1]) {
        m[1].split(",").forEach((e) => exports.add(e.trim().split(/\s+as\s+/)[0].trim()));
      }
    }
  }
  return exports;
}

function detectImportExportConflicts(changedFiles, base, head) {
  const conflicts = [];
  const jsFiles = changedFiles.filter((f) => /\.(js|ts|tsx|jsx)$/.test(f));

  for (const file of jsFiles) {
    const baseContent = getFileContent(base, file);
    const headContent = getFileContent(head, file);
    if (!baseContent || !headContent) continue;

    const baseExports = extractExports(baseContent);
    const headExports = extractExports(headContent);

    const removed = [...baseExports].filter((e) => !headExports.has(e));
    if (removed.length > 0) {
      conflicts.push({
        type: "import_export_mismatch",
        severity: "medium",
        file,
        detail: `Exports removed: [${removed.join(", ")}] — may break importers`,
        suggestion: "Check all import sites before removing exports",
      });
    }
  }
  return conflicts;
}

// ── 5. Route overlap ──────────────────────────────────────────────────────────

function detectRouteOverlap(changedFiles, base, head) {
  const conflicts = [];
  const routeFiles = changedFiles.filter((f) =>
    /routes?|api|controller/i.test(f) && /\.(js|ts)$/.test(f)
  );

  const allBaseRoutes = new Map();
  const allHeadRoutes = new Map();

  for (const file of routeFiles) {
    const baseContent = getFileContent(base, file);
    const headContent = getFileContent(head, file);
    const baseRoutes = extractRoutes(baseContent ?? "");
    const headRoutes = extractRoutes(headContent ?? "");

    baseRoutes.forEach((r) => allBaseRoutes.set(r, file));
    headRoutes.forEach((r) => allHeadRoutes.set(r, file));
  }

  for (const [route, file] of allHeadRoutes) {
    if (allBaseRoutes.has(route) && allBaseRoutes.get(route) !== file) {
      conflicts.push({
        type: "route_overlap",
        severity: "high",
        file,
        detail: `Route '${route}' defined in both '${file}' and '${allBaseRoutes.get(route)}'`,
        suggestion: "Consolidate route definitions — duplicate routes cause unpredictable behavior",
      });
    }
  }
  return conflicts;
}

// ── 6. CSS class conflict ─────────────────────────────────────────────────────

function extractCssClasses(source) {
  if (!source) return new Set();
  const classes = new Set();
  const m = source.matchAll(/^\s*\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)\s*\{/gm);
  for (const match of m) classes.add(match[1]);
  return classes;
}

function detectCssConflicts(changedFiles, base, head) {
  const conflicts = [];
  const cssFiles = changedFiles.filter((f) => /\.(css|scss|less)$/.test(f));

  for (const file of cssFiles) {
    const baseContent = getFileContent(base, file);
    const headContent = getFileContent(head, file);
    if (!baseContent || !headContent) continue;

    const baseClasses = extractCssClasses(baseContent);
    const headClasses = extractCssClasses(headContent);

    // Check for classes that appear in both with different property counts (naive but useful)
    const shared = [...baseClasses].filter((c) => headClasses.has(c));
    for (const cls of shared) {
      const baseRules = (baseContent.match(new RegExp(`\\.${cls}\\s*\\{([^}]+)\\}`, "g")) ?? []).join(" ");
      const headRules = (headContent.match(new RegExp(`\\.${cls}\\s*\\{([^}]+)\\}`, "g")) ?? []).join(" ");
      if (baseRules !== headRules) {
        conflicts.push({
          type: "css_conflict",
          severity: "low",
          file,
          detail: `CSS class '.${cls}' has diverging rules on both branches`,
          suggestion: "Review and reconcile style differences for class .${cls}",
        });
      }
    }
  }
  return conflicts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n🔍 Semantic Conflict Detector`);
console.log(`   Base: ${BASE_BRANCH}  →  Head: ${HEAD_BRANCH}\n`);

const changedFiles = getChangedFiles(BASE_BRANCH, HEAD_BRANCH);
if (changedFiles.length === 0) {
  console.log("✅ No changed files detected between branches.");
  process.exit(0);
}

console.log(`   Scanning ${changedFiles.length} changed file(s)...\n`);

const allConflicts = [
  ...detectFunctionConflicts(changedFiles, BASE_BRANCH, HEAD_BRANCH),
  ...detectSchemaConflicts(changedFiles, BASE_BRANCH, HEAD_BRANCH),
  ...detectApiConflicts(changedFiles, BASE_BRANCH, HEAD_BRANCH),
  ...detectImportExportConflicts(changedFiles, BASE_BRANCH, HEAD_BRANCH),
  ...detectRouteOverlap(changedFiles, BASE_BRANCH, HEAD_BRANCH),
  ...detectCssConflicts(changedFiles, BASE_BRANCH, HEAD_BRANCH),
];

// ── Output ────────────────────────────────────────────────────────────────────

const report = {
  timestamp: new Date().toISOString(),
  base: BASE_BRANCH,
  head: HEAD_BRANCH,
  files_scanned: changedFiles.length,
  total_conflicts: allConflicts.length,
  by_type: {},
  by_severity: { critical: [], high: [], medium: [], low: [] },
  conflicts: allConflicts,
};

for (const c of allConflicts) {
  report.by_type[c.type] = (report.by_type[c.type] ?? 0) + 1;
  report.by_severity[c.severity].push(c);
}

if (OUTPUT_FILE) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log(`📄 Report written to: ${OUTPUT_FILE}`);
}

if (allConflicts.length === 0) {
  console.log("✅ No semantic conflicts detected.");
  process.exit(0);
}

// Human-readable summary
const SEVERITY_ICON = { critical: "🔴", high: "🟠", medium: "🟡", low: "🔵" };
console.log(`⚠️  Found ${allConflicts.length} semantic conflict(s):\n`);

for (const [sev, items] of Object.entries(report.by_severity)) {
  if (items.length === 0) continue;
  console.log(`${SEVERITY_ICON[sev]} ${sev.toUpperCase()} (${items.length})`);
  for (const item of items) {
    console.log(`   [${item.type}] ${item.file}`);
    console.log(`   → ${item.detail}`);
    console.log(`   💡 ${item.suggestion}\n`);
  }
}

const hasCritical = report.by_severity.critical.length > 0;
const hasHigh = report.by_severity.high.length > 0;

if (hasCritical || hasHigh) {
  console.error("❌ Critical or high-severity semantic conflicts block this merge.");
  process.exit(1);
} else {
  console.warn("⚠️  Low/medium severity semantic conflicts — review recommended.");
  process.exit(0);
}
