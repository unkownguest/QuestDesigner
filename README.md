# Narrative Forge

Narrative Forge is a browser-based toolkit for indie game developers designing RPG dialogue, quest flow, characters, and lore.

The current MVP centers on a node-based Dialogue Designer with:

- draggable dialogue, choice, quest, objective, reward, condition, variable, start, and end nodes
- visual connections with editable labels
- a side inspector for node and edge editing
- graph validation, script export, project JSON export/import, notes, and local autosave
- a PixiJS-powered 2.5D Stage preview that plays the dialogue tree from app data

## Run

```bash
npm install
npm run dev
```

## Check

```bash
npm run lint
npm run build
```

## Scope

This is not a native Unreal Engine plugin yet. The export format is intentionally clean JSON that can later be transformed into Unreal DataTables, Blueprint-friendly JSON, or custom quest assets.
