import { requireApproved } from "../guards.js";
import { createCase } from "../cases.js";
import { getCategories } from "../catalog.js";
import { detectSensitive } from "../utils/detectSensitive.js";
import { cropImage } from "../ui/image-editor.js";
import { uploadImage } from "../utils/uploadImage.js";
import { toast } from "../ui/toast.js";
import { CLINICAL_FIELD_OPTIONS } from "../clinical-fields.js";

let currentStep = 1;
let currentUser = null;
let tags = [];
let diagnosisKeywords = [];
let optionSet = [];
let nextClinicalFieldId = 0;
let nextStepId = 2;
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

  addClinicalSteps();
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

// Etapas clínicas do caso
function addClinicalSteps() {
  const container = document.getElementById("steps-container");
  const firstStep = createClinicalStep(0, "Etapa 1 — Queixa principal");
  addClinicalField(firstStep, "queixa", "Queixa principal", "Descreva o motivo da consulta...");
  container.appendChild(firstStep);

  const secondStep = createClinicalStep(1, "Etapa 2 — Informações clínicas");
  addClinicalField(secondStep, "hda", "História da Doença Atual (HDA)", "Descreva a história da doença atual...");
  addClinicalField(secondStep, "sinais-vitais", "Sinais vitais", "Informe os sinais vitais...");
  addClinicalField(secondStep, "exames-lab", "Exames laboratoriais", "Informe os exames laboratoriais...");
  addInfoPicker(secondStep);
  container.appendChild(secondStep);
}

function addAdditionalStep() {
  const stepIndex = nextStepId++;
  const stepEl = createClinicalStep(stepIndex, `Etapa ${stepIndex + 1}`, true);
  addInfoPicker(stepEl);
  document.getElementById("steps-container").appendChild(stepEl);
}

