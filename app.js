/* DCC-DOS APP.JS (complete paste)
   Features:
   - Folder navigation (open folders, [..] up)
   - F1 Help, F3 Open, F5 Refresh, F10 Exit
   - ↑/↓ selection + Enter open + Backspace up
   - DOS-style beeps (invalid keys / denied / confirm)
   - Typing cursor animation (idle + lock prompt)
   - Fake disk access delay when opening folders/files
*/
function toggleHelp(){
  ensureHelp();
  if (!help) return;

  var isHidden = help.classList.contains("hidden");

  if (isHidden){
    help.classList.remove("hidden");
    help.style.display = "grid";   // show
    beepTick && beepTick();
  } else {
    help.classList.add("hidden");
    help.style.display = "none";   // force hide even if CSS is weird
    beepTick && beepTick();
  }
}
console.log("DCC-DOS app.js loaded");

// --- F1 trap (capture phase) so browser help doesn't steal it ---
(function(){
  function isF1(e){
    return e.key === "F1" || e.code === "F1" || e.key === "Help";
  }

  // keydown
  window.addEventListener("keydown", function(e){
   if (!isF1(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof toggleHelp === "function") toggleHelp();
  }, { capture: true });

  // keyup (some browsers open help on keyup)
  window.addEventListener("keyup", function(e){
    if (!isF1(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }, { capture: true });
})();

// ===================== CONFIG =====================
var PASSWORD = "GATORWIDOW"; // puzzle gate only (not real security)

// Fake “disk” timing
var DISK_MIN_MS = 180;
var DISK_MAX_MS = 650;

// Cursor blink
var CURSOR_INTERVAL_MS = 550;

// ===================== FILE TREE =====================
// Mirror your real folder structure here.
// Paths are relative to your site root (same level as index.html).
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

    { name: "10_TRAINING", type: "dir", children: [] },

    {
      name: "20_ACTIVE_CASES",
      type: "dir",
      children: [
        {
          name: "1983_BR_BATON_ROGUE",
          type: "dir",
          children: [
            { name: "01_BRIEF", type: "dir", children: [] },
            { name: "02_LOGS", type: "dir", children: [] },
            { name: "03_WITNESS", type: "dir", children: [] },
            { name: "04_MAPS", type: "dir", children: [] },
            { name: "05_DISPATCH", type: "dir", children: [] },
            {
              name: "EVIDENCE",
              type: "dir",
              children: [
                { name: "PHOTOS", type: "dir", children: [] },
                { name: "AUDIO", type: "dir", children: [] },
                { name: "SAMPLES", type: "dir", children: [] }
              ]
            },
            {
              name: "LOCKED",
              type: "dir",
              children: [
                // Example locked:
                // { name:"404_MISSION_DIRECTIVE.PDF", type:"pdf", locked:true, path:"doc/20_ACTIVE_CASES/1983_BR_BATON_ROGUE/LOCKED/404_MISSION_DIRECTIVE.pdf", tag:"LOCKED" }
              ]
            }
          ]
        }
      ]
    },

    {
      name: "30_FIELD_MANUALS",
      type: "dir",
      children: [
        { name: "203_FIELD_MANUAL_OIL_MEN.PDF", type: "pdf", path: "doc/30_FIELD_MANUALS/203_FIELD_MANUAL_OIL_MEN.pdf", tag: "MAN" },
        { name: "218_FIELD_MANUAL_COLOR_BLEEDERS.PDF", type: "pdf", path: "doc/30_FIELD_MANUALS/218_FIELD_MANUAL_COLOR_BLEEDERS.pdf", tag: "MAN" },
        { name: "223_FIELD_MANUAL_GREEN_DRAGON.PDF", type: "pdf", path: "doc/30_FIELD_MANUALS/223_FIELD_MANUAL_GREEN_DRAGON.pdf", tag: "MAN" }
      ]
    },

    { name: "40_FORMS", type: "dir", children: [] },
    { name: "80_INTERNAL", type: "dir", children: [] },
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

// Left path title (recommended in index.html):
// <div class="panelTitle" id="pathTitle">C:\DCC\</div>
var pathTitle = document.getElementById("pathTitle");

// Help overlay (we can create it if missing)
var help = document.getElementById("help");

var pendingLockedFile = null;

// Selection + entries
var selectedIndex = 0;
var currentEntries = [];

// Disk busy lock (prevents double-open spam)
var diskBusy = false;

// ===================== HELP OVERLAY (auto-create if missing) =====================
function ensureHelp(){
  if (help) return;

  help = document.createElement("div");
  help.id = "help";
  help.className = "help hidden";
  help.setAttribute("role", "dialog");
  help.setAttribute("aria-modal", "true");

  // Minimal styling without touching your CSS: keep it readable
  help.style.position = "fixed";
  help.style.inset = "0";
  help.style.display = "grid";
  help.style.placeItems = "center";
  help.style.background = "rgba(0,0,0,0.6)";
  help.style.zIndex = "9999";

  var box = document.createElement("div");
  box.className = "helpBox";
  box.style.width = "min(720px, 92vw)";
  box.style.padding = "14px";
  box.style.border = "1px solid rgba(180,255,210,0.35)";
  box.style.background = "rgba(0,0,0,0.88)";
  box.style.boxShadow = "0 0 30px rgba(0,0,0,0.85)";

  box.innerHTML =
    "<div class='panelTitle'>DCC-DOS HELP</div>" +
    "<div class='mono'>" +
    "<div><b>F1</b>  Help (toggle)</div>" +
    "<div><b>F3</b>  Open selected item</div>" +
    "<div><b>F5</b>  Refresh directory</div>" +
    "<div><b>F10</b> Exit session</div>" +
    "<br/>" +
    "<div><b>↑/↓</b> Move selection</div>" +
    "<div><b>Enter</b> Open</div>" +
    "<div><b>Backspace</b> Up one level</div>" +
    "<br/>" +
    "<div class='dim'>NOTE: “LOCKED” files require a passphrase.</div>" +
    "</div>" +
    "<div class='dim' style='margin-top:10px'>Press F1 or Esc to close</div>";

  help.appendChild(box);
  document.body.appendChild(help);
}
ensureHelp();

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

  // Some browsers require user interaction before sound is allowed.
  // If it fails silently, that's OK.
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

    setTimeout(function(){
      try { o.stop(); } catch (e2) {}
    }, ms);
  } catch (e) {}
}

function beepOk(){
  beep(880, 45, 0.03);
  setTimeout(function(){ beep(1320, 40, 0.025); }, 55);
}

function beepWarn(){
  beep(220, 110, 0.045);
}

function beepTick(){
  beep(900, 18, 0.015);
}

// ===================== NAVIGATION STACK =====================
// Fake C:\DCC\DOC\ path feel
var navStack = [
  { node: { name: "DCC", type: "dir", children: [TREE] }, label: "DCC" },
  { node: TREE, label: "DOC" }
];

function currentNode(){
  return navStack[navStack.length - 1].node;
}

function currentPath(){
  var parts = [];
  for (var i = 0; i < navStack.length; i++) parts.push(navStack[i].label);
  return "C:\\" + parts.join("\\") + "\\";
}

function isInLockedFolder(){
  for (var i = 0; i < navStack.length; i++){
    if (String(navStack[i].label).toUpperCase() === "LOCKED") return true;
  }
  return false;
}

// ===================== VIEW HELPERS =====================
function showIdle(message){
  if (!idle) return;

  // Ensure viewer panel state
  if (pdf) { pdf.src = ""; pdf.classList.add("hidden"); }
  if (locked) locked.classList.add("hidden");
  idle.classList.remove("hidden");

  if (viewerTitle) viewerTitle.textContent = "VIEWER";

  // Update idle message if possible
  // Expecting:
  // <div class="big">DCC ARCHIVE TERMINAL</div>
  // <div class="mono dim">Select a file on the left to open.</div>
  var mono = idle.querySelector(".mono");
  if (mono && message) mono.textContent = message;

  // Cursor in idle message
  ensureCursor(mono || idle);
}

function showPDF(path, title){
  if (viewerTitle) viewerTitle.textContent = "VIEWER: " + title;

  if (pdf) {
    pdf.src = path + "#view=FitH";
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

  if (pw) pw.value = "";
  if (pwMsg) pwMsg.textContent = "";
  if (pw) pw.focus();

  // Cursor inside lock panel (after the "Enter passphrase:" line)
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
  // Create cursor once
  if (!cursorEl){
    cursorEl = document.createElement("span");
    cursorEl.id = "dccCursor";
    cursorEl.textContent = "_";
    cursorEl.style.display = "inline-block";
    cursorEl.style.marginLeft = "6px";
    cursorEl.style.opacity = "0.85";
  }

  // Attach cursor to a reasonable place
  if (!targetEl) return;

  // If target is lock panel, attach to the line that says "Enter passphrase:"
  if (targetEl === locked && locked){
    var lines = locked.querySelectorAll(".mono");
    var attach = null;
    for (var i = 0; i < lines.length; i++){
      if (lines[i].textContent && lines[i].textContent.toLowerCase().indexOf("enter passphrase") !== -1){
        attach = lines[i];
        break;
      }
    }
    if (attach){
      if (cursorEl.parentNode !== attach){
        attach.appendChild(cursorEl);
      }
      startCursorBlink();
      return;
    }
  }

  // Otherwise attach to the target itself (or first .mono inside)
  var mono = targetEl.querySelector ? targetEl.querySelector(".mono") : null;
  var attachEl = mono || targetEl;
  if (attachEl && cursorEl.parentNode !== attachEl){
    attachEl.appendChild(cursorEl);
  }
  startCursorBlink();
}

function startCursorBlink(){
  if (cursorTimer) return;
  cursorTimer = setInterval(function(){
    cursorVisible = !cursorVisible;
    if (cursorEl) cursorEl.style.opacity = cursorVisible ? "0.85" : "0.0";
  }, CURSOR_INTERVAL_MS);
}

// ===================== DISK ACCESS DELAY =====================
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
  // Show an “ACCESSING...” style hint without adding new HTML
  if (viewerTitle) viewerTitle.textContent = msg;
  // Optional short tick sound
  beepTick();
}

// ===================== LIST RENDERING (folders + files + selection) =====================
function updateLeftPane(){
  if (pathTitle) {
    pathTitle.textContent = currentPath();
  } else {
    // fallback: try to set the first .panelTitle in left pane if pathTitle id isn't present
    var maybe = document.querySelector(".left .panelTitle");
    if (maybe) maybe.textContent = currentPath();
  }
  renderList();
}

function renderList(){
  if (!list) return;

  list.innerHTML = "";
  currentEntries = [];

  // [..] entry if not at DOC root
  if (navStack.length > 2){
    currentEntries.push({ type: "up" });
  }

  var node = currentNode();
  var children = (node.children || []).slice();

  children.sort(function(a,b){
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "dir" ? -1 : 1;
  });

  for (var i = 0; i < children.length; i++){
    currentEntries.push(children[i]);
  }

  // clamp selection
  if (selectedIndex < 0) selectedIndex = 0;
  if (selectedIndex > currentEntries.length - 1) selectedIndex = Math.max(0, currentEntries.length - 1);

  for (var k = 0; k < currentEntries.length; k++){
    (function(entry, idx){
      var row = document.createElement("div");
      row.className = "item" + (idx === selectedIndex ? " selected" : "");

      // UP
      if (entry.type === "up"){
        row.innerHTML = "[..] <span class='tag'>[UP]</span>";
        row.onclick = function(){
          selectedIndex = idx;
          activateSelected();
        };
        list.appendChild(row);
        return;
      }

      // DIR
      if (entry.type === "dir"){
        row.innerHTML = entry.name + " <span class='tag'>[DIR]</span>";
        row.onclick = function(){
          selectedIndex = idx;
          activateSelected();
        };
        list.appendChild(row);
        return;
      }

      // PDF
      var lockedNow = !!entry.locked || isInLockedFolder();
      var tag = lockedNow ? "LOCKED" : (entry.tag || "FILE");
      row.innerHTML = entry.name + " <span class='tag'>[" + tag + "]</span>";
      row.onclick = function(){
        selectedIndex = idx;
        activateSelected();
      };
      list.appendChild(row);
    })(currentEntries[k], k);
  }
}

function rerenderSelection(){
  renderList();
}

function goUp(){
  if (navStack.length <= 2){
    beepWarn(); // invalid at root
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

  // [..]
  if (entry && entry.type === "up"){
    goUp();
    return;
  }

  // folder
  if (entry && entry.type === "dir"){
    flashDiskMessage("ACCESSING: " + entry.name);
    diskDelay(function(){
      navStack.push({ node: entry, label: entry.name });
      selectedIndex = 0;
      updateLeftPane();
      beepOk();
    });
    return;
  }

  // file
  if (entry && entry.type === "pdf"){
    var lockedNow = !!entry.locked || isInLockedFolder();
    flashDiskMessage("OPENING: " + entry.name);
    diskDelay(function(){
      openPdfNode(entry, lockedNow);
      // (beep happens inside openPdfNode depending on state)
    });
    return;
  }

  beepWarn();
}

// ===================== OPEN FILES + LOCK =====================
function openPdfNode(f, lockedNow){
  if (!lockedNow){
    showPDF(f.path, f.name);
    beepOk();
    return;
  }
  pendingLockedFile = f;
  showLock(f.name);
  beepWarn();
}

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
      showPDF(pendingLockedFile.path, pendingLockedFile.name);
    });
  } else {
    if (pwMsg) pwMsg.textContent = "BAD COMMAND OR FILE NAME";
    beepWarn();
  }
}

