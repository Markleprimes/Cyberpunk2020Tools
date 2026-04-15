[README.md](https://github.com/user-attachments/files/26737002/README.md)
# Cyberpunk 2020 Web Tools

A browser-based Cyberpunk 2020 character dossier and minigame toolkit built as a static site.

## What It Includes

- Character dossier page in `DND.html`
- Front launcher page in `index.html`
- Upload and download support for `.txt` and dossier `.zip` bundles
- Inventory editor and item-file merge
- Roll Lab with animated dice modal
- Netrunner breach protocol minigame
- Audio-driven UI feedback and transition effects

## Project Files

- `index.html`
  Front page / launcher
- `DND.html`
  Main dossier interface
- `index.css`
  Launcher styles
- `DND.css`
  Dossier styles
- `functions/index.js`
  Launcher UI logic
- `functions/index-transition.js`
  "Chippin In" loading transition
- `functions/createNewCharacter.js`
  Blank-character creation helpers
- `functions/upload-download.js`
  Shared dossier/item upload and zip export logic
- `functions/dossierSheet.js`
  Core statistics, physical, reputation, wallet, skills, damage, armor
- `functions/inventory.js`
  Inventory parsing, editing, rendering
- `functions/rollLab.js`
  Roll presets, aim flow, dice execution modal, roll cinema
- `functions/netrunner.js`
  Netrunner breach protocol game

## How To Use

1. Open `index.html` for the launcher flow.
2. Load a character `.txt` / `.zip`, or create a blank dossier.
3. Use `DND.html` directly if you want to skip the launcher.

Because this is a static site, there is no install step required for normal use.

## Character File Format

Example:

```txt
name: {
  "Kaito Hakurada", "The Cold Fish"
}

stats: {
  REF=10, INT=8, COOL=8, ATTR=6, TECH=5, LUCK=4, EMPT=4
}

career: {
  "Solo"
}

careerSkill: {
  point=6
  Awareness/Notice=6
  Handgun=5
  Stealth=3
}

reputation: {
  rep=3
}

wallet: {
  eddies=2500
}

physicalBody: {
  bodylevel=3
  weight=54
  stunpoint=7
}

armor: {
  Head=10, Torso=18, R.Arm=12, L.Arm=12, R.Leg=14, L.Leg=14
}

damage: {
  Head=0, Torso=0, R.Arm=0, L.Arm=0, R.Leg=0, L.Leg=0
}
```

## Item File Format

Example:

```txt
weapon: {
  weapon1:{
    name="Medium Pistol",
    Type="Weapon",
    Accuracy=0,
    Damage/Ammo="2D6+1",
    ShotsCapacity=12,
    Cost=450,
    info:{ "" }
  }
}

miscellaneous: {
  misc1:{
    name="Trauma Team Card",
    Type="Service",
    Cost=500,
    info:{ "" }
  }
}
```

## Zip Bundle Format

Supported dossier zip contents:

- `character.txt`
- `items.txt`
- optional banner image such as `banner.png`

The dossier exports as zip only.

## Netrunner Controls

- `Easy`, `Medium`, `Hard` buttons select difficulty
- `Arrow Keys` move the runner
- `R` generates a new breach

Rules:

- Hit a wall and the run fails
- Cross your own path and the run fails
- Reach the red node before time runs out

## Notes

- This project is intended to run fully client-side in the browser.
- If GitHub Pages serves the site, make sure `index.html` is at the published root.
- Audio files are expected in the local `audio/` folder.

