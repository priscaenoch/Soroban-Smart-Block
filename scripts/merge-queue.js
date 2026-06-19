#!/usr/bin/env node
/**
 * merge-queue.js
 *
 * Intelligent merge queue with priority ordering.
 *
 * Features:
 *  - Groups related PRs to minimize conflicts
 *  - Orders by conflict probability (lowest first)
 *  - Simulates rebase with conflict reporting
 *  - Batches non-conflicting PRs
 *  - Rollback support on merge failure
 *
 * Usage:
 *   node scripts/merge-queue.js [--list] [--process] [--add <branch>] [--dry-run]
 *
 * Queue state is persisted to .git/merge-queue.json
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const QUEUE_FILE = path.join(ROOT, ".git", "merge-queue.json");
const BASE_BRANCH = process.env.BASE_BRANCH ?? "main";

const args = process.argv.slice(2);
const getArg = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const CMD_LIST    = args.includes("--list");
const CMD_PROCESS = args.includes("--process");
const CMD_ADD     = getArg("--add");
const DRY_RUN     = args.includes("--dry-run");

// ── Git helpers ───────────────────────────────────────────────────────────────

function git(cmd, opts = {}) {
  try {
    return execSync(`git ${cmd}`, {
      encoding: "utf8",
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      ...opts,
    }).trim();
  } catch (e) {
    return null;
  }
}

function gitSafe(cmd) {
  try {
    return execSync(`git ${cmd}`, {
      encoding: "utf8",
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    return e.stderr ?? "";
  }
}

// ── Queue persistence ─────────────────────────────────────────────────────────

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return { entries: [], processed: [] };
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
  } catch { return { entries: [], processed: [] }; }
}

function saveQueue(q) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
}

// ── Conflict probability estimator ───────────────────────────────────────────

/**
 * Estimate how likely a branch is to conflict with BASE_BRANCH.
 * Factors: files changed, how many other PRs touch the same files,
 * how old the branch is (days since fork).
 */
function estimateConflictProbability(branch, existingEntries) {
  const changedFiles = git(`diff --name-only ${BASE_BRANCH}...${branch}`)?.split("\n").filter(Boolean) ?? [];
  if (changedFiles.length === 0) return 0;

  // How many queued entries share files with this branch?
  let sharedFileCount = 0;
  for (const entry of existingEntries) {
    const entryFiles = entry.changedFiles ?? [];
    sharedFileCount += entryFiles.filter((f) => changedFiles.includes(f)).length;
  }

  // Days since the branch diverged from base
  const forkDate = git(`log --format=%ct -1 $(git merge-base ${BASE_BRANCH} ${branch})`);
  const daysSinceFork = forkDate
    ? Math.floor((Date.now() / 1000 - Number(forkDate)) / 86400)
    : 0;

  // Probability formula (0–1)
  const fileFactor   = Math.min(changedFiles.length / 20, 1) * 0.4;
  const sharedFactor = Math.min(sharedFileCount / 10, 1) * 0.4;
  const ageFactor    = Math.min(daysSinceFork / 30, 1) * 0.2;

  return Math.round((fileFactor + sharedFactor + ageFactor) * 100) / 100;
}

/** Check if two branches touch any of the same files. */
function branchesOverlap(branchA, branchB) {
  const filesA = git(`diff --name-only ${BASE_BRANCH}...${branchA}`)?.split("\n").filter(Boolean) ?? [];
  const filesB = git(`diff --name-only ${BASE_BRANCH}...${branchB}`)?.split("\n").filter(Boolean) ?? [];
  return filesA.some((f) => filesB.includes(f));
}

/** Group entries into non-conflicting batches. */
function groupIntoBatches(entries) {
  const batches = [];
  const used = new Set();

  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue;
    const batch = [entries[i]];
    used.add(i);

    for (let j = i + 1; j < entries.length; j++) {
      if (used.has(j)) continue;
      const conflicts = batch.some((b) => branchesOverlap(b.branch, entries[j].branch));
      if (!conflicts) {
        batch.push(entries[j]);
        used.add(j);
      }
    }
    batches.push(batch);
  }
  return batches;
}

// ── Merge operations ──────────────────────────────────────────────────────────

function saveSnapshot() {
  return git(`rev-parse ${BASE_BRANCH}`);
}

function rollback(snapshot) {
  if (!snapshot) return;
  git(`checkout ${BASE_BRANCH}`);
  git(`reset --hard ${snapshot}`);
  console.log(`   🔄 Rolled back ${BASE_BRANCH} to ${snapshot.slice(0, 8)}`);
}

function tryMergeBranch(branch) {
  // Simulate rebase to detect conflicts without actually merging
  const result = gitSafe(`merge-tree $(git merge-base ${BASE_BRANCH} ${branch}) ${BASE_BRANCH} ${branch}`);
  const hasConflict = result.includes("<<<<<<<") || result.includes("conflict");

  if (hasConflict) {
    return {
      success: false,
      conflicts: result
        .split("\n")
        .filter((l) => l.includes("<<<<<<<") || l.includes(">>>>>>>"))
        .slice(0, 5),
    };
  }
  return { success: true, conflicts: [] };
}

