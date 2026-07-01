# DIB — Data Illustrative Base

Database management tool built with Tauri v2 (Rust + React/TypeScript). Supports SQLite and PostgreSQL with schema introspection, query execution, and script management.

## Prerequisites

### Local Build

| Tool | Version |
|------|---------|
| [Rust](https://rustup.rs/) | 1.70+ |
| [Node.js](https://nodejs.org/) | 18+ |
| [Bun](https://bun.sh/) | 1.0+ |
| [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) | System deps |

**Linux (Debian/Ubuntu):**
```bash
sudo apt-get update && sudo apt-get install -y \
  curl build-essential pkg-config file \
  libssl-dev libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev \
  libsecret-1-dev libdbus-1-dev
```

**Windows:** Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 10/11) and the [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

**macOS:** Xcode Command Line Tools (`xcode-select --install`).

### Docker Build

| Tool | Version |
|------|---------|
| [Docker](https://docs.docker.com/get-docker/) | 20.10+ |
| [Docker Compose](https://docs.docker.com/compose/install/) | v2+ |

## Local Development

```bash
# Install dependencies
bun install

# Start dev server (opens Tauri window with hot-reload)
bun run tauri dev
```

## Local Production Build

```bash
# Build frontend + Rust backend
bun run tauri build
```

**Output locations:**

| File | Path |
|------|------|
| Standalone exe | `src-tauri/target/release/dib.exe` (Windows) |
| NSIS installer | `src-tauri/target/release/bundle/nsis/dib_0.1.0_x64-setup.exe` |
| MSI installer | `src-tauri/target/release/bundle/msi/dib_0.1.0_x64_en-US.msi` |
| Linux AppImage | `src-tauri/target/release/bundle/appimage/dib_0.1.0_amd64.AppImage` |
| Linux .deb | `src-tauri/target/release/bundle/deb/dib_0.1.0_amd64.deb` |
| macOS .app | `src-tauri/target/release/bundle/macos/Dib.app` |

### Other Scripts

```bash
bun run lint        # ESLint
bun run format      # Prettier
bunx tsc --noEmit   # TypeScript check
```

## Docker

### Dev (with GUI via WSLg/X11)

Runs Tauri dev inside a container with display forwarding.

```bash
docker compose up dev
```

On **Windows (WSL2)**, the container connects to WSLg automatically. On **Linux**, ensure `$DISPLAY` is set.

### Production Build

Builds the app inside Docker and outputs bundles to `./release/`.

```bash
docker compose up build
```

Output will be in `./release/` after the build completes.

### Build without Compose

```bash
# Dev
docker build -f Dockerfile.dev -t dib-dev .
docker run --rm -it \
  -v .:/app \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -e DISPLAY=${DISPLAY} \
  dib-dev

# Production
docker build -f Dockerfile.prod -t dib-prod .
docker run --rm -v ./release:/output dib-prod
```

## Architecture

```
src/                  # React/TypeScript frontend
src-tauri/            # Rust backend (Tauri v2)
├── src/commands/     # IPC command handlers
├── src/db/           # Database drivers (SQLite, PostgreSQL)
├── src/storage/      # Local persistence (SQLite)
├── icons/            # App icons
└── tauri.conf.json   # Tauri configuration
dist/                 # Built frontend (generated)
```

## License

Private — DIB Team
