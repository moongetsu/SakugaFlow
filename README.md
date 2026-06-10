<h1 align="center">
  <img src="SakugaFlow/SakugaFlow-Logo.png" width="" alt="SakugaFlow"/>
  <br />
</h1>
<p align="center">
  <b>Sakugabooru directly in After Effects.</b><br>
  <i>Search, preview, download, and import animation clips without leaving AE.</i>
</p>

<hr>

## 🎬 About

**SakugaFlow** is a free unofficial After Effects CEP extension made for reference and editing workflows. It searches Sakugabooru, previews clips, downloads selected files locally, and imports them directly into your After Effects timeline. It also includes AI upscaling powered by Real-ESRGAN.

SakugaFlow is an independent project built from scratch. It shares no code with Sakugaloader and was created with a different structure and feature set. The goal is to provide editors with a lightweight, stable loader regardless of their hardware or software setup.

> [!NOTE]
> **Compatibility:** Supports **After Effects CC 2018 through CC 2026+** (v15.0+). Windows primary, macOS untested.

---

## 🚀 Features

### Search & Browse
- **Sakugabooru Search** - Search clips by tags with comma-separated queries, pagination, and autocomplete suggestions.
- **Saved Tags** - Save frequently used search tags for quick access.
- **Rating Filters** - Filter results by rating (safe, questionable, explicit).
- **Recently Added** - One-click browse of the latest clips uploaded to Sakugabooru.

### Preview & Player
- **Canvas Video Player** - Built-in player with playlist support and keyboard navigation (arrow keys, spacebar).
- **Hover Preview** - Hover over any card to preview the clip with audio directly in the grid.
- **Full-size Preview** - Click any card to open a larger preview with playback controls.

### Download & Import
- **One-Click Download** - Download individual clips or batch-download multiple selections.
- **Direct Timeline Import** - Import downloaded clips straight into your AE composition at the playhead position.
- **Bulk Operations** - Select multiple clips and download them all at once.

### AI Upscale
- **Real-ESRGAN Integration** - Upscale clips using AI with configurable scale factors (2x, 3x, 4x).
- **Queue System** - Queue multiple clips, track progress with per-clip status (trim, extract, enhance, encode, done).
- **Render History** - View all past upscale renders with quick import and open-folder actions.
- **FFmpeg Pipeline** - Automatic frame extraction and video encoding via FFmpeg.

### Scene Packs
- **Local Folders** - Browse local scene pack folders and import files directly into AE.
- **Multi-Folder Support** - Add and manage multiple scene pack directories.

### Library
- **Downloaded Clips Manager** - Browse, preview, and manage all your downloaded clips in one place.
- **Import from Library** - Import any previously downloaded clip back into your timeline.

### Customization
- **Card Sizes** - Adjust thumbnail card sizes to your preference.
- **Accent Colors** - Customize the extension's accent color.
- **Background Images** - Set a custom background image with configurable opacity and blur.
- **Glass & Gradient** - Toggle glass-morphism panels and gradient overlays.
- **Hover Audio** - Enable/disable audio on hover with adjustable volume.

---

## 📦 Installation

### Method 1: ZXP Installer (Easiest)
1. Pick your After Effects version folder (AE2018 / AE2020 / AE2022).
2. Download [ZXP Installer](https://aescripts.com/learn/post/zxp-installer) (Windows & macOS).
3. Drag `SakugaFlow.zxp` onto the ZXP Installer window.
4. Restart After Effects, go to `Window > Extensions > SakugaFlow Extension`.

### Method 2: Windows Setup Wizard (.exe)
1. Open your version folder and run `SakugaFlowSetup.exe`.
2. Follow the setup wizard - it handles file placement and registry keys automatically.

### Method 3: Manual Folder Installation
1. Copy the `SakugaFlow` folder from your desired version folder to:
   - Windows: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`
   - macOS: `~/Library/Application Support/Adobe/CEP/extensions/`
2. Enable PlayerDebugMode: double-click `Add-Keys.reg` or run `Add-Keys.bat` as admin.
3. Restart After Effects.

---

## 🔧 Building from Source
```bash
cd tools && npm install
cd .. && npm run build:all
```

---

## 🤝 Credits & Background

Credit for the original concept of a dedicated Sakugabooru fetcher extension for After Effects goes to the creators of **Sakugaloader**.

When the concept was first released, I wanted to contribute to its development - fixing bugs, optimizing code, and maintaining support for older versions of After Effects. Because collaboration was not possible and support for older AE versions was dropped in the original tool, I decided to build a new alternative from scratch.

This extension is written entirely from the ground up, shares no code with other plugins, and supports CC 2018 through CC 2026.

---

## 💬 Community

- **SakugaFlow Discord:** https://discord.gg/SRYzqKRRgQ
- **Sakugaloader Discord:** https://discord.gg/ysFGJGdgzf
- **GitHub:** https://github.com/Moongetsu/SakugaFlow

---

## ⚠️ Usage Notice

Use responsibly. This extension does not own, host, or license any clips. All rights belong to their original copyright holders. Do not redistribute downloaded clips as packs, sell downloaded content, or claim ownership of any material.

---

<p align="center">
  <img src="https://badgen.net/badge/Built%20for/After%20Effects/red?icon=adobe" alt="After Effects" />
  <img src="https://badgen.net/badge/Tech/CEP%20Extension/gold" alt="CEP" />
  <img src="https://badgen.net/badge/AI%20Engine/Real-ESRGAN/green" alt="AI Engine" />
  <img src="https://badgen.net/badge/Compatibility/CC%202018-2026%2B/blue" alt="Compatibility" />
</p>

<p align="center">
  <i>Unofficial tool by Moongetsu. Made for the AMV community.</i>
</p>