function createClinicalStep(stepIndex, title, removable = false) {
  const stepEl = document.createElement("div");
  stepEl.className = "dynamic-step-item";
  stepEl.dataset.index = stepIndex;
  stepEl.innerHTML = `
    <div class="dynamic-step-header">
      <input class="dynamic-step-title" value="${title}" aria-label="Título da fase" maxlength="100">
      ${removable ? '<button type="button" class="btn btn-ghost btn-sm btn-remove-step">Remover fase</button>' : ""}
    </div>
    <div class="clinical-fields" data-clinical-fields></div>
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
  setupStepImage(stepEl, stepIndex);

  if (removable) {
    stepEl.querySelector(".btn-remove-step").addEventListener("click", () => {
      const alreadyUploaded = Boolean(stepEl.dataset.imageUrl);
      if (stepEl.dataset.imagePreviewUrl) URL.revokeObjectURL(stepEl.dataset.imagePreviewUrl);
      stepEl.remove();
      if (alreadyUploaded) {
        toast("A imagem removida da fase continua hospedada publicamente no ImgBB.", { type: "warning" });
      }
    });
  }

  return stepEl;
}

function addClinicalField(stepEl, key, labelText, placeholder = "", removable = false) {
  const field = document.createElement("div");
  field.className = "field clinical-extra-field";
  field.dataset.fieldKey = key;

  const label = document.createElement("label");
  const input = document.createElement("textarea");
  input.id = `clinical-field-${nextClinicalFieldId++}`;
  input.rows = key === "hda" || key === "exames-lab" || key === "exame-fisico" ? 3 : 2;
  input.dataset.clinicalField = key;
  input.placeholder = placeholder;
  label.htmlFor = input.id;
  label.textContent = labelText;
  if (key === "queixa") {
    const requiredMark = document.createElement("span");
    requiredMark.className = "required";
    requiredMark.textContent = " *";
    label.appendChild(requiredMark);
  }
  field.appendChild(label);
  field.appendChild(input);

  if (key === "outras-informacoes") {
    const hint = document.createElement("span");
    hint.className = "field-hint";
    hint.textContent = "Ex.: gestação ou outra condição especial relevante.";
    field.appendChild(hint);
  }

  if (removable) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-ghost btn-sm remove-clinical-field";
    removeButton.textContent = "Remover";
    removeButton.addEventListener("click", () => {
      const option = stepEl.querySelector(`[data-info-option="${key}"]`);
      if (option) option.hidden = false;
      field.remove();
    });
    field.appendChild(removeButton);
  }

  stepEl.querySelector("[data-clinical-fields]").appendChild(field);
  return field;
}

function addInfoPicker(stepEl) {
  const picker = document.createElement("div");
  picker.className = "add-info-picker";
  picker.innerHTML = `
    <button type="button" class="btn btn-secondary btn-add-info" aria-expanded="false">
      + Adicionar informação
    </button>
    <div class="add-info-options" hidden>
      <p class="field-hint">Escolha uma informação para incluir:</p>
      <div class="add-info-options-list"></div>
    </div>
  `;

  const toggle = picker.querySelector(".btn-add-info");
  const optionsPanel = picker.querySelector(".add-info-options");
  const optionsList = picker.querySelector(".add-info-options-list");
  CLINICAL_FIELD_OPTIONS.forEach(({ key, label }) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "btn btn-ghost btn-sm";
    option.dataset.infoOption = key;
    option.textContent = label;
    const alreadyAdded = stepEl.querySelector(`[data-field-key="${key}"]`);
    option.hidden = Boolean(alreadyAdded);
    option.addEventListener("click", () => {
      if (stepEl.querySelector(`[data-field-key="${key}"]`)) return;
      addClinicalField(stepEl, key, label, `Informe ${label.toLowerCase()}...`, true);
      option.hidden = true;
      optionsPanel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    });
    optionsList.appendChild(option);
  });

  toggle.addEventListener("click", () => {
    optionsPanel.hidden = !optionsPanel.hidden;
    toggle.setAttribute("aria-expanded", String(!optionsPanel.hidden));
  });
  stepEl.querySelector("[data-clinical-fields]").after(picker);
}

document.getElementById("add-step-btn").addEventListener("click", addAdditionalStep);

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
    const title = stepEl.querySelector(".dynamic-step-title").value.trim() || `Etapa ${index + 1}`;
    const fields = {};
    stepEl.querySelectorAll("textarea[data-clinical-field]").forEach((input) => {
      const value = input.value.trim();
      if (value) fields[input.dataset.clinicalField] = value;
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
    specialConditions: formData.get("specialConditions").trim(),
    scenario: formData.get("scenario"),
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
const caseForm = document.getElementById("case-form");
caseForm.noValidate = true;

function validatePublishForm() {
  const title = document.getElementById("title");
  const specialty = document.getElementById("specialty");
  const scenario = document.getElementById("scenario");
  const difficulty = document.querySelector('input[name="difficulty"]:checked');
  const complaint = document.querySelector('[data-clinical-field="queixa"]');
  const diagnosis = document.getElementById("diagnosis");

  const requiredFields = [
    { field: title, step: 1, message: "Informe o título do caso." },
    { field: specialty, step: 1, message: "Selecione uma especialidade." },
    { field: scenario, step: 1, message: "Selecione o cenário de atendimento." },
    { field: difficulty, step: 1, message: "Selecione o nível de dificuldade." },
    { field: complaint, step: 2, message: "Preencha a queixa principal." },
    { field: diagnosis, step: 3, message: "Informe o diagnóstico do caso." }
  ];

  for (const { field, step, message } of requiredFields) {
    if (!field || !field.value?.trim()) {
      goToStep(step);
      field?.focus();
      toast(message, { type: "warning" });
      return false;
    }
  }

  const emptyAdditionalStep = [...document.querySelectorAll(".dynamic-step-item")].slice(2).find(stepEl => {
    const hasClinicalInfo = [...stepEl.querySelectorAll("textarea[data-clinical-field]")]
      .some(input => input.value.trim());
    const hasHint = stepEl.querySelector("textarea[id^='step-hint-']").value.trim();
    return !hasClinicalInfo && !hasHint && !stepEl.dataset.imageUrl && !pendingStepImages.has(stepEl);
  });
  if (emptyAdditionalStep) {
    goToStep(2);
    emptyAdditionalStep.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("Preencha uma informação ou remova a fase vazia.", { type: "warning" });
    return false;
  }

  if (!document.getElementById("anonymization-check").checked) {
    goToStep(4);
    toast("Você precisa confirmar a anonimização do caso.", { type: "warning" });
    return false;
  }

  return true;
}

caseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validatePublishForm()) return;

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
