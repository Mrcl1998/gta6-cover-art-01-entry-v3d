// Night Drive Cover Studio — cover renderer (canvas 2D, no network).
// Draws a multi-panel GTA-style poster: photos per panel, a gradient-map
// colour grade, a halftone title block in Anton + Pacifico, a badge ribbon
// with a star heat meter, film grain, vignette and inked panel borders.

export const LAYOUTS = {
  nine: { label: "Nine-panel grid", panels: 9 },
  hero: { label: "Hero + three", panels: 4 },
  fullbleed: { label: "Full-bleed", panels: 1 },
  stack: { label: "Tilted snapshot stack", panels: 4 },
};

export const GRADES = {
  sunset: { label: "Vice Sunset", stops: [[0, "#1a0b2e"], [0.35, "#7b1e5b"], [0.62, "#ff2e63"], [0.82, "#ff7a1a"], [1, "#ffe9a3"]] },
  neon: { label: "Neon Night", stops: [[0, "#04041a"], [0.3, "#120a4d"], [0.55, "#c81d7a"], [0.78, "#19e3d6"], [1, "#eafffb"]] },
  pink: { label: "Pink Haze", stops: [[0, "#2b0a24"], [0.35, "#8c1d5e"], [0.62, "#ff5ea8"], [0.85, "#ffb3d9"], [1, "#fff0f6"]] },
  teal: { label: "Teal Haze", stops: [[0, "#02141a"], [0.35, "#0a4d57"], [0.62, "#19b8a6"], [0.85, "#8ff5e6"], [1, "#f2fffc"]] },
  golden: { label: "Golden Hour", stops: [[0, "#241105"], [0.35, "#7a3c0d"], [0.62, "#e07b1a"], [0.85, "#ffc93c"], [1, "#fff7d6"]] },
  mono: { label: "Mono Noir", stops: [[0, "#000000"], [0.4, "#2e2e2e"], [0.7, "#8a8a8a"], [1, "#ffffff"]] },
};

export const EXPORT_SIZES = [
  { name: "1080x1080", w: 1080, h: 1080 },
  { name: "1080x1350", w: 1080, h: 1350 },
  { name: "1920x1080", w: 1920, h: 1080 },
  { name: "1080x1920", w: 1080, h: 1920 },
];

/** Panel rectangles for a layout, in fractions of the cover (x, y, w, h). */
export function layoutPanels(layout, W, H) {
  const titleH = layout === "fullbleed" ? 0.30 : 0.26;
  const artH = 1 - titleH;
  if (layout === "nine") {
    const out = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        out.push({ x: (c / 3) * W, y: (r / 3) * H * artH, w: W / 3, h: (H * artH) / 3 });
      }
    }
    return out;
  }
  if (layout === "hero") {
    return [
      { x: 0, y: 0, w: W * 0.62, h: H * artH },
      { x: W * 0.62, y: 0, w: W * 0.38, h: (H * artH) / 3 },
      { x: W * 0.62, y: (H * artH) / 3, w: W * 0.38, h: (H * artH) / 3 },
      { x: W * 0.62, y: (2 * H * artH) / 3, w: W * 0.38, h: (H * artH) / 3 },
    ];
  }
  if (layout === "fullbleed") {
    return [{ x: 0, y: 0, w: W, h: H * artH }];
  }
  // Tilted snapshot stack: four overlapping polaroid-style frames.
  const pw = W * 0.46, ph = H * artH * 0.52;
  return [
    { x: W * 0.04, y: H * 0.02, w: pw, h: ph, tilt: -4 },
    { x: W * 0.50, y: H * 0.04, w: pw, h: ph, tilt: 3 },
    { x: W * 0.06, y: H * artH * 0.44, w: pw, h: ph, tilt: 2.5 },
    { x: W * 0.50, y: H * artH * 0.46, w: pw, h: ph, tilt: -3 },
  ];
}

