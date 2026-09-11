/* ---------------------------------------------------------------------------
   Copy this file to config.js and fill it in. config.js is not tracked by
   git, so your credentials stay out of the repository.

   With no config.js at all the page still runs — it falls back to the
   built-in generative ambient music, which is what the public build uses.
--------------------------------------------------------------------------- */

window.CONFIG = {

  /* "auto" picks in this order:
       1. Spotify (if clientId is set)
       2. music/ folder (if you have local files there)
       3. YouTube — a curated Pakistani nostalgia playlist that streams
          from youtube-nocookie.com; no API key required.
       4. Generative ambient (always available, needs no files or accounts)

     Force one with "spotify", "files", "youtube", or "ambient". */
  mode: "auto",

  /* From https://developer.spotify.com/dashboard — see SPOTIFY-SETUP.md.
     Leave empty to skip Spotify entirely. */
  clientId: "",

  /* Any Spotify playlist link. Empty resumes whatever you last played. */
  playlist: "",

  /* Must match the port in start.command and your registered Redirect URI. */
  port: 8080,

  /* Playback volume, 0 to 1. */
  volume: 0.6,
};
