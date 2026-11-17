import { requireApproved } from "../guards.js";
import { getCase, getCaseVersion, updateCase, deleteCase } from "../cases.js";
import { getCategories } from "../catalog.js";
import { CLINICAL_FIELD_OPTIONS, getClinicalFieldLabel } from "../clinical-fields.js";
import { toast } from "../ui/toast.js";

const params = new URLSearchParams(location.search);
const caseId = params.get("id");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const editContent = document.getElementById("edit-content");
const stepsContainer = document.getElementById("steps-container");

let currentUser = null;
let currentCase = null;
let tags = [];
let diagnosisKeywords = [];
let optionSet = [];
let nextStepId = 0;
let nextFieldId = 0;
let canManageAnyCase = false;

if (!caseId) {
  loadingState.style.display = "none";
  errorState.style.display = "block";
} else {
  initialize();
}

async function initialize() {
  const context = await requireApproved();
  if (!context) return;
  currentUser = context.user;

  try {
    currentCase = await getCase(caseId);
    if (!currentCase || (currentCase.authorId !== currentUser.uid && context.profile.role !== "admin")) {
      throw new Error("Sem permissão");
    }
    canManageAnyCase = context.profile.role === "admin";

    await loadSpecialties(currentCase.specialty);
    document.getElementById("title").value = currentCase.title || "";
    document.getElementById("special-conditions").value = currentCase.specialConditions || "";
    document.getElementById("scenario").value = currentCase.scenario || "";
    const difficultyInput = document.querySelector(`input[name="difficulty"][value="${currentCase.difficulty}"]`);
    if (difficultyInput) difficultyInput.checked = true;
    const visibilityInput = document.querySelector(`input[name="visibility"][value="${currentCase.visibility}"]`);
    if (visibilityInput) visibilityInput.checked = true;

    tags = [...(currentCase.tags || [])];
    diagnosisKeywords = [...(currentCase.diagnosisKeywords || [])];
    optionSet = [...(currentCase.optionSet || [])];
    setupTagsInput("tags-wrapper", "tags-input", tags);
    setupTagsInput("diagnosis-keywords-wrapper", "diagnosis-keywords-input", diagnosisKeywords);
    setupTagsInput("option-set-wrapper", "option-set-input", optionSet);

    let version = null;
    if (currentCase.currentVersion > 0) {
      version = await getCaseVersion(caseId, currentCase.currentVersion);
      if (!version) throw new Error("Versão atual do caso não encontrada");
    }

    document.getElementById("diagnosis").value = version?.diagnosis || currentCase.diagnosis || "";
    document.getElementById("conduct").value = version?.conduct || currentCase.conduct || "";
    document.getElementById("explanation").value = version?.explanation || currentCase.explanation || "";
    renderSteps(version?.steps || currentCase.steps || []);

    loadingState.style.display = "none";
    editContent.style.display = "block";
  } catch (error) {
    console.error(error);
    loadingState.style.display = "none";
    errorState.style.display = "block";
  }
}

async function loadSpecialties(selectedSlug) {
  const select = document.getElementById("specialty");
  const categories = await getCategories();
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category.slug;
    option.textContent = category.name;
    select.appendChild(option);
  });

  if (selectedSlug && !categories.some(category => category.slug === selectedSlug)) {
    const option = document.createElement("option");
    option.value = selectedSlug;
    option.textContent = selectedSlug;
    select.appendChild(option);
  }
  select.value = selectedSlug || "";
}

function setupTagsInput(wrapperId, inputId, tagsArray) {
  const wrapper = document.getElementById(wrapperId);
  const input = document.getElementById(inputId);

  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = input.value.trim();
    if (!value || tagsArray.includes(value)) return;
    tagsArray.push(value);
    input.value = "";
    renderTags(wrapper, input, tagsArray);
  });
  renderTags(wrapper, input, tagsArray);
}