/** Draw one photo into a panel rect with cover-fit, zoom and pan. */
export function drawPhotoPanel(ctx, img, rect, crop) {
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = (crop.zoom || 120) / 100;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale, dh = ih * scale;
  const dx = rect.x + (rect.w - dw) / 2 + ((crop.panX || 0) / 100) * rect.w * 0.4;
  const dy = rect.y + (rect.h - dh) / 2 + ((crop.panY || 0) / 100) * rect.h * 0.4;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (rect.tilt) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((rect.tilt * Math.PI) / 180);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.restore();
}

/** Build a 256-entry gradient-map lookup from grade stops. */
export function gradeLookup(stops) {
  const lut = new Uint8Array(256 * 3);
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const pts = stops.map(([t, c]) => [t, hex(c)]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = pts[0], b = pts[pts.length - 1];
    for (let k = 0; k < pts.length - 1; k++) {
      if (t >= pts[k][0] && t <= pts[k + 1][0]) { a = pts[k]; b = pts[k + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    for (let ch = 0; ch < 3; ch++) lut[i * 3 + ch] = Math.round(a[1][ch] + (b[1][ch] - a[1][ch]) * f);
  }
  return lut;
}

/** Apply the gradient-map grade to a canvas region, blended by strength. */
export function applyGrade(ctx, x, y, w, h, gradeKey, strength) {
  if (strength <= 0) return;
  const grade = GRADES[gradeKey] || GRADES.sunset;
  const lut = gradeLookup(grade.stops);
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  const s = strength / 100;
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    const li = lum * 3;
    d[i] = Math.round(d[i] * (1 - s) + lut[li] * s);
    d[i + 1] = Math.round(d[i + 1] * (1 - s) + lut[li + 1] * s);
    d[i + 2] = Math.round(d[i + 2] * (1 - s) + lut[li + 2] * s);
  }
  ctx.putImageData(img, x, y);
}

/** Halftone dot field behind the title block. */
export function drawHalftone(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.fillStyle = color;
  const step = Math.max(10, w / 72);
  for (let gy = y + step / 2; gy < y + h; gy += step) {
    for (let gx = x + step / 2; gx < x + w; gx += step) {
      const f = 1 - (gy - y) / h;
      const r = step * 0.14 + step * 0.30 * f;
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Ribbon badge with star heat meter, drawn in the title block. The ribbon
 *  sits at the left edge and the stars at the right edge, clear of the
 *  centred title. */
export function drawBadgeRibbon(ctx, x, y, w, h, badgeText, heat, starX) {
  ctx.save();
  ctx.fillStyle = "#ff2e88";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - h * 0.5, y + h);
  ctx.lineTo(x + h * 0.5, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(h * 0.52)}px Anton, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText.toUpperCase(), x + w / 2, y + h / 2 + 1);
  ctx.restore();
  // Star heat meter, right-aligned to the given right edge so the last
  // star is never clipped by the canvas edge.
  const stars = "★★★★★".split("").map((_, i) => (i < heat ? "★" : "☆")).join("");
  ctx.save();
  ctx.fillStyle = "#ffc93c";
  ctx.font = `${Math.round(h * 0.55)}px sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(stars, starX, y + h / 2 + 1);
  ctx.restore();
}

/** The title block: halftone, big Anton title, neon Pacifico subtitle, badge. */
export function drawTitleBlock(ctx, W, H, state) {
  const titleH = (state.layout === "fullbleed" ? 0.30 : 0.26) * H;
  const y0 = H - titleH;
  const grad = ctx.createLinearGradient(0, y0, 0, H);
  grad.addColorStop(0, "#12081c");
  grad.addColorStop(1, "#2b0a33");
  ctx.fillStyle = grad;
  ctx.fillRect(0, y0, W, titleH);
  if (state.effects.halftone) {
    drawHalftone(ctx, 0, y0, W, titleH * 0.55, "rgba(255,46,136,0.35)");
  }
  // Sunset band above the title.
  const band = ctx.createLinearGradient(0, y0, W, y0);
  band.addColorStop(0, "#ff7a1a");
  band.addColorStop(0.5, "#ff2e88");
  band.addColorStop(1, "#19e3d6");
  ctx.fillStyle = band;
  ctx.fillRect(0, y0, W, Math.max(6, H * 0.006));

  const cx = W / 2;
  const titleSize = Math.min(W * 0.10, titleH * 0.42);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(titleSize)}px Anton, sans-serif`;
  ctx.shadowColor = "rgba(255,46,136,0.85)";
  ctx.shadowBlur = titleSize * 0.18;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(state.title.toUpperCase(), cx, y0 + titleH * 0.42);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,201,60,0.9)";
  ctx.lineWidth = Math.max(2, titleSize * 0.03);
  ctx.strokeText(state.title.toUpperCase(), cx, y0 + titleH * 0.42);
  // Neon script subtitle.
  ctx.font = `${Math.round(titleSize * 0.52)}px Pacifico, cursive`;
  ctx.fillStyle = "#19e3d6";
  ctx.shadowColor = "rgba(25,227,214,0.9)";
  ctx.shadowBlur = titleSize * 0.22;
  ctx.fillText(state.subtitle, cx, y0 + titleH * 0.76);
  ctx.restore();

  // Badge ribbon (left) + star heat meter (right) on their own top row,
  // above the title so nothing overlaps the lettering.
  const badgeW = Math.min(W * 0.22, 260);
  const badgeH = titleH * 0.16;
  drawBadgeRibbon(ctx, W * 0.03, y0 + titleH * 0.03, badgeW, badgeH, state.badge, state.heat, W * 0.94);
}

/** Inked panel borders + diagonal bands over the art area. */
export function drawInkedBorders(ctx, panels, W, H, state) {
  ctx.save();
  ctx.strokeStyle = "#0d0512";
  ctx.lineWidth = Math.max(4, W * 0.006);
  for (const p of panels) {
    ctx.save();
    if (p.tilt) {
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate((p.tilt * Math.PI) / 180);
      ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-p.w / 2, p.h / 2 - Math.max(10, H * 0.012), p.w, Math.max(10, H * 0.012));
    } else {
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Film grain + vignette over the whole cover. */
export function drawGrainVignette(ctx, W, H, state, seed) {
  if (state.effects.grain) {
    const g = ctx.createImageData(W, H);
    let s = seed || 12345;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < g.data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      g.data[i] = v; g.data[i + 1] = v; g.data[i + 2] = v; g.data[i + 3] = 14;
    }
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    off.getContext("2d").putImageData(g, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }
  if (state.effects.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(5,0,12,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Render the full cover onto a canvas of the given size. */
export function renderCover(canvas, state, photos) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#12081c";
  ctx.fillRect(0, 0, W, H);
  const panels = layoutPanels(state.layout, W, H);
  const artH = H * (state.layout === "fullbleed" ? 0.70 : 0.74);
  panels.forEach((p, i) => {
    const img = state.onePhotoAll
      ? photos[0]
      : photos[state.panelPhotos[i] ?? 0] || photos[0];
    drawPhotoPanel(ctx, img, p, state.crops[i] || { zoom: 120, panX: 0, panY: 0 });
  });
  applyGrade(ctx, 0, 0, W, Math.ceil(artH), state.grade, state.gradeStrength);
  if (state.effects.borders) drawInkedBorders(ctx, panels, W, H, state);
  drawTitleBlock(ctx, W, H, state);
  drawGrainVignette(ctx, W, H, state, 987654321);
  return canvas;
}

/** Render an export-size cover and return a PNG blob. */
export async function exportCoverPng(state, photos, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  renderCover(canvas, state, photos);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Default editor state. */
export function defaultState() {
  return {
    layout: "nine",
    grade: "sunset",
    gradeStrength: 72,
    title: "NIGHT DRIVE",
    subtitle: "Leonida after dark",
    badge: "VICE CITY",
    heat: 4,
    onePhotoAll: true,
    panelPhotos: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    crops: Array.from({ length: 9 }, () => ({ zoom: 120, panX: 0, panY: 0 })),
    selectedPanel: 0,
    effects: { grain: true, vignette: true, halftone: true, borders: true },
  };
}
