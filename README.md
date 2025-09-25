# Cycling Annotator (Web)

Cycling Annotator is a browser-based rewrite of the desktop sprint analysis tool. It runs entirely client-side with React, Tailwind CSS, shadcn/ui components, and IndexedDB for persistence.

## Getting started

```
npm install
npm run dev -- --host 0.0.0.0
```

Open the local dev URL printed in your terminal (default `http://localhost:5173`). The `--host` flag keeps the dev server reachable from other devices on your LAN.

## GitHub Pages deployment

The repo ships with `.github/workflows/deploy.yml`, which builds the Vite app and publishes it to GitHub Pages with a single workflow run. To go live:

1. Push the workflow file to the default branch (expected `main`).
2. In your repository go to **Settings → Pages** and set the source to **GitHub Actions**.
3. Update `.env.local` (and any GitHub secrets you rely on) so production URLs include the repository path, for example `https://<username>.github.io/<repo>/oauth2/callback` for `VITE_GOOGLE_OAUTH_REDIRECT_URI`.
4. Commit and push your app changes to `main`; the `Deploy to GitHub Pages` workflow will build, create a SPA-friendly `404.html`, and publish the result.
5. Wait for the deployment badge on the workflow run to turn green, then browse to `https://<username>.github.io/<repo>/`.

If you fork or rename the repository, you can override the build-time base path by setting `VITE_PUBLIC_BASE_PATH` in the workflow or when running `npm run build` locally. The QR-code flow now preserves any sub-directory so links such as `https://user.github.io/repo/phone-upload` continue to resolve when shared.

## Video sources

When you click **Open Video**, a dialog lets you choose between:

- **Open from local** - opens the file picker and loads the video as before.
- **Open from Google Photos** - launches the Google OAuth flow (see below). Tokens are stored locally, so you can revisit the Photos picker without re-consenting every time.
- **Upload from phone via QR** - generates a QR code that links to a mobile-friendly upload page. Scan it, pick a video on your phone, and the desktop app downloads it automatically when the upload completes.

### Google Photos setup (browser + optional backend)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Photos Library API** (and Google Drive API if you also need Drive).
3. Configure the OAuth consent screen (External user type unless you are only using a Workspace org). Add the `https://www.googleapis.com/auth/photoslibrary.readonly` scope.
4. Create **OAuth client credentials** (Web application). Add redirect URIs:
   - `http://localhost:5173/oauth2/callback` for local dev (match `VITE_GOOGLE_OAUTH_REDIRECT_URI`).
   - Any production URL you plan to deploy to.
5. Download the `client_secret.json` and keep it safe. The web app uses the **client ID** (not the secret) along with the PKCE flow when running entirely in the browser. If you introduce a backend that handles token exchange, store the secret server-side.
6. Set the environment variables in `.env.local`:

   ```env
   VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5173/oauth2/callback
   VITE_GOOGLE_PHOTOS_SCOPES=https://www.googleapis.com/auth/photoslibrary.readonly
   VITE_GOOGLE_PHOTOS_ALBUM_ID=optional-default-album-id
   ```

   The `.env.local` file is not committed; paste the client ID there. If your workflow uses a backend, place the path to `client_secret.json` and the secret itself on the server instead.

7. After authentication you will receive an authorization `code` at the redirect URI. The app exchanges it with PKCE and stores the resulting tokens in `sessionStorage`.

### Phone upload via QR

1. Start the helper server: `npm run upload-server` (listens on port 3030 by default).
2. Update `.env.local` with `VITE_UPLOAD_SERVER_URL`, pointing to that helper. Use your computer's LAN IP instead of `localhost` so phones on the same Wi-Fi can reach it (for example `http://192.168.1.24:3030`).
3. Click **Open Video → Upload from phone via QR**. Replace `localhost` in the desktop base URL if needed, then scan the QR code with your phone.
4. On the phone page, select a video and upload it. Keep both the phone page and the desktop dialog open until the upload finishes.
5. The desktop app polls the helper, downloads the uploaded file, and loads it into the annotator automatically.

## Annotate workflow

1. Click **Open Video** and pick a local `.mp4`, `.webm`, or `.mov` file (or use the Google Photos / phone upload options above).
2. The filename is parsed (`YYMMDD-Group-Riders-StartType-Distance-Rep`) and the sidebar is pre-filled with metadata.
3. Use the player to scrub:
   - Space toggles play/pause
   - Arrow Left/Right step 1 frame
   - Arrow Up/Down jump to first/last frame
   - `Q` pauses
   - Mouse wheel over the video steps ±1 frame
4. Focus any timestamp field or press **Enter next** to record the next mark. **Start time** stores the absolute value; all other fields are relative to Start and display offsets.
5. Choose a split mode (½ / ¼ / Full lap) and click **Apply Splits** to rebuild the distance labels and metrics tabs.
6. Click **💾 Save Session**. The draft is stored under a video hash and immediately appears in the Compare tab.

## Compare sessions

1. Switch to the **Compare** tab.
2. Use **Reload / Select All / Clear** and the filter box to pick sessions.
3. Choose **Total time** or **Split time** mode. Split mode enables the granularity selector (½ / ¼ / Full lap).
4. Tabs let you swap between a distance vs time chart and the comparison table. Table headers and cells are clickable - selecting one column makes it the reference; other columns display +/- relative to it.

## Persistence and import/export

- Sessions are cached in IndexedDB under a hash of `name:size:lastModified`.
- The **Export sessions** button downloads a single `sessions.json` bundle.
- **Import sessions** merges and overwrites by video key.

## Testing

```
npm run test
```

Unit tests cover file-name parsing, time parsing, split generation, comparison transforms, and utility helpers.

## Tech stack

- React, TypeScript, Vite
- Tailwind CSS with shadcn/ui primitives (dark theme)
- Recharts for plotting
- IndexedDB (`idb`) for persistence
- Vitest + Testing Library for unit tests

## Notes

- The app is offline-first. All files stay on-device.
- `requestVideoFrameCallback` powers frame stepping with a `seeked` fallback.
- Ensure `.env.local` is populated with your Google OAuth settings before attempting the Google Photos flow.
- Run `npm run upload-server` if you plan to ingest videos from phones.
