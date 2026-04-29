# Office URL Analyzer

Old office/noir styled URL analyzer built on the VirusTotal v3 API. It checks one item at a time and turns the raw scan/reputation data into a readable report.

## Accepted inputs

- Full link: `https://site.com/page`
- Website/domain: `site.com`
- IP address: `8.8.8.8`
- Downloaded file hash: MD5, SHA-1, or SHA-256 text

If a full page is not found, try the main website instead. Example: use `sporcle.com` instead of `sporcle.com/games/pokemon/151`.

## Local setup

Create `.env`:

```text
VT_API_KEY=your_virustotal_api_key
```

Install and run:

```powershell
npm install
npm start
```

Open:

```text
http://localhost:5173
```

## Netlify

Add this environment variable in Netlify:

```text
VT_API_KEY=your_virustotal_api_key
```

Build settings:

```text
Build command: leave blank
Publish directory: public
Functions directory: netlify/functions
```

If this project folder is not the root of the GitHub repo, set Netlify's base directory to the folder that contains this README.

## Notes

- `.env` is for local use only. Do not commit it.
- The browser never gets the VirusTotal key; requests go through the Node server or Netlify function.
- The score is a review aid, not a guarantee that a site is safe or unsafe.
- VirusTotal public API limits are strict, so the app includes a small in-memory quota guard.
