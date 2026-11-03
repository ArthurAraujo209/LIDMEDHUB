import { requireApproved } from "../guards.js";
import { createCase } from "../cases.js";
import { getCategories } from "../catalog.js";
import { detectSensitive } from "../utils/detectSensitive.js";
import { cropImage } from "../ui/image-editor.js";
import { uploadImage } from "../utils/uploadImage.js";
import { toast } from "../ui/toast.js";

let currentStep = 1;
let currentUser = null;
let tags = [];
let diagnosisKeywords = [];
let optionSet = [];
let nextStepId = 0;
let categories = [];
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const pendingStepImages = new WeakMap();

// Inicialização
(async () => {
  const ctx = await requireApproved();
  if (!ctx) return;
  currentUser = ctx.user;

  // Carrega categorias
  categories = await getCategories();
  const specialtySelect = document.getElementById("specialty");
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.slug;
    option.textContent = cat.name;
    specialtySelect.appendChild(option);
  });

  // Adiciona primeira etapa
  addStep();
})();

// Tags input
function setupTagsInput(wrapperId, inputId, tagsArray) {
  const wrapper = document.getElementById(wrapperId);
  const input = document.getElementById(inputId);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = input.value.trim();
      if (value && !tagsArray.includes(value)) {
        tagsArray.push(value);
        renderTags(wrapperId, tagsArray);
        input.value = "";
      }
    }
  });

  renderTags(wrapperId, tagsArray);
}

function renderTags(wrapperId, tagsArray) {
  const wrapper = document.getElementById(wrapperId);
  const input = wrapper.querySelector(".tags-input");

  // Remove chips antigos
  wrapper.querySelectorAll(".tag-chip").forEach(chip => chip.remove());

  // Adiciona chips
  tagsArray.forEach((tag, index) => {
    const chip = document.createElement("div");
    chip.className = "tag-chip";
    chip.innerHTML = `
      ${tag}
      <button type="button" data-index="${index}">×</button>
    `;
    chip.querySelector("button").addEventListener("click", () => {
      tagsArray.splice(index, 1);
      renderTags(wrapperId, tagsArray);
    });
    wrapper.insertBefore(chip, input);
  });
}

setupTagsInput("tags-wrapper", "tags-input", tags);
setupTagsInput("diagnosis-keywords-wrapper", "diagnosis-keywords-input", diagnosisKeywords);
setupTagsInput("option-set-wrapper", "option-set-input", optionSet);

