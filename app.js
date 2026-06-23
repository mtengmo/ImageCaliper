'use strict';

// ── i18n ─────────────────────────────────────────────────────────────────────

const TRANSLATIONS = {
  en: {
    'calibrate':       'Calibrate',
    'measure':         'Measure',
    'drop-image':      'Drop an image here',
    'or':              'or',
    'choose-file':     'Choose File',
    'paste-url':       'or paste a URL',
    'enter-to-load':   'Press Enter to load',
    'load-to-begin':   'Load an image to begin',
    'choose-image':    'Choose Image',
    'measurements':    'Measurements',
    'clear-all':       'Clear All',
    'new-image':       'New Image',
    'kbd-hint':        '<strong>Esc</strong> — cancel line &nbsp; <strong>Del</strong> — remove last',
    'privacy':         '100% local — your images never leave the browser',
    'dialog-title':    'Set Calibration Scale',
    'dialog-desc':     'The line you drew is <strong><span id="dialog-pixel-length">0</span> px</strong> long in the image. Enter its real-world length to set the scale.',
    'real-length':     'Real-world length',
    'unit':            'Unit',
    'cancel':          'Cancel',
    'set-scale':       'Set Scale',
    'not-calibrated':  'Not calibrated',
    'scale-label':     'SCALE',
    'hint-cal-new':    'Click and drag to draw a calibration reference line',
    'hint-cal-exists': 'Draw a new calibration line to update the scale  |  Drag endpoints to fine-tune',
    'hint-meas-empty': 'Click and drag to draw a measurement line  |  Drag endpoints to adjust',
    'hint-drawing':    'Click to place the end point  |  Esc to cancel',
    'hint-dragging':   'Drag to reposition endpoint  |  Esc to cancel',
    'hint-meas-count': (n) => `${n} measurement${n > 1 ? 's' : ''}  |  Drag endpoints to adjust`,
    'error-url':       'Could not load image. The URL may be broken or the server may block direct linking.',
    'error-file':      'Could not load image.',
  },
  sv: {
    'calibrate':       'Kalibrera',
    'measure':         'Mät',
    'drop-image':      'Släpp en bild här',
    'or':              'eller',
    'choose-file':     'Välj fil',
    'paste-url':       'eller klistra in en URL',
    'enter-to-load':   'Tryck Enter för att ladda',
    'load-to-begin':   'Ladda en bild för att börja',
    'choose-image':    'Välj bild',
    'measurements':    'Mätningar',
    'clear-all':       'Rensa allt',
    'new-image':       'Ny bild',
    'kbd-hint':        '<strong>Esc</strong> — avbryt linje &nbsp; <strong>Del</strong> — ta bort sista',
    'privacy':         '100% lokalt — dina bilder lämnar aldrig webbläsaren',
    'dialog-title':    'Ange kalibreringsskala',
    'dialog-desc':     'Linjen du ritade är <strong><span id="dialog-pixel-length">0</span> px</strong> lång i bilden. Ange dess verkliga längd för att ställa in skalan.',
    'real-length':     'Verklig längd',
    'unit':            'Enhet',
    'cancel':          'Avbryt',
    'set-scale':       'Ange skala',
    'not-calibrated':  'Ej kalibrerad',
    'scale-label':     'SKALA',
    'hint-cal-new':    'Klicka och dra för att rita en kalibreringslinje',
    'hint-cal-exists': 'Rita en ny kalibreringslinje för att uppdatera skalan  |  Dra ändpunkter för finjustering',
    'hint-meas-empty': 'Klicka och dra för att rita en mätlinje  |  Dra ändpunkter för att justera',
    'hint-drawing':    'Klicka för att placera slutpunkten  |  Esc för att avbryta',
    'hint-dragging':   'Dra för att flytta ändpunkten  |  Esc för att avbryta',
    'hint-meas-count': (n) => `${n} mätning${n > 1 ? 'ar' : ''}  |  Dra ändpunkter för att justera`,
    'error-url':       'Kunde inte ladda bilden. URL:en kan vara felaktig eller servern kan blockera direktlänkar.',
    'error-file':      'Kunde inte ladda bilden.',
  },
};

const lang = (navigator.language || 'en').toLowerCase().startsWith('sv') ? 'sv' : 'en';