function renderTags(wrapper, input, tagsArray) {
  wrapper.querySelectorAll(".tag-chip").forEach(chip => chip.remove());
  tagsArray.forEach((tag, index) => {
    const chip = document.createElement("div");
    chip.className = "tag-chip";
    const text = document.createElement("span");
    text.textContent = tag;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Remover ${tag}`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      tagsArray.splice(index, 1);
      renderTags(wrapper, input, tagsArray);
    });
    chip.append(text, removeButton);
    wrapper.insertBefore(chip, input);
  });
}

function renderSteps(steps) {
  stepsContainer.replaceChildren();
  nextStepId = 0;
  steps.forEach((step, index) => {
    stepsContainer.appendChild(createClinicalStep(step, index));
  });
}

function createClinicalStep(step = {}, index = nextStepId++, isNewPhase = false) {
  nextStepId = Math.max(nextStepId, index + 1);
  const stepEl = document.createElement("div");
  stepEl.className = "dynamic-step-item";
  stepEl.dataset.index = index;
  stepEl.dataset.newPhase = String(isNewPhase);
  stepEl.innerHTML = `
    <div class="dynamic-step-header">
      <input class="dynamic-step-title" aria-label="Título da fase" maxlength="100" required>
      <button type="button" class="btn btn-ghost btn-sm btn-remove-step">Remover fase</button>
    </div>
    <div class="clinical-fields" data-clinical-fields></div>
    <div class="field step-image-field">
      <label for="phase-image-${index}">Imagem clínica (URL opcional)</label>
      <input id="phase-image-${index}" type="url" data-step-image-url placeholder="https://i.ibb.co/...">
      <span class="field-hint">Deixe vazio para remover a imagem desta fase. Imagens hospedadas externamente não são apagadas ao remover o link.</span>
    </div>
    <div class="field">
      <label for="phase-hint-${index}">Dica para esta fase (opcional)</label>
      <textarea id="phase-hint-${index}" rows="2" placeholder="Dica revelada quando a pessoa solicitar"></textarea>
    </div>
  `;

  const titleInput = stepEl.querySelector(".dynamic-step-title");
  titleInput.value = step.title || `Etapa ${index + 1}`;
  stepEl.querySelector("[data-step-image-url]").value = step.imageUrl || "";
  stepEl.querySelector(`#phase-hint-${index}`).value = step.hint || "";

  Object.entries(step.fields || {}).forEach(([key, value]) => {
    addClinicalField(stepEl, key, value);
  });
  addInfoPicker(stepEl);

  stepEl.querySelector(".btn-remove-step").addEventListener("click", () => {
    if (!confirm(`Remover a fase “${titleInput.value || `Etapa ${index + 1}`}”?`)) return;
    stepEl.remove();
  });
  return stepEl;
}

function addClinicalField(stepEl, key, value = "") {
  const alreadyAdded = [...stepEl.querySelectorAll("[data-field-key]")]
    .some(field => field.dataset.fieldKey === key);
  if (alreadyAdded) return;

  const field = document.createElement("div");
  field.className = "field clinical-extra-field";
  field.dataset.fieldKey = key;
  const inputId = `phase-field-${nextFieldId++}`;
  const label = document.createElement("label");
  label.htmlFor = inputId;
  label.textContent = getClinicalFieldLabel(key);
  const textarea = document.createElement("textarea");
  textarea.id = inputId;
  textarea.rows = key === "hda" || key === "exames-lab" || key === "exame-fisico" ? 3 : 2;
  textarea.dataset.clinicalField = key;
  textarea.value = value || "";
  textarea.placeholder = `Informe ${getClinicalFieldLabel(key).toLowerCase()}...`;
  field.append(label, textarea);

  if (key === "outras-informacoes") {
    const hint = document.createElement("span");
    hint.className = "field-hint";
    hint.textContent = "Ex.: gestação ou outra condição especial relevante.";
    field.appendChild(hint);
  }

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "btn btn-ghost btn-sm remove-clinical-field";
  removeButton.textContent = "Remover informação";
  removeButton.addEventListener("click", () => {
    field.remove();
    updateInfoOptions(stepEl);
  });
  field.appendChild(removeButton);
  stepEl.querySelector("[data-clinical-fields]").appendChild(field);
  updateInfoOptions(stepEl);
}

function addInfoPicker(stepEl) {
  const picker = document.createElement("div");
  picker.className = "add-info-picker";
  picker.innerHTML = `
    <button type="button" class="btn btn-secondary btn-add-info" aria-expanded="false">
      + Adicionar informação
    </button>
    <div class="add-info-options" hidden>
      <p class="field-hint">Escolha um tipo de informação para esta fase:</p>
      <div class="add-info-options-list"></div>
    </div>
  `;

  const optionsPanel = picker.querySelector(".add-info-options");
  const toggle = picker.querySelector(".btn-add-info");
  const optionsList = picker.querySelector(".add-info-options-list");
  CLINICAL_FIELD_OPTIONS.forEach(({ key, label }) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "btn btn-ghost btn-sm";
    option.dataset.infoOption = key;
    option.textContent = label;
    option.addEventListener("click", () => {
      addClinicalField(stepEl, key);
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
  updateInfoOptions(stepEl);
}

function updateInfoOptions(stepEl) {
  const existingKeys = new Set(
    [...stepEl.querySelectorAll("[data-field-key]")].map(field => field.dataset.fieldKey)
  );
  stepEl.querySelectorAll("[data-info-option]").forEach(option => {
    option.hidden = existingKeys.has(option.dataset.infoOption);
  });
}

document.getElementById("add-step-btn").addEventListener("click", () => {
  const step = createClinicalStep({}, nextStepId++, true);
  stepsContainer.appendChild(step);
  step.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.getElementById("case-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = document.getElementById("save-btn");
  const updates = collectFormData();
  const validationMessage = validateCaseData(updates);
  if (validationMessage) {
    toast(validationMessage, { type: "warning" });
    return;
  }

  button.disabled = true;
  button.textContent = "Salvando...";
  try {
    await updateCase(caseId, updates);
    toast("Caso atualizado com sucesso!", { type: "success" });
    const destination = currentCase.status === "draft"
      ? "/meus-casos.html"
      : `/caso.html?id=${encodeURIComponent(caseId)}`;
    setTimeout(() => location.replace(destination), 1000);
  } catch (error) {
    console.error(error);
    toast(error.message || "Erro ao atualizar caso.", { type: "danger" });
    button.disabled = false;
    button.textContent = "Salvar alterações";
  }
});

function collectFormData() {
  const formData = new FormData(document.getElementById("case-form"));
  const steps = [...stepsContainer.querySelectorAll(".dynamic-step-item")].map(stepEl => {
    const fields = {};
    stepEl.querySelectorAll("textarea[data-clinical-field]").forEach(input => {
      const value = input.value.trim();
      if (value) fields[input.dataset.clinicalField] = value;
    });
    return {
      title: stepEl.querySelector(".dynamic-step-title").value.trim(),
      fields,
      hint: stepEl.querySelector("textarea[id^='phase-hint-']").value.trim() || null,
      imageUrl: stepEl.querySelector("[data-step-image-url]").value.trim() || null
    };
  });

  return {
    title: formData.get("title").trim(),
    specialty: formData.get("specialty"),
    specialConditions: formData.get("specialConditions").trim(),
    scenario: formData.get("scenario"),
    tags,
    difficulty: parseInt(formData.get("difficulty"), 10),
    visibility: formData.get("visibility"),
    steps,
    diagnosis: formData.get("diagnosis").trim(),
    diagnosisKeywords,
    optionSet,
    conduct: formData.get("conduct").trim(),
    explanation: formData.get("explanation").trim()
  };
}

function validateCaseData(data) {
  if (!data.title) return "Informe o título do caso.";
  if (!data.specialty) return "Selecione uma especialidade.";
  if (!data.scenario) return "Selecione o cenário de atendimento.";
  if (!Number.isInteger(data.difficulty)) return "Selecione a dificuldade do caso.";
  if (!data.steps.length) return "Adicione pelo menos uma fase.";
  if (data.steps.some(step => !step.title)) return "Informe um título para cada fase.";
  if (!data.diagnosis) return "Informe o diagnóstico correto do caso.";

  const emptyNewPhase = [...stepsContainer.querySelectorAll(".dynamic-step-item[data-new-phase='true']")]
    .find(stepEl => {
      const hasClinicalInfo = [...stepEl.querySelectorAll("textarea[data-clinical-field]")]
        .some(input => input.value.trim());
      const hasHint = stepEl.querySelector("textarea[id^='phase-hint-']").value.trim();
      return !hasClinicalInfo && !hasHint && !stepEl.querySelector("[data-step-image-url]").value.trim();
    });
  if (emptyNewPhase) return "Preencha uma informação ou remova a fase vazia.";

  for (const step of data.steps) {
    if (!step.imageUrl) continue;
    try {
      const imageUrl = new URL(step.imageUrl);
      if (imageUrl.protocol !== "https:" || imageUrl.hostname !== "i.ibb.co") {
        return "Use uma URL HTTPS de imagem hospedada em i.ibb.co ou remova a imagem.";
      }
    } catch {
      return "Informe uma URL válida para a imagem ou deixe o campo vazio.";
    }
  }
  return "";
}

document.getElementById("delete-case-btn").addEventListener("click", async event => {
  const button = event.currentTarget;
  const confirmed = confirm(
    `Excluir permanentemente o caso “${currentCase.title}”? As fases, versões, avaliações e favoritos vinculados serão apagados. As tentativas anteriores continuarão no histórico como “Caso excluído”. Imagens já enviadas ao ImgBB continuarão hospedadas lá.`
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Excluindo...";
  try {
    await deleteCase(caseId, currentUser.uid, canManageAnyCase);
    toast("Caso excluído.", { type: "success" });
    setTimeout(() => location.replace("/meus-casos.html"), 700);
  } catch (error) {
    console.error(error);
    toast(error.message || "Erro ao excluir caso.", { type: "danger" });
    button.disabled = false;
    button.textContent = "Excluir caso";
  }
});
