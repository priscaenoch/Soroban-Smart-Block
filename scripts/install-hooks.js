import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const gitHooksDir = path.join(rootDir, ".git", "hooks");

const hooks = {
  "pre-commit": `#!/bin/sh
echo "=== Running pre-commit hooks ==="

if [ -f Cargo.toml ]; then
  echo "Checking cargo formatting..."
  cargo fmt --manifest-path Cargo.toml --check || { echo "❌ cargo fmt check failed!"; exit 1; }
fi

if [ -d indexer ]; then
  echo "Running eslint on indexer..."
  (cd indexer && npx eslint src) || { echo "❌ eslint on indexer failed!"; exit 1; }
  echo "Running prettier on indexer..."
  (cd indexer && npx prettier --check src) || { echo "❌ prettier on indexer failed!"; exit 1; }
fi

if [ -d frontend ]; then
  echo "Running eslint on frontend..."
  (cd frontend && npx eslint src) || { echo "❌ eslint on frontend failed!"; exit 1; }
  echo "Running prettier on frontend..."
  (cd frontend && npx prettier --check src) || { echo "❌ prettier on frontend failed!"; exit 1; }
fi

echo "✅ Pre-commit hooks passed successfully!"
`,

  "pre-push": `#!/bin/sh
echo "=== Running pre-push hooks ==="

if [ -f Cargo.toml ]; then
  echo "Running cargo tests..."
  cargo test || { echo "❌ cargo test failed!"; exit 1; }
fi

if [ -d indexer ]; then
  echo "Running indexer tests..."
  (cd indexer && npm test) || { echo "❌ indexer tests failed!"; exit 1; }
fi

if [ -d frontend ]; then
  echo "Running frontend tests..."
  (cd frontend && npm test) || { echo "❌ frontend tests failed!"; exit 1; }
  echo "Verifying frontend build..."
  (cd frontend && npm run build) || { echo "❌ frontend build failed!"; exit 1; }
fi

echo "✅ Pre-push hooks passed successfully!"
`,

  "commit-msg": `#!/bin/sh
echo "=== Running commit-msg hook ==="
npx --no-install commitlint --edit "$1" || {
  echo "❌ Commit message does not follow conventional commit standards!"
  echo "Please use format: feat: description, fix: description, etc."
  exit 1
}
echo "✅ Commit message format is valid!"
`,

  "post-merge": `#!/bin/sh
echo "=== Running post-merge hooks ==="
if git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD | grep -q 'package-lock.json'; then
  echo "package-lock.json changed. Updating dependencies..."
  if [ -d indexer ]; then
    echo "Installing indexer dependencies..."
    (cd indexer && npm install)
  fi
  if [ -d frontend ]; then
    echo "Installing frontend dependencies..."
    (cd frontend && npm install)
  fi
  echo "✅ Dependencies updated!"
fi
`
};

export function installHooks() {
  if (!fs.existsSync(path.join(rootDir, ".git"))) {
    console.log("⚠️ Not a git repository or .git folder not found. Skipping Git hooks installation.");
    return;
  }

  if (!fs.existsSync(gitHooksDir)) {
    fs.mkdirSync(gitHooksDir, { recursive: true });
  }

  for (const [hookName, hookContent] of Object.entries(hooks)) {
    const hookPath = path.join(gitHooksDir, hookName);
    fs.writeFileSync(hookPath, hookContent, { encoding: "utf8" });
    try {
      fs.chmodSync(hookPath, 0o755); // make executable
      console.log(`✓ Installed git hook: ${hookName}`);
    } catch (err) {
      console.warn(`⚠️ Installed ${hookName} but could not set executable permissions: ${err.message}`);
    }
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  installHooks();
}