function t (key) {
  const val = (TRANSLATIONS[lang] || TRANSLATIONS.en)[key] ?? TRANSLATIONS.en[key] ?? key;
  return typeof val === 'function' ? val : val;
}

function tf (key, ...args) {
  const val = (TRANSLATIONS[lang] || TRANSLATIONS.en)[key] ?? TRANSLATIONS.en[key] ?? key;
  return typeof val === 'function' ? val(...args) : val;
}

function applyTranslations () {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
}

// ── State ────────────────────────────────────────────────────────────────────

const state = {
  // Image
  image: null,
  imageUrl: null,
  imageNaturalW: 0,
  imageNaturalH: 0,

  // Canvas geometry (recalculated on resize)
  displayW: 0,
  displayH: 0,
  scaleX: 1,
  scaleY: 1,
  dpr: 1,

  // Calibration
  calibrationLine: null,     // { p1, p2 } in image coords
  pixelsPerUnit: 0,
  unit: 'mm',
  calibrationRealValue: 0,   // stored so endpoint drag can recalculate scale

  // Measurements
  measurements: [],
  nextId: 1,

  // Interaction
  mode: 'calibrate',         // 'calibrate' | 'measure'
  drawState: 'idle',         // 'idle' | 'drawing' | 'dragging-endpoint'
  currentLine: null,         // { p1, p2 } in image coords (live during draw)
  pendingPixelLength: 0,     // pixel length stored while dialog is open
  dragTarget: null,          // { type: 'calibration'|'measurement', id, endpoint: 'p1'|'p2' }
  dragOriginalPt: null,      // saved endpoint position for Escape cancellation
  hoveredMeasurementId: null,
};

// ── DOM refs ─────────────────────────────────────────────────────────────────

let canvas, ctx;

function $ (id) { return document.getElementById(id); }

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

function init () {
  applyTranslations();
  canvas = $('main-canvas');
  ctx    = canvas.getContext('2d');

  $('file-input').addEventListener('change', e => {
    if (e.target.files[0]) handleFileSelect(e.target.files[0]);
  });

  const dropTarget = $('drop-target');
  dropTarget.addEventListener('click', e => {
    // The label already opens the picker via its `for` attribute — don't double-trigger
    if (e.target.closest('label') || e.target.tagName === 'INPUT') return;
    $('file-input').click();
  });
  dropTarget.addEventListener('dragover',  onDragOver);
  dropTarget.addEventListener('dragleave', onDragLeave);
  dropTarget.addEventListener('drop',      onDrop);

  $('canvas-area').addEventListener('dragover', onDragOver);
  $('canvas-area').addEventListener('drop',     onDrop);

  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);

  canvas.addEventListener('touchstart',  e => { e.preventDefault(); onMouseDown(e.touches[0]); },      { passive: false });
  canvas.addEventListener('touchmove',   e => { e.preventDefault(); onMouseMove(e.touches[0]); },      { passive: false });
  canvas.addEventListener('touchend',    e => { e.preventDefault(); onMouseUp(e.changedTouches[0]); }, { passive: false });

  document.addEventListener('keydown', onKeyDown);

  $('btn-calibrate').addEventListener('click',  () => setMode('calibrate'));
  $('btn-measure').addEventListener('click',    () => setMode('measure'));
  $('btn-clear').addEventListener('click',      clearAll);
  $('btn-new-image').addEventListener('click',  resetToNewImage);
  $('btn-edit-scale').addEventListener('click', openEditScaleDialog);

  $('image-url-input').addEventListener('keydown', e => { if (e.key === 'Enter') loadFromUrlInput(); });

  // Mobile bar
  $('mbtn-calibrate').addEventListener('click', () => { setMode('calibrate'); closeDrawer(); });
  $('mbtn-measure').addEventListener('click',   () => { setMode('measure');   closeDrawer(); });
  $('btn-drawer-toggle').addEventListener('click', toggleDrawer);
  $('drawer-overlay').addEventListener('click',   closeDrawer);

  $('cal-confirm').addEventListener('click', onCalibrationConfirm);
  $('cal-cancel').addEventListener('click',  onCalibrationCancel);
  $('calibration-dialog').addEventListener('cancel', onCalibrationCancel);

  $('results-list').addEventListener('click', e => {
    const btn = e.target.closest('.measurement-delete');
    if (btn) deleteMeasurement(Number(btn.dataset.id));
  });
  $('results-list').addEventListener('mouseover', e => {
    const row = e.target.closest('.measurement-row');
    if (row) { state.hoveredMeasurementId = Number(row.dataset.id); render(); }
  });
  $('results-list').addEventListener('mouseout', e => {
    const row = e.target.closest('.measurement-row');
    if (row) { state.hoveredMeasurementId = null; render(); }
  });

  const ro = new ResizeObserver(debounce(() => {
    if (state.image) { fitImageToCanvas(); render(); }
  }, 100));
  ro.observe($('canvas-area'));
}

