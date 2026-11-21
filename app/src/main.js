// Night Drive Cover Studio — editor wiring.
// Loads photos (upload, drag-and-drop, samples), keeps an undo/redo history,
// drives the layout / grade / caption controls, and exports all four post
// sizes in one click. Runs fully offline; photos never leave the machine.
import {
  LAYOUTS, GRADES, EXPORT_SIZES, layoutPanels, renderCover,
  exportCoverPng, defaultState,
} from "./cover.js";

const $ = (id) => document.getElementById(id);
const canvas = $("coverCanvas");
const statusEl = $("status");
const state = defaultState();
const photos = []; // HTMLImageElement list, index = photo slot
const photoNames = [];
let history = [];
let historyIndex = -1;
let exportSize = { name: "1080x1350", w: 1080, h: 1350 };

function setStatus(msg) { statusEl.textContent = msg; }

function snapshotState() {
  return JSON.parse(JSON.stringify(state));
}

function pushHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(snapshotState());
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1;
  updateUndoRedo();
}

function restoreHistory() {
  const snap = history[historyIndex];
  if (!snap) return;
  const keepSelected = state.selectedPanel;
  Object.assign(state, JSON.parse(JSON.stringify(snap)));
  state.selectedPanel = keepSelected;
  syncControls();
  render();
  updateUndoRedo();
}

function updateUndoRedo() {
  $("undoBtn").disabled = historyIndex <= 0;
  $("redoBtn").disabled = historyIndex >= history.length - 1;
}

function render() {
  renderCover(canvas, state, photos);
}

/** Load an image from a URL or blob URL into a photo slot. */
export function loadPhotoIntoSlot(src, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      photos.push(img);
      photoNames.push(name || `Photo ${photos.length}`);
      rebuildPhotoSelect();
      render();
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Could not load ${name || src}`));
    img.src = src;
  });
}

function rebuildPhotoSelect() {
  const sel = $("panelPhoto");
  sel.innerHTML = "";
  photoNames.forEach((name, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${i + 1}. ${name}`;
    sel.appendChild(opt);
  });
  sel.value = String(state.panelPhotos[state.selectedPanel] ?? 0);
}

function loadSamplePhotos() {
  return Promise.all([
    loadPhotoIntoSlot("./samples/boulevard.jpg", "Boulevard — golden hour"),
    loadPhotoIntoSlot("./samples/pier.jpg", "Pier — turquoise water"),
  ]);
}

/** Read user-picked files as photos. */
function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith("image/"));
  if (!files.length) { setStatus("That file was not an image — try a JPG or PNG."); return; }
  let done = 0;
  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    loadPhotoIntoSlot(url, file.name).then(() => {
      done++;
      if (done === files.length) {
        pushHistory();
        setStatus(`${files.length} photo${files.length > 1 ? "s" : ""} loaded — drag a panel to reposition, then Export all sizes.`);
      }
    }).catch(() => setStatus(`Could not read ${file.name}.`));
  });
}

