# Real Body Model Integration

## Goal

Replace the procedural avatar body with a real GLB body mesh while preserving the current web editor and body parameter schema.

## What Is Implemented

- Viewer now prefers `/models/avatar-body/base.glb`
- If the GLB is missing or fails to load, the app falls back to the procedural body model
- A shared manifest defines expected morph target names and bone aliases
- The viewer reports the current model source in the UI

## Required Asset

Place the body file here:

- `apps/web/public/models/avatar-body/base.glb`

## Recommended GLB Contents

- Full body mesh with head, torso, legs, feet, and arms
- Skeleton bones for hips, spine, upper arms, forearms, thighs, and calves
- Morph targets matching these concepts:
  - `shoulderWide`
  - `chestFull`
  - `waistSlim`
  - `torsoTall`
  - `hipWide`
  - `legLong`
  - `bodyMass`

## Parameter Flow

1. Editor form produces an `AvatarBodySchema`
2. `mapAvatarSchemaToMorphProfile()` derives normalized scale and morph values
3. `applyAvatarSchemaToBodyModel()` maps those values onto GLB morph targets and skeleton bones
4. Viewer renders the GLB model if available, otherwise uses the procedural fallback

## Next Recommended Step

Prepare or purchase a production-ready human body GLB with clean topology and morph targets, then tune `apps/web/lib/avatar-body-model.ts` to the model's actual morph and bone names.
