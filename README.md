# Cyberpunk 2020 Web Tools

A browser-based Cyberpunk 2020 toolkit for player dossiers, GM monitoring, rolling, combat support, and lightweight online table play.

## What This Site Does

This project is meant to give a Cyberpunk 2020 session a more tactile browser interface without needing a heavy install.

Main features:

- player dossier page
- GM / referee console
- animated roll system with presets
- inventory, reputation, wallet, physical data, and damage tracking
- Netrunner breach protocol minigame
- `.txt` and `.zip` character import / export
- Firebase room link for live GM-player sync

## Main Pages

- `index.html`
  Launcher, upload page, and quick-start overview
- `DND.html`
  Player dossier
- `gm.html`
  Referee / GM console

## Quick Start

You can use either:

- live site: [https://markleprimes.github.io/Cyberpunk2020Tools/](https://markleprimes.github.io/Cyberpunk2020Tools/)
- local files: open `index.html` directly in the browser

1. Open the live site or `index.html`
2. Choose one of these:
   - `LOAD FILE`
   - `CREATE NEW CHARACTER`
   - `OPEN GM PAGE`
3. If you load a character, use a `.txt` or bundled `.zip`
4. If you create a new character, enter name, street name, and career
5. The launcher will transition into the dossier

## Character Files

Supported:

- character `.txt`
- item `.txt`
- bundled dossier `.zip`

Recommended dossier zip contents:

- `character.txt`
- `items.txt`
- optional banner image such as `banner.png`

Exports are zip-based.

## Using The Room Link

The room system is for live table use between player dossier pages and the GM page.

Basic flow:

1. Open `gm.html`
2. Enter a room ID and connect
3. On the player dossier, enter the same room ID in `ROOM LINK`
4. Choose whether the dossier connects as `PLAYER` or `NPC`
5. Click `CONNECT`

After that, the GM page can see linked characters and use the referee tools.

## NPC / Random Generation

For NPCs, mooks, throwaway enemies, or other random generated content, the intended workflow is to use an external chatbot AI and have it output text in the same upload format shown on the front page.

Recommended flow:

1. ask your preferred chatbot for a Cyberpunk 2020 NPC or item set
2. tell it to match the upload format
3. save the result as `.txt`
4. import it into the dossier or GM page

That keeps random generation flexible without forcing this site itself to become a full generator.

## Front Page Format Guide

The front page already includes the visible upload template for:

- character files
- item files

That is the format to copy when preparing content from other tools.

## Tech Notes

This project runs client-side in the browser and uses:

- HTML
- CSS
- JavaScript
- Firebase Realtime Database for live room sync
- JSZip for zip import / export

No traditional install is required for normal local use beyond opening the pages in a browser.

## Project Structure

- `index.html`, `index.css`
  launcher and public entry page
- `DND.html`, `DND.css`
  player dossier UI
- `gm.html`, `gm.css`
  referee UI
- `functions/`
  split JavaScript modules for upload, dossier logic, rolling, sync, GM combat flow, and netrunning

## Development Note

This project was built with heavy AI assistance during development, but the important part for use is the workflow:

- load or create a character
- connect players to the GM room if needed
- use the dossier and GM tools during play
- use external chatbot generation when you need fast random content
