# Office URL Analyzer

An old-school office themed URL analyzer for checking links, website names, IP addresses, and file hashes against VirusTotal v3.

## Run it

Create a local `.env` file:

```text
VT_API_KEY=your_virustotal_api_key
```

Then start the server:

```powershell
npm start
```

Then open http://localhost:5173.

## Deploy to Netlify

This project is Netlify-ready. Netlify serves `public/` as the site and routes `/api/triage` plus `/api/quota` to a serverless function.

In Netlify, add this environment variable:

```text
VT_API_KEY=your_virustotal_api_key
```

Netlify settings:

```text
Publish directory: public
Functions directory: netlify/functions
Build command: leave blank
```

## What it does

- Detects whether the input is a URL, IP address, domain, or MD5/SHA1/SHA256 file hash.
- Calls VirusTotal API v3 report endpoints from the local server or Netlify Functions.
- Applies a local guard for the public API quota: 4 requests per minute and 500 requests per UTC day.
- Builds a general risk score from VirusTotal detections, reputation, votes, and URL/domain red flags.
- Renders a printable report page designed for portfolio screenshots.

## Notes

VirusTotal public API limits are strict, so this is shaped for personal and student use. The built-in quota guard is in memory, which is fine for local use and helpful for warm Netlify Functions, but not a durable production rate limiter. For production use, add persistent quota tracking, authentication, audit logging, and a backend secret manager.
