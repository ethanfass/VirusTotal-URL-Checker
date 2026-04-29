const form = document.querySelector("#triageForm");
const indicatorInput = document.querySelector("#indicatorInput");
const sampleBtn = document.querySelector("#sampleBtn");
const printBtn = document.querySelector("#printBtn");
const helpBtn = document.querySelector("#helpBtn");
const helpDialog = document.querySelector("#helpDialog");
const helpCloseBtn = document.querySelector("#helpCloseBtn");
const quotaText = document.querySelector("#quotaText");
const emptyState = document.querySelector("#emptyState");
const reportCard = document.querySelector("#reportCard");
const reportTitle = document.querySelector("#reportTitle");
const reportSubtitle = document.querySelector("#reportSubtitle");
const verdictStamp = document.querySelector("#verdictStamp");
const scoreNumber = document.querySelector("#scoreNumber");
const meterFill = document.querySelector("#meterFill");
const postureText = document.querySelector("#postureText");
const caseFacts = document.querySelector("#caseFacts");
const signalList = document.querySelector("#signalList");
const detectionsBody = document.querySelector("#detectionsBody");
const statsText = document.querySelector("#statsText");
const checkedAt = document.querySelector("#checkedAt");
const labelList = document.querySelector("#labelList");
const rawJson = document.querySelector("#rawJson");
const vtLink = document.querySelector("#vtLink");
const signalTemplate = document.querySelector("#signalTemplate");

refreshQuota();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runLookup();
});

sampleBtn.addEventListener("click", () => {
  renderReport(sampleReport);
  setStatus("Sample case loaded");
});

printBtn.addEventListener("click", () => window.print());
helpBtn.addEventListener("click", () => helpDialog.showModal());
helpCloseBtn.addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => {
  if (event.target === helpDialog) helpDialog.close();
});
document.addEventListener("click", handleInfoToggle);

if (new URLSearchParams(window.location.search).has("help")) {
  helpDialog.showModal();
}

async function runLookup() {
  clearNotice();
  const indicator = indicatorInput.value.trim();

  if (!indicator) {
    showNotice("Enter a URL, domain, IP address, or file hash first.");
    return;
  }

  form.querySelector("button[type='submit']").disabled = true;
  setStatus("Analyzing indicator");

  try {
    const response = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indicator })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Lookup failed.");
    }

    renderReport(payload);
    setStatus(`${payload.quota.minuteRemaining}/4 minute slots left`);
  } catch (error) {
    showNotice(friendlyLookupError(error.message, indicator));
    setStatus("Case needs attention");
  } finally {
    form.querySelector("button[type='submit']").disabled = false;
    refreshQuota();
  }
}

async function refreshQuota() {
  try {
    const response = await fetch("/api/quota");
    const quota = await response.json();
    quotaText.textContent = `${quota.minuteRemaining}/4 minute slots, ${quota.dayRemaining}/500 day slots`;
  } catch {
    quotaText.textContent = "Quota guard unavailable";
  }
}

function renderReport(payload) {
  clearNotice();
  emptyState.classList.add("hidden");
  reportCard.classList.remove("hidden");

  const score = payload.risk.score;
  const stats = payload.report.stats;
  const typeLabel = labelForType(payload.type);
  const date = new Date(payload.checkedAt);

  reportTitle.textContent = `${typeLabel} Analysis`;
  reportSubtitle.textContent = payload.normalizedIndicator;
  verdictStamp.textContent = payload.risk.verdict;
  verdictStamp.style.color = colorForScore(score);
  scoreNumber.textContent = score;
  meterFill.style.width = `${score}%`;
  postureText.textContent = payload.risk.posture;
  checkedAt.textContent = date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  statsText.textContent = `${stats.malicious} malicious, ${stats.suspicious} suspicious, ${stats.harmless} harmless`;
  vtLink.href = payload.report.permalink;

  renderFacts(payload);
  renderSignals(payload.risk.signals);
  renderDetections(payload.report.detections);
  renderLabels(payload.report.labels);
  rawJson.textContent = JSON.stringify(payload.report.raw, null, 2);
}

function renderFacts(payload) {
  caseFacts.replaceChildren();
  const baseFacts = [
    ["Case type", labelForType(payload.type)],
    ["Report ID", payload.reportId],
    ["VT reputation", payload.report.reputation]
  ];
  const facts = [...baseFacts, ...(payload.report.meta || []).slice(1, 6).map((item) => [item.label, item.value])];

  for (const [label, value] of facts) {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.append(label);
    const explanation = factExplanation(label);
    if (explanation) dt.append(createInfoControl(explanation, `Explain ${label}`));
    dd.textContent = value || "Not listed";
    wrapper.append(dt, dd);
    caseFacts.append(wrapper);
  }
}

function handleInfoToggle(event) {
  const button = event.target.closest(".info-btn");
  if (!button) return;

  const wrapper = button.closest(".info-wrap");
  const popover = wrapper?.querySelector(".info-popover");
  if (!popover) return;

  const isOpen = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!isOpen));
  button.classList.toggle("active", !isOpen);
  popover.hidden = isOpen;
  popover.textContent = button.dataset.info || "";
}

