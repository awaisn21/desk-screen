# Putting it online

The public build has no accounts, no sign-in, and no audio files. It serves
the artwork and the generative ambient engine, which composes in the visitor's
own browser. Anyone can open it and press play.

Spotify is deliberately left out of this build. It needs each visitor's own
Premium account, and Spotify caps a development-mode app at five authorised
people — so a public Spotify version would break for the sixth visitor.
Your local copy keeps Spotify; only the deployed one drops it.

## Build

```
python3 build-public.py
```

Writes `dist/` — about 1.1 MB, almost all of it the five images.

## Deploy

```
cd dist
npx vercel --prod
```

First run asks you to log in and name the project; after that it is one
command. Or drag the `dist` folder onto <https://vercel.com/new> if you would
rather not touch a terminal.

Any static host works — Netlify, Cloudflare Pages, GitHub Pages, an S3
bucket. There is no server side, no build step on their end, and no
environment variables.

## After deploying

`vercel.json` sets cache headers: the images are immutable for a year, the
scripts for an hour, and the page itself always revalidates. So when you
change the artwork, rebuild and redeploy — visitors get the new images
without a hard refresh, because the filenames change with them.

If you want the same URL to keep working while you iterate, use the Vercel
project's production domain rather than a preview URL.

## What it costs

Nothing on any hosting free tier. One visit transfers roughly 400 KB — one
image plus a few kilobytes of code — and then nothing further, however long
the tab stays open. The music is generated locally, so it uses no bandwidth
at all.
