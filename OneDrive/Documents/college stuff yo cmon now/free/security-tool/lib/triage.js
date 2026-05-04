import net from "node:net";

const VT_BASE_URL = "https://www.virustotal.com/api/v3";

const quotaState = {
  dayKey: currentUtcDay(),
  dayCount: 0,
  minuteHits: []
};

async function triageIndicator(body) {
  const indicator = String(body?.indicator || "").trim();
  const apiKey = String(process.env.VT_API_KEY || "").trim();

  if (!indicator) {
    throw httpError(400, "Enter a URL, IP address, domain, or file hash.");
  }

  if (!apiKey) {
    throw httpError(503, "VirusTotal API key is not configured on the backend. Set VT_API_KEY in .env locally or in Netlify environment variables.");
  }

  const classification = classifyIndicator(indicator);
  enforceLocalQuota();

  const vtResponse = await fetchVirusTotal(classification.path, apiKey, classification);

  let resolutionCount = null;
  if (classification.type === "ip_address") {
    resolutionCount = await fetchResolutionCount(classification.normalized, apiKey);
  }

  const normalized = normalizeVirusTotalReport(vtResponse, classification, resolutionCount);
  const risk = scoreIndicator(normalized, classification);

  return {
    checkedAt: new Date().toISOString(),
    indicator,
    type: classification.type,
    normalizedIndicator: classification.normalized,
    reportId: classification.id,
    risk,
    report: normalized,
    quota: getQuotaSnapshot()
  };
}

function getQuotaSnapshot() {
  resetQuotaIfNeeded();
  return {
    minuteRemaining: Math.max(0, 4 - quotaState.minuteHits.length),
    dayRemaining: Math.max(0, 500 - quotaState.dayCount),
    dayUsed: quotaState.dayCount
  };
}

function classifyIndicator(value) {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(trimmed)) {
    return {
      type: "file",
      normalized: lower,
      id: lower,
      path: `/files/${encodeURIComponent(lower)}`
    };
  }

  if (net.isIP(trimmed)) {
    return {
      type: "ip_address",
      normalized: trimmed,
      id: trimmed,
      path: `/ip_addresses/${encodeURIComponent(trimmed)}`
    };
  }

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && isLikelyDomain(trimmed)) {
    const hostname = trimmed.replace(/\.$/, "").toLowerCase();
    return {
      type: "domain",
      normalized: hostname,
      id: hostname,
      path: `/domains/${encodeURIComponent(hostname)}`
    };
  }

  const url = parseHttpUrl(trimmed);
  if (url) {
    const normalized = url.toString();
    const id = Buffer.from(normalized).toString("base64url");
    return {
      type: "url",
      normalized,
      id,
      path: `/urls/${id}`
    };
  }

  throw httpError(400, "That indicator does not look like a URL, IP address, domain, or MD5/SHA1/SHA256 hash.");
}

