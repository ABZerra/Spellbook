# Spell Preparation Between Long Rests (MVP PRD)

## Problem
Spellcasters need a reliable way to plan and apply prepared spell changes between sessions.

## Primary goal
Enable users to prepare, review, and save their next long-rest spell changes while preserving an immutable history.

## Core jobs to be done
- Preview future spell list before applying a long rest.
- Queue additions/removals/replacements with optional notes.
- Compare active list and planned list.
- Browse spell details and metadata quickly.
- Organize spells into reusable groups.
- Keep independent spellbooks per character.
- Review applied long-rest snapshots over time.

## MVP scope
- Character-level spellbooks
- Active list + pending plan
- Planned changes (add/remove/replace + note)
- Diff preview
- Apply plan to create long-rest snapshot
- History browsing per character

## Success criteria
- Plans can be saved without applying.
- Preview exactly matches what apply will produce.
- Apply writes immutable history and updates active list.
- Data remains isolated per character.
