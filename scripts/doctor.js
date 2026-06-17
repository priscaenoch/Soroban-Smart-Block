import "./load-env.js";
import { runAllChecks } from "../indexer/src/doctor-lib.js";

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;

function getStatusIcon(status) {
  if (status === "pass") return green("✓");
  if (status === "warn") return yellow("⚠");
  return red("✗");
}

async function run() {
  console.log(`\n🩺  ${bold("Soroban Explorer Environment Doctor")}\n`);

  let checks;
  try {
    checks = await runAllChecks();
  } catch (err) {
    console.error(red(`Fatal error running diagnostics: ${err.message}`));
    process.exit(1);
  }

  let hasFailures = false;

  // 1. Runtimes
  console.log(bold("─ Runtimes ───────────────────────────────────"));
  for (const [key, value] of Object.entries(checks.runtimes)) {
    console.log(`  ${getStatusIcon(value.status)} ${bold(key.toUpperCase())}: ${value.message}`);
    if (value.status === "fail") hasFailures = true;
  }
  console.log();

  // 2. Database
  console.log(bold("─ Database Connection ────────────────────────"));
  const dbStatus = checks.database.connected ? "pass" : "fail";
  console.log(`  ${getStatusIcon(dbStatus)} ${checks.database.message}`);
  if (dbStatus === "fail") hasFailures = true;
  console.log();

  // 3. Env
  console.log(bold("─ Environment Variables ──────────────────────"));
  for (const [key, value] of Object.entries(checks.env)) {
    console.log(`  ${getStatusIcon(value.status)} ${bold(key)}: ${value.value}`);
    if (value.status === "fail") hasFailures = true;
  }
  console.log();

  // 4. Ports
  console.log(bold("─ Service Ports ──────────────────────────────"));
  for (const [port, info] of Object.entries(checks.ports)) {
    console.log(`  ${getStatusIcon(info.status)} Port ${port}: ${info.message}`);
    if (info.status === "fail") hasFailures = true;
  }
  console.log();

  // 5. System Check
  console.log(bold("─ System Metrics ─────────────────────────────"));
  console.log(`  ${getStatusIcon(checks.system.disk.status)} Disk: ${checks.system.disk.message}`);
  console.log(`  ${getStatusIcon(checks.system.memory.status)} Memory: ${checks.system.memory.message}`);
  if (checks.system.disk.status === "fail" || checks.system.memory.status === "fail") {
    hasFailures = true;
  }
  console.log();

  // 6. Git Hooks
  console.log(bold("─ Git Hooks ──────────────────────────────────"));
  console.log(`  ${getStatusIcon(checks.gitHooks.status)} ${checks.gitHooks.message}`);
  console.log();

  // 7. Docker
  console.log(bold("─ Docker Infrastructure ──────────────────────"));
  console.log(`  ${getStatusIcon(checks.docker.status)} ${checks.docker.message}`);
  console.log();

  if (hasFailures) {
    console.log(red(`❌ ${bold("Doctor found issues in your environment.")} Fix them before running the project.\n`));
    process.exit(1);
  } else {
    console.log(green(`✨ ${bold("All environment checks passed successfully!")}\n`));
    process.exit(0);
  }
}

run();