// ── Image handling ────────────────────────────────────────────────────────────

function handleFileSelect (file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  loadImage(URL.createObjectURL(file));
}

function loadFromUrlInput () {
  const url = $('image-url-input').value.trim();
  if (!url) return;
  setUrlError('');
  loadImageFromUrl(url);
}

function loadImageFromUrl (url) {
  const img = new Image();
  img.onload = () => {
    setUrlError('');
    $('image-url-input').value = '';
    if (state.imageUrl && state.imageUrl.startsWith('blob:')) URL.revokeObjectURL(state.imageUrl);
    state.imageUrl = url;
    onImageLoaded(img);
  };
  img.onerror = () => setUrlError(t('error-url'));
  img.src = url;
}

function setUrlError (msg) {
  const el = $('url-error');
  el.textContent = msg;
  el.hidden = !msg;
}

function loadImage (src) {
  const img = new Image();
  img.onload = () => {
    if (state.imageUrl && state.imageUrl.startsWith('blob:')) URL.revokeObjectURL(state.imageUrl);
    state.imageUrl = src;
    onImageLoaded(img);
  };
  img.onerror = () => alert(t('error-file'));
  img.src = src;
}

function onImageLoaded (img) {
  state.image         = img;
  state.imageNaturalW = img.naturalWidth;
  state.imageNaturalH = img.naturalHeight;

  $('upload-zone').hidden        = true;
  $('controls').hidden           = false;
  $('canvas-placeholder').hidden = true;
  $('canvas-wrapper').hidden     = false;
  $('mobile-bar').hidden         = false;

  fitImageToCanvas();
  render();
  setStatusBar(modeHint());
}

function fitImageToCanvas () {
  const area  = $('canvas-area');
  const scale = Math.min(
    (area.clientWidth  - 32) / state.imageNaturalW,
    (area.clientHeight - 32) / state.imageNaturalH,
    1
  );

  state.displayW = Math.round(state.imageNaturalW * scale);
  state.displayH = Math.round(state.imageNaturalH * scale);
  state.scaleX   = scale;
  state.scaleY   = scale;
  state.dpr      = window.devicePixelRatio || 1;

  canvas.style.width  = state.displayW + 'px';
  canvas.style.height = state.displayH + 'px';
  canvas.width        = Math.round(state.displayW  * state.dpr);
  canvas.height       = Math.round(state.displayH * state.dpr);
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────

function onDragOver (e) {
  e.preventDefault();
  e.stopPropagation();
  $('drop-target').classList.add('drag-over');
}

function onDragLeave (e) {
  e.preventDefault();
  $('drop-target').classList.remove('drag-over');
}

function onDrop (e) {
  e.preventDefault();
  e.stopPropagation();
  $('drop-target').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
}

// ── Coordinate mapping ────────────────────────────────────────────────────────

function cssToImage (cssX, cssY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (cssX - rect.left) / state.scaleX,
    y: (cssY - rect.top)  / state.scaleY,
  };
}

function imageToCanvas (ix, iy) {
  return {
    x: ix * state.scaleX * state.dpr,
    y: iy * state.scaleY * state.dpr,
  };
}

// ── Endpoint hit detection ────────────────────────────────────────────────────

// Hit radius in display (CSS) pixels
const HIT_RADIUS = 10;

