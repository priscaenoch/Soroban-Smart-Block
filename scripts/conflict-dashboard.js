#!/usr/bin/env node
/**
 * conflict-dashboard.js
 *
 * Generates a self-contained HTML dashboard tracking merge conflict trends.
 *
 * Metrics rendered:
 *  1. Conflicts per week            (bar chart)
 *  2. Most conflicted files         (table)
 *  3. Most conflicted authors       (table)
 *  4. Conflict resolution time      (histogram)
 *  5. Conflict types distribution   (pie chart)
 *  6. Conflict hot spots            (heat map over file tree)
 *
 * Data source: git log + optional conflict-report JSON files in .git/conflict-reports/
 *
 * Usage:
 *   node scripts/conflict-dashboard.js [--output <path>] [--since <YYYY-MM-DD>]
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const args      = process.argv.slice(2);
const getArg    = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };

const OUTPUT_FILE   = getArg("--output") ?? path.join(ROOT, "docs", "site", "conflict-dashboard.html");
const SINCE         = getArg("--since")  ?? "3 months ago";
const REPORTS_DIR   = path.join(ROOT, ".git", "conflict-reports");

// ── Git data collectors ───────────────────────────────────────────────────────

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, {
      encoding: "utf8", cwd: ROOT,
      stdio: ["pipe","pipe","ignore"],
      timeout: 5000,
    }).trim();
  } catch { return ""; }
}

/** Return all merge commits with their metadata since SINCE. */
function getMergeCommits() {
  const log = git(
    `log --merges --format="%H|%ae|%aI|%s" --since="${SINCE}"`
  );
  if (!log) return [];
  return log.split("\n").filter(Boolean).map((line) => {
    const [sha, email, date, subject] = line.split("|");
    return { sha, email, date: new Date(date), subject };
  });
}

/** Find files that had conflict markers resolved in a merge commit. */
const _conflictCache = new Map();
function getConflictedFiles(sha) {
  if (_conflictCache.has(sha)) return _conflictCache.get(sha);
  // A file was in conflict if it appears in both parents' diff
  const parentLine = git(`log --pretty=%P -n 1 ${sha}`);
  const parents = parentLine ? parentLine.split(" ").filter(Boolean) : [];
  if (parents.length < 2) { _conflictCache.set(sha, []); return []; }
  const filesA = new Set((git(`diff --name-only ${parents[0]} ${sha}`) || "").split("\n").filter(Boolean));
  const filesB = (git(`diff --name-only ${parents[1]} ${sha}`) || "").split("\n").filter(Boolean);
  const result = filesB.filter((f) => filesA.has(f));
  _conflictCache.set(sha, result);
  return result;
}

/** Build a week bucket string from a Date. */
function weekOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.toISOString().slice(0, 10);
}

// ── Load stored reports ───────────────────────────────────────────────────────

function loadStoredReports() {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  const reports = [];
  for (const file of fs.readdirSync(REPORTS_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), "utf8"));
      reports.push(data);
    } catch { /* skip */ }
  }
  return reports;
}

// ── Data aggregation ──────────────────────────────────────────────────────────

