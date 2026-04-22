const form = document.querySelector("#triageForm");
const indicatorInput = document.querySelector("#indicatorInput");
const sampleBtn = document.querySelector("#sampleBtn");
const printBtn = document.querySelector("#printBtn");
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

async function runLookup() {
  clearNotice();
  const indicator = indicatorInput.value.trim();

  if (!indicator) {
    showNotice("The case folder needs an indicator.");
    return;
  }

  form.querySelector("button[type='submit']").disabled = true;
  setStatus("Checking VirusTotal");

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
    showNotice(error.message);
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

  reportTitle.textContent = `${typeLabel} Triage`;
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
    dt.textContent = label;
    dd.textContent = value || "Not listed";
    wrapper.append(dt, dd);
    caseFacts.append(wrapper);
  }
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
    body.textContent = "VirusTotal and local heuristics did not surface a strong suspicious pattern.";
    score.textContent = "0";
    score.className = "negative";
    text.append(title, body);
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
    body.textContent = signal.detail;
    score.textContent = formatImpact(signal.impact);
    if (signal.impact < 0) score.classList.add("negative");
    if (signal.impact >= 18) card.style.borderColor = "rgba(139, 45, 43, 0.85)";
    signalList.append(fragment);
  }
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
  if (score >= 75) return "#8b2d2b";
  if (score >= 50) return "#9b5724";
  if (score >= 25) return "#1e5963";
  return "#285f38";
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
    verdict: "Elevated suspicion",
    posture: "Treat as risky until a human confirms context.",
    signals: [
      { label: "Vendor malicious detections", impact: 36, detail: "3 engines reported malicious activity." },
      { label: "Phishing language", impact: 14, detail: "Contains pressure words: login, secure, update, account." },
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