// Steps dinâmicos
function addStep() {
  const stepIndex = nextStepId++;

  const container = document.getElementById("steps-container");
  const stepEl = document.createElement("div");
  stepEl.className = "dynamic-step-item";
  stepEl.dataset.index = stepIndex;
  stepEl.innerHTML = `
    <div class="dynamic-step-header">
      <input type="text" class="dynamic-step-title" value="Etapa ${stepIndex + 1}" placeholder="Título da etapa">
      ${stepIndex > 0 ? '<button type="button" class="btn btn-ghost btn-sm btn-remove-step">Remover</button>' : ''}
    </div>
    <div class="clinical-fields">
      <div class="clinical-field-group">
        <input type="checkbox" id="field-queixa-${stepIndex}">
        <div class="field">
          <label for="field-queixa-value-${stepIndex}">Queixa Principal</label>
          <textarea id="field-queixa-value-${stepIndex}" rows="2"></textarea>
        </div>
      </div>
      <div class="clinical-field-group">
        <input type="checkbox" id="field-hda-${stepIndex}">
        <div class="field">
          <label for="field-hda-value-${stepIndex}">História da Doença Atual</label>
          <textarea id="field-hda-value-${stepIndex}" rows="3"></textarea>
        </div>
      </div>
      <div class="clinical-field-group">
        <input type="checkbox" id="field-antecedentes-${stepIndex}">
        <div class="field">
          <label for="field-antecedentes-value-${stepIndex}">Antecedentes</label>
          <textarea id="field-antecedentes-value-${stepIndex}" rows="2"></textarea>
        </div>
      </div>
      <div class="clinical-field-group">
        <input type="checkbox" id="field-medicamentos-${stepIndex}">
        <div class="field">
          <label for="field-medicamentos-value-${stepIndex}">Medicamentos</label>
          <textarea id="field-medicamentos-value-${stepIndex}" rows="2"></textarea>
        </div>
      </div>
      <div class="clinical-field-group">
        <input type="checkbox" id="field-exame-fisico-${stepIndex}">
        <div class="field">
          <label for="field-exame-fisico-value-${stepIndex}">Exame Físico</label>
          <textarea id="field-exame-fisico-value-${stepIndex}" rows="3"></textarea>
        </div>
      </div>
      <div class="clinical-field-group">
        <input type="checkbox" id="field-sinais-vitais-${stepIndex}">
        <div class="field">
          <label for="field-sinais-vitais-value-${stepIndex}">Sinais Vitais</label>
          <textarea id="field-sinais-vitais-value-${stepIndex}" rows="2"></textarea>
        </div>
      </div>
      <div class="clinical-field-group">
        <input type="checkbox" id="field-exames-lab-${stepIndex}">
        <div class="field">
          <label for="field-exames-lab-value-${stepIndex}">Exames Laboratoriais</label>
          <textarea id="field-exames-lab-value-${stepIndex}" rows="3"></textarea>
        </div>
      </div>
      <div class="clinical-field-group">
        <input type="checkbox" id="field-evolucao-${stepIndex}">
        <div class="field">
          <label for="field-evolucao-value-${stepIndex}">Evolução</label>
          <textarea id="field-evolucao-value-${stepIndex}" rows="2"></textarea>
        </div>
      </div>
    </div>
    <div class="field step-image-field">
      <label for="step-image-${stepIndex}">Imagem clínica (opcional)</label>
      <label class="image-anonymization-check" for="step-image-consent-${stepIndex}">
        <input type="checkbox" id="step-image-consent-${stepIndex}">
        <span>Confirmo que a imagem está totalmente anonimizada e pode ser hospedada publicamente em um serviço externo. Nunca envie imagens com identificação, rosto, dados de prontuário ou metadados DICOM.</span>
      </label>
      <input id="step-image-${stepIndex}" type="file" accept="image/jpeg,image/png,image/webp" disabled>
      <span class="field-hint">JPEG, PNG ou WebP; até 3 MB. A imagem será reprocessada para remover metadados e só enviada ao publicar. Rascunhos não armazenam imagens.</span>
      <span class="image-upload-status" id="step-image-status-${stepIndex}" role="status" aria-live="polite">A imagem só será enviada após a confirmação acima.</span>
      <div class="step-image-preview" id="step-image-preview-${stepIndex}" hidden>
        <img alt="Pré-visualização da imagem anonimizada">
        <button type="button" class="btn btn-ghost btn-sm" data-remove-step-image>Remover do caso</button>
      </div>
    </div>
    <div class="field" style="margin-top: var(--space-3);">
      <label for="step-hint-${stepIndex}">Dica (opcional)</label>
      <textarea id="step-hint-${stepIndex}" rows="2" placeholder="Dica para ajudar na resolução desta etapa"></textarea>
    </div>
  `;

  container.appendChild(stepEl);
  setupStepImage(stepEl, stepIndex);

  if (stepIndex > 0) {
    stepEl.querySelector(".btn-remove-step").addEventListener("click", () => {
      const alreadyUploaded = Boolean(stepEl.dataset.imageUrl);
      if (stepEl.dataset.imagePreviewUrl) URL.revokeObjectURL(stepEl.dataset.imagePreviewUrl);
      stepEl.remove();
      if (alreadyUploaded) {
        toast("A imagem removida do formulário continua hospedada publicamente no ImgBB.", { type: "warning" });
      }
    });
  }
}