function findNearbyEndpoint (imgPt) {
  const threshold = HIT_RADIUS / state.scaleX;

  if (state.calibrationLine) {
    for (const ep of ['p1', 'p2']) {
      if (lineLengthPx(imgPt, state.calibrationLine[ep]) <= threshold) {
        return { type: 'calibration', id: null, endpoint: ep };
      }
    }
  }

  for (const m of state.measurements) {
    for (const ep of ['p1', 'p2']) {
      if (lineLengthPx(imgPt, m[ep]) <= threshold) {
        return { type: 'measurement', id: m.id, endpoint: ep };
      }
    }
  }

  return null;
}

// ── Interaction handlers ──────────────────────────────────────────────────────

function onMouseDown (e) {
  if (!state.image) return;
  if (state.drawState !== 'idle') return;
  const pt = cssToImage(e.clientX, e.clientY);
  const ep = findNearbyEndpoint(pt);
  if (ep) {
    startEndpointDrag(ep);
  } else {
    startLine(pt);
  }
}

function onMouseMove (e) {
  if (!state.image) return;
  const pt = cssToImage(e.clientX, e.clientY);

  if (state.drawState === 'drawing') {
    updateLine(pt);
  } else if (state.drawState === 'dragging-endpoint') {
    updateEndpointDrag(pt);
  } else {
    // Update cursor to hint at draggable endpoints
    const ep = findNearbyEndpoint(pt);
    canvas.style.cursor = ep ? 'grab' : 'crosshair';
  }
}

function onMouseUp (e) {
  if (!state.image) return;
  const pt = cssToImage(e.clientX, e.clientY);

  if (state.drawState === 'drawing') {
    finalizeLine(pt);
  } else if (state.drawState === 'dragging-endpoint') {
    finalizeEndpointDrag(pt);
  }
}

function onMouseLeave () {
  if (state.drawState === 'idle') canvas.style.cursor = 'crosshair';
}

function onKeyDown (e) {
  if (e.key === 'Escape') {
    if (state.drawState === 'drawing') {
      state.drawState   = 'idle';
      state.currentLine = null;
      canvas.style.cursor = 'crosshair';
      render();
      setStatusBar(modeHint());
    } else if (state.drawState === 'dragging-endpoint') {
      // Restore saved position
      const { type, id, endpoint } = state.dragTarget;
      const line = type === 'calibration'
        ? state.calibrationLine
        : state.measurements.find(m => m.id === id);
      if (line) line[endpoint] = state.dragOriginalPt;
      state.drawState  = 'idle';
      state.dragTarget = null;
      canvas.style.cursor = 'crosshair';
      render();
      setStatusBar(modeHint());
    }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement === document.body || document.activeElement === canvas) {
      const last = state.measurements[state.measurements.length - 1];
      if (last) deleteMeasurement(last.id);
    }
  }
}

// ── Drawing state machine ─────────────────────────────────────────────────────

function startLine (imgPt) {
  state.drawState   = 'drawing';
  state.currentLine = { p1: imgPt, p2: imgPt };
  setStatusBar(t('hint-drawing'));
}

function updateLine (imgPt) {
  state.currentLine.p2 = imgPt;
  render();
}

function finalizeLine (imgPt) {
  state.currentLine.p2 = imgPt;
  const lenPx = lineLengthPx(state.currentLine.p1, state.currentLine.p2);

  if (lenPx * state.scaleX < 5) {
    state.drawState   = 'idle';
    state.currentLine = null;
    render();
    return;
  }

  state.drawState = 'idle';

  if (state.mode === 'calibrate') {
    state.pendingPixelLength = lenPx;
    openCalibrationDialog(lenPx, '');
  } else {
    commitMeasurement(state.currentLine);
    state.currentLine = null;
    render();
    setStatusBar(modeHint());
  }
}

// ── Endpoint dragging ─────────────────────────────────────────────────────────

function startEndpointDrag (target) {
  state.drawState  = 'dragging-endpoint';
  state.dragTarget = target;

  const line = target.type === 'calibration'
    ? state.calibrationLine
    : state.measurements.find(m => m.id === target.id);
  state.dragOriginalPt = { ...line[target.endpoint] };

  canvas.style.cursor = 'grabbing';
  setStatusBar(t('hint-dragging'));
}

