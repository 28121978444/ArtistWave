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
