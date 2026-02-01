(() => {
  "use strict";

  // prevent double init
  if (window.__DCC_ENTROPY_ENGINE__) return;
  window.__DCC_ENTROPY_ENGINE__ = true;

  console.log("[ENTROPY] engine script loaded");

  const KEY = "DCC_ENTROPY";
  const MAX = 999;

  const TICK_MS    = 2000; // +1 every 2s
  const TIME_GAIN  = 1;
  const CLICK_GAIN = 1;

  // thresholds for body classes + status text
  const LEVELS = [
    { at: 0,   cls: "",             status: "" },
    { at: 120,  cls: "entropy-lv1",  status: "NOISE RISING" },
    { at: 230,  cls: "entropy-lv2",  status: "SIGNAL DRIFT" },
    { at: 535, cls: "entropy-lv3",  status: "FLOORS MISALIGN" },
    { at: 640, cls: "entropy-lv4",  status: "EBS PRIORITY: ENTROPY EVENT" }
  ];

  // PDF-specific deltas (doc paths, lowercase)
  const PDF_DELTAS_RAW = {
    "/doc/00_start_here/000_read_this_first.pdf":          -50,
    "/doc/00_start_here/010_field_agent_orientation.pdf":  -25,
    "/doc/00_start_here/020_codewords_and_markings.pdf":   -30,
    "/doc/00_start_here/030_radio_and_ebs_protocol.pdf":   -15,

    "/doc/30_field_manuals/203_field_manual_oil_men.pdf":        +25,
    "/doc/30_field_manuals/218_field_manual_color_bleeders.pdf": +20,
    "/doc/30_field_manuals/223_field_manual_green_dragon.pdf":   +35,
    "/doc/30_field_manuals/216_FIELD_MANUAL_SPACERS.pdf":   +30,
	"/doc/30_field_manuals/252_FIELD_MANUAL_SWIVLERS.pdf":   +35,
    "/doc/50_science_department/000157_sci_dep_ext_control.pdf": +15,
    "/doc/50_science_department/000025_sci_dep_event_05x25.pdf": -30,
    "/doc/50_science_department/000198_sci_dep_event_05725.pdf": -35,
    "/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/AGENT_18567_FIELD_REPORT.pdf": -20,
    "/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/AGENT_19658_FIELD_REPORT.pdf": +25,   
	"/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/DCC_SCIENCE_MEMO_1.pdf": +5,
	"/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/DCC_SCIENCE_MEMO_2.pdf": +5,
	"/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/DCC_SCIENCE_MEMO_3.pdf": +5,
	"/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/DCC_SCIENCE_MEMO_4.pdf": +5,
	"/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/DCC_SCIENCE_MEMO_5.pdf": +5,
	"/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/DCC_SCIENCE_MEMO_6.pdf": +5,
	"/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/JANITOR_LETTER_98767.pdf": +25,
	"/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/MNT_FORM_59864.pdf": -10,
	"/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/PESONAL_LETTER_23368_REDACTED.pdf": -30,
	"/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/06_INCIDENTS/DCC_BR_CASE_5698/SUPERVISOR_56_REPORT_ON_AGENTS.pdf": -30,
    "/doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/LOCKED/PESONAL_LETTER_23368.pdf": -60
  
  
  
  };

  const PDF_DELTAS = (() => {
    const out = Object.create(null);
    for (const [k, v] of Object.entries(PDF_DELTAS_RAW)) {
      out[k.toLowerCase()] = Number(v);
    }
    return out;
  })();

  const clamp = (n) => Math.max(0, Math.min(MAX, n));
  const pad3  = (n) => String(n).padStart(3, "0");

  function read() {
    const raw = localStorage.getItem(KEY);
    const n = parseInt(raw || "0", 10);
    return Number.isFinite(n) ? clamp(n) : 0;
  }

  function write(n) {
    const v = clamp(n);
    try { localStorage.setItem(KEY, String(v)); } catch {}
    return v;
  }

  function normalizeDocPath(path) {
    if (!path) return "";
    let p = String(path);
    try {
      const u = new URL(p, window.location.origin);
      p = u.pathname || "";
    } catch {
      // relative doc/... ok
    }
    p = p.split("?")[0].split("#")[0];
    p = p.replace(/\\/g, "/").toLowerCase();
    const idx = p.indexOf("/doc/");
    if (idx !== -1) p = p.slice(idx);
    return p;
  }

  function bestLevel(entropy) {
    let best = LEVELS[0];
    for (const lv of LEVELS) if (entropy >= lv.at) best = lv;
    return best;
  }

  function lvStatus(entropy) {
    const lv = bestLevel(entropy);
    return lv.status ? `// ${lv.status}` : "";
  }

  function apply(entropy) {
    const lv = bestLevel(entropy);

    const valueEl  = document.getElementById("entropyValue");
    const statusEl = document.getElementById("entropyStatus");

    if (valueEl)  valueEl.textContent = pad3(entropy);
    if (statusEl) statusEl.textContent = lvStatus(entropy);

    const b = document.body;
    if (b) {
      b.classList.remove("entropy-lv1","entropy-lv2","entropy-lv3","entropy-lv4");
      if (lv.cls) b.classList.add(lv.cls);
    }
  }

  function flashDelta(delta, before, after) {
    const statusEl = document.getElementById("entropyStatus");
    if (!statusEl) return;

    const sign = delta > 0 ? "+" : "";
    statusEl.textContent = `// Δ ${sign}${delta}  ${pad3(before)}→${pad3(after)}`;

    clearTimeout(window.__dccDeltaFlashT);
    window.__dccDeltaFlashT = setTimeout(() => {
      statusEl.textContent = lvStatus(after);
    }, 1400);
  }

  function addEntropy(delta) {
    if (!delta) return read();
    const d = Number(delta) || 0;
    const before = read();
    const after = write(before + d);
    apply(after);
    flashDelta(d, before, after);
    console.log("[ENTROPY] add", d, "=>", after);
    return after;
  }

  function applyDeltaForPath(path) {
    const key = normalizeDocPath(path);
    const delta = PDF_DELTAS[key];
    if (typeof delta === "number" && Number.isFinite(delta)) {
      console.log("[ENTROPY] PDF delta", key, "=>", delta);
      addEntropy(delta);
    } else {
      console.log("[ENTROPY] PDF delta", key, "=>", "none");
    }
  }

  function applyPdfViewDeltaIfPresent() {
    const params = new URLSearchParams(window.location.search || "");
    const file = params.get("file") || params.get("pdf") || params.get("doc");
    if (!file) return;
    applyDeltaForPath(file);
  }

  // public hook for app.js + mobile viewer
  window.DCC_onDocumentOpen = function(path) {
    applyDeltaForPath(path);
  };

  function wireResetButton() {
  const btn = document.getElementById("entropyResetBtn");
  if (!btn || btn.dataset.wired === "1") return;
  btn.dataset.wired = "1";

  const modal   = document.getElementById("dccResetModal");
  const input   = document.getElementById("dccResetInput");
  const cancel  = document.getElementById("dccResetCancel");
  const confirm = document.getElementById("dccResetConfirm");

  function close() {
    modal.classList.add("hidden");
    input.value = "";
  }

  btn.addEventListener("click", () => {
    modal.classList.remove("hidden");
    input.focus();
  });

  cancel.addEventListener("click", close);

  confirm.addEventListener("click", () => {
    const v = input.value.trim().toUpperCase();
    if (v !== "CONFIRM") return;

    write(0);
    apply(0);

    const status = document.getElementById("entropyStatus");
    if (status) status.textContent = "// STABILIZATION COMPLETE";

    setTimeout(() => {
      if (status) status.textContent = "";
    }, 1800);

    close();
  });

  // Enter key triggers confirm
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      confirm.click();
    }
    if (e.key === "Escape") {
      close();
    }
  });
}


  function init() {
    const start = read();
    console.log("[ENTROPY] init, start =", start);
    apply(start);
    wireResetButton();
    applyPdfViewDeltaIfPresent();

    // time-based entropy
    setInterval(() => {
      if (document.visibilityState === "visible") {
        addEntropy(TIME_GAIN);
      }
    }, TICK_MS);

    // click-based entropy
    document.addEventListener("click", () => {
      addEntropy(CLICK_GAIN);
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
window.addEventListener("load", () => {
  const bl = document.getElementById("entropyBlackout");
  if (bl) bl.style.display = "none";

  const d = document.getElementById("entropyDemon");
  if (d) { d.style.display = "none"; d.classList.remove("run"); }
});