function buildDashboardData() {
  const mergeCommits = getMergeCommits();
  const storedReports = loadStoredReports();

  // ── 1. Conflicts per week ──────────────────────────────────────────────────
  const weeklyMap = new Map();
  // Cap at 30 merge commits to stay fast in shallow repos
  const sampleCommits = mergeCommits.slice(0, 30);
  for (const commit of sampleCommits) {
    const files = getConflictedFiles(commit.sha);
    if (files.length === 0) continue;
    const w = weekOf(commit.date);
    weeklyMap.set(w, (weeklyMap.get(w) ?? 0) + files.length);
  }
  const weeksRaw = [...weeklyMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const weeks    = weeksRaw.map(([w]) => w);
  const weekCounts = weeksRaw.map(([, c]) => c);

  // ── 2. Most conflicted files ───────────────────────────────────────────────
  const fileMap = new Map();
  for (const commit of sampleCommits) {
    const files = getConflictedFiles(commit.sha);
    for (const f of files) fileMap.set(f, (fileMap.get(f) ?? 0) + 1);
  }
  // Merge in stored report data
  for (const r of storedReports) {
    for (const fe of r.files ?? []) {
      fileMap.set(fe.file, (fileMap.get(fe.file) ?? 0) + (fe.blocks ?? 1));
    }
  }
  const topFiles = [...fileMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([file, count]) => ({ file, count }));

  // ── 3. Most conflicted authors ─────────────────────────────────────────────
  const authorMap = new Map();
  for (const commit of sampleCommits) {
    const files = getConflictedFiles(commit.sha);
    if (files.length === 0) continue;
    authorMap.set(commit.email, (authorMap.get(commit.email) ?? 0) + files.length);
  }
  const topAuthors = [...authorMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([author, count]) => ({ author, count }));

  // ── 4. Conflict resolution time (histogram buckets) ───────────────────────
  // Approximate: time between the branch creation and merge commit
  const resolutionTimes = [];
  for (const commit of sampleCommits) {
    const files = getConflictedFiles(commit.sha);
    if (files.length === 0) continue;
    const parents = git(`log --pretty=%P -n 1 ${commit.sha}`).split(" ").filter(Boolean);
    if (parents.length < 2) continue;
    const branchDate = git(`log --pretty=%aI -1 ${parents[1]}`);
    if (!branchDate) continue;
    const diffDays = (commit.date - new Date(branchDate)) / 86400000;
    if (diffDays >= 0 && diffDays < 90) resolutionTimes.push(Math.round(diffDays));
  }
  const histBuckets  = ["0–1d", "2–3d", "4–7d", "8–14d", "15–30d", "30d+"];
  const histCounts   = [0, 0, 0, 0, 0, 0];
  for (const d of resolutionTimes) {
    if (d <= 1)       histCounts[0]++;
    else if (d <= 3)  histCounts[1]++;
    else if (d <= 7)  histCounts[2]++;
    else if (d <= 14) histCounts[3]++;
    else if (d <= 30) histCounts[4]++;
    else              histCounts[5]++;
  }

  // ── 5. Conflict types distribution (from stored reports) ──────────────────
  const typeMap = new Map();
  for (const r of storedReports) {
    for (const [type, count] of Object.entries(r.by_type ?? {})) {
      typeMap.set(type, (typeMap.get(type) ?? 0) + count);
    }
  }
  // Fallback: categorise by file extension
  for (const [file, count] of fileMap.entries()) {
    const ext = path.extname(file).slice(1) || "other";
    if (!typeMap.has(ext)) typeMap.set(ext, 0);
    typeMap.set(ext, typeMap.get(ext) + count);
  }
  const pieLabels = [...typeMap.keys()].slice(0, 8);
  const pieValues = pieLabels.map((k) => typeMap.get(k));

  // ── 6. Heat map (file tree intensity) ────────────────────────────────────
  const heatMap = topFiles.map(({ file, count }) => {
    const parts  = file.split("/");
    const module = parts.length > 1 ? parts[0] : "root";
    return { file, module, count };
  });

  return {
    generated: new Date().toISOString(),
    since: SINCE,
    totalMergeCommits: mergeCommits.length,
    totalConflictedMerges: sampleCommits.filter((c) => getConflictedFiles(c.sha).length > 0).length,
    weeks, weekCounts,
    topFiles,
    topAuthors,
    histBuckets, histCounts,
    pieLabels, pieValues,
    heatMap,
  };
}

// ── HTML generator ────────────────────────────────────────────────────────────

function generateHTML(data) {
  const j = (v) => JSON.stringify(v);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Merge Conflict Dashboard — Soroban Smart Block</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 2rem;
    }
    h1 { font-size: 1.75rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.25rem; }
    .subtitle { color: #94a3b8; font-size: 0.875rem; margin-bottom: 2rem; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .kpi {
      background: #1e2433;
      border: 1px solid #2d3748;
      border-radius: 0.75rem;
      padding: 1.25rem;
    }
    .kpi-value { font-size: 2rem; font-weight: 700; color: #60a5fa; }
    .kpi-label { font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem; }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .card {
      background: #1e2433;
      border: 1px solid #2d3748;
      border-radius: 0.75rem;
      padding: 1.5rem;
    }
    .card-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .chart-wrap { position: relative; height: 240px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      color: #64748b;
      border-bottom: 1px solid #2d3748;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #1a2236; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #232d42; }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-red   { background: #7f1d1d; color: #fca5a5; }
    .badge-amber { background: #78350f; color: #fcd34d; }
    .badge-green { background: #14532d; color: #86efac; }
    .heat-bar {
      height: 10px;
      border-radius: 4px;
      background: linear-gradient(90deg, #1d4ed8, #ef4444);
      margin-top: 4px;
    }
    .ts { color: #475569; font-size: 0.75rem; margin-top: 0.5rem; }
    .full-width { grid-column: 1 / -1; }
  </style>
</head>
<body>
  <h1>🔀 Merge Conflict Dashboard</h1>
  <p class="subtitle">Soroban Smart Block Explorer · Generated ${new Date(data.generated).toLocaleString()} · Since ${data.since}</p>

  <!-- KPI row -->
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-value">${data.totalMergeCommits}</div>
      <div class="kpi-label">Total merge commits</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${data.totalConflictedMerges}</div>
      <div class="kpi-label">Merges with conflicts</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${data.topFiles.reduce((s, f) => s + f.count, 0)}</div>
      <div class="kpi-label">Total conflict occurrences</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${data.topFiles.length}</div>
      <div class="kpi-label">Distinct conflicted files</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${data.topAuthors.length}</div>
      <div class="kpi-label">Authors involved</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${data.weeks.length}</div>
      <div class="kpi-label">Weeks tracked</div>
    </div>
  </div>

  <!-- Charts -->
  <div class="charts-grid">

    <!-- 1. Conflicts per week (bar) -->
    <div class="card full-width">
      <div class="card-title">📊 Conflicts per Week</div>
      <div class="chart-wrap">
        <canvas id="chartWeekly"></canvas>
      </div>
    </div>

    <!-- 4. Resolution time (histogram) -->
    <div class="card">
      <div class="card-title">⏱ Conflict Resolution Time</div>
      <div class="chart-wrap">
        <canvas id="chartResTime"></canvas>
      </div>
    </div>

    <!-- 5. Conflict types (pie) -->
    <div class="card">
      <div class="card-title">🥧 Conflict Types Distribution</div>
      <div class="chart-wrap">
        <canvas id="chartPie"></canvas>
      </div>
    </div>

    <!-- 2. Most conflicted files (table) -->
    <div class="card">
      <div class="card-title">📄 Most Conflicted Files</div>
      <table>
        <thead>
          <tr><th>#</th><th>File</th><th>Conflicts</th><th>Risk</th></tr>
        </thead>
        <tbody>
          ${data.topFiles.slice(0, 10).map(({ file, count }, i) => {
            const badge = count >= 10
              ? `<span class="badge badge-red">High</span>`
              : count >= 4
              ? `<span class="badge badge-amber">Medium</span>`
              : `<span class="badge badge-green">Low</span>`;
            const short = file.length > 45 ? "…" + file.slice(-42) : file;
            return `<tr><td>${i + 1}</td><td title="${file}">${short}</td><td><strong>${count}</strong></td><td>${badge}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    <!-- 3. Most conflicted authors (table) -->
    <div class="card">
      <div class="card-title">👤 Most Conflicted Authors</div>
      <table>
        <thead>
          <tr><th>#</th><th>Author</th><th>Conflicts</th></tr>
        </thead>
        <tbody>
          ${data.topAuthors.map(({ author, count }, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${author}</td>
              <td><strong>${count}</strong></td>
            </tr>`).join("") || "<tr><td colspan='3' style='color:#475569;padding:1rem'>No data yet</td></tr>"}
        </tbody>
      </table>
    </div>

    <!-- 6. Heat map -->
    <div class="card full-width">
      <div class="card-title">🔥 Conflict Hot Spots (File Tree Heat Map)</div>
      <table>
        <thead>
          <tr><th>File</th><th>Module</th><th>Conflict Count</th><th>Heat</th></tr>
        </thead>
        <tbody>
          ${(() => {
            const max = Math.max(...data.heatMap.map((h) => h.count), 1);
            return data.heatMap.map(({ file, module, count }) => {
              const pct = Math.round((count / max) * 100);
              const short = file.length > 50 ? "…" + file.slice(-47) : file;
              return `<tr>
                <td title="${file}">${short}</td>
                <td>${module}</td>
                <td><strong>${count}</strong></td>
                <td style="min-width:120px">
                  <div style="font-size:0.75rem;color:#64748b">${pct}%</div>
                  <div class="heat-bar" style="width:${pct}%"></div>
                </td>
              </tr>`;
            }).join("");
          })() || "<tr><td colspan='4' style='color:#475569;padding:1rem'>No data yet</td></tr>"}
        </tbody>
      </table>
    </div>

  </div>

  <p class="ts">Data sourced from git history. Run <code>node scripts/conflict-dashboard.js</code> to regenerate.</p>

  <script>
    const CHART_DEFAULTS = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#94a3b8", font: { size: 12 } } } },
    };

    // 1. Weekly bar
    new Chart(document.getElementById("chartWeekly"), {
      type: "bar",
      data: {
        labels: ${j(data.weeks)},
        datasets: [{
          label: "Conflict occurrences",
          data: ${j(data.weekCounts)},
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: { ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "#1e293b" } },
          y: { ticks: { color: "#64748b" }, grid: { color: "#1e293b" }, beginAtZero: true },
        },
      },
    });

    // 4. Resolution time histogram
    new Chart(document.getElementById("chartResTime"), {
      type: "bar",
      data: {
        labels: ${j(data.histBuckets)},
        datasets: [{
          label: "Merges resolved",
          data: ${j(data.histCounts)},
          backgroundColor: ["#22c55e","#86efac","#fbbf24","#f97316","#ef4444","#dc2626"],
          borderRadius: 4,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: { ticks: { color: "#64748b" }, grid: { color: "#1e293b" } },
          y: { ticks: { color: "#64748b" }, grid: { color: "#1e293b" }, beginAtZero: true },
        },
      },
    });

    // 5. Conflict types pie
    new Chart(document.getElementById("chartPie"), {
      type: "doughnut",
      data: {
        labels: ${j(data.pieLabels)},
        datasets: [{
          data: ${j(data.pieValues)},
          backgroundColor: [
            "#3b82f6","#8b5cf6","#ec4899","#f97316",
            "#22c55e","#14b8a6","#eab308","#6366f1",
          ],
          borderWidth: 2,
          borderColor: "#1e2433",
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          legend: {
            position: "right",
            labels: { color: "#94a3b8", font: { size: 11 }, padding: 12 },
          },
        },
      },
    });
  </script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("📊 Building conflict dashboard data from git history...");
const data = buildDashboardData();
const html = generateHTML(data);

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, html, "utf8");

console.log(`✅ Dashboard written to: ${OUTPUT_FILE}`);
console.log(`   Merge commits analysed: ${data.totalMergeCommits}`);
console.log(`   Conflicted merges found: ${data.totalConflictedMerges}`);
console.log(`   Unique files tracked:    ${data.topFiles.length}`);
