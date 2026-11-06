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
