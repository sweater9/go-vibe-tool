# IntelliTools launch asset capture guide

Use the live production site for screenshots so launch media always matches the product users receive.

## Capture settings
- Desktop viewport: 1440 × 1000 or similar, browser chrome excluded where possible.
- Keep the production IntelliTools branding and normal light theme.
- Do not show personal browser data, extensions, bookmarks, account names or notifications.
- Use only synthetic sample content.
- Export screenshots as PNG.
- Keep important UI inside a central safe area so Product Hunt cropping does not remove it.

## Required frames

### 01 — Homepage discovery
**Route:** `/`  
Show hero, tool search and enough catalogue cards to communicate breadth.  
**Caption:** 40 focused tools. One workspace.

### 02 — AI Prompt Builder
**Route:** `/?tool=ai-prompt-builder#tools`  
Use a short synthetic task and show a completed structured prompt.  
**Caption:** Turn a rough request into a structured prompt.

### 03 — PII & Secret Redactor
**Route:** `/?tool=pii-secret-redactor#tools`  
Use fake data only, for example `alex@example.test` and `API_KEY=demo_not_a_real_key`. Show the redacted result.  
**Caption:** Clean sensitive patterns before you share text.

### 04 — Private PDF Tools
**Route:** `/?tool=pdf-studio#tools`  
Show the PDF workspace without any real/private document names.  
**Caption:** Everyday PDF tasks without another account.

### 05 — Image Studio
**Route:** `/?tool=image-studio#tools`  
Use a non-personal sample image and show compression/conversion controls.  
**Caption:** Resize, convert and compress in one focused workspace.

### 06 — Return workflow
**Route:** `/`  
Favourite two tools first, then show Favourites / Recently Used.  
**Caption:** Find it once. Get back to it quickly.

## Demo recording
Target 20–35 seconds. Record one continuous path:
1. Homepage.
2. Search for AI Prompt Builder.
3. Open it and show a prepared result.
4. Follow the related-tool path to PII & Secret Redactor.
5. Favourite a tool.
6. Return home and show the shortcut shelf.
7. Finish with the IntelliTools hero and “Less switching. More doing.”

Avoid cursor wandering, typing long examples, loading pauses and demonstrations of every feature.

## Thumbnail
The source thumbnail is `assets/product-hunt-thumbnail.svg`. Export it to a 240 × 240 PNG for upload while retaining the SVG source in the repository.