if (unlockBtn) unlockBtn.onclick = tryUnlock;
if (pw) {
  pw.onkeydown = function(e){
    if (e.key === "Enter") {
      e.preventDefault();
      tryUnlock();
    }
  };
}

// ===================== HELP =====================
function toggleHelp(){
  ensureHelp();
  if (!help) return;
  var isHidden = help.classList.contains("hidden");
  if (isHidden) {
    help.classList.remove("hidden");
    beepTick();
  } else {
    help.classList.add("hidden");
    beepTick();
  }
   if (e.key === "Escape" && help && !help.classList.contains("hidden")) {
  e.preventDefault();
  toggleHelp();
}
}

// ===================== EXIT =====================
function exitSession(){
  flashDiskMessage("TERMINATING SESSION...");
  diskDelay(function(){
    // reset viewer
    if (pdf) { pdf.src = ""; pdf.classList.add("hidden"); }
    if (locked) locked.classList.add("hidden");
    if (idle) idle.classList.remove("hidden");
    if (viewerTitle) viewerTitle.textContent = "VIEWER";

    // back to root
    while (navStack.length > 2) navStack.pop();
    selectedIndex = 0;
    updateLeftPane();

    // idle message + cursor
    showIdle("Session terminated. Press F5 to reinitialize.");
    beepOk();
  });
}

