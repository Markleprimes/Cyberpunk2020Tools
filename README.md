# Cyberpunk 2020 Web Tools

A browser-based Cyberpunk 2020 interface suite for character dossiers, referee support, rolling, and lightweight online table play.

## Project Overview

This project is built as a static web toolkit for Cyberpunk 2020 roleplay sessions. It is meant to feel like a playable in-universe interface rather than a plain sheet app.

Core features include:

- player dossier page
- referee / GM monitor
- dice and preset roll system
- inventory and damage tracking
- Netrunner breach protocol minigame
- `.txt` and `.zip` character import/export
- Firebase-backed room sync for live table use

## AI Disclosure

Roughly **80% of this project was built with AI assistance**.

That includes a large amount of:

- interface scaffolding
- system wiring
- repetitive implementation work
- iteration on visual and interaction polish

Human direction still shaped the project through:

- feature selection
- rule interpretation
- testing and correction
- pacing and usability decisions
- deciding what stayed, what got removed, and what got rebuilt

This disclosure is here on purpose. I would rather publish it honestly than pretend otherwise.

## Why It Exists

The goal is simple: make Cyberpunk 2020 table play feel faster, more tactile, and more stylish without needing a heavy install or custom backend.

This toolkit is designed for:

- running a dossier in browser
- giving the GM a live monitor page
- speeding up common rolls and combat flow
- giving hacking scenes their own game feel

## Pages

- `index.html`
  Front launcher and public-facing project page
- `DND.html`
  Player dossier
- `gm.html`
  Referee / GM console

## File Support

The project supports:

- character `.txt`
- item `.txt`
- bundled dossier `.zip`

Recommended zip bundle contents:

- `character.txt`
- `items.txt`
- optional banner image such as `banner.png`

Exports are zip-based for portability.

## NPC / Mook Generation

For quick NPCs, mooks, throwaway enemies, or other random generation tasks, the intended workflow is to use an **external chatbot AI** and have it produce output in the same upload format shown on the front page.

That keeps random generation flexible without forcing this site to become a full procedural content generator.

Practical workflow:

1. ask your preferred chatbot AI for a Cyberpunk 2020 NPC
2. have it format the result to match the upload template
3. save it as `.txt`
4. import it into the GM page or dossier

## Tech Notes

This project runs client-side in the browser and is built from:

- HTML
- CSS
- JavaScript
- Firebase Realtime Database for live room sync
- JSZip for zip import/export

No traditional install is required for local use beyond opening the pages in a browser.

## Project Structure

- `index.html`, `index.css`
  launcher / public front page
- `DND.html`, `DND.css`
  dossier UI
- `gm.html`, `gm.css`
  referee UI
- `functions/`
  split JavaScript modules for upload, dossier logic, roll systems, sync, GM combat flow, and netrunning

## Publishing Note

This is being published as a creative tool project, not as a claim of hand-written purity.

The important thing for me is that:

- it works
- it is usable at the table
- it has personality
- and the AI involvement is stated openly

If you use or fork it, I strongly recommend keeping that same kind of transparency.
