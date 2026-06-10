# Narrative Forge

Narrative Forge is a browser-based toolkit for indie game developers designing RPG dialogue, quest flow, characters, and lore.

The current MVP centers on a node-based Dialogue Designer with:

- draggable dialogue, choice, quest, objective, reward, condition, variable, start, and end nodes
- visual connections with editable labels
- a side inspector for node and edge editing
- graph validation, script export, project JSON export/import, notes, and local autosave
- a PixiJS-powered 2.5D Stage preview that plays the dialogue tree from app data
- an AI Quest Generator surface that validates generated JSON before importing it into quests, characters, dialogue nodes, and Preview Mode

## Run

```bash
npm install
npm run dev
```

## New Worktree Setup

This repository uses **npm** (detected from `package-lock.json`) and includes an automated setup script for fresh worktrees:

```bash
git worktree add ../narrative-forge-work <branch-or-commit>
cd ../narrative-forge-work
npm run setup:worktree
```

The setup script:

- installs dependencies (`npm ci`)
- creates missing local env files:
  - `.env.local` from `.env.example`
  - `api/.env.local` from `api/.env.example`
- runs `npm run build`

You can rerun `npm run setup:worktree` at any time; existing files are preserved unless missing.

## Check

```bash
npm run lint
npm run build
```

## AI Generator

The browser app does not store AI API keys. The repo includes a serverless endpoint at `api/generate-quest.js` for hosts such as Vercel.

You do **not** need OpenAI/Codex API credentials in the frontend. For local development without a configured backend endpoint, the generator falls back to an offline local draft so you can still create and import a complete quest package.

Set server-side environment variables:

```bash
OPENAI_API_KEY=...         # or CODEX_API_KEY=...
AI_MODEL=gpt-4.1-mini      # optional override (also accepts OPENAI_MODEL for backward compatibility)
AI_RESPONSES_URL=https://api.openai.com/v1/responses  # optional override
```

For local development, point the frontend at a running proxy:

```bash
VITE_AI_GENERATOR_ENDPOINT=/api/generate-quest
```

In production builds, and now also by default in local development, the frontend uses `/api/generate-quest`.
The app validates the response before importing anything. If the endpoint is unavailable, it falls back to an internal local draft.

## Scope

This is not a native Unreal Engine plugin yet. The export format is intentionally clean JSON that can later be transformed into Unreal DataTables, Blueprint-friendly JSON, or custom quest assets.