function setupStepImage(stepEl, stepIndex) {
  const consent = stepEl.querySelector(`#step-image-consent-${stepIndex}`);
  const input = stepEl.querySelector(`#step-image-${stepIndex}`);
  const status = stepEl.querySelector(`#step-image-status-${stepIndex}`);
  const preview = stepEl.querySelector(`#step-image-preview-${stepIndex}`);
  const previewImage = preview.querySelector("img");
  const removeButton = preview.querySelector("[data-remove-step-image]");

  consent.addEventListener("change", () => {
    if (!consent.checked && pendingStepImages.has(stepEl)) {
      const alreadyUploaded = Boolean(stepEl.dataset.imageUrl);
      if (stepEl.dataset.imagePreviewUrl) URL.revokeObjectURL(stepEl.dataset.imagePreviewUrl);
      delete stepEl.dataset.imagePreviewUrl;
      delete stepEl.dataset.imageUrl;
      pendingStepImages.delete(stepEl);
      preview.hidden = true;
      previewImage.removeAttribute("src");
      input.value = "";
      status.textContent = alreadyUploaded
        ? "Confirmação removida e imagem desvinculada. A cópia enviada ainda está pública no ImgBB."
        : "Confirmação removida; a imagem também foi removida do caso.";
    }
    input.disabled = !consent.checked || pendingStepImages.has(stepEl);
  });

  removeButton.addEventListener("click", () => {
    const alreadyUploaded = Boolean(stepEl.dataset.imageUrl);
    if (stepEl.dataset.imagePreviewUrl) URL.revokeObjectURL(stepEl.dataset.imagePreviewUrl);
    delete stepEl.dataset.imagePreviewUrl;
    delete stepEl.dataset.imageUrl;
    pendingStepImages.delete(stepEl);
    preview.hidden = true;
    previewImage.removeAttribute("src");
    input.value = "";
    input.disabled = !consent.checked;
    status.textContent = alreadyUploaded
      ? "Link removido deste caso. A cópia já enviada continua hospedada publicamente no ImgBB."
      : "Imagem removida deste caso.";
  });

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!consent.checked) {
      input.value = "";
      toast("Confirme a anonimização antes de enviar uma imagem.", { type: "warning" });
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      input.value = "";
      input.disabled = false;
      status.textContent = "Arquivo inválido. Use JPEG, PNG ou WebP de até 3 MB.";
      toast("Escolha uma imagem JPEG, PNG ou WebP de até 3 MB.", { type: "warning" });
      return;
    }

    input.disabled = true;
    status.textContent = "Abrindo editor de recorte...";
    try {
      const imageBlob = await cropImage(file, { title: "Recortar imagem clínica" });
      if (!imageBlob) {
        status.textContent = "Recorte cancelado.";
        return;
      }
      if (!consent.checked) {
        input.value = "";
        status.textContent = "Confirmação removida; a imagem não foi anexada.";
        return;
      }
      if (imageBlob.size > MAX_IMAGE_BYTES) {
        throw new Error("O recorte ficou maior que 3 MB. Ajuste o zoom e tente novamente.");
      }
      if (stepEl.dataset.imagePreviewUrl) URL.revokeObjectURL(stepEl.dataset.imagePreviewUrl);

      pendingStepImages.set(stepEl, imageBlob);
      stepEl.dataset.imagePreviewUrl = URL.createObjectURL(imageBlob);
      previewImage.src = stepEl.dataset.imagePreviewUrl;
      preview.hidden = false;
      status.textContent = "Recorte pronto. Será enviado ao ImgBB público quando você publicar o caso.";
    } catch (error) {
      console.error(error);
      status.textContent = error.message || "Falha ao enviar imagem.";
      toast(error.message || "Erro ao enviar imagem.", { type: "danger" });
      input.value = "";
    } finally {
      input.disabled = !consent.checked || pendingStepImages.has(stepEl);
    }
  });
}

async function uploadPendingStepImages(caseData) {
  const stepElements = document.querySelectorAll(".dynamic-step-item");
  const hasImages = Array.from(stepElements).some((stepEl) =>
    pendingStepImages.has(stepEl) || stepEl.dataset.imageUrl
  );
  if (caseData.visibility === "private" && hasImages) {
    throw new Error("O ImgBB hospeda imagens publicamente. Remova as imagens ou publique o caso para incluí-las.");
  }

  for (const [index, stepEl] of stepElements.entries()) {
    const imageBlob = pendingStepImages.get(stepEl);
    if (!imageBlob || stepEl.dataset.imageUrl) continue;

    const consent = stepEl.querySelector('input[type="checkbox"][id^="step-image-consent-"]');
    if (!consent?.checked) {
      throw new Error(`Confirme a anonimização da imagem na etapa ${index + 1}.`);
    }

    const status = stepEl.querySelector(".image-upload-status");
    status.textContent = "Enviando imagem ao ImgBB...";
    const imageUrl = await uploadImage(imageBlob, currentUser, "clinical");
    stepEl.dataset.imageUrl = imageUrl;
    caseData.steps[index].imageUrl = imageUrl;
    status.textContent = "Imagem hospedada publicamente e vinculada a esta etapa.";
  }
}

document.getElementById("add-step-btn").addEventListener("click", addStep);