function updateEndpointDrag (imgPt) {
  const { type, id, endpoint } = state.dragTarget;
  if (type === 'calibration') {
    state.calibrationLine[endpoint] = imgPt;
  } else {
    const m = state.measurements.find(m => m.id === id);
    if (m) m[endpoint] = imgPt;
  }
  render();
}

function finalizeEndpointDrag (imgPt) {
  updateEndpointDrag(imgPt);

  const { type, id } = state.dragTarget;

  if (type === 'calibration' && state.calibrationRealValue > 0) {
    // Recalculate scale with new line length, keeping same real-world value
    const newLenPx = lineLengthPx(state.calibrationLine.p1, state.calibrationLine.p2);
    if (newLenPx > 0) {
      state.pixelsPerUnit = newLenPx / state.calibrationRealValue;
      for (const m of state.measurements) {
        m.lengthReal = m.lengthPx / state.pixelsPerUnit;
        m.unit       = state.unit;
      }
      updateCalibrationStatus();
      updateSidebar();
    }
  } else if (type === 'measurement') {
    const m = state.measurements.find(m => m.id === id);
    if (m) {
      m.lengthPx   = lineLengthPx(m.p1, m.p2);
      m.lengthReal = state.pixelsPerUnit > 0 ? m.lengthPx / state.pixelsPerUnit : m.lengthPx;
      updateSidebar();
    }
  }

  state.drawState  = 'idle';
  state.dragTarget = null;
  canvas.style.cursor = 'crosshair';
  render();
  setStatusBar(modeHint());
}

// ── Calibration ───────────────────────────────────────────────────────────────

function openCalibrationDialog (pixelLength, prefillValue) {
  $('dialog-pixel-length').textContent = Math.round(pixelLength);
  $('cal-value').value = prefillValue !== undefined ? prefillValue : '';
  if (state.unit) $('cal-unit').value = state.unit;
  $('calibration-dialog').showModal();
  setTimeout(() => $('cal-value').focus(), 50);
}

function openEditScaleDialog () {
  if (!state.calibrationLine || state.pixelsPerUnit === 0) return;
  const lenPx = lineLengthPx(state.calibrationLine.p1, state.calibrationLine.p2);
  state.pendingPixelLength = lenPx;
  state.currentLine        = null; // signal: use existing calibrationLine
  openCalibrationDialog(lenPx, state.calibrationRealValue || '');
}

function onCalibrationConfirm () {
  const val  = parseFloat($('cal-value').value);
  const unit = $('cal-unit').value;
  if (!val || val <= 0) { $('cal-value').focus(); return; }

  // Use the line that was just drawn, or (when editing) the existing calibration line
  const line = state.currentLine || state.calibrationLine;
  setCalibration(state.pendingPixelLength, val, unit, line);

  $('calibration-dialog').close();
  state.currentLine = null;
  if (state.mode === 'calibrate') setMode('measure');
  render();
  setStatusBar(modeHint());
}

function onCalibrationCancel () {
  $('calibration-dialog').close();
  state.currentLine        = null;
  state.drawState          = 'idle';
  state.pendingPixelLength = 0;
  render();
  setStatusBar(modeHint());
}

function setCalibration (pixelLength, realValue, unit, line) {
  state.pixelsPerUnit        = pixelLength / realValue;
  state.calibrationRealValue = realValue;
  state.unit                 = unit;
  state.calibrationLine      = { p1: { ...line.p1 }, p2: { ...line.p2 } };

  for (const m of state.measurements) {
    m.lengthReal = m.lengthPx / state.pixelsPerUnit;
    m.unit       = state.unit;
  }
  updateCalibrationStatus();
  updateSidebar();
}

// ── Measurements ──────────────────────────────────────────────────────────────

function commitMeasurement (line) {
  const lenPx   = lineLengthPx(line.p1, line.p2);
  const lenReal = state.pixelsPerUnit > 0 ? lenPx / state.pixelsPerUnit : lenPx;
  const unit    = state.pixelsPerUnit > 0 ? state.unit : 'px';
  state.measurements.push({
    id: state.nextId++,
    p1: { ...line.p1 },
    p2: { ...line.p2 },
    lengthPx:   lenPx,
    lengthReal: lenReal,
    unit,
  });
  updateSidebar();
}

