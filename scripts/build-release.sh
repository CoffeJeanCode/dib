#!/usr/bin/env bash
set -euo pipefail

APP_NAME="dib"
VERSION="0.1.0"
EXPORT_DIR="$(cd "$(dirname "$0")/.." && pwd)/export"

# ── helpers ──────────────────────────────────────────────────
die() { echo "[ERROR] $*" >&2; exit 1; }
info() { echo "[INFO] $*"; }
run()  { echo "[RUN]  $*"; "$@"; }

# ── help runs without prerequisites ──────────────────────────
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: $0 [--windows] [--linux-only] [--clean]"
  echo "  --windows      Build for Linux + Windows (requires mingw-w64)"
  echo "  --linux-only   Build only for Linux (default)"
  echo "  --clean        Clean build artifacts first"
  exit 0
fi

# ── check prerequisites ──────────────────────────────────────
command -v bun  >/dev/null 2>&1 || die "bun is required (https://bun.sh)"
command -v cargo >/dev/null 2>&1 || die "cargo (Rust) is required (https://rustup.rs)"
command -v rustc >/dev/null 2>&1 || die "rustc is required"

ARCH=$(rustc -vV | grep 'host:' | awk '{print $2}')
LINUX_TARGET="$ARCH"
WINDOWS_TARGET="x86_64-pc-windows-gnu"

BUILD_LINUX=true
BUILD_WINDOWS=false
CLEAN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --windows) BUILD_WINDOWS=true; shift ;;
    --linux-only) BUILD_WINDOWS=false; shift ;;
    --clean) CLEAN=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--windows] [--linux-only] [--clean]"
      echo "  --windows      Build for Linux + Windows (requires mingw-w64)"
      echo "  --linux-only   Build only for Linux (default)"
      echo "  --clean        Clean build artifacts first"
      exit 0
      ;;
    *) die "Unknown option: $1 (use --help)" ;;
  esac
done

# ── clean ─────────────────────────────────────────────────────
if $CLEAN; then
  info "Cleaning..."
  run rm -rf "$EXPORT_DIR"
  run cargo clean --manifest-path src-tauri/Cargo.toml
  run rm -rf dist
fi

mkdir -p "$EXPORT_DIR"

# ── frontend build ────────────────────────────────────────────
info "Building frontend..."
run bun install --frozen-lockfile
run bun run build

# ── Linux build ───────────────────────────────────────────────
if $BUILD_LINUX; then
  info "Building for Linux ($LINUX_TARGET)..."
  run cargo build --release --manifest-path src-tauri/Cargo.toml

  SRC="src-tauri/target/release/$APP_NAME"
  DEST="$EXPORT_DIR/${APP_NAME}-v${VERSION}-linux-$LINUX_TARGET"
  if [[ -f "$SRC" ]]; then
    run cp "$SRC" "$DEST"
    run strip "$DEST" 2>/dev/null || true
    run chmod +x "$DEST"
    info "Linux binary: $DEST"
  else
    # Tauri may produce the binary inside a bundle subdir
    BUNDLE="src-tauri/target/release/bundle/deb/${APP_NAME}_${VERSION}_amd64.deb"
    if [[ -f "$BUNDLE" ]]; then
      run cp "$BUNDLE" "$EXPORT_DIR/"
      info "Linux bundle: $BUNDLE → $EXPORT_DIR/"
    fi
    # AppImage
    APPIMAGE="src-tauri/target/release/bundle/appimage/${APP_NAME}_${VERSION}_amd64.AppImage"
    if [[ -f "$APPIMAGE" ]]; then
      run cp "$APPIMAGE" "$EXPORT_DIR/"
      info "AppImage: $APPIMAGE → $EXPORT_DIR/"
    fi
  fi
fi

# ── Windows cross-build ───────────────────────────────────────
if $BUILD_WINDOWS; then
  if rustup target list --installed | grep -q "$WINDOWS_TARGET"; then
    info "Building for Windows ($WINDOWS_TARGET)..."
    run cargo build --release --target "$WINDOWS_TARGET" --manifest-path src-tauri/Cargo.toml

    SRC="src-tauri/target/$WINDOWS_TARGET/release/${APP_NAME}.exe"
    DEST="$EXPORT_DIR/${APP_NAME}-v${VERSION}-windows-$WINDOWS_TARGET.exe"
    if [[ -f "$SRC" ]]; then
      run cp "$SRC" "$DEST"
      info "Windows binary: $DEST"
    fi
  else
    info "Target '$WINDOWS_TARGET' not installed. Run: rustup target add $WINDOWS_TARGET"
    info "Also install mingw-w64: apt install mingw-w64 / brew install mingw-w64"
  fi
fi

# ── summary ───────────────────────────────────────────────────
echo ""
info "──────────────────────────────────────────────"
info "Build complete!"
info "Export directory: $EXPORT_DIR"
ls -lh "$EXPORT_DIR" 2>/dev/null
info "──────────────────────────────────────────────"
