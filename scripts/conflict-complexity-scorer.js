#!/usr/bin/env node
/**
 * conflict-complexity-scorer.js
 *
 * Scores each conflict block by complexity using a weighted rubric.
 *
 * Factor          Weight  Example
 * linesChanged    0.30    10 lines = +3
 * functionsAffect 0.30    2 functions = +3
 * testCoverageGap 0.20    no tests = +5
 * authorExperience 0.10   new contributor = +3
 * fileHistory     0.10    frequently conflicted = +2
 *
 * Score > 7 → requires senior review
 *
 * Usage:
 *   node scripts/conflict-complexity-scorer.js [--file <path>] [--json]
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const getArg = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const TARGET_FILE = getArg("--file");
const JSON_OUTPUT = args.includes("--json");
const SENIOR_THRESHOLD = 7;

// ── Helpers ───────────────────────────────────────────────────────────────────

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
  } catch { return ""; }
}

/** Count commit frequency for a file (high frequency = higher risk). */
function getFileCommitCount(filePath) {
  const out = git(`log --oneline -- "${filePath}"`);
  return out ? out.split("\n").filter(Boolean).length : 0;
}

/** Get unique authors who touched this file. */
function getFileAuthors(filePath) {
  const out = git(`log --format="%ae" -- "${filePath}"`);
  return out ? [...new Set(out.split("\n").filter(Boolean))] : [];
}

/** Check if a test file exists for the source file. */
function hasTestFile(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  const dir = path.dirname(filePath);
  const testPatterns = [
    path.join(dir, `${base}.test.js`),
    path.join(dir, `${base}.test.ts`),
    path.join(dir, `${base}.spec.js`),
    path.join(dir, `${base}.spec.ts`),
    path.join(dir, "..", "test", `${base}.test.js`),
    path.join(dir, "..", "test", `${base}.test.ts`),
  ];
  return testPatterns.some((p) => fs.existsSync(p));
}

/** Parse conflict blocks out of a file. */
function parseConflictBlocks(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch { return []; }

  const lines = content.split("\n");
  const blocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("<<<<<<<")) {
      current = { start: i + 1, oursLines: [], theirsLines: [], inTheirs: false, file: filePath };
    } else if (line.startsWith("=======") && current) {
      current.inTheirs = true;
    } else if (line.startsWith(">>>>>>>") && current) {
      current.end = i + 1;
      current.branch = line.replace(">>>>>>>", "").trim();
      blocks.push(current);
      current = null;
    } else if (current) {
      if (!current.inTheirs) current.oursLines.push(line);
      else current.theirsLines.push(line);
    }
  }
  return blocks;
}

/** Extract function names touched within a set of lines. */
function extractFunctionNames(lines) {
  const names = new Set();
  const pat = /(?:async\s+)?(?:function\s+)?(\w+)\s*[=(]/;
  for (const line of lines) {
    const m = line.match(pat);
    if (m && m[1] && m[1].length > 2) names.add(m[1]);
  }
  return names;
}

// ── Scorer ────────────────────────────────────────────────────────────────────

function scoreConflictBlock(block) {
  const allLines = [...block.oursLines, ...block.theirsLines];
  const linesChanged = allLines.length;

  // Factor 1: lines changed (0–10 → weight 0.30)
  const linesScore = Math.min(linesChanged / 20 * 10, 10) * 0.30;

  // Factor 2: functions affected (0–10 → weight 0.30)
  const fns = extractFunctionNames(allLines);
  const fnScore = Math.min(fns.size * 2, 10) * 0.30;

  // Factor 3: test coverage gap (0 or 5 → weight 0.20)
  const testScore = hasTestFile(block.file) ? 0 : 5 * 0.20;

  // Factor 4: author experience (proxy: commit count for this file → weight 0.10)
  const authors = getFileAuthors(block.file);
  const authorScore = (authors.length < 2 ? 3 : 1) * 0.10;

  // Factor 5: file history (high-churn = higher risk → weight 0.10)
  const commits = getFileCommitCount(block.file);
  const histScore = (commits > 30 ? 5 : commits > 10 ? 3 : 1) * 0.10;

  const total = Math.round((linesScore + fnScore + testScore + authorScore + histScore) * 10) / 10;

  return {
    score: Math.min(total, 10),
    breakdown: {
      linesChanged,
      functionsAffected: fns.size,
      functionNames: [...fns],
      hasTests: hasTestFile(block.file),
      authorCount: authors.length,
      fileCommits: commits,
    },
    requiresSeniorReview: total >= SENIOR_THRESHOLD,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const filesToScore = TARGET_FILE
  ? [TARGET_FILE]
  : (() => {
      // scan all tracked files for conflicts
      const out = git("ls-files");
      return (out ? out.split("\n").filter(Boolean) : [])
        .filter((f) => /\.(js|ts|tsx|jsx|rs|json)$/.test(f));
    })();

const results = [];

for (const file of filesToScore) {
  const blocks = parseConflictBlocks(file);
  if (blocks.length === 0) continue;

  for (const block of blocks) {
    const scored = scoreConflictBlock(block);
    results.push({
      file,
      lines: `${block.start}–${block.end}`,
      branch: block.branch,
      ...scored,
    });
  }
}

if (JSON_OUTPUT) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.some((r) => r.requiresSeniorReview) ? 2 : 0);
}

if (results.length === 0) {
  console.log("✅ No conflict blocks to score.");
  process.exit(0);
}

console.log(`\n📊 Conflict Complexity Report\n${"─".repeat(60)}`);
for (const r of results) {
  const icon = r.requiresSeniorReview ? "🔴" : r.score >= 5 ? "🟠" : "🟢";
  console.log(`\n${icon} ${r.file} (lines ${r.lines})`);
  console.log(`   Score: ${r.score}/10${r.requiresSeniorReview ? " — ⚠️  SENIOR REVIEW REQUIRED" : ""}`);
  console.log(`   Lines changed:       ${r.breakdown.linesChanged}`);
  console.log(`   Functions affected:  ${r.breakdown.functionsAffected} [${r.breakdown.functionNames.join(", ")}]`);
  console.log(`   Has tests:           ${r.breakdown.hasTests ? "✅" : "❌"}`);
  console.log(`   Authors on file:     ${r.breakdown.authorCount}`);
  console.log(`   File commit count:   ${r.breakdown.fileCommits}`);
}

console.log(`\n${"─".repeat(60)}`);
const needReview = results.filter((r) => r.requiresSeniorReview);
if (needReview.length > 0) {
  console.log(`\n⚠️  ${needReview.length} conflict(s) require senior review (score ≥ ${SENIOR_THRESHOLD}).`);
  process.exit(2);
} else {
  console.log(`\n✅ All conflicts within auto-resolvable complexity range.`);
  process.exit(0);
}
