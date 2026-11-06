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