function createInfoControl(message, label) {
  const wrapper = document.createElement("span");
  const button = document.createElement("button");
  const popover = document.createElement("span");

  wrapper.className = "info-wrap";
  button.className = "info-btn info-btn-small";
  button.type = "button";
  button.dataset.info = message;
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", label);
  button.textContent = "i";
  popover.className = "info-popover";
  popover.hidden = true;

  wrapper.append(button, popover);
  return wrapper;
}

function factExplanation(label) {
  const explanations = {
    "Case type": "The kind of item the app recognized: full URL, website/domain, IP address, or file hash.",
    "Report ID": "VirusTotal's internal identifier for this exact item. URLs often become encoded IDs, so they may look unusual.",
    "VT reputation": "VirusTotal community reputation. Negative numbers mean more negative community signals; positive numbers mean more positive signals.",
    "Last analysis": "When VirusTotal last scanned or refreshed this item.",
    "Final URL": "The final page VirusTotal reached after redirects.",
    "Title": "The page title VirusTotal saw during analysis. Error titles can appear if the site blocked VirusTotal's scanner.",
    "HTTP response": "The web server response code. 200 usually means loaded, 403 means blocked/forbidden, 404 means not found.",
    "Registrar": "The company where a domain name is registered.",
    "Creation date": "When the domain was first created, if VirusTotal has that data.",
    "Last DNS records": "How many recent DNS records VirusTotal has for this domain.",
    "Country": "The country VirusTotal associates with the IP address.",
    "Network": "The IP network range this address belongs to.",
    "ASN": "The autonomous system number, usually identifying the network operator.",
    "Owner": "The organization VirusTotal associates with the IP address.",
    "Meaningful name": "A filename VirusTotal has seen for this hash.",
    "File type": "The file format or type VirusTotal identified.",
    "Size": "The file size.",
    "Magic": "Low-level file type details from file inspection."
  };

  return explanations[label] || null;
}

function renderSignals(signals) {
  signalList.replaceChildren();

  if (!signals.length) {
    const empty = document.createElement("div");
    empty.className = "signal-card";
    const text = document.createElement("div");
    const title = document.createElement("strong");
    const body = document.createElement("p");
    const score = document.createElement("span");
    title.textContent = "No standout warning signs";
    const titleLine = document.createElement("div");
    titleLine.className = "signal-title-line";
    titleLine.append(title, createInfoControl("This means the lookup did not produce a specific scoring reason beyond the normal report data.", "Explain no standout warning signs"));
    body.textContent = "VirusTotal and local heuristics did not surface a strong suspicious pattern.";
    score.textContent = "0";
    score.className = "negative";
    text.append(titleLine, body);
    empty.append(text, score);
    signalList.append(empty);
    return;
  }

  for (const signal of signals) {
    const fragment = signalTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".signal-card");
    const title = fragment.querySelector("strong");
    const body = fragment.querySelector("p");
    const score = fragment.querySelector("span");
    title.textContent = signal.label;
    const titleLine = document.createElement("div");
    titleLine.className = "signal-title-line";
    title.replaceWith(titleLine);
    titleLine.append(title, createInfoControl(signalExplanation(signal), `Explain ${signal.label}`));
    body.textContent = signal.detail;
    score.textContent = formatImpact(signal.impact);
    if (signal.impact < 0) score.classList.add("negative");
    if (signal.impact >= 18) card.style.borderColor = "rgba(139, 45, 43, 0.85)";
    signalList.append(fragment);
  }
}

function signalExplanation(signal) {
  const explanations = {
    "Vendor malicious detections": "One or more VirusTotal security vendors marked this item malicious. This is one of the strongest reasons the score goes up.",
    "Vendor suspicious detections": "One or more VirusTotal security vendors did not call it fully malicious, but still marked it suspicious.",
    "Detection density": "This compares flagged engines against total engines. A higher percentage means the warning is broader, not just one isolated vendor.",
    "Community reputation": "VirusTotal users and partners can affect reputation. Negative reputation adds concern; positive reputation can reduce it.",
    "Community votes": "Public votes on VirusTotal. More malicious votes than harmless votes raise the score, but they are not a final verdict.",
    "Plain HTTP": "The link uses http instead of https, so traffic is not protected by normal browser encryption.",
    "IP host": "The link points directly to a number-based IP address instead of a normal domain name, which can be harder for people to recognize.",
    "Long URL": "Very long links can hide redirects, tracking data, or misleading destination details.",
    "Embedded credentials marker": "The link contains an @ sign or credential-looking field, which can make browsers show a misleading destination.",
    "Heavy query string": "The link has a large amount of data after the question mark. That can be normal, but it can also hide redirects or tracking.",
    "Punycode domain": "The domain uses encoded international characters. Attackers sometimes use this to make domains resemble familiar brands.",
    "Deep subdomain chain": "The host has many nested name parts. That can make the true website owner harder to spot.",
    "Hyphenated host": "Hyphen-heavy domains are common in lookalike links, though this signal is weak by itself.",
    "Credential-risk wording": "The link or domain contains words often seen around account access, payments, or urgent verification."
  };

  if (signal.impact < 0) {
    return "This signal lowers the risk score because it is evidence in the item's favor.";
  }

  return explanations[signal.label] || "This is one reason the local scoring model changed the URL risk score.";
}