function parseHttpUrl(value) {
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (!url.hostname.includes(".") && !net.isIP(url.hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isLikelyDomain(value) {
  if (value.includes("/") || value.includes(" ") || value.length > 253) {
    return false;
  }
  const labels = value.replace(/\.$/, "").split(".");
  return labels.length >= 2 && labels.every((label) => /^[a-z0-9-]{1,63}$/i.test(label) && !label.startsWith("-") && !label.endsWith("-"));
}

async function fetchVirusTotal(apiPath, apiKey, classification) {
  const response = await fetch(`${VT_BASE_URL}${apiPath}`, {
    headers: {
      accept: "application/json",
      "x-apikey": apiKey
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || payload?.error?.code || `VirusTotal returned HTTP ${response.status}.`;
    if (response.status === 404) {
      throw httpError(response.status, notFoundMessage(classification), payload?.error || null);
    }
    throw httpError(response.status, message, payload?.error || null);
  }

  return payload;
}

async function fetchResolutionCount(ip, apiKey) {
  try {
    const response = await fetch(
      `${VT_BASE_URL}/ip_addresses/${encodeURIComponent(ip)}/resolutions?limit=1`,
      { headers: { accept: "application/json", "x-apikey": apiKey } }
    );
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    return typeof data?.meta?.count === "number" ? data.meta.count : null;
  } catch {
    return null;
  }
}

function notFoundMessage(classification) {
  if (classification.type === "url") {
    const hostname = new URL(classification.normalized).hostname;
    return `VirusTotal has no report for that exact page yet. Try checking just the website name instead: ${hostname}`;
  }

  if (classification.type === "domain") {
    return `VirusTotal does not have a report for the domain "${classification.normalized}" yet.`;
  }

  if (classification.type === "ip_address") {
    return `VirusTotal does not have a report for the IP address "${classification.normalized}" yet.`;
  }

  return "VirusTotal does not have a report for that file hash yet.";
}

function normalizeVirusTotalReport(payload, classification, resolutionCount = null) {
  const data = payload?.data || {};
  const attributes = data.attributes || {};
  const stats = attributes.last_analysis_stats || {};
  const votes = attributes.total_votes || {};

  const allDetections = Object.entries(attributes.last_analysis_results || {})
    .filter(([, result]) => ["malicious", "suspicious"].includes(result?.category))
    .map(([engine, result]) => ({
      engine: result.engine_name || engine,
      category: result.category || "unknown",
      result: result.result || "flagged",
      method: result.method || "scanner"
    }));

  const totalDetectionCount = allDetections.length;

  // Domain age in days — only available in domain reports, not URL reports
  const domainAgeDays = (classification.type === "domain" && attributes.creation_date)
    ? Math.floor((Date.now() / 1000 - Number(attributes.creation_date)) / 86400)
    : null;

  // Redirect chain (URLs only)
  const redirectChain = (classification.type === "url" && Array.isArray(attributes.redirection_chain) && attributes.redirection_chain.length > 1)
    ? attributes.redirection_chain
    : null;

  // First seen / submission count
  const firstSeenAt = attributes.first_submission_date ? Number(attributes.first_submission_date) : null;
  const timesSubmitted = attributes.times_submitted != null ? Number(attributes.times_submitted) : null;

  // TLS certificate details
  const certificate = attributes.last_https_certificate
    ? parseCertificate(attributes.last_https_certificate)
    : null;

  // Crowdsourced vendor categories
  const rawCategories = attributes.categories;
  const categories = (rawCategories && typeof rawCategories === "object" && Object.keys(rawCategories).length > 0)
    ? rawCategories
    : null;

  // DNS records (domain reports only)
  const dnsRecords = (classification.type === "domain" && Array.isArray(attributes.last_dns_records) && attributes.last_dns_records.length > 0)
    ? attributes.last_dns_records
        .map(r => ({ type: r.type || "?", value: r.value || "", ttl: typeof r.ttl === "number" ? r.ttl : null, priority: r.priority ?? null }))
        .slice(0, 40)
    : null;

  return {
    id: data.id || classification.id,
    permalink: `https://www.virustotal.com/gui/${vtGuiSegment(classification.type)}/${encodeURIComponent(data.id || classification.id)}`,
    stats: {
      malicious: Number(stats.malicious || 0),
      suspicious: Number(stats.suspicious || 0),
      harmless: Number(stats.harmless || 0),
      undetected: Number(stats.undetected || 0),
      timeout: Number(stats.timeout || 0)
    },
    reputation: Number(attributes.reputation || 0),
    votes: {
      harmless: Number(votes.harmless || 0),
      malicious: Number(votes.malicious || 0)
    },
    detections: allDetections.slice(0, 12),
    totalDetectionCount,
    labels: [...new Set([...(attributes.tags || []), ...Object.values(attributes.categories || {})])].slice(0, 12),
    meta: buildMeta(attributes, classification, resolutionCount, firstSeenAt, timesSubmitted, certificate),
    raw: payload,
    // Enrichment fields used for display and scoring
    domainAgeDays,
    redirectChain,
    firstSeenAt,
    timesSubmitted,
    certificate,
    categories,
    resolutionCount,
    dnsRecords
  };
}

function parseCertificate(cert) {
  const issuer = cert.issuer || {};
  const subject = cert.subject || {};
  const validity = cert.validity || {};
  const validFromRaw = parseCertDate(validity.not_before);
  const validToRaw = parseCertDate(validity.not_after);

  return {
    issuerOrg: issuer.O || null,
    issuerCN: issuer.CN || null,
    subjectCN: subject.CN || null,
    validFrom: validFromRaw ? formatUnixDate(validFromRaw) : (validity.not_before ? String(validity.not_before) : null),
    validTo: validToRaw ? formatUnixDate(validToRaw) : (validity.not_after ? String(validity.not_after) : null),
    validFromRaw,
    validToRaw,
    serialNumber: cert.serial_number || null,
    thumbprint: cert.thumbprint ? cert.thumbprint.slice(0, 24) : null
  };
}

function parseCertDate(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  // Handle "YYYY-MM-DD HH:MM:SS" format VT uses
  const d = new Date(String(value).replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
}

function vtGuiSegment(type) {
  if (type === "ip_address") return "ip-address";
  if (type === "file") return "file";
  if (type === "domain") return "domain";
  return "url";
}

function buildMeta(attributes, classification, resolutionCount, firstSeenAt, timesSubmitted, certificate) {
  const meta = [];
  addMeta(meta, "Type", titleCase(classification.type.replace("_", " ")));
  addMeta(meta, "VT reputation", attributes.reputation);
  addMeta(meta, "Last analysis", formatUnixDate(attributes.last_analysis_date));
  addMeta(meta, "First seen", firstSeenAt ? formatUnixDate(firstSeenAt) : null);
  addMeta(meta, "Submission count", timesSubmitted);

  if (classification.type === "file") {
    addMeta(meta, "Meaningful name", attributes.meaningful_name);
    addMeta(meta, "File type", attributes.type_description || attributes.type_tag);
    addMeta(meta, "Size", formatBytes(attributes.size));
    addMeta(meta, "Magic", attributes.magic);
  }

  if (classification.type === "url") {
    addMeta(meta, "Final URL", attributes.last_final_url || attributes.url);
    addMeta(meta, "Title", attributes.title);
    addMeta(meta, "HTTP response", attributes.last_http_response_code);
    if (Array.isArray(attributes.redirection_chain) && attributes.redirection_chain.length > 1) {
      addMeta(meta, "Redirect hops", attributes.redirection_chain.length);
    }
    if (certificate?.issuerOrg) {
      addMeta(meta, "Cert issuer", certificate.issuerOrg);
    }
  }

  if (classification.type === "domain") {
    addMeta(meta, "Registrar", attributes.registrar);
    addMeta(meta, "Creation date", formatUnixDate(attributes.creation_date));
    if (attributes.creation_date) {
      const ageDays = Math.floor((Date.now() / 1000 - Number(attributes.creation_date)) / 86400);
      addMeta(meta, "Domain age", formatDomainAge(ageDays));
    }
    addMeta(meta, "Last DNS records", Array.isArray(attributes.last_dns_records) ? `${attributes.last_dns_records.length} records` : null);
    if (certificate?.issuerOrg) {
      addMeta(meta, "Cert issuer", certificate.issuerOrg);
    }
  }

  if (classification.type === "ip_address") {
    addMeta(meta, "Country", attributes.country);
    addMeta(meta, "Network", attributes.network);
    addMeta(meta, "ASN", attributes.asn ? `AS${attributes.asn}` : null);
    addMeta(meta, "Owner", attributes.as_owner);
    if (resolutionCount !== null) {
      addMeta(meta, "Hosted domains", resolutionCount.toLocaleString());
    }
  }

  return meta;
}

function addMeta(meta, label, value) {
  if (value === undefined || value === null || value === "") return;
  meta.push({ label, value: String(value) });
}

function scoreIndicator(report, classification) {
  const stats = report.stats;
  const total = stats.malicious + stats.suspicious + stats.harmless + stats.undetected;
  const signals = [];
  let score = 0;

  if (stats.malicious > 0) {
    const points = Math.min(65, stats.malicious * 12);
    score += points;
    signals.push({
      label: "Vendor malicious detections",
      impact: points,
      detail: `${stats.malicious} engines reported malicious activity.`
    });
  }

  if (stats.suspicious > 0) {
    const points = Math.min(24, stats.suspicious * 7);
    score += points;
    signals.push({
      label: "Vendor suspicious detections",
      impact: points,
      detail: `${stats.suspicious} engines marked the indicator suspicious.`
    });
  }

  if (total > 0) {
    const detectionRatio = (stats.malicious + stats.suspicious) / total;
    if (detectionRatio >= 0.1) {
      const points = Math.round(Math.min(18, detectionRatio * 55));
      score += points;
      signals.push({
        label: "Detection density",
        impact: points,
        detail: `${Math.round(detectionRatio * 100)}% of available engines flagged it.`
      });
    }
  }

  if (report.reputation < 0) {
    const points = Math.min(15, Math.abs(report.reputation));
    score += points;
    signals.push({
      label: "Community reputation",
      impact: points,
      detail: `VirusTotal reputation is ${report.reputation}.`
    });
  }

  if (report.votes.malicious > report.votes.harmless) {
    const points = Math.min(10, report.votes.malicious * 3);
    score += points;
    signals.push({
      label: "Community votes",
      impact: points,
      detail: `${report.votes.malicious} malicious vote(s), ${report.votes.harmless} harmless vote(s).`
    });
  }

  // Domain age (domain type only — URL reports don't include domain registration date)
  if (report.domainAgeDays !== null && report.domainAgeDays < 365) {
    let points, detail;
    if (report.domainAgeDays < 7) {
      points = 35;
      detail = `Domain is only ${report.domainAgeDays} day${report.domainAgeDays === 1 ? "" : "s"} old — brand new.`;
    } else if (report.domainAgeDays < 30) {
      points = 25;
      detail = `Domain is ${report.domainAgeDays} days old — registered very recently.`;
    } else if (report.domainAgeDays < 90) {
      points = 15;
      detail = `Domain is ${report.domainAgeDays} days old — created in the last 3 months.`;
    } else {
      points = 5;
      detail = `Domain is under one year old (${report.domainAgeDays} days).`;
    }
    score += points;
    signals.push({ label: "Young domain", impact: points, detail });
  }

  // Redirect chain depth
  if (report.redirectChain && report.redirectChain.length > 1) {
    const hops = report.redirectChain.length;
    const points = hops > 5 ? 15 : 8;
    score += points;
    signals.push({
      label: "Multi-hop redirect chain",
      impact: points,
      detail: `URL passes through ${hops} redirect${hops === 1 ? "" : "s"} before reaching the final destination.`
    });
  }

  // TLS certificate age
  if (report.certificate?.validFromRaw) {
    const certAgeDays = Math.floor((Date.now() / 1000 - report.certificate.validFromRaw) / 86400);
    if (certAgeDays >= 0 && certAgeDays < 14) {
      const points = 12;
      score += points;
      signals.push({
        label: "Brand-new TLS certificate",
        impact: points,
        detail: `Certificate was issued ${certAgeDays === 0 ? "today" : `${certAgeDays} day${certAgeDays === 1 ? "" : "s"} ago`}. Phishing pages often use freshly issued free certificates.`
      });
    } else if (certAgeDays >= 14 && certAgeDays < 30) {
      const points = 5;
      score += points;
      signals.push({
        label: "New TLS certificate",
        impact: points,
        detail: `Certificate was issued ${certAgeDays} days ago — recent certs on suspicious domains warrant a closer look.`
      });
    }
  }

  // First seen within 48 hours
  if (report.firstSeenAt) {
    const hoursSinceSeen = (Date.now() / 1000 - report.firstSeenAt) / 3600;
    if (hoursSinceSeen < 48) {
      const points = 10;
      score += points;
      signals.push({
        label: "First seen recently",
        impact: points,
        detail: `First submitted to VirusTotal ${Math.round(hoursSinceSeen)} hour${Math.round(hoursSinceSeen) === 1 ? "" : "s"} ago — this is a fresh, unaged entry.`
      });
    }
  }

  // Hosted domain count on IP (bulletproof hosting indicator)
  if (report.resolutionCount !== null && classification.type === "ip_address") {
    if (report.resolutionCount > 500) {
      const points = 15;
      score += points;
      signals.push({
        label: "Very high hosted domain count",
        impact: points,
        detail: `${report.resolutionCount.toLocaleString()} domains have pointed to this IP — typical of bulletproof hosting infrastructure.`
      });
    } else if (report.resolutionCount > 100) {
      const points = 8;
      score += points;
      signals.push({
        label: "High hosted domain count",
        impact: points,
        detail: `${report.resolutionCount.toLocaleString()} domains have resolved to this IP — unusually high for a normal server.`
      });
    }
  }

  const lexicalSignals = scoreLexicalFeatures(classification);
  for (const signal of lexicalSignals) {
    score += signal.impact;
    signals.push(signal);
  }

  if (stats.malicious === 0 && stats.suspicious === 0 && stats.harmless > 0) {
    const impact = -Math.min(18, Math.round(stats.harmless / 3));
    score += impact;
    signals.push({
      label: "Harmless coverage",
      impact,
      detail: `${stats.harmless} engines reported no issue.`
    });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: finalScore,
    verdict: verdictForScore(finalScore),
    posture: postureForScore(finalScore),
    signals: signals.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 10)
  };
}

function scoreLexicalFeatures(classification) {
  const signals = [];
  const suspiciousWords = ["login", "verify", "secure", "account", "update", "wallet", "bank", "invoice", "password", "mfa", "signin", "pay"];
  const value = classification.normalized.toLowerCase();

  if (classification.type === "url") {
    const url = new URL(classification.normalized);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== "https:") {
      signals.push({ label: "Plain HTTP", impact: 9, detail: "The URL does not use HTTPS." });
    }
    if (net.isIP(hostname)) {
      signals.push({ label: "IP host", impact: 14, detail: "The URL uses an IP address instead of a domain name." });
    }
    if (classification.normalized.length > 120) {
      signals.push({ label: "Long URL", impact: 12, detail: "The URL is unusually long." });
    } else if (classification.normalized.length > 75) {
      signals.push({ label: "Long URL", impact: 7, detail: "The URL is longer than typical login or landing links." });
    }
    if (url.username || url.password || classification.normalized.includes("@")) {
      signals.push({ label: "Embedded credentials marker", impact: 13, detail: "The URL contains an @ marker or credential field." });
    }
    if (url.search.length > 80) {
      signals.push({ label: "Heavy query string", impact: 6, detail: "The query string carries a lot of tracking or redirect data." });
    }
    addDomainShapeSignals(signals, hostname);
  }

  if (classification.type === "domain") {
    addDomainShapeSignals(signals, classification.normalized);
  }

  const matchedWords = suspiciousWords.filter((word) => value.includes(word)).slice(0, 4);
  if (matchedWords.length > 0 && ["url", "domain"].includes(classification.type)) {
    signals.push({
      label: "Credential-risk wording",
      impact: Math.min(14, matchedWords.length * 5),
      detail: `Contains account or login pressure words: ${matchedWords.join(", ")}.`
    });
  }

  return signals;
}

function addDomainShapeSignals(signals, hostname) {
  const labels = hostname.split(".");
  if (hostname.includes("xn--")) {
    signals.push({ label: "Punycode domain", impact: 13, detail: "The hostname uses encoded international characters." });
  }
  if (labels.length >= 5) {
    signals.push({ label: "Deep subdomain chain", impact: 8, detail: "The hostname has many nested labels." });
  }
  if (hostname.includes("-")) {
    signals.push({ label: "Hyphenated host", impact: 4, detail: "Hyphen-heavy names are common in lookalike domains." });
  }
}

function enforceLocalQuota() {
  resetQuotaIfNeeded();
  const now = Date.now();
  quotaState.minuteHits = quotaState.minuteHits.filter((timestamp) => now - timestamp < 60_000);

  if (quotaState.minuteHits.length >= 4) {
    throw httpError(429, "Local VirusTotal public API guard: wait a minute before the next lookup.");
  }

  if (quotaState.dayCount >= 500) {
    throw httpError(429, "Local VirusTotal public API guard: daily lookup budget reached.");
  }

  quotaState.minuteHits.push(now);
  quotaState.dayCount += 1;
}

function resetQuotaIfNeeded() {
  const dayKey = currentUtcDay();
  if (quotaState.dayKey !== dayKey) {
    quotaState.dayKey = dayKey;
    quotaState.dayCount = 0;
    quotaState.minuteHits = [];
  }
}

function currentUtcDay() {
  return new Date().toISOString().slice(0, 10);
}

function httpError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function formatUnixDate(value) {
  if (!value) return null;
  return new Date(Number(value) * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function formatDomainAge(days) {
  if (days < 1) return "Less than 1 day";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} old`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `~${months} month${months === 1 ? "" : "s"} old`;
  }
  const years = Math.floor(days / 365);
  const remMonths = Math.floor((days % 365) / 30);
  return remMonths > 0 ? `${years} yr ${remMonths} mo old` : `${years} year${years === 1 ? "" : "s"} old`;
}

function formatBytes(value) {
  if (!Number.isFinite(Number(value))) return null;
  const units = ["B", "KB", "MB", "GB"];
  let size = Number(value);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function verdictForScore(score) {
  if (score >= 75) return "High risk";
  if (score >= 50) return "Elevated risk";
  if (score >= 25) return "Needs review";
  return "Low visible risk";
}

function postureForScore(score) {
  if (score >= 75) return "Quarantine first, investigate before opening.";
  if (score >= 50) return "Treat as risky until a human confirms context.";
  if (score >= 25) return "Review the breakdown before trusting it.";
  return "No strong warning signs in this report.";
}

export { classifyIndicator, getQuotaSnapshot, httpError, scoreIndicator, triageIndicator };