// Navegação do wizard
function goToStep(step) {
  document.querySelectorAll(".wizard-section").forEach(s => s.classList.remove("is-active"));
  document.querySelectorAll(".wizard-step").forEach(s => s.classList.remove("is-active", "is-complete"));

  document.querySelector(`[data-section="${step}"]`).classList.add("is-active");
  document.querySelector(`[data-step="${step}"]`).classList.add("is-active");

  for (let i = 1; i < step; i++) {
    document.querySelector(`[data-step="${i}"]`).classList.add("is-complete");
  }

  document.getElementById("prev-btn").style.display = step > 1 ? "block" : "none";
  document.getElementById("next-btn").style.display = step < 4 ? "block" : "none";
  document.getElementById("publish-btn").style.display = step === 4 ? "block" : "none";

  currentStep = step;

  // Se chegou na etapa 4, verifica dados sensíveis
  if (step === 4) {
    checkSensitiveData();
  }
}

document.getElementById("next-btn").addEventListener("click", () => {
  if (currentStep < 4) goToStep(currentStep + 1);
});

document.getElementById("prev-btn").addEventListener("click", () => {
  if (currentStep > 1) goToStep(currentStep - 1);
});

// Verificação de dados sensíveis
function checkSensitiveData() {
  const allText = [];

  document.querySelectorAll("textarea").forEach(el => {
    if (el.value) allText.push(el.value);
  });

  const warnings = detectSensitive(allText.join(" "));
  const warningsEl = document.getElementById("sensitive-warnings");

  if (warnings.length > 0) {
    warningsEl.innerHTML = `
      <div class="sensitive-alert">
        <strong>Possíveis dados sensíveis detectados:</strong><br>
        ${warnings.map(w => `• ${w.message}`).join("<br>")}
      </div>
    `;
  } else {
    warningsEl.innerHTML = "";
  }
}

// Coleta dados do formulário
function collectFormData(publish = false) {
  const formData = new FormData(document.getElementById("case-form"));

  // Coleta steps
  const collectedSteps = [];
  document.querySelectorAll(".dynamic-step-item").forEach((stepEl) => {
    const index = Number(stepEl.dataset.index);
    const title = stepEl.querySelector(".dynamic-step-title").value || `Etapa ${index + 1}`;
    const fields = {};

    const fieldNames = ["queixa", "hda", "antecedentes", "medicamentos", "exame-fisico", "sinais-vitais", "exames-lab", "evolucao"];
    fieldNames.forEach(name => {
      const checkbox = document.getElementById(`field-${name}-${index}`);
      const value = document.getElementById(`field-${name}-value-${index}`).value.trim();
      if (checkbox.checked && value) {
        fields[name] = value;
      }
    });

    const hint = document.getElementById(`step-hint-${index}`).value.trim();

    collectedSteps.push({
      title,
      fields,
      hint: hint || null,
      imageUrl: stepEl.dataset.imageUrl || null
    });
  });

  return {
    title: formData.get("title"),
    specialty: formData.get("specialty"),
    tags,
    difficulty: parseInt(formData.get("difficulty")),
    visibility: formData.get("visibility"),
    steps: collectedSteps,
    diagnosis: formData.get("diagnosis"),
    conduct: formData.get("conduct") || "",
    explanation: formData.get("explanation") || "",
    diagnosisKeywords,
    optionSet,
    publish
  };
}

// Publicar
document.getElementById("case-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!document.getElementById("anonymization-check").checked) {
    toast("Você precisa confirmar a anonimização do caso.", { type: "warning" });
    return;
  }

  const btn = document.getElementById("publish-btn");
  btn.disabled = true;
  btn.textContent = "Publicando...";

  try {
    const caseData = collectFormData(true);
    await uploadPendingStepImages(caseData);
    const caseId = await createCase(currentUser.uid, caseData);
    toast("Caso publicado com sucesso!", { type: "success" });
    setTimeout(() => location.replace(`/caso.html?id=${caseId}`), 1000);
  } catch (err) {
    console.error(err);
    toast(err.message || "Erro ao publicar caso.", { type: "danger" });
    btn.disabled = false;
    btn.textContent = "Publicar Caso";
  }
});

// Salvar rascunho
document.getElementById("save-draft-btn").addEventListener("click", async () => {
  const btn = document.getElementById("save-draft-btn");
  btn.disabled = true;
  btn.textContent = "Salvando...";

  try {
    const caseData = collectFormData(false);
    const caseId = await createCase(currentUser.uid, caseData);
    toast("Rascunho salvo!", { type: "success" });
    setTimeout(() => location.replace(`/editar-caso.html?id=${caseId}`), 1000);
  } catch (err) {
    console.error(err);
    toast(err.message || "Erro ao salvar rascunho.", { type: "danger" });
    btn.disabled = false;
    btn.textContent = "Salvar Rascunho";
  }
});