function renderDetections(detections) {
  detectionsBody.replaceChildren();

  if (!detections.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No malicious or suspicious engine rows returned.";
    row.append(cell);
    detectionsBody.append(row);
    return;
  }

  for (const detection of detections) {
    const row = document.createElement("tr");
    for (const value of [detection.engine, detection.category, detection.result]) {
      const cell = document.createElement("td");
      cell.textContent = value || "flagged";
      row.append(cell);
    }
    detectionsBody.append(row);
  }
}

function renderLabels(labels) {
  labelList.replaceChildren();
  const safeLabels = labels && labels.length ? labels : ["no-labels-returned"];
  for (const label of safeLabels) {
    const chip = document.createElement("span");
    chip.textContent = label;
    labelList.append(chip);
  }
}

function showNotice(message) {
  clearNotice();
  const notice = document.createElement("div");
  notice.className = "notice";
  notice.textContent = message;
  form.append(notice);
}

function friendlyLookupError(message, indicator) {
  if (/URL\s+".+"\s+not found/i.test(message)) {
    const domain = domainFromIndicator(indicator);
    if (domain) {
      return `VirusTotal has no report for that exact page yet. Try checking just the website name instead: ${domain}`;
    }
    return "VirusTotal has no report for that exact page yet. Try checking the main website name instead.";
  }

  return message;
}

function domainFromIndicator(indicator) {
  const value = indicator.trim();
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname || null;
  } catch {
    return null;
  }
}

function clearNotice() {
  const notice = form.querySelector(".notice");
  if (notice) notice.remove();
}

function setStatus(message) {
  quotaText.textContent = message;
}

function labelForType(type) {
  return {
    url: "URL",
    ip_address: "IP address",
    domain: "Domain",
    file: "File hash"
  }[type] || "Indicator";
}

function colorForScore(score) {
  if (score >= 75) return "#7b343a";
  if (score >= 50) return "#6b5424";
  if (score >= 25) return "#474350";
  return "#224D31";
}

function formatImpact(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

const sampleReport = {
  checkedAt: new Date().toISOString(),
  indicator: "http://login-secure-update.example.com/account/verify?session=desk-demo&redirect=mail",
  type: "url",
  normalizedIndicator: "http://login-secure-update.example.com/account/verify?session=desk-demo&redirect=mail",
  reportId: "aHR0cDovL2xvZ2luLXNlY3VyZS11cGRhdGUuZXhhbXBsZS5jb20vYWNjb3VudC92ZXJpZnk_c2Vzc2lvbj1kZXNrLWRlbW8mcmVkaXJlY3Q9bWFpbA",
  quota: { minuteRemaining: 3, dayRemaining: 499 },
  risk: {
    score: 68,
    verdict: "Elevated risk",
    posture: "Treat as risky until a human confirms context.",
    signals: [
      { label: "Vendor malicious detections", impact: 36, detail: "3 engines reported malicious activity." },
      { label: "Credential-risk wording", impact: 14, detail: "Contains account or login pressure words: login, secure, update, account." },
      { label: "Plain HTTP", impact: 9, detail: "The URL does not use HTTPS." },
      { label: "Hyphenated host", impact: 4, detail: "Hyphen-heavy names are common in lookalike domains." }
    ]
  },
  report: {
    id: "desk-demo",
    permalink: "https://www.virustotal.com/gui/home/url",
    stats: { malicious: 3, suspicious: 1, harmless: 64, undetected: 22, timeout: 0 },
    reputation: -4,
    votes: { harmless: 1, malicious: 3 },
    labels: ["phishing", "login", "recently-seen", "http"],
    meta: [
      { label: "Type", value: "URL" },
      { label: "VT reputation", value: "-4" },
      { label: "Last analysis", value: "Apr 22, 2026, 10:24 AM" },
      { label: "Final URL", value: "http://login-secure-update.example.com/account/verify" },
      { label: "HTTP response", value: "302" }
    ],
    detections: [
      { engine: "AlphaSOC", category: "malicious", result: "phishing" },
      { engine: "DeskAV", category: "malicious", result: "credential phishing" },
      { engine: "Netcraft", category: "suspicious", result: "suspicious" },
      { engine: "SecureBrain", category: "malicious", result: "malicious" }
    ],
    raw: {
      data: {
        type: "url",
        id: "desk-demo",
        attributes: {
          last_analysis_stats: { malicious: 3, suspicious: 1, harmless: 64, undetected: 22, timeout: 0 },
          reputation: -4,
          note: "Sample data for portfolio screenshots."
        }
      }
    }
  }
};

if (new URLSearchParams(window.location.search).has("sample")) {
  renderReport(sampleReport);
  setStatus("Sample case loaded");
}
