# Cyberpunk 2020 Web Tools

A browser-based Cyberpunk 2020 toolkit for player dossiers, GM monitoring, rolling, combat support, lightweight online table play, and account-backed character persistence.

## What This Site Does

This project is meant to give a Cyberpunk 2020 session a more tactile browser interface without needing a heavy install.

Main features:

- player dossier page
- GM / referee console
- animated roll system with presets
- per-character dossier theme / setting
- inventory, reputation, wallet, physical data, and damage tracking
- Netrunner breach protocol minigame
- `.txt` and `.zip` character import / export
- Firebase room link for live GM-player sync
- Google login for optional account saves
- account save / restore for dossier characters
- saved local NPC tabs on the GM page

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

Notes:

- the live site is hosted on GitHub Pages
- Firebase is used for login, saves, and live sync
- Google login will not work from a local `file://` page
- if you want login and account saves, use the live site
- if you just want a quick local session, opening the local files is still fine

1. Open the live site or `index.html`
2. Choose one of these:
   - `LOAD FILE`
   - `CREATE NEW CHARACTER`
   - `OPEN GM PAGE`
3. If you are not signed in, the launcher now lets you choose:
   - `LOG IN WITH GOOGLE`
   - `ENTER WITHOUT LOGIN`
4. If you load a character, use a `.txt` or bundled `.zip`
5. If you create a new character, enter name, street name, and career
6. The launcher will transition into the dossier

## Login And Save Behavior

- Google login is optional
- guest entry is allowed from the launcher
- signed-in users can save dossier characters to their account
- signed-in users can reopen characters from the homepage `SAVED CHARACTERS` section
- dossier also includes `LOAD FROM SAVE` and `SAVE` in the left drawer
- GM local NPC tabs now persist to the signed-in account as well

If you do not sign in:

- the site still works
- local play is fine
- account restore after refresh is not available

## Character Files

Supported:

- character `.txt`
- item `.txt`
- special-skill `.txt`
- bundled dossier `.zip`

Recommended dossier zip contents:

- `character.txt`
- `items.txt`
- `specialskills.txt`
- optional banner image such as `banner.png`

Exports are zip-based.

## Recent Updates

### 2026-05-22 to 2026-05-23

- Firebase Google login was added to the launcher, dossier, and GM pages.
- Launcher access is no longer forced-login. Users can choose:
  - `LOG IN WITH GOOGLE`
  - `ENTER WITHOUT LOGIN`
- Homepage now includes a full-width `SAVED CHARACTERS` section for signed-in users.
- Dossier now supports account-backed `SAVE` and `LOAD FROM SAVE`.
- GM local NPC tabs now persist to the signed-in account.
- Dossier and GM headers now show the current signed-in user state.
- Dossier `USER` tag now opens auth actions, including sign-out confirmation.
- GM character flow was pushed further into dossier-style tabs instead of the older monitor-first layout.
- Remote players and local NPCs now use a more unified tab language on the GM page.
- `DEATH SAVE` was added as a manual physical stat and can now be added to the roll pool from the dossier.
- Dossier inventory was overhauled:
  - compact item cards
  - hover info panel
  - fixed item detail modal
  - separate `active` and `passive` item attributes
- Active item attributes now apply directly to dossier values.
- Passive item attributes can be used as roll modifiers or dice queue helpers.
- Roll HUD modifier preview was cleaned up and now shows a real breakdown tooltip.
- The breach minigame was rebalanced:
  - checkpoint-based route logic
  - GM timer-controlled remote breach
  - timer-aware board generation
- Dossier theme switching is now saved per character.
- Current dossier settings include:
  - `Night City`
  - `European Economy Community`
- `European Economy Community` uses the `EuroTheatre` dossier header and a colder blue/navy skin.

### Character Format

```txt
name: {
  "Character Name", "Street Name"
}

stats: {
  REF=0, INT=0, COOL=0, ATTR=0, TECH=0, LUCK=0, MA=0, BODY=0, EMP=0
}

career: {
  "Solo"
}

setting: {
  "Night City"
}

careerSkill: {
  point=0
  Awareness=0
}

specialSkills: {
  aikido1:{
    name="Throw Redirect",
    tiedSkill="Martial Art (Aikido)",
    value=2,
    info:{ "Redirect incoming momentum into a throw." }
  }
}

reputation: {
  rep=0
}

wallet: {
  eddies=0
}

physicalBody: {
  bodylevel=0
  weight=0
  stunpoint=0
  deathsave=0
}

armor: {
  Head=0
  Torso=0
  R.Arm=0
  L.Arm=0
  R.Leg=0
  L.Leg=0
}

damage: {
  Head=0
  Torso=0
  R.Arm=0
  L.Arm=0
  R.Leg=0
  L.Leg=0
}
```

### Item Format

Current item save format uses separate `active` and `passive` blocks.

Notes:

- `active` attributes auto-apply to the dossier
- `passive` attributes are meant for roll interaction
- legacy flat item files can still load through compatibility parsing

```txt
weapon: {
  weapon1:{
    name="Medium Pistol",
    active:{ Head Armor="2" },
    passive:{ Accuracy="1", Damage="2d6+3", Ammo="12" },
    info:{ "Standard sidearm." }
  }
}

cyberware: {
  cyberware1:{
    name="Amplified Hearing",
    active:{ Awareness="2", Body Level="1" },
    passive:{ Initiative="1", Detect="2" },
    info:{ "Boosted hearing in loud environments." }
  }
}

buff: {
  buff1:{
    name="Combat Stim",
    active:{ REF="1", Body Level="1" },
    passive:{ Handgun="1" },
    info:{ "Short burst combat enhancer." }
  }
}
```

## Using The Room Link

The room system is for live table use between player dossier pages and the GM page.

Basic flow:

1. Open `gm.html`
2. Enter a room ID and connect
3. On the player dossier, enter the same room ID in `ROOM LINK`
4. Choose whether the dossier connects as `PLAYER` or `NPC`
5. Click `CONNECT`

After that, the GM page can see linked characters and use the referee tools.

Current GM flow:

- connected players appear as character tabs
- local NPCs can be created or imported as their own tabs
- local NPC tabs now save to the signed-in account
- right-click tab actions are used for quick facedown / initiative staging

## NPC / Random Generation

For NPCs, mooks, throwaway enemies, or other random generated content, the intended workflow is to use an external chatbot AI and have it output text in the same upload format shown on the front page.

Recommended flow:

1. ask your preferred chatbot for a Cyberpunk 2020 NPC or item set
2. tell it to match the upload format
3. save the result as `.txt`
4. import it into the dossier or GM page

That keeps random generation flexible without forcing this site itself to become a full generator.

## Front Page Format Guide

The front page includes a format guide modal for:

- character files
- item files
- bundled zip structure

That is the format to copy when preparing content from other tools.

## Tech Notes

This project runs client-side in the browser and uses:

- HTML
- CSS
- JavaScript
- Firebase Authentication for Google login
- Firebase Realtime Database for live room sync
- Firebase Realtime Database for account save data
- JSZip for zip import / export

No traditional install is required for normal local use beyond opening the pages in a browser, but Google login and account saves should be tested from the hosted site, not local `file://` pages.

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

This project was built with roughly 80% AI assistance during development, but the important part for use is the workflow:

- load or create a character
- sign in only if you want account-backed saves
- connect players to the GM room if needed
- use the dossier and GM tools during play
- use external chatbot generation when you need fast random content
