#!/usr/bin/env bash
set -euo pipefail

# Bumps version in package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml,
# commits, and tags. Push manually after reviewing.
#
# Usage: scripts/bump-version.sh <patch|minor|major|X.Y.Z>

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

die() { echo "[ERROR] $*" >&2; exit 1; }

[[ $# -eq 1 ]] || die "Usage: $0 <patch|minor|major|X.Y.Z>"
BUMP="$1"

command -v node >/dev/null 2>&1 || die "node is required"

git diff --quiet -- package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml \
  || die "Uncommitted changes in version files — commit or stash first"

CURRENT=$(node -p "require('./package.json').version")

NEW=$(node -e "
const semver = '$CURRENT'.split('.').map(Number);
let [maj, min, pat] = semver;
const bump = '$BUMP';
if (/^\d+\.\d+\.\d+$/.test(bump)) {
  console.log(bump);
} else if (bump === 'major') {
  console.log(\`\${maj + 1}.0.0\`);
} else if (bump === 'minor') {
  console.log(\`\${maj}.\${min + 1}.0\`);
} else if (bump === 'patch') {
  console.log(\`\${maj}.\${min}.\${pat + 1}\`);
} else {
  process.exit(1);
}
") || die "Invalid bump type: $BUMP"

echo "[INFO] $CURRENT -> $NEW"

node -e "
const fs = require('fs');
const p = require('./package.json');
p.version = '$NEW';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"

node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
c.version = '$NEW';
fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(c, null, 2) + '\n');
"

sed -i.bak -E "0,/^version = \".*\"/s//version = \"$NEW\"/" src-tauri/Cargo.toml
rm -f src-tauri/Cargo.toml.bak

command -v cargo >/dev/null 2>&1 && cargo update -p dib --manifest-path src-tauri/Cargo.toml 2>/dev/null || true

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: bump version to $NEW"
git tag "v$NEW"

echo "[INFO] Tagged v$NEW. Push with:"
echo "  git push origin main --tags"
