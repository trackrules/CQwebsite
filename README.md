# Cycling Annotator (Web)

Cycling Annotator is a browser-based rewrite of the desktop sprint analysis tool. It runs entirely client-side with React, Tailwind CSS, shadcn/ui components, and IndexedDB for persistence.

## Getting started

`ash
npm install
npm run dev
`

Open the local dev URL printed in your terminal (default http://localhost:5173).

## Annotate workflow

1. Click **Open Video** and pick a local .mp4, .webm, or .mov file.
2. The filename is parsed (YYMMDD-Group-Riders-StartType-Distance-Rep) and the sidebar is pre-filled with metadata.
3. Auto detection runs in the background (optional checkbox). On success you will hear a short tone and the 6th beep timestamp is applied as **Start time**.
4. Use the player to scrub:
   - Space toggles play/pause
   - Arrow Left/Right step 1 frame
   - Arrow Up/Down jump to first/last frame
   - Q pauses
   - Mouse wheel over the video steps ±1 frame
5. Focus any timestamp field to prefill the current absolute time. Press **Enter** to commit:
   - Start time stores the absolute value
   - All other fields are relative to Start and display as offsets
6. Choose a split mode (¼ / ½ / Full lap) and click **Apply Splits** to rebuild the distance labels and metrics tabs.
7. Click **💾 Save Session**. The draft is stored under a video hash and immediately appears in the Compare tab.

## Compare sessions

1. Switch to the **Compare** tab.
2. Use **Reload / Select All / Clear** and the filter box to pick sessions.
3. Choose **Total time** or **Split time** mode. Split mode enables the granularity selector (¼ / ½ / Full lap).
4. Tabs let you swap between a distance vs time chart and the comparison table.
   - Table headers and cells are clickable. Selecting one column makes it the reference; other columns display italics with ±Δ from that reference.

## Persistence and import/export

- Sessions are cached in IndexedDB under a hash of 
ame:size:lastModified.
- The **Export sessions** button downloads a single sessions.json bundle.
- **Import sessions** merges and overwrites by video key.

## Testing

`ash
npm run test
`

Unit tests cover file-name parsing, time parsing, split generation, comparison transforms, and the audio beep detector helper.

## Tech stack

- React, TypeScript, Vite
- Tailwind CSS with shadcn/ui primitives (dark theme)
- Recharts for plotting
- IndexedDB (idb) for persistence
- Vitest + Testing Library for unit tests

## Notes

- The app is offline-first. All files stay on-device.
- equestVideoFrameCallback powers frame stepping with a seeked fallback.
- If your browser suspends audio contexts, interact with the page (click) before running detection or playing the confirmation tone.

