# Local development

Album Motion is a Vite application. It does not use Apache, MAMP, `.htaccess`, or an `htdocs` directory.

The project can remain here:

```text
/Users/KatyAnn/Documents/Codex/2026-07-23/v
```

## One-time Mac setup

This Mac currently has an obsolete Node.js installation and damaged Apple Command Line Tools. Before using the project from a normal Terminal session:

1. Ask macOS to install Apple Command Line Tools:

```bash
xcode-select --install
```

Complete the Apple installer, then verify Git:

```bash
git --version
```

If macOS says the tools are already installed but Git still reports a missing `xcrun`, use **System Preferences → Software Update** to install a compatible Command Line Tools update. Do not delete the existing tools directory without making a backup or getting help.

2. Install `nvm` (Node Version Manager) using its official installer:

```bash
export PROFILE="$HOME/.bash_profile"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
source "$HOME/.bash_profile"
```

Verify it:

```bash
command -v nvm
```

3. Change to the project directory and install its selected Node version:

```bash
cd /Users/KatyAnn/Documents/Codex/2026-07-23/v
nvm install
nvm use
```

The `.nvmrc` file selects Node.js 22 for this project without changing older MAMP projects.

## Install and run

```bash
npm install
npm run doctor
npm run dev
```

Vite prints a local address, normally `http://localhost:5173`. Open that address in a browser.

During `npm run dev`, render requests travel through `/api/company-tbd`. Vite serves that development-only endpoint and keeps render jobs in memory, so restarting Vite clears them. This exercises the same HTTP adapter intended for the future backend without requiring Docker or a cloud account.

The default Apple/Drift path creates a real 320px animated GIF preview in memory and exposes a download button when the job completes. The selected URL, local image, or authenticated loader is resolved and temporarily registered before rendering, so the downloaded GIF uses the same host-provided artwork shown in the editor. The preview lasts at most 2 seconds and is not a platform-ready master. Water and MP4 requests fail explicitly until their renderers are implemented.

To bypass HTTP temporarily while debugging the interface:

```bash
VITE_RENDER_SERVICE_MODE=fake npm run dev
```

The production build defaults to the in-memory demonstration unless a deployed host explicitly configures `VITE_RENDER_SERVICE_MODE=http` and provides the matching API.

Stop the development server with **Control-C**.

## Useful commands

```bash
npm run doctor   # Check the local Node environment
npm run lint     # Check code quality and common mistakes
npm run test     # Run all automated tests once
npm run check    # Run doctor, lint, tests, and the production build
npm run dev      # Start the development server
npm run build    # Type-check and create a production build
npm run preview  # Preview the production build locally
```

## What does not need to run

MAMP and Docker are not required for the current browser preview. MAMP can remain installed for older PHP or WordPress projects. Docker may become useful later when Album Motion gains a server rendering service.
