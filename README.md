# ArtistWave 🎵

A local, browser-based music player that lets you **choose the correct artist or recording** before creating a playlist. Searches artist identities using MusicBrainz and publicly available audio recordings on the Internet Archive.

## Getting started

1. Download or clone this repository.
2. Open `index.html` in a modern browser.
3. Enter the artist or band's name (for example, **Dorothy**).
4. Review the selection cards: MusicBrainz artist identities and matching Internet Archive recordings appear separately.
5. Select the artist you mean. ArtistWave searches Internet Archive for playable audio credited to that artist.
6. Click a track to play it.

For browsers that restrict requests on `file://` pages, run `python -m http.server 8000` in the repository directory and visit `http://localhost:8000`.

## Features

- Multiple artist and recording matches, including similarly named bands, performers, and radio recordings
- Artist-specific, creator-metadata-based Internet Archive playlist search
- Streaming from publicly accessible audio files, with play/pause, skip, seek, volume, shuffle and repeat
- Browser-local favorites (online recordings)
- Local audio file import; files remain on your device
- Responsive dark layout
- YouTube **search link** for selected artists (not embedded YouTube playback)
- No API key required

## Limitations

MusicBrainz provides artist identification, **not audio playback**. Internet Archive may lack licensed commercial releases; choosing an artist does not guarantee playable tracks. Artist attribution on Archive records can be incorrect or missing. Playback depends on file availability, browser codec support and third-party APIs. Some browsers require the HTTP server method above. Internet access is required for online search and streaming.

This project does not download from commercial streaming platforms or bypass licensing restrictions.

## Files

- `index.html` — markup
- `styles.css` — responsive UI
- `app.js` — artist selection, Archive search, playlist and player logic
- `LICENSE` — MIT license

## Version

**v1.1 test build** — artist-choice search before playlist loading. Search and streaming require real-world browser testing across providers.

## Artist / recording images (v1.2)

Match cards show an image on the left third and identifying text on the right two-thirds. Archive recording cards use an Archive thumbnail. MusicBrainz artist cards try photos or logos linked to the exact artist ID and, if unavailable, cover art from a release by that artist. Where no usable artwork is found, a styled fallback symbol is shown. The first successfully selected image URL is stored in browser `localStorage` under the unique artist/recording ID and reused on later searches, including after closing the tab. This preference is local to the same browser profile/device; images still depend on the original host being available. Clearing site data resets the choice.

## Rap era browser (v1.3)

The left sidebar now has **MUSIC GENRES → Rap → 80s / 90s / 2000s / 2010s / 2020s**. Choosing an era shows an editorial artist list (major and less-commercial artists). Clicking an artist opens their artist-only Archive playlist. Artists may appear in several decades. The list is curated rather than an objective chart ranking; commercial tracks may not be available for streaming.

Jazz and metal are planned for later iterations. Their navigation will use historically meaningful stylistic periods, rather than assuming every genre fits decade groupings (for example, Swing, Bebop, Hard Bop, Modal and Fusion for jazz).

### Personalizing an artist image

Click an image in a search-result artist/recording card to replace it using a direct HTTPS image URL or your own image file. Files are resized before being saved to this browser's local storage. **Restore automatic image** forgets the manual choice. A saved image stays the same across future searches in the same browser profile, unless you reset it, clear site data or the remote host stops serving the image.

## Song lyrics links (v1.5)

Every track—playable or catalog-only—has clearly labeled **AZLyrics** and **Genius** external search links. They open in a new browser tab. The interface credits these destination websites and explicitly describes the links as *searches*, not verified song pages or reproduced lyrics. ArtistWave does not scrape, copy, cache or display their copyrighted lyrics. Lyrics sites may return zero results or change their search URLs. The checkbox **Show titles without audio** is optional and uses MusicBrainz title data, not a guarantee that audio does not exist anywhere online.

## Rap navigation visibility fix (v1.6)

Clicking an era in the left **Rap** menu expands its artist names **directly underneath that era**. The larger artist panel in the main view is also populated and scrolled into view. Clicking a name in either location starts that artist's Archive playlist search. Clicking the open era collapses it.

## Online hosting (GitHub Pages)

This repository includes [an automatic deployment workflow](.github/workflows/pages.yml). It deploys the static website whenever changes are pushed to `main`, and also supports manual runs through the Actions tab.

**One-time repository setup:** Open **Settings → Pages**, and under **Build and deployment** select **GitHub Actions**. Ensure GitHub Actions is enabled for this repository. If the repository is private, Pages eligibility depends on your GitHub plan; making it public is an option but also exposes the source code.

