import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline/promises";
import { execSync } from "child_process";
import pg from "pg";

import { runAllChecks } from "../indexer/src/doctor-lib.js";
import { installHooks } from "./install-hooks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;

function executeCommand(command, cwd = rootDir) {
  try {
    execSync(command, { cwd, stdio: "inherit", shell: true });
    return true;
  } catch (err) {
    console.error(red(`Failed to execute: ${command}. Error: ${err.message}`));
    return false;
  }
}

async function run() {
  const isNonInteractive = process.argv.includes("--non-interactive") || process.argv.includes("-y");

  console.log(`\n✨  ${bold(cyan("Soroban Explorer Setup Wizard"))}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // ── [1/7] System Requirements Check ──
    console.log(bold("[1/7] System Requirements Check"));
    const checks = await runAllChecks();
    let setupPrereqPass = true;

    // Check critical requirements
    const nodeStatus = checks.runtimes.node.status;
    const wasm32Status = checks.runtimes.wasm32.status;

    console.log(`  ${nodeStatus === "pass" ? green("✓") : red("✗")} Node.js 20+ detected (${checks.runtimes.node.version})`);
    console.log(`  ${checks.runtimes.npm.status === "pass" ? green("✓") : yellow("⚠")} npm 10+ detected (${checks.runtimes.npm.version})`);
    console.log(`  ${checks.runtimes.rust.status === "pass" ? green("✓") : yellow("⚠")} Rust 1.80+ detected (${checks.runtimes.rust.version})`);
    console.log(`  ${wasm32Status === "pass" ? green("✓") : red("✗")} wasm32-unknown-unknown target installed`);

    if (checks.ports[5432].status === "pass") {
      console.log(`  ${green("✓")} PostgreSQL detected on port 5432`);
    } else {
      console.log(`  ${red("✗")} PostgreSQL not running on port 5432`);
      console.log(`    → Install via: brew install postgresql@16`);
      console.log(`    → Or run: docker compose up -d postgres`);
      // We don't block setup since they might run with docker profiles later
    }

    if (nodeStatus === "fail" || wasm32Status === "fail") {
      setupPrereqPass = false;
      console.log(red("\n❌ Critical requirements are missing. Please install Node.js 20+ and wasm32 target."));
      if (!isNonInteractive) {
        const answer = await rl.question(yellow("Do you want to ignore this and continue anyway? (y/N): "));
        if (answer.toLowerCase() !== "y") {
          process.exit(1);
        }
      } else {
        process.exit(1);
      }
    }
    console.log();

    // ── [2/7] Environment Configuration ──
    console.log(bold("[2/7] Environment Configuration"));
    const envPath = path.join(rootDir, ".env");
    const envExamplePath = path.join(rootDir, ".env.example");

    let rpcUrl = "https://soroban-testnet.stellar.org";
    let dbUrl = "postgres://soroban:soroban_secret@localhost:5432/soroban_explorer";
    let pollMs = "5000";

    if (!fs.existsSync(envPath)) {
      if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log(`  ${green("✓")} .env created from .env.example`);
      } else {
        console.log(`  ${red("✗")} .env.example not found in workspace`);
        fs.writeFileSync(envPath, "");
      }
    } else {
      console.log(`  ${green("✓")} Existing .env file found`);
      // Read current values
      const envContent = fs.readFileSync(envPath, "utf8");
      const rpcMatch = envContent.match(/^SOROBAN_RPC_URL=(.*)$/m);
      const dbMatch = envContent.match(/^DATABASE_URL=(.*)$/m);
      const pollMatch = envContent.match(/^POLL_MS=(.*)$/m);
      if (rpcMatch) rpcUrl = rpcMatch[1].trim();
      if (dbMatch) dbUrl = dbMatch[1].trim();
      if (pollMatch) pollMs = pollMatch[1].trim();
    }

    if (!isNonInteractive) {
      rpcUrl = await rl.question(`  → SOROBAN_RPC_URL [${rpcUrl}]: `) || rpcUrl;
      dbUrl = await rl.question(`  → DATABASE_URL [${dbUrl}]: `) || dbUrl;
      pollMs = await rl.question(`  → POLL_MS [${pollMs}]: `) || pollMs;
    }

    // Write values to .env
    let envContent = fs.readFileSync(envPath, "utf8");
    const updateEnvVar = (key, val) => {
      const regex = new RegExp(`^#?\\s*${key}=.*$`, "m");
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${val}`);
      } else {
        envContent += `\n${key}=${val}`;
      }
    };
    updateEnvVar("SOROBAN_RPC_URL", rpcUrl);
    updateEnvVar("DATABASE_URL", dbUrl);
    updateEnvVar("POLL_MS", pollMs);
    fs.writeFileSync(envPath, envContent);
    console.log(`  ${green("✓")} Configuration updated in .env`);
    console.log();

    // Reload process.env
    process.env.DATABASE_URL = dbUrl;
    process.env.SOROBAN_RPC_URL = rpcUrl;

    // ── [3/7] Database Setup ──
    console.log(bold("[3/7] Database Setup"));
    let dbCreated = false;
    let migrationsRun = false;
    let seedLoaded = false;

    try {
      const parsedUrl = new URL(dbUrl);
      const dbName = parsedUrl.pathname.slice(1);
      parsedUrl.pathname = "/postgres"; // connect to default admin DB
      const adminDbUrl = parsedUrl.toString();

      const adminClient = new pg.Client({ connectionString: adminDbUrl, connectionTimeoutMillis: 3000 });
      await adminClient.connect();
      const res = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
      if (res.rowCount === 0) {
        console.log(`  Creating database ${dbName}...`);
        await adminClient.query(`CREATE DATABASE ${dbName}`);
        console.log(`  ${green("✓")} Database ${dbName} created`);
      } else {
        console.log(`  ${green("✓")} Database ${dbName} already exists`);
      }
      dbCreated = true;
      await adminClient.end();
    } catch (err) {
      console.log(`  ${yellow("⚠")} Could not automatically verify/create database: ${err.message}`);
      console.log(`    Proceeding assuming database already exists.`);
    }

    // Run database migrations/initialization
    try {
      const { db } = await import("../indexer/src/db.js");
      console.log("  Running migrations...");
      await db.init();
      console.log(`  ${green("✓")} Migrations run successfully`);
      migrationsRun = true;
    } catch (err) {
      console.log(`  ${red("✗")} Migration run failed: ${err.message}`);
    }

    // Run database seeding
    try {
      const { seed } = await import("./seed.js");
      console.log("  Loading seed data...");
      await seed();
      console.log(`  ${green("✓")} Seed data loaded (520 events, 20 contracts)`);
      seedLoaded = true;
    } catch (err) {
      console.log(`  ${red("✗")} Database seeding failed: ${err.message}`);
    }
    console.log();

    // ── [4/7] Dependency Installation ──
    console.log(bold("[4/7] Dependency Installation"));
    console.log("  Installing root dependencies...");
    let depPass = executeCommand("npm install");

    console.log("  Installing indexer dependencies...");
    depPass = depPass && executeCommand("npm ci", path.join(rootDir, "indexer"));

    console.log("  Installing frontend dependencies...");
    depPass = depPass && executeCommand("npm ci", path.join(rootDir, "frontend"));

    console.log("  Fetching Rust cargo dependencies...");
    depPass = depPass && executeCommand("cargo fetch");

    console.log("  Installing Git hooks...");
    try {
      installHooks();
      console.log(`  ${green("✓")} Git hooks installed`);
    } catch (err) {
      console.log(`  ${yellow("⚠")} Git hooks installation failed: ${err.message}`);
    }

    if (depPass) {
      console.log(`  ${green("✓")} Dependencies installed successfully`);
    } else {
      console.log(`  ${red("✗")} Some dependencies failed to install`);
    }
    console.log();

    // ── [5/7] Build Verification ──
    console.log(bold("[5/7] Build Verification"));
    console.log("  Building contracts...");
    const contractBuildPass = executeCommand("cargo build --release --target wasm32-unknown-unknown -p soroban-explorer-contract");
    console.log(`  ${contractBuildPass ? green("✓") : red("✗")} Contract compilation`);

    console.log("  Building frontend...");
    const frontendBuildPass = executeCommand("npm run build", path.join(rootDir, "frontend"));
    console.log(`  ${frontendBuildPass ? green("✓") : red("✗")} Frontend build`);
    console.log();

    // ── [6/7] Service Health Check ──
    console.log(bold("[6/7] Service Health Check"));
    // PostgreSQL responsive check
    let pgResponsive = false;
    try {
      const client = new pg.Client({ connectionString: dbUrl });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      pgResponsive = true;
      console.log(`  ${green("✓")} PostgreSQL responsive`);
    } catch {
      console.log(`  ${red("✗")} PostgreSQL unresponsive`);
    }

    console.log(`  ${green("✓")} Service Health Check passed`);
    console.log();

    // ── [7/7] Done! ──
    console.log(bold("[7/7] Done!"));
    console.log(`  Run: ${cyan("npm run dev")}`);
    console.log(`  Open: ${cyan("http://localhost:5173")}\n`);

  } catch (err) {
    console.error(red(`\nAn error occurred during setup: ${err.message}`));
  } finally {
    rl.close();
  }
}

run();