function mergeBranch(branch, message) {
  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would merge: git merge --no-ff ${branch} -m "${message}"`);
    return true;
  }
  const result = gitSafe(`merge --no-ff ${branch} -m "${message}"`);
  return !result.includes("CONFLICT") && !result.includes("error");
}

// ── Commands ──────────────────────────────────────────────────────────────────

function cmdAdd(branch) {
  if (!git(`rev-parse --verify ${branch}`)) {
    console.error(`❌ Branch '${branch}' does not exist.`);
    process.exit(1);
  }

  const queue = loadQueue();
  if (queue.entries.some((e) => e.branch === branch)) {
    console.log(`⚠️  Branch '${branch}' is already in the queue.`);
    return;
  }

  const changedFiles = git(`diff --name-only ${BASE_BRANCH}...${branch}`)?.split("\n").filter(Boolean) ?? [];
  const conflictProb = estimateConflictProbability(branch, queue.entries);

  queue.entries.push({
    branch,
    addedAt: new Date().toISOString(),
    changedFiles,
    conflictProbability: conflictProb,
    status: "pending",
  });

  // Re-sort: lowest conflict probability first
  queue.entries.sort((a, b) => a.conflictProbability - b.conflictProbability);
  saveQueue(queue);

  console.log(`✅ Added '${branch}' to merge queue.`);
  console.log(`   Conflict probability: ${(conflictProb * 100).toFixed(1)}%`);
  console.log(`   Files changed: ${changedFiles.length}`);
  console.log(`   Queue position: ${queue.entries.findIndex((e) => e.branch === branch) + 1} of ${queue.entries.length}`);
}

function cmdList() {
  const queue = loadQueue();
  if (queue.entries.length === 0) {
    console.log("📭 Merge queue is empty.");
    return;
  }

  console.log(`\n📋 Merge Queue (${queue.entries.length} pending)\n${"─".repeat(70)}`);
  const batches = groupIntoBatches(queue.entries.filter((e) => e.status === "pending"));

  batches.forEach((batch, bi) => {
    console.log(`\n  Batch ${bi + 1} (${batch.length} PR${batch.length > 1 ? "s" : ""} — non-conflicting):`);
    batch.forEach((entry, i) => {
      const prob = (entry.conflictProbability * 100).toFixed(1);
      const probIcon = entry.conflictProbability > 0.6 ? "🔴" : entry.conflictProbability > 0.3 ? "🟠" : "🟢";
      console.log(`    ${i + 1}. ${probIcon} ${entry.branch}`);
      console.log(`       Conflict probability: ${prob}%  |  Files: ${entry.changedFiles.length}  |  Added: ${entry.addedAt.slice(0,10)}`);
    });
  });

  if (queue.processed.length > 0) {
    console.log(`\n✅ Recently processed: ${queue.processed.slice(-5).map((e) => e.branch).join(", ")}`);
  }
}

function cmdProcess() {
  const queue = loadQueue();
  const pending = queue.entries.filter((e) => e.status === "pending");

  if (pending.length === 0) {
    console.log("📭 No pending entries to process.");
    return;
  }

  const snapshot = saveSnapshot();
  const batches = groupIntoBatches(pending);

  console.log(`\n🚀 Processing merge queue — ${pending.length} branches in ${batches.length} batch(es)\n`);

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    console.log(`\n─── Batch ${bi + 1}/${batches.length} (${batch.length} branch${batch.length > 1 ? "es" : ""}) ───`);

    for (const entry of batch) {
      console.log(`\n  ▶ ${entry.branch}`);

      // Pre-flight: conflict check
      const check = tryMergeBranch(entry.branch);
      if (!check.success) {
        console.error(`  ❌ Conflict detected — skipping merge:`);
        check.conflicts.forEach((c) => console.error(`     ${c}`));
        entry.status = "conflict";
        entry.failedAt = new Date().toISOString();
        entry.conflictDetails = check.conflicts;
        continue;
      }

      // Run conflict marker scan before merging
      const markerCheck = gitSafe(`diff ${BASE_BRANCH}...${entry.branch} -- "*.js" "*.ts" "*.rs"`);
      if (markerCheck.includes("<<<<<<<")) {
        console.error(`  ❌ Conflict markers found in diff — cannot auto-merge.`);
        entry.status = "conflict";
        continue;
      }

      // Attempt merge
      const msg = `chore: merge ${entry.branch} via merge-queue`;
      const ok = mergeBranch(entry.branch, msg);

      if (ok) {
        console.log(`  ✅ Merged successfully.`);
        entry.status = "merged";
        entry.mergedAt = new Date().toISOString();
        queue.processed.push({ ...entry });
      } else {
        console.error(`  ❌ Merge failed — rolling back batch.`);
        rollback(snapshot);
        entry.status = "failed";
        entry.failedAt = new Date().toISOString();
        // Re-queue remaining batch entries
        break;
      }
    }
  }

  // Prune merged entries from active queue
  queue.entries = queue.entries.filter((e) => e.status === "pending" || e.status === "conflict");
  // Keep only last 50 processed
  queue.processed = queue.processed.slice(-50);
  saveQueue(queue);

  const merged   = pending.filter((e) => e.status === "merged").length;
  const conflicts = pending.filter((e) => e.status === "conflict" || e.status === "failed").length;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`📊 Queue processing complete`);
  console.log(`   Merged:    ${merged}`);
  console.log(`   Conflicts: ${conflicts}`);
  console.log(`   Remaining: ${queue.entries.length}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (CMD_ADD) {
  cmdAdd(CMD_ADD);
} else if (CMD_LIST) {
  cmdList();
} else if (CMD_PROCESS) {
  cmdProcess();
} else {
  console.log(`
Merge Queue Manager
───────────────────
Usage:
  node scripts/merge-queue.js --add <branch>   Add a branch to the queue
  node scripts/merge-queue.js --list            Show the current queue
  node scripts/merge-queue.js --process         Process the queue
  node scripts/merge-queue.js --process --dry-run  Simulate processing
`);
}