/** Wire every editor control to the state. */
function bindControls() {
  $("photoInput").addEventListener("change", (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  });
  $("sampleBoulevard").addEventListener("click", () => {
    state.panelPhotos = state.panelPhotos.map(() => 0);
    state.onePhotoAll = true;
    $("onePhotoAll").checked = true;
    pushHistory(); render(); setStatus("Boulevard sample across all panels.");
  });
  $("samplePier").addEventListener("click", () => {
    state.panelPhotos = state.panelPhotos.map(() => 1);
    state.onePhotoAll = true;
    $("onePhotoAll").checked = true;
    pushHistory(); render(); setStatus("Pier sample across all panels.");
  });
  $("onePhotoAll").addEventListener("change", (e) => {
    state.onePhotoAll = e.target.checked;
    pushHistory(); render();
  });
  $("panelPhoto").addEventListener("change", (e) => {
    state.onePhotoAll = false;
    $("onePhotoAll").checked = false;
    state.panelPhotos[state.selectedPanel] = Number(e.target.value);
    pushHistory(); render();
  });

  document.querySelectorAll(".layout-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".layout-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.layout = btn.dataset.layout;
      pushHistory(); render();
      setStatus(`Layout: ${LAYOUTS[state.layout].label}.`);
    });
  });
  document.querySelectorAll(".grade-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".grade-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.grade = btn.dataset.grade;
      pushHistory(); render();
      setStatus(`Grade: ${GRADES[state.grade].label}.`);
    });
  });
  $("gradeSlider").addEventListener("input", (e) => {
    state.gradeStrength = Number(e.target.value);
    render();
  });
  $("gradeSlider").addEventListener("change", () => pushHistory());

  $("titleInput").addEventListener("input", (e) => { state.title = e.target.value || "NIGHT DRIVE"; render(); });
  $("titleInput").addEventListener("change", () => pushHistory());
  $("subtitleInput").addEventListener("input", (e) => { state.subtitle = e.target.value || "Leonida after dark"; render(); });
  $("subtitleInput").addEventListener("change", () => pushHistory());
  $("badgeInput").addEventListener("input", (e) => { state.badge = e.target.value || "VICE CITY"; render(); });
  $("badgeInput").addEventListener("change", () => pushHistory());
  $("heatSlider").addEventListener("input", (e) => {
    state.heat = Number(e.target.value);
    $("heatLabel").textContent = "★".repeat(state.heat) + "☆".repeat(5 - state.heat);
    render();
  });
  $("heatSlider").addEventListener("change", () => pushHistory());

  const cropOf = () => state.crops[state.selectedPanel];
  $("zoomSlider").addEventListener("input", (e) => { cropOf().zoom = Number(e.target.value); render(); });
  $("zoomSlider").addEventListener("change", () => pushHistory());
  $("panXSlider").addEventListener("input", (e) => { cropOf().panX = Number(e.target.value); render(); });
  $("panXSlider").addEventListener("change", () => pushHistory());
  $("panYSlider").addEventListener("input", (e) => { cropOf().panY = Number(e.target.value); render(); });
  $("panYSlider").addEventListener("change", () => pushHistory());

  $("grainCheck").addEventListener("change", (e) => { state.effects.grain = e.target.checked; pushHistory(); render(); });
  $("vignetteCheck").addEventListener("change", (e) => { state.effects.vignette = e.target.checked; pushHistory(); render(); });
  $("halftoneCheck").addEventListener("change", (e) => { state.effects.halftone = e.target.checked; pushHistory(); render(); });
  $("bordersCheck").addEventListener("change", (e) => { state.effects.borders = e.target.checked; pushHistory(); render(); });

  document.querySelectorAll(".size-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".size-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const [w, h] = btn.dataset.size.split("x").map(Number);
      exportSize = { name: btn.dataset.size, w, h };
      canvas.width = w;
      canvas.height = h;
      document.querySelector(".preview-tag").textContent = `LIVE PREVIEW · ${w} × ${h}`;
      render();
    });
  });

  $("undoBtn").addEventListener("click", () => {
    if (historyIndex > 0) { historyIndex--; restoreHistory(); }
  });
  $("redoBtn").addEventListener("click", () => {
    if (historyIndex < history.length - 1) { historyIndex++; restoreHistory(); }
  });
  $("resetBtn").addEventListener("click", () => {
    const fresh = defaultState();
    Object.assign(state, fresh);
    syncControls();
    pushHistory(); render();
    setStatus("Reset to the Night Drive default.");
  });
  $("exportAllBtn").addEventListener("click", () => exportAllSizes());

  // Drag on the preview: click selects a panel, drag pans its photo.
  let dragging = false;
  let lastX = 0, lastY = 0;
  const panelAt = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * canvas.width;
    const y = ((clientY - r.top) / r.height) * canvas.height;
    const panels = layoutPanels(state.layout, canvas.width, canvas.height);
    const idx = panels.findIndex((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
    return idx >= 0 ? idx : 0;
  };
  canvas.addEventListener("pointerdown", (e) => {
    state.selectedPanel = panelAt(e.clientX, e.clientY);
    syncCropControls();
    rebuildPhotoSelect();
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const crop = cropOf();
    const r = canvas.getBoundingClientRect();
    crop.panX = Math.max(-100, Math.min(100, crop.panX + ((e.clientX - lastX) / r.width) * 160));
    crop.panY = Math.max(-100, Math.min(100, crop.panY + ((e.clientY - lastY) / r.height) * 160));
    lastX = e.clientX; lastY = e.clientY;
    syncCropControls();
    render();
  });
  canvas.addEventListener("pointerup", () => { if (dragging) { dragging = false; pushHistory(); } });

  // Drag-and-drop photos anywhere on the page.
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });
}

