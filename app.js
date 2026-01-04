/* DCC-DOS APP.JS (DESKTOP-ONLY CLEAN)
   - Folder navigation ([..] up)
   - F1 Help, F3 Open, F5 Refresh, F10 Exit
   - ↑/↓ selection + Enter open + Backspace up
   - DOS beeps (warn/ok/tick)
   - Typing cursor blink (idle + lock prompt)
   - Fake disk delay when opening folders/files
*/

console.log("DCC-DOS app.js loaded");


// ======================= Mobile path to pic ==================
function isMobile(){
  return window.matchMedia("(max-width: 900px)").matches;
}

// Convert a PDF path to your mobile-image folder path
// Example: doc/00_START_HERE/000_READ_THIS_FIRST.pdf  ->  m/00_START_HERE/000_READ_THIS_FIRST
function mobileFolderForPdf(pdfPath){
  var p = pdfPath.replace(/^doc\//, "m/");
  p = p.replace(/\.pdf$/i, ""); // strip extension
  return p;
}

// ===================== CONFIG =====================
var PASSWORD = "GATORWIDOW"; // puzzle gate only (not real security)

// Fake disk timing
var DISK_MIN_MS = 180;
var DISK_MAX_MS = 650;

// Cursor blink
var CURSOR_INTERVAL_MS = 550;

// ===================== FILE TREE =====================
// Paths are relative to site root (same folder as index.html).
var TREE = {
  name: "DOC",
  type: "dir",
  children: [
    {
      name: "00_START_HERE",
      type: "dir",
      children: [
        { name: "000_READ_THIS_FIRST.PDF", type: "pdf", path: "doc/00_START_HERE/000_READ_THIS_FIRST.pdf", tag: "START" },
        { name: "010_FIELD_AGENT_ORIENTATION.PDF", type: "pdf", path: "doc/00_START_HERE/010_FIELD_AGENT_ORIENTATION.pdf", tag: "TRAIN" },
        { name: "020_CODEWORDS_AND_MARKINGS.PDF", type: "pdf", path: "doc/00_START_HERE/020_CODEWORDS_AND_MARKINGS.pdf", tag: "TRAIN" },
        { name: "030_RADIO_AND_EBS_PROTOCOL.PDF", type: "pdf", path: "doc/00_START_HERE/030_RADIO_AND_EBS_PROTOCOL.pdf", tag: "TRAIN" }
      ]
    },

    { name: "10_TRAINING", type: "dir", children: [
      { name: "BEST_PRACTICE_LLE_USE_02.PDF", type: "pdf", path: "doc/10_TRAINING/BEST_PRACTICE_LLE_USE_02.pdf", tag: "TRAINING" }
    ]},

    { name: "20_ACTIVE_CASES", type: "dir", children: [
      { name: "1983_BR_BATON_ROGUE", type: "dir", children: [
        { name: "01_BRIEF", type: "dir", children: [] },
        { name: "02_LOGS", type: "dir", children: [] },
        { name: "03_WITNESS", type: "dir", children: [] },
        { name: "04_MAPS", type: "dir", children: [] },
        { name: "05_DISPATCH", type: "dir", children: [] },
        { name: "EVIDENCE", type: "dir", children: [
          { name: "PHOTOS", type: "dir", children: [] },
          { name: "AUDIO", type: "dir", children: [] },
          { name: "SAMPLES", type: "dir", children: [] }
        ]},
        { name: "LOCKED", type: "dir", children: [
          // Example:
          // { name:"404_MISSION_DIRECTIVE.PDF", type:"pdf", locked:true, path:"doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/LOCKED/404_MISSION_DIRECTIVE.pdf", tag:"LOCKED" }
        ]}
      ]}
    ]},

    { name: "30_FIELD_MANUALS", type: "dir", children: [
      { name: "203_FIELD_MANUAL_OIL_MEN.PDF", type: "pdf", path: "doc/30_FIELD_MANUALS/203_FIELD_MANUAL_OIL_MEN.pdf", tag: "MAN" },
      { name: "218_FIELD_MANUAL_COLOR_BLEEDERS.PDF", type: "pdf", path: "doc/30_FIELD_MANUALS/218_FIELD_MANUAL_COLOR_BLEEDERS.pdf", tag: "MAN" },
      { name: "223_FIELD_MANUAL_GREEN_DRAGON.PDF", type: "pdf", path: "doc/30_FIELD_MANUALS/223_FIELD_MANUAL_GREEN_DRAGON.pdf", tag: "MAN" }
    ]},

    { name: "40_FORMS", type: "dir", children: [] },

    { name: "50_SCIENCE_DEPARTMENT", type: "dir", children: [
      { name: "000157_SCI_DEP_EXT_CONTROL.PDF", type: "pdf", path: "doc/50_SCIENCE_DEPARTMENT/000157_SCI_DEP_EXT_CONTROL.pdf", tag: "SCI_CASE" },
      { name: "000025_SCI_DEP_EVENT_05X25.PDF", type: "pdf", path: "doc/50_SCIENCE_DEPARTMENT/000025_SCI_DEP_EVENT_05X25.pdf", tag: "SCI_CASE" },
      { name: "000198_SCI_DEP_EVENT_05725.PDF", type: "pdf", path: "doc/50_SCIENCE_DEPARTMENT/000198_SCI_DEP_EVENT_05725.pdf", tag: "SCI_CASE" }
    ]},

    { name: "80_INTERNAL", type: "dir", children: [
      { name: "DIRECTOR_MEMO_789.PDF", type: "pdf", path: "doc/80_INTERNAL/DIRECTOR_MEMO_789.pdf", tag: "DCC_OFFICIAL" },
      { name: "MISSION_STATEMENT_OFFICIAL.PDF", type: "pdf", path: "doc/80_INTERNAL/MISSION_STATEMENT_OFFICIAL.pdf", tag: "DCC_OFFICIAL" }
    ]},

    { name: "90_ARCHIVE_POLICY", type: "dir", children: [] }
  ]
};

// ===================== DOM =====================
var list = document.getElementById("list");
var pdf = document.getElementById("pdf");
var idle = document.getElementById("idle");
var locked = document.getElementById("locked");
var viewerTitle = document.getElementById("viewerTitle");
var pw = document.getElementById("pw");
var unlockBtn = document.getElementById("unlockBtn");
var pwMsg = document.getElementById("pwMsg");
var pathTitle = document.getElementById("pathTitle");
var help = document.getElementById("help");

// ===================== HELP (F1 + Esc) =====================
function toggleHelp(){
  if (!help) return;
  help.classList.toggle("hidden");
  beepTick();
}

// Capture F1 so browser help doesn’t steal it
(function(){
  function isF1(e){ return e.key === "F1" || e.code === "F1" || e.key === "Help"; }

  window.addEventListener("keydown", function(e){
    if (!isF1(e)) return;
    e.preventDefault();
    e.stopPropagation();
    toggleHelp();
  }, { capture:true });

  window.addEventListener("keyup", function(e){
    if (!isF1(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }, { capture:true });
})();

// ===================== DOS BEEPS =====================
var audioCtx = null;

function getAudioCtx(){
  if (audioCtx) return audioCtx;
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    return audioCtx;
  } catch (e) {
    return null;
  }
}

function beep(freq, ms, gain){
  var ctx = getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(function(){ try { o.stop(); } catch(e2){} }, ms);
  } catch (e) {}
}

function beepOk(){ beep(880, 45, 0.03); setTimeout(function(){ beep(1320, 40, 0.025); }, 55); }
function beepWarn(){ beep(220, 110, 0.045); }
function beepTick(){ beep(900, 18, 0.015); }

// ===================== NAV STACK =====================
var navStack = [
  { node: { name: "DCC", type:"dir", children:[TREE] }, label:"DCC" },
  { node: TREE, label:"DOC" }
];

function currentNode(){ return navStack[navStack.length - 1].node; }

function currentPath(){
  var parts = [];
  for (var i=0; i<navStack.length; i++) parts.push(navStack[i].label);
  return "C:\\" + parts.join("\\") + "\\";
}

function isInLockedFolder(){
  for (var i=0; i<navStack.length; i++){
    if (String(navStack[i].label).toUpperCase() === "LOCKED") return true;
  }
  return false;
}

// ===================== VIEW HELPERS =====================
function showIdle(msg){
  if (pdf){ pdf.src = ""; pdf.classList.add("hidden"); }
  if (locked) locked.classList.add("hidden");
  if (idle) idle.classList.remove("hidden");
  if (viewerTitle) viewerTitle.textContent = "VIEWER";

  var mono = idle ? idle.querySelector(".mono") : null;
  if (mono && msg) mono.textContent = msg;

  ensureCursor(mono || idle);
}
function isMobile(){
  return window.matchMedia("(max-width: 900px)").matches;
}

// doc/.../file.pdf  ->  m/.../file
function mobileFolderForPdf(pdfPath){
  var p = (pdfPath || "").replace(/\\/g, "/");         // normalize slashes
  p = p.replace(/^(\.?\/)?dos\//i, "");               // remove leading DOS/ if any
  p = p.replace(/^(\.?\/)?/i, "");                    // remove leading ./ if any
  p = p.replace(/^doc\//i, "m/");                     // doc/... -> m/...
  p = p.replace(/\.pdf$/i, "");                       // remove .pdf
  return p;
}


function openForDevice(pdfPath, displayName){
  if (isMobile()){
    var folder = mobileFolderForPdf(pdfPath);
    var url = "mobile.html?folder=" + encodeURIComponent(folder) +
              "&name=" + encodeURIComponent(displayName || "");
    console.log("MOBILE URL:", url);
    window.location.href = url;
    return;
  }
  showPDF(pdfPath, displayName);
}



function showPDF(path, title){
  if (viewerTitle) viewerTitle.textContent = "VIEWER: " + title;
  if (pdf){
    pdf.src = path;
    pdf.classList.remove("hidden");
  }
  if (locked) locked.classList.add("hidden");
  if (idle) idle.classList.add("hidden");
}




function showLock(title){
  if (viewerTitle) viewerTitle.textContent = "VIEWER: " + title;
  if (pdf) pdf.classList.add("hidden");
  if (idle) idle.classList.add("hidden");
  if (locked) locked.classList.remove("hidden");
  if (pw){ pw.value = ""; pw.focus(); }
  if (pwMsg) pwMsg.textContent = "";
  ensureCursor(locked);
}

function normalize(s){
  return (s || "").trim().toUpperCase().replace(/\s+/g, "");
}

// ===================== TYPING CURSOR =====================
var cursorEl = null;
var cursorTimer = null;
var cursorVisible = true;

function ensureCursor(targetEl){
  if (!targetEl) return;

  if (!cursorEl){
    cursorEl = document.createElement("span");
    cursorEl.id = "dccCursor";
    cursorEl.textContent = "_";
    cursorEl.style.display = "inline-block";
    cursorEl.style.marginLeft = "6px";
    cursorEl.style.opacity = "0.85";
  }

  // Lock panel: attach after "Enter passphrase:"
  if (targetEl === locked && locked){
    var lines = locked.querySelectorAll(".mono");
    var attach = null;
    for (var i=0; i<lines.length; i++){
      if ((lines[i].textContent || "").toLowerCase().indexOf("enter passphrase") !== -1){
        attach = lines[i];
        break;
      }
    }
    if (attach && cursorEl.parentNode !== attach) attach.appendChild(cursorEl);
    startCursorBlink();
    return;
  }

  var mono = targetEl.querySelector ? targetEl.querySelector(".mono") : null;
  var attachEl = mono || targetEl;
  if (attachEl && cursorEl.parentNode !== attachEl) attachEl.appendChild(cursorEl);
  startCursorBlink();
}

function startCursorBlink(){
  if (cursorTimer) return;
  cursorTimer = setInterval(function(){
    cursorVisible = !cursorVisible;
    if (cursorEl) cursorEl.style.opacity = cursorVisible ? "0.85" : "0.0";
  }, CURSOR_INTERVAL_MS);
}

// ===================== DISK DELAY =====================
var diskBusy = false;

function diskDelay(fn){
  if (diskBusy) return;
  diskBusy = true;
  var ms = DISK_MIN_MS + Math.floor(Math.random() * (DISK_MAX_MS - DISK_MIN_MS + 1));
  setTimeout(function(){
    diskBusy = false;
    try { fn(); } catch (e) {}
  }, ms);
}

function flashDiskMessage(msg){
  if (viewerTitle) viewerTitle.textContent = msg;
  beepTick();
}

// ===================== LIST RENDER =====================
var selectedIndex = 0;
var currentEntries = [];
var pendingLockedFile = null;

function updateLeftPane(){
  if (pathTitle) pathTitle.textContent = currentPath();
  renderList();
}

function renderList(){
  if (!list) return;

  list.innerHTML = "";
  currentEntries = [];

  // [..] entry if not at DOC root
  if (navStack.length > 2) currentEntries.push({ type:"up" });

  var node = currentNode();
  var children = (node.children || []).slice();

  children.sort(function(a,b){
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return (a.type === "dir") ? -1 : 1;
  });

  for (var i=0; i<children.length; i++) currentEntries.push(children[i]);

  if (selectedIndex < 0) selectedIndex = 0;
  if (selectedIndex > currentEntries.length - 1) selectedIndex = Math.max(0, currentEntries.length - 1);

  for (var k=0; k<currentEntries.length; k++){
    (function(entry, idx){
      var row = document.createElement("div");
      row.className = "item" + (idx === selectedIndex ? " selected" : "");

      if (entry.type === "up"){
        row.innerHTML = "[..] <span class='tag'>[UP]</span>";
      } else if (entry.type === "dir"){
        row.innerHTML = entry.name + " <span class='tag'>[DIR]</span>";
      } else if (entry.type === "pdf"){
        var lockedNow = !!entry.locked || isInLockedFolder();
        var tag = lockedNow ? "LOCKED" : (entry.tag || "FILE");
        row.innerHTML = entry.name + " <span class='tag'>[" + tag + "]</span>";
      } else {
        row.innerHTML = entry.name || "(UNKNOWN)";
      }

      row.onclick = function(){
        selectedIndex = idx;
        activateSelected();
      };

      list.appendChild(row);
    })(currentEntries[k], k);
  }
}

function goUp(){
  if (navStack.length <= 2){
    beepWarn();
    return;
  }
  flashDiskMessage("ACCESSING: ..");
  diskDelay(function(){
    navStack.pop();
    selectedIndex = 0;
    updateLeftPane();
    beepOk();
  });
}

function activateSelected(){
  if (!currentEntries.length){
    beepWarn();
    return;
  }

  var entry = currentEntries[selectedIndex];

  if (entry.type === "up"){
    goUp();
    return;
  }

  if (entry.type === "dir"){
    flashDiskMessage("ACCESSING: " + entry.name);
    diskDelay(function(){
      navStack.push({ node: entry, label: entry.name });
      selectedIndex = 0;
      updateLeftPane();
      beepOk();
    });
    return;
  }

  if (entry.type === "pdf"){
    var lockedNow = !!entry.locked || isInLockedFolder();
    flashDiskMessage("OPENING: " + entry.name);
    diskDelay(function(){
      if (!lockedNow){
        openForDevice(entry.path, entry.name);
        beepOk();
      } else {
        pendingLockedFile = entry;
        showLock(entry.name);
        beepWarn();
      }
    });
    return;
  }

  beepWarn();
}

// ===================== LOCK UNLOCK =====================
function tryUnlock(){
  if (!pendingLockedFile){
    beepWarn();
    return;
  }
  var guess = normalize(pw ? pw.value : "");
  if (guess === normalize(PASSWORD)){
    if (pwMsg) pwMsg.textContent = "DECRYPTING... OK";
    beepOk();
    diskDelay(function(){
    openForDevice(pendingLockedFile.path, pendingLockedFile.name);
});

  } else {
    if (pwMsg) pwMsg.textContent = "BAD COMMAND OR FILE NAME";
    beepWarn();
  }
}

if (unlockBtn) unlockBtn.onclick = tryUnlock;
if (pw){
  pw.onkeydown = function(e){
    if (e.key === "Enter"){
      e.preventDefault();
      tryUnlock();
    }
  };
}

// ===================== EXIT =====================
function exitSession(){
  flashDiskMessage("TERMINATING SESSION...");
  diskDelay(function(){
    while (navStack.length > 2) navStack.pop();
    selectedIndex = 0;
    updateLeftPane();
    showIdle("Session terminated. Press F5 to reinitialize.");
    beepOk();
  });
}

// ===================== KEYBOARD =====================
document.addEventListener("keydown", function(e){
  // If help open: allow Esc to close; otherwise swallow keys
  if (help && !help.classList.contains("hidden")){
    if (e.key === "Escape"){
      e.preventDefault();
      toggleHelp();
      return;
    }
    beepTick();
    return;
  }

  if (diskBusy){
    beepTick();
    return;
  }

  var active = document.activeElement;
  var typingInPw = (active && active.id === "pw");

  if (e.key === "Escape"){
    // If lock panel open, back out to idle (optional)
    if (locked && !locked.classList.contains("hidden")){
      e.preventDefault();
      showIdle("Select a file on the left to open.");
      beepTick();
      return;
    }
  }

  if (e.key === "F5"){
    e.preventDefault();
    flashDiskMessage("REFRESHING DIRECTORY...");
    diskDelay(function(){
      updateLeftPane();
      beepOk();
    });
    return;
  }

  if (e.key === "F3"){
    e.preventDefault();
    activateSelected();
    return;
  }

  if (e.key === "F10"){
    e.preventDefault();
    exitSession();
    return;
  }

  if (locked && !locked.classList.contains("hidden")){
    // allow typing in password input
    if (!typingInPw && e.key && e.key.length === 1) beepWarn();
    return;
  }

  if (e.key === "ArrowDown"){
    e.preventDefault();
    if (!currentEntries.length){ beepWarn(); return; }
    selectedIndex = Math.min(selectedIndex + 1, currentEntries.length - 1);
    renderList();
    beepTick();
    return;
  }

  if (e.key === "ArrowUp"){
    e.preventDefault();
    if (!currentEntries.length){ beepWarn(); return; }
    selectedIndex = Math.max(selectedIndex - 1, 0);
    renderList();
    beepTick();
    return;
  }

  if (e.key === "Enter"){
    if (typingInPw) return;
    e.preventDefault();
    activateSelected();
    return;
  }

  if (e.key === "Backspace"){
    if (typingInPw) return;
    e.preventDefault();
    goUp();
    return;
  }

  // Optional DOS “invalid key” beep
  if (!typingInPw && e.key && e.key.length === 1){
    beepWarn();
  }
});

// ===================== CLOCK =====================
function tick(){
  var d = new Date();
  var t = d.toLocaleString(undefined, { hour12:false });
  var c = document.getElementById("clock");
  if (c) c.textContent = t;
}
setInterval(tick, 1000);
tick();

// ===================== BOOT =====================
function boot(){
  updateLeftPane();
  showIdle("Select a file on the left to open.");
  beepTick();
}
boot();
