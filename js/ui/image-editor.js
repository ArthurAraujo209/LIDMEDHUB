const MAX_IMAGE_PIXELS = 20_000_000;
const MAX_IMAGE_DIMENSION = 2400;

export async function cropImage(file, { aspectRatio = null, title = "Recortar imagem" } = {}) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }

  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
    bitmap.close();
    throw new Error("A imagem excede o limite de resolução de 20 megapixels.");
  }

  const ratio = Math.min(2, Math.max(0.5, aspectRatio || bitmap.width / bitmap.height));
  const logicalWidth = Math.max(240, Math.min(720, window.innerWidth * 0.88, window.innerHeight * 0.52 * ratio));
  const logicalHeight = logicalWidth / ratio;
  const canvas = document.createElement("canvas");
  canvas.className = "image-editor-canvas";
  canvas.width = Math.round(logicalWidth * window.devicePixelRatio);
  canvas.height = Math.round(logicalHeight * window.devicePixelRatio);
  canvas.style.aspectRatio = String(ratio);

  const dialog = document.createElement("dialog");
  dialog.className = "image-editor-dialog";
  dialog.setAttribute("aria-labelledby", "image-editor-title");
  dialog.innerHTML = `
    <form method="dialog" class="image-editor-panel">
      <header class="image-editor-header">
        <div>
          <h2 id="image-editor-title"></h2>
          <p>Arraste para ajustar e use o controle para aproximar.</p>
        </div>
        <button class="image-editor-close" type="button" aria-label="Cancelar recorte">×</button>
      </header>
      <div class="image-editor-viewport"></div>
      <label class="image-editor-zoom">
        <span>Zoom</span>
        <input type="range" min="1" max="3" step="0.01" value="1" aria-label="Zoom da imagem">
      </label>
      <footer class="image-editor-actions">
        <button class="btn btn-secondary" type="button" data-cancel>Cancelar</button>
        <button class="btn btn-primary" type="button" data-confirm>Usar recorte</button>
      </footer>
    </form>
  `;
  dialog.querySelector("#image-editor-title").textContent = title;
  dialog.querySelector(".image-editor-viewport").appendChild(canvas);
  document.body.appendChild(dialog);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    dialog.remove();
    throw new Error("Não foi possível abrir o editor de imagem neste navegador.");
  }

  const zoomInput = dialog.querySelector('input[type="range"]');
  const scale = Math.max(logicalWidth / bitmap.width, logicalHeight / bitmap.height);
  let zoom = 1;
  let offsetX = (logicalWidth - bitmap.width * scale) / 2;
  let offsetY = (logicalHeight - bitmap.height * scale) / 2;
  let drag = null;
  let settled = false;

  function draw() {
    const ratio = window.devicePixelRatio || 1;
    const drawWidth = bitmap.width * scale * zoom;
    const drawHeight = bitmap.height * scale * zoom;
    offsetX = Math.min(0, Math.max(logicalWidth - drawWidth, offsetX));
    offsetY = Math.min(0, Math.max(logicalHeight - drawHeight, offsetY));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    ctx.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight);
  }

  function finish(result) {
    if (settled) return;
    settled = true;
    dialog.close();
    dialog.remove();
    bitmap.close();
    resolveResult(result);
  }

  let resolveResult;
  const resultPromise = new Promise((resolve) => {
    resolveResult = resolve;
  });

  dialog.querySelector(".image-editor-close").addEventListener("click", () => finish(null));
  dialog.querySelector("[data-cancel]").addEventListener("click", () => finish(null));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    finish(null);
  });
  dialog.querySelector("[data-confirm]").addEventListener("click", async () => {
    const sourceX = Math.max(0, Math.min(bitmap.width - logicalWidth / (scale * zoom), -offsetX / (scale * zoom)));
    const sourceY = Math.max(0, Math.min(bitmap.height - logicalHeight / (scale * zoom), -offsetY / (scale * zoom)));
    const sourceWidth = Math.min(bitmap.width - sourceX, logicalWidth / (scale * zoom));
    const sourceHeight = Math.min(bitmap.height - sourceY, logicalHeight / (scale * zoom));
    const outputScale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(sourceWidth * outputScale));
    output.height = Math.max(1, Math.round(sourceHeight * outputScale));
    const outputContext = output.getContext("2d");
    if (!outputContext) {
      finish(null);
      return;
    }

    outputContext.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      output.width,
      output.height
    );

    try {
      const blob = await new Promise((resolve, reject) => {
        output.toBlob(
          (imageBlob) => imageBlob ? resolve(imageBlob) : reject(new Error("Não foi possível gerar o recorte.")),
          "image/jpeg",
          0.9
        );
      });
      finish(blob);
    } catch (error) {
      finish(error);
    }
  });

  zoomInput.addEventListener("input", () => {
    const previousZoom = zoom;
    zoom = Number(zoomInput.value);
    const centerX = logicalWidth / 2;
    const centerY = logicalHeight / 2;
    offsetX = centerX - (centerX - offsetX) * (zoom / previousZoom);
    offsetY = centerY - (centerY - offsetY) * (zoom / previousZoom);
    draw();
  });

  canvas.addEventListener("pointerdown", (event) => {
    drag = { x: event.clientX, y: event.clientY, offsetX, offsetY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    offsetX = drag.offsetX + (event.clientX - drag.x) * (logicalWidth / rect.width);
    offsetY = drag.offsetY + (event.clientY - drag.y) * (logicalHeight / rect.height);
    draw();
  });
  canvas.addEventListener("pointerup", () => { drag = null; });
  canvas.addEventListener("pointercancel", () => { drag = null; });

  draw();
  if (typeof dialog.showModal === "function") dialog.showModal();
  else {
    dialog.setAttribute("open", "");
    dialog.classList.add("is-open");
  }
  zoomInput.focus();

  const blob = await resultPromise;
  if (blob instanceof Error) throw blob;
  return blob;
}