function deleteMeasurement (id) {
  state.measurements = state.measurements.filter(m => m.id !== id);
  if (state.hoveredMeasurementId === id) state.hoveredMeasurementId = null;
  updateSidebar();
  render();
}

function clearAll () {
  state.measurements         = [];
  state.calibrationLine      = null;
  state.pixelsPerUnit        = 0;
  state.calibrationRealValue = 0;
  state.currentLine          = null;
  state.drawState            = 'idle';
  state.dragTarget           = null;
  state.hoveredMeasurementId = null;
  canvas.style.cursor = 'crosshair';
  setMode('calibrate');
  updateCalibrationStatus();
  updateSidebar();
  render();
  setStatusBar(modeHint());
}

function resetToNewImage () {
  clearAll();
  if (state.imageUrl) { URL.revokeObjectURL(state.imageUrl); state.imageUrl = null; }
  state.image         = null;
  state.imageNaturalW = 0;
  state.imageNaturalH = 0;
  $('upload-zone').hidden        = false;
  $('controls').hidden           = true;
  $('canvas-placeholder').hidden = false;
  $('canvas-wrapper').hidden     = true;
  $('mobile-bar').hidden         = true;
  closeDrawer();
  $('file-input').value        = '';
  $('image-url-input').value   = '';
  setUrlError('');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function render () {
  if (!state.image) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);

  if (state.calibrationLine) {
    const isDraggingCal = state.dragTarget?.type === 'calibration';
    const calLenPx = lineLengthPx(state.calibrationLine.p1, state.calibrationLine.p2);
    const calLabel = state.calibrationRealValue > 0
      ? `${t('scale-label')}: ${formatLength(state.calibrationRealValue, state.unit)}  (${Math.round(calLenPx)} px)`
      : t('scale-label');
    drawLine(state.calibrationLine, {
      color:     '#ef4444',
      lineWidth: 2,
      dotRadius: 5,
      label:     calLabel,
      dashed:    false,
      dragEp:    isDraggingCal ? state.dragTarget.endpoint : null,
    });
  }

  state.measurements.forEach((m, i) => {
    const hovered    = m.id === state.hoveredMeasurementId;
    const isDragging = state.dragTarget?.type === 'measurement' && state.dragTarget.id === m.id;
    drawLine(m, {
      color:     hovered ? '#86efac' : '#22c55e',
      lineWidth: 2,
      dotRadius: 4,
      label:     `#${i + 1}: ${formatLength(m.lengthReal, m.unit)}`,
      dashed:    false,
      dragEp:    isDragging ? state.dragTarget.endpoint : null,
    });
  });

  if (state.drawState === 'drawing' && state.currentLine) {
    const isCal = state.mode === 'calibrate';
    drawLine(state.currentLine, {
      color:     isCal ? '#fca5a5' : '#86efac',
      lineWidth: 2,
      dotRadius: 4,
      label:     getLiveLabel(),
      dashed:    true,
      dragEp:    null,
    });
  }
}

function drawLine (line, opts) {
  const c1 = imageToCanvas(line.p1.x, line.p1.y);
  const c2 = imageToCanvas(line.p2.x, line.p2.y);

  ctx.save();

  ctx.beginPath();
  ctx.moveTo(c1.x, c1.y);
  ctx.lineTo(c2.x, c2.y);
  ctx.strokeStyle = opts.color;
  ctx.lineWidth   = opts.lineWidth * state.dpr;
  if (opts.dashed) ctx.setLineDash([6 * state.dpr, 4 * state.dpr]);
  ctx.stroke();
  ctx.setLineDash([]);

  const pts = { p1: c1, p2: c2 };
  for (const [key, pt] of Object.entries(pts)) {
    const isDragTarget = opts.dragEp === key;
    const r = isDragTarget ? (opts.dotRadius + 3) * state.dpr : opts.dotRadius * state.dpr;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isDragTarget ? '#ffffff' : opts.color;
    ctx.fill();
    if (isDragTarget) {
      ctx.strokeStyle = opts.color;
      ctx.lineWidth   = 2 * state.dpr;
      ctx.stroke();
    }
  }

  if (opts.label) drawLabel(c1, c2, opts.label, opts.color);

  ctx.restore();
}