Once the workflow succeeds, the expected site address is **https://28121978444.github.io/ArtistWave/**. This URL is not guaranteed to work until Pages is enabled and a deployment has succeeded.

ArtistWave is a static client-side app. Online MusicBrainz/Internet Archive requests require an Internet connection and may be affected by browser cross-origin restrictions or third-party service availability. No API keys or credentials are required or stored in the repository.

### Troubleshooting a 404 on GitHub Pages

If `https://28121978444.github.io/ArtistWave/` shows **There isn't a GitHub Pages site here**, the repository may be public without Pages itself being enabled. On 2026-11-06 the deployment workflow's **Configure GitHub Pages** step failed with **Get Pages site failed — Not Found**. The JavaScript syntax check and site-file preparation passed before that step.

**One-time fix (repository owner):** Go to [Settings → Pages](https://github.com/28121978444/ArtistWave/settings/pages) and set **Build and deployment → Source → GitHub Actions**. This creates/configures the Pages site. Then use [Actions → Deploy ArtistWave to GitHub Pages](https://github.com/28121978444/ArtistWave/actions/workflows/pages.yml) to rerun the failed job or choose **Run workflow** on `main`. GitHub's default `GITHUB_TOKEN` cannot create a new Pages site simply by setting `enablement: true` in the workflow; a user must enable it in repository settings unless a separate credential with administration and Pages permissions is configured. No such credential should be added to the site.

## Genre movements and showdance discovery (v1.7)

The left sidebar now browses a curated selection in this order:

- **Jazz** → Early Jazz, Swing, Bebop, Cool Jazz, Hard Bop, Modal/Spiritual, Fusion, and contemporary movements.
- **Rock** → **Classic & Hard Rock**, **Heavy Metal**, **Power Metal**, **Death Metal**. Each has its own historical eras and artist lists. Artists can repeat across eras (Alice Cooper appears throughout several Classic/Hard Rock periods).
- **Rap** → Retains the existing 80s, 90s, 2000s, 2010s, 2020s artist lists, including major names and lesser-known performers.
- **Reggae** → Ska, Rocksteady, Roots, Dub, Dancehall, and contemporary/reggae revival.
- **Showdance & training** → **Dance Pop**, **Electronic Dance** (House, Trance, festival EDM), **Funk & Disco**, **Latin Dance**, **Cinematic & Orchestral**, and **Breakbeat & Street**. Use these lists as inspiration for gymnastics and showdance routine selection.

Selecting a genre, then a substyle when present, then an era opens the artist list both inside the sidebar and in the main content area. Clicking an artist starts the existing artist-only recording search. These are editorial exploration categories rather than authoritative historical boundaries, musical rankings, or guarantees of playable recordings. Some names intentionally appear in multiple eras. Gymnastics coaches/performers should verify actual tempo, length, content suitability and any necessary music permissions for public performances. This is not an automatic tempo/BPM-based fitness recommendation engine.

## Local music folders and source selection (v2.0)

ArtistWave can now index music in a folder chosen by the user. Click **Add Music Folder** in the sidebar. Chrome/Edge may prompt with the File System Access folder picker, and compatible browsers fall back to a directory upload picker. Selected subfolders are scanned recursively where supported, with an upper limit of 6,000 files per scan. Import only runs after your explicit selection, and is **not continuous monitoring**. No music is uploaded to ArtistWave or GitHub; it is played through temporary browser object URLs. The index remains in memory for the current tab/session, so select the folder again after reloading.

Supported filename extensions are MP3, M4A, AAC, OGG/OGA, FLAC, WAV, and Opus. MP3 ID3v2.3/2.4 artist/title/album text metadata is used when available; other formats use folder names and filenames, preferring `Artist - Track.ext` or `Music/Artist/Album/Track.ext`. Tracks without identifiable artist metadata appear as `Unknown artist` and won't automatically match a named artist search.

**Music sources:** select **Local + online**, **Local only**, or **Online only** in the search controls. Local + online is the default. Local music wins over duplicates from Internet Archive. The playlist is rebuilt when the source setting changes, so existing loaded files can be included or excluded without uploading them. Local-only searches do not contact online artist/recording lookup services. Songs without audio remain optional and are only listed in online-enabled modes.

Folder access depends on your browser's permission and feature support. A directory scan does not grant ongoing access to your filesystem, and changing devices requires selecting folders again. Local files cannot be saved as persistent favorites because browser object URLs are temporary. Always respect rights needed for public performance or use of music in competitions.

## Multiple online audio sources (v2.1)

ArtistWave can combine **Internet Archive** and **Audius** playback results for the selected artist, along with local files. Use the checkboxes under **Online audio providers** to enable or disable each provider. By default Internet Archive and Audius are on; Jamendo is optional. The **Music sources** selector (Local + online / Local only / Online only) continues to work across all providers. Providers are queried independently so an unavailable service does not prevent successful results from another service.

**Audius:** Read-only public API at https://api.audius.co/v1; no API key is required for basic searches. Artist discovery queries match the public artist name or handle, then request that user's published tracks. Gated, unlisted and non-streamable tracks are excluded, and audio is played using Audius' streaming endpoint. Returned artist matches and playback availability depend on the Audius service; independent artists may have no matching accounts or tracks.

**Jamendo:** requires a valid application `client_id` obtained from https://devportal.jamendo.com/. Enter it into the **Jamendo client ID** field and choose **Save ID**. ArtistWave stores this client ID and provider preference in this browser's localStorage only; do not enter an account password, secret, or private access token. Jamendo is disabled until an ID is supplied. Playback results are filtered to the requested artist and require an HTTPS audio URL; direct streams still depend on Jamendo API access and browser playback policies. The app does **not** ship a shared Jamendo client ID. Review Jamendo's API terms and each track's license before nonpersonal or public-performance uses.

**Deduplication:** tracks are merged by normalized artist and title. One link per song is displayed. Local files take priority, then Internet Archive, Audius, and Jamendo, preserving explicitly named live, acoustic and remix versions. Each Audius/Jamendo track links to its original provider page, so artists and platforms receive attribution. Choosing a provider may change the preferred audio URL while retaining the song in the playlist.

This is a static browser application: CORS restrictions, throttling, unavailable streams and service/API changes may prevent individual sources from working in some browsers. No audio files are downloaded or rehosted by ArtistWave. Spotify, YouTube and SoundCloud are not integrated as direct audio providers in this release.

## Album-grouped playlist (v2.2)

The playlist groups available tracks by the album or collection title provided by local MP3 metadata, folder name, Audius, Jamendo or the Internet Archive. Unspecified and generic releases appear under **Singles & unknown albums**. Every album heading shows the track count and a **▶ Play album** button when at least one playable track exists. Clicking it starts the first song in that section and plays through only that album's songs in the displayed order, even when tracks are interleaved across different sources in the underlying playlist. Repeat-all loops within the current album, repeat-one repeats its current song, and manual track selection or shuffle-all exits album playback. Catalog-only entries remain visible under their album where known but do not get included in the playable queue. Duplicate filtering and source priorities remain active.

## Accounts and cloud sync (v2.3)

ArtistWave supports **optional Google account authorization and private cloud sync**, while retaining **guest mode** for listeners who prefer to keep data on their own device. The application is still a static GitHub Pages site: no ArtistWave-managed authentication server or traditional database is required. Signed-in data is stored as `artistwave-library-v1.json` in the user's private, hidden **Google Drive appDataFolder**, accessed only with their consent. **No audio files are uploaded**.

### One-time setup required by the site owner

Google authorization cannot work until a Google Cloud project and browser OAuth client have been configured:

1. Open [Google Cloud Console](https://console.cloud.google.com/), create/select a Google Cloud project, and **enable the Google Drive API**.
2. Configure the Google Auth Platform OAuth consent screen for the project. Add the scopes `openid`, `email`, `profile` and `https://www.googleapis.com/auth/drive.appdata`; add test users if the consent screen is in Testing status. Google's review/publication requirements apply if the app is made broadly available.
3. Create an OAuth **Web application** client. Under **Authorized JavaScript origins**, add `https://28121978444.github.io` (the origin, **not** the `/ArtistWave/` path). For localhost testing, add the exact localhost origin. Use no client secret in this public app.
4. Set the public OAuth **client ID** in `index.html`, in the `<meta name="google-oauth-client-id" content="">` tag's `content` attribute, and publish the site. Alternatively, for a browser-only trial enter the ID in the sidebar's **Google Drive sync setup** field. Client IDs are public identifiers, not secrets.
5. On the site, click **Sign in with Google** and grant the requested consent. The browser receives a short-lived token that is kept **in memory**, not stored in a cookie, localStorage or the repository.

The sign-in button will prompt for the OAuth client ID until setup is completed. Browser popups must be permitted. No Google account credentials or refresh tokens are stored by ArtistWave.

### Data and account isolation

- **Guest mode** continues to save favorites and provider preferences locally in that browser without sign-in.
- **First account sign-in:** If there is no existing private cloud library, a new one is created using the current guest favorites/preferences. Otherwise the existing cloud library is loaded, keeping the guest library separate. **Import guest favorites** explicitly merges guest favorites into an existing cloud account.
- **Signed in:** Favorite additions/removals and source preferences are synced after a brief delay, with **Sync now** available as a manual action. Account changes are not written into the guest favorites store. When Google Drive is temporarily unavailable, the UI shows the error and does not silently replace newer cloud data.
- **Sign out:** Returns to the original guest favorites and source preferences. If account changes are pending cloud sync, sign-out is blocked with instructions to sync first.
- **Other devices:** Sign in with the same Google account and same configured OAuth app to load the cloud library. No account-specific audio is transferred. Local folder permissions and local-only tracks must be selected again per device.
- **Stored data:** Online favorites, source toggles, and search/display preferences. A future version can extend this schema to custom playlists and showdance routines. Currently no standalone playlist-editor or routine data is saved because those features do not exist yet.
- **Privacy:** Only the Google Drive `drive.appdata` scope is requested for storage, in addition to identity scopes. This grants access to the application's hidden files, not to the user's general Drive file list. Google may require app verification before broad public release.

Google's documentation: [OAuth token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model) and [Drive appDataFolder](https://developers.google.com/workspace/drive/api/guides/appdata).

### Updated development roadmap

1. **v2.3 — Accounts and cloud sync** (implemented; Google OAuth setup required to activate)
2. **v2.4 — Album intelligence and playback reliability:** verify real album associations; improve recording fallback, failed-stream recovery and queue handling.
3. **v2.5 — Library improvements:** covers, recently played, richer metadata, and durable local-folder access where browsers allow it.
4. **v3.0 — Showdance Studio:** tempo/energy browsing, routine playlists, cue points, transitions and arrangement tools, with appropriate licensing.
5. **Later:** additional music genres, mobile usability and performance improvements.

## v2.4 — Album intelligence and playback reliability

- **Album provenance:** Album metadata supplied directly by a track, a source's album field, or a local file's album tag is distinguished from a generic Internet Archive item title. Archive items with no explicit album are displayed as **Archive collection · [item title]**, not presented as verified albums. Tracks lacking album information remain grouped as **Singles & unknown albums**.
- **Release years:** A year appears alongside an album or collection heading when the underlying source provides one. ArtistWave does not guess missing years or automatically assert a MusicBrainz album match based only on the song title.
- **One song, multiple sources:** Duplicates are still displayed as a single playlist row, but alternative playable URLs are retained internally. Local playback takes precedence over Internet Archive, then Audius, then Jamendo; file format is a secondary preference within a provider.
- **Automatic source recovery:** If a streaming URL fails to play, reports a media error, or stalls while loading, the player tries the next enabled available link for that same song. No extra playlist entries are added. If every enabled link fails, ArtistWave stops that song and displays a clear error rather than looping indefinitely.
- **Album queues:** Play album, next/previous and repeat continue to respect album-only playback. Manual song selection or shuffle-all exits album playback. Switching online providers recalculates the selected song's available alternatives without changing the user's preferred source settings.
- **Google Drive favorites:** When saved as favorites, safe HTTPS alternate playback sources can be synchronized along with the chosen track. Local paths, blob URLs, and local audio files are never uploaded to the cloud.

Playback still depends on publicly accessible sources, user/browser permissions and licensing. A source being listed does not guarantee that it can be played on every browser. A true catalog-verification/enrichment service with caching and rate limits can be considered for a future release.

## v2.5 — Library improvements

- **Album cover art:** Album groups display small cover images supplied by Audius, Jamendo, and Internet Archive where available. If a provider has no valid artwork or the image cannot be fetched, the heading shows a music-note placeholder. Artwork URLs are HTTPS only and are not uploaded to ArtistWave.
- **Recently Played:** A Recently Played navigation entry displays the most recent 30 distinct tracks. Playing a track moves it to the top of the history. Entries can be played again and grouped by album. The **Clear** button in this view clears listening history.
- **Guest and account history:** Guest listening history is retained in browser storage for playable online recordings. Signed-in users synchronize the same sanitized history through their private Google Drive application-data backup, alongside favorites and settings. Local audio blob URLs, the music files, and folder handles are **never sent to Google Drive**. A separate guest library is restored on account sign-out.
- **Jump to album:** When tracks are listed, a dropdown above the playlist lets listeners jump directly to any album or Archive collection on the page, without scrolling through every track.
- **Optional saved local-folder access:** On browsers supporting the File System Access API and IndexedDB handle storage, a selected folder handle is remembered locally. **Reopen saved folder** asks for the browser's read permission if required, then reindexes the folder; no background scanning or file upload occurs. **Forget saved folder** deletes the stored handle from ArtistWave's browser storage, but does not revoke browser-level permissions. On other browsers, choose the folder again after reloading.

The saved-folder feature is intentionally local to each device and cannot be synchronized using the cloud account. Features depend on browser support and permission settings. The app remains entirely static on GitHub Pages without an ArtistWave-managed database.

## ArtistWave v3.0 — Showdance Studio for gyms

ArtistWave now has a separate **🤸 Showdance Studio** workspace, intended for gym coaches and athletes planning **gymnastics and dance competition routines**. The original music discovery, favorites, album navigation, and player remain available.

### Planning a competition routine

1. Click **🤸 Showdance Studio** in the left sidebar, then **+ New routine**.
2. Enter the routine name, athlete or team, discipline, and **target duration in seconds**. The default is a configurable 90 seconds and **not an official event-specific rule**.
3. In the normal music library, search for songs or open a folder. Return to Studio to select tracks from the current playlist, local music library, favorites, or recently played tracks.
4. Click **+ Add track**. Each section has editable **Start (sec)** and **End (sec)** times and a choreography cue. Use cue labels such as *Entrance*, *Tumbling pass*, *Formation change*, and *Final pose*.
5. Reorder sections with **↑ / ↓** or delete them with **×**. The total planned duration is displayed against the gym's chosen target, with an alert when exceeded.
6. Use **▶ Rehearse routine** and **■ Stop** to preview sections sequentially. Playback uses the browser and currently available source URLs; it does **not** export or render an edited audio file.

### Saving, safety and source availability

- Guest routines are saved in browser localStorage.
- When using Google OAuth, routine metadata and **safe HTTPS online audio references** synchronize to the signed-in user's private Google Drive application-data file. Different user accounts retain separate routines.
- Local songs are only stored as *artist/title/source metadata*. The actual audio files, object URLs, folder permissions, and local path identifiers are **never synchronized**. Reopen the local music folder to rehearse local segments on another device.
- The workspace supports up to 75 saved routines, 30 sections per routine, and duration targets of 15–900 seconds. It assumes the coach or athlete will confirm the actual limits for the relevant discipline and competition.
- Some online streams do not support reliable seeking to arbitrary times; use local files with the right performance rights where reliable practice playback is essential.
- This version is a **rehearsal planner**, not a rendered audio editor: no crossfading, mixing, downloadable audio exports, automatic BPM analysis, or official scoring checks are claimed.
- Music permissions and performance licensing remain the gym's responsibility.

### Sidebar visibility fix

The genre navigation has been moved above the larger account/folder controls in the left sidebar. On desktop it has its own scroll area with more vertical space, while the overall sidebar can scroll to the optional account and folder settings. On narrow screens, genres remain accessible in the responsive sidebar.

## Three listening workspaces — top navigation

The top header provides three clear destinations, without combining their playback methods:

- **🎧 Entertainment:** Existing audio-only discovery, artist search, genres, favorites, albums, local folders, and streaming providers. The large decorative hero is hidden to prioritize finding and playing music. Local folder tools are collapsed in the left sidebar so the genre browser has more room.
- **🤸 Showdance:** The existing gymnastics and dance rehearsal workspace remains available for review by trainers. This navigation release does not add or change its routine-editing features.
- **▶ YouTube:** A separate video viewing workspace using a **visible official YouTube embedded player**, not an extracted audio stream. Paste an HTTPS YouTube watch, short, live, or playlist URL to play when embedding is permitted. A search form opens YouTube search results in a new tab; it does not use a YouTube search API key. Switching away removes the embedded player URL so video playback stops.

The Google account dropdown stays at the top right and remains dedicated to ArtistWave's optional Drive sync. No YouTube Premium or YouTube account access is requested; YouTube sign-in and subscription features are subject to YouTube's own embedded player behavior. Some YouTube videos cannot be embedded by their owners.

On smaller displays, workspace navigation remains accessible at the top, with the entertainment sidebar presented only within the audio workspace. The embedded player keeps a 16:9 presentation and at least a 200px minimum height to accommodate official controls.

### YouTube account continuation

ArtistWave's **Google Drive sign-in** does not itself authenticate a YouTube browser session. The official embedded YouTube player may use an existing youtube.com session through the browser's cookies, subject to privacy settings. The YouTube workspace displays a context-sensitive connection hint when a Google account is signed into ArtistWave and offers **Continue with YouTube** in a user-initiated new tab to visit YouTube and sign in if required. No automatic YouTube sign-in is claimed, no third-party cookies are set by ArtistWave, and no YouTube API scope or account credential is requested.
