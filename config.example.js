/* ---------------------------------------------------------------------------
   Copy this file to config.js and fill it in. config.js is not tracked by
   git, so your client id stays out of the repository.

   With no config.js at all the page still runs — it falls back to the
   built-in generative music, which is what the public build uses.
--------------------------------------------------------------------------- */

window.CONFIG = {

  /* "auto" picks Spotify if a clientId is set, then the music/ folder, then
     the built-in generative music. Force one with "spotify", "files"
     or "ambient". */
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