// ===================== KEYBOARD (F-keys + DOS nav) =====================
document.addEventListener("keydown", function(e){
  ensureHelp();

  // If help open: Esc/F1 closes
  if (help && !help.classList.contains("hidden")){
    
    // Any other key while help open = soft tick
    beepTick();
    return;
  }
if (e.key === "?"){
  e.preventDefault();
  toggleHelp();
  return;
}
  // If busy, ignore most input (soft tick)
  if (diskBusy){
    // allow F1 to open help even while busy
    if (e.key === "F1"){
      e.preventDefault();
      toggleHelp();
      return;
    }
    beepTick();
    return;
  }

  // If typing in password box, allow text entry (except function keys + nav keys)
  var active = document.activeElement;
  var typingInPw = (active && active.id === "pw");

  // Function keys
  if (e.key === "F1"){
    e.preventDefault();
    toggleHelp();
    return;
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

  // Lock screen: Enter handled by pw handler, but allow Escape to back out (optional)
  if (locked && !locked.classList.contains("hidden")){
    if (e.key === "Escape"){
      e.preventDefault();
      // Back out to idle (doesn't unlock)
      showIdle("Select a file on the left to open.");
      beepTick();
      return;
    }
    // Otherwise, if not typing in pw, treat as invalid
    if (!typingInPw){
      beepWarn();
    }
    return;
  }

  // Navigation keys (DOS feel)
  if (e.key === "ArrowDown"){
    e.preventDefault();
    if (!currentEntries.length){ beepWarn(); return; }
    selectedIndex = Math.min(selectedIndex + 1, currentEntries.length - 1);
    rerenderSelection();
    beepTick();
    return;
  }

  if (e.key === "ArrowUp"){
    e.preventDefault();
    if (!currentEntries.length){ beepWarn(); return; }
    selectedIndex = Math.max(selectedIndex - 1, 0);
    rerenderSelection();
    beepTick();
    return;
  }

  if (e.key === "Enter"){
    // if focus is in pw, let pw handler do it
    if (typingInPw) return;
    e.preventDefault();
    activateSelected();
    return;
  }

  if (e.key === "Backspace"){
    // if focus is in pw, allow deleting characters
    if (typingInPw) return;
    e.preventDefault();
    goUp();
    return;
  }

  // Ignore normal typing (so you can scroll/page without beeping constantly),
  // but beep for "random keys" that feel like invalid commands (optional).
  // We'll only beep on single-character keys when not in an input.
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



