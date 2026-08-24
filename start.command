#!/bin/bash
# Double-click to run Second Screen.
# Serves the folder on 127.0.0.1 — Spotify sign-in requires that, and local
# audio files work the same way.

cd "$(dirname "$0")" || exit 1
PORT=8080   # must match "port" in config.js and your Spotify Redirect URI

echo "Second Screen"
echo "-------------"
python3 sync.py || { echo; echo "sync failed — is python3 installed?"; read -r -p "press return to close"; exit 1; }
echo

if curl -s -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
  echo "Already serving on port $PORT — opening it."
  open "http://127.0.0.1:$PORT/"
  exit 0
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT INT TERM

sleep 1
open "http://127.0.0.1:$PORT/"

echo "Serving on http://127.0.0.1:$PORT"
echo "Press F for fullscreen, then drag the window to your second screen."
echo
echo "Leave this window open. Close it to stop the server."
wait $SERVER