function drawLabel (c1, c2, text, lineColor) {
  const mx    = (c1.x + c2.x) / 2;
  const my    = (c1.y + c2.y) / 2;
  const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);

  const fontSize = Math.round(12 * state.dpr);
  ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
  const textW = ctx.measureText(text).width;
  const textH = fontSize;
  const pad   = 4 * state.dpr;

  ctx.save();
  ctx.translate(mx, my);
  const displayAngle = (angle > Math.PI / 2 || angle < -Math.PI / 2) ? angle + Math.PI : angle;
  ctx.rotate(displayAngle);

  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  roundRect(ctx, -textW / 2 - pad, -textH / 2 - pad * 0.8, textW + pad * 2, textH + pad * 1.6, 4 * state.dpr);
  ctx.fill();

  ctx.fillStyle    = lineColor || '#ffffff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1 * state.dpr);
  ctx.restore();
}

function roundRect (ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getLiveLabel () {
  if (!state.currentLine) return '';
  const lenPx = lineLengthPx(state.currentLine.p1, state.currentLine.p2);
  if (state.pixelsPerUnit > 0) return formatLength(lenPx / state.pixelsPerUnit, state.unit);
  return Math.round(lenPx) + ' px';
}

// ── DOM updates ───────────────────────────────────────────────────────────────

// ── Mobile drawer ─────────────────────────────────────────────────────────────

function isMobile () {
  return window.matchMedia('(max-width: 700px)').matches;
}

function toggleDrawer () {
  const open = $('sidebar').classList.contains('drawer-open');
  open ? closeDrawer() : openDrawer();
}

function openDrawer () {
  $('sidebar').classList.add('drawer-open');
  $('drawer-overlay').classList.add('visible');
  $('drawer-overlay').hidden = false;
}

function closeDrawer () {
  $('sidebar').classList.remove('drawer-open');
  $('drawer-overlay').classList.remove('visible');
  setTimeout(() => { $('drawer-overlay').hidden = true; }, 300);
}

function setMode (mode) {
  state.mode = mode;
  $('btn-calibrate').classList.toggle('active',  mode === 'calibrate');
  $('btn-measure').classList.toggle('active',    mode === 'measure');
  $('mbtn-calibrate').classList.toggle('active', mode === 'calibrate');
  $('mbtn-measure').classList.toggle('active',   mode === 'measure');
  setStatusBar(modeHint());
}

function updateCalibrationStatus () {
  const calibrated  = state.pixelsPerUnit > 0;
  const dotClass    = 'dot ' + (calibrated ? 'calibrated' : 'uncalibrated');
  $('cal-dot').className        = dotClass;
  $('mobile-cal-dot').className = dotClass;
  $('cal-text').textContent     = calibrated ? formatScale() : t('not-calibrated');
  $('btn-edit-scale').hidden    = !calibrated;
}

function formatScale () {
  const ppu = state.pixelsPerUnit;
  if (ppu >= 1) return `${ppu.toFixed(1)} px/${state.unit}`;
  return `1 px = ${(1 / ppu).toFixed(2)} ${state.unit}`;
}

function updateSidebar () {
  const list   = $('results-list');
  const header = $('results-header');
  header.hidden  = state.measurements.length === 0;
  list.innerHTML = '';
  state.measurements.forEach((m, i) => {
    const row = document.createElement('div');
    row.className  = 'measurement-row';
    row.dataset.id = m.id;
    row.innerHTML  = `
      <span class="measurement-index">#${i + 1}</span>
      <span class="measurement-value">${formatLength(m.lengthReal, m.unit)}</span>
      <button class="measurement-delete" data-id="${m.id}" title="Delete">✕</button>
    `;
    list.appendChild(row);
  });
  updateCalibrationStatus();
}

function setStatusBar (text) {
  $('status-bar').textContent = text;
}

function modeHint () {
  if (state.mode === 'calibrate') {
    return state.calibrationLine ? t('hint-cal-exists') : t('hint-cal-new');
  }
  return state.measurements.length === 0
    ? t('hint-meas-empty')
    : tf('hint-meas-count', state.measurements.length);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function lineLengthPx (p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function formatLength (value, unit) {
  if (unit === 'px') return Math.round(value) + ' px';
  return parseFloat(value.toFixed(2)) + ' ' + unit;
}

function debounce (fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