function syncCropControls() {
  const crop = state.crops[state.selectedPanel];
  $("zoomSlider").value = String(crop.zoom);
  $("panXSlider").value = String(crop.panX);
  $("panYSlider").value = String(crop.panY);
}

function syncControls() {
  $("titleInput").value = state.title;
  $("subtitleInput").value = state.subtitle;
  $("badgeInput").value = state.badge;
  $("heatSlider").value = String(state.heat);
  $("heatLabel").textContent = "★".repeat(state.heat) + "☆".repeat(5 - state.heat);
  $("gradeSlider").value = String(state.gradeStrength);
  $("onePhotoAll").checked = state.onePhotoAll;
  $("grainCheck").checked = state.effects.grain;
  $("vignetteCheck").checked = state.effects.vignette;
  $("halftoneCheck").checked = state.effects.halftone;
  $("bordersCheck").checked = state.effects.borders;
  document.querySelectorAll(".layout-btn").forEach((b) => b.classList.toggle("active", b.dataset.layout === state.layout));
  document.querySelectorAll(".grade-btn").forEach((b) => b.classList.toggle("active", b.dataset.grade === state.grade));
  syncCropControls();
  rebuildPhotoSelect();
}

/** Export all four post sizes at once; returns the blobs. */
export async function exportAllSizes() {
  setStatus("Exporting all four sizes…");
  const links = { "1080x1080": $("dlSquare"), "1080x1350": $("dlPoster"), "1920x1080": $("dlWide"), "1080x1920": $("dlStory") };
  const out = {};
  for (const size of EXPORT_SIZES) {
    const blob = await exportCoverPng(state, photos, size);
    out[size.name] = blob;
    const link = links[size.name];
    if (link) {
      link.href = URL.createObjectURL(blob);
      link.textContent = `${size.name} ✓`;
    }
  }
  $("downloads").hidden = false;
  setStatus("Done — 1080×1080, 1080×1350, 1920×1080 and 1080×1920 story, all exported as PNG.");
  return out;
}

/** Screenshot scene: ?shot=cover draws the exported cover full-frame. */
function shotScene() {
  const shot = new URLSearchParams(location.search).get("shot");
  if (shot === "cover") {
    document.querySelector(".topbar").style.display = "none";
    document.querySelector(".editor").style.display = "none";
    document.querySelector(".foot").style.display = "none";
    document.querySelector(".size-row").style.display = "none";
    document.querySelector("#status").style.display = "none";
    document.querySelector(".studio").style.display = "block";
    document.querySelector(".preview-pane").style.width = "100%";
    document.querySelector(".preview-tag").style.display = "none";
    canvas.width = 1920;
    canvas.height = 1080;
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    render();
  }
}

// Test hook for the Playwright practice run.
window.__nightDrive = { state, photos, exportAllSizes, render, exportSize: () => exportSize };

loadSamplePhotos()
  .then(() => {
    bindControls();
    syncControls();
    pushHistory();
    render();
    shotScene();
    setStatus("Sample photos loaded — pick a layout, a grade, edit the caption, then Export all sizes.");
  })
  .catch((err) => setStatus(`Sample photos failed to load: ${err.message}`));
