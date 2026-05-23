// -- Viewport: pan, zoom, canvas coordinate helpers

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left  - state.panX) / state.zoom,
    y: (event.clientY - rect.top   - state.panY) / state.zoom
  };
}

function applyViewport() {
  const zoom = clampZoom(state.zoom);
  state.zoom = zoom;
  canvas.style.setProperty("--zoom",  zoom);
  canvas.style.setProperty("--pan-x", state.panX);
  canvas.style.setProperty("--pan-y", state.panY);
  canvas.parentElement.style.setProperty("--grid-size", (28 * zoom) + "px");
  canvas.parentElement.style.backgroundPosition = `${state.panX}px ${state.panY}px`;
  groupLayer.style.width  = (100 / zoom) + "%";
  groupLayer.style.height = (100 / zoom) + "%";
  linkLayer.style.width   = (100 / zoom) + "%";
  linkLayer.style.height  = (100 / zoom) + "%";
  nodeLayer.style.width   = (100 / zoom) + "%";
  nodeLayer.style.height  = (100 / zoom) + "%";
  portLayer.style.width   = (100 / zoom) + "%";
  portLayer.style.height  = (100 / zoom) + "%";
  zoomValue.textContent   = Math.round(zoom * 100) + "%";
}

function setZoom(nextZoom) {
  state.zoom = clampZoom(nextZoom);
  applyViewport();
  persist();
}

function setZoomAt(nextZoom, screenX, screenY) {
  const rect   = canvas.getBoundingClientRect();
  const before = canvasPoint({ clientX: screenX, clientY: screenY });
  state.zoom   = clampZoom(nextZoom);
  state.panX   = screenX - rect.left - before.x * state.zoom;
  state.panY   = screenY - rect.top  - before.y * state.zoom;
  applyViewport();
  persist();
}
