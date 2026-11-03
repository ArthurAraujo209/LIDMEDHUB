import { requireApproved } from "../guards.js";
import { getCase, getCaseVersion, updateCase } from "../cases.js";
import { getCategories } from "../catalog.js";
import { toast } from "../ui/toast.js";

const params = new URLSearchParams(location.search);
const caseId = params.get("id");

if (!caseId) {
  document.getElementById("loading-state").style.display = "none";
  document.getElementById("error-state").style.display = "block";
}

let currentUser = null;
let currentCase = null;
let tags = [];
let categories = [];

const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const editContent = document.getElementById("edit-content");

(async () => {
  const ctx = await requireApproved();
  if (!ctx) return;
  currentUser = ctx.user;

  try {
    // Carrega caso
    currentCase = await getCase(caseId);

    if (!currentCase || (currentCase.authorId !== currentUser.uid && ctx.profile.role !== "admin")) {
      throw new Error("Sem permissão");
    }

    // Carrega categorias
    categories = await getCategories();
    const specialtySelect = document.getElementById("specialty");
    categories.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.slug;
      option.textContent = cat.name;
      if (cat.slug === currentCase.specialty) option.selected = true;
      specialtySelect.appendChild(option);
    });

    // Preenche formulário
    document.getElementById("title").value = currentCase.title;
    tags = currentCase.tags || [];
    renderTags();

    document.querySelector(`input[name="difficulty"][value="${currentCase.difficulty}"]`).checked = true;
    document.querySelector(`input[name="visibility"][value="${currentCase.visibility}"]`).checked = true;

    // Preview das etapas
    if (currentCase.currentVersion > 0) {
      const version = await getCaseVersion(caseId, currentCase.currentVersion);
      const preview = document.getElementById("steps-preview");
      preview.innerHTML = `
        <p class="text-sm text-muted">${currentCase.stepCount} etapas no caso</p>
        <p class="text-sm text-muted">Diagnóstico: ${version.diagnosis}</p>
      `;
    }

    loadingState.style.display = "none";
    editContent.style.display = "block";
  } catch (err) {
    console.error(err);
    loadingState.style.display = "none";
    errorState.style.display = "block";
  }
})();

// Tags
function setupTagsInput() {
  const wrapper = document.getElementById("tags-wrapper");
  const input = document.getElementById("tags-input");

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = input.value.trim();
      if (value && !tags.includes(value)) {
        tags.push(value);
        renderTags();
        input.value = "";
      }
    }
  });
}

function renderTags() {
  const wrapper = document.getElementById("tags-wrapper");
  const input = wrapper.querySelector(".tags-input");

  wrapper.querySelectorAll(".tag-chip").forEach(chip => chip.remove());

  tags.forEach((tag, index) => {
    const chip = document.createElement("div");
    chip.className = "tag-chip";
    chip.innerHTML = `${tag} <button type="button" data-index="${index}">×</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      tags.splice(index, 1);
      renderTags();
    });
    wrapper.insertBefore(chip, input);
  });
}

setupTagsInput();
renderTags();

// Salvar
document.getElementById("case-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const editType = document.querySelector('input[name="editType"]:checked').value;
  const isStructural = editType === "structural";

  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.textContent = "Salvando...";

  try {
    const formData = new FormData(e.target);

    const updates = {
      title: formData.get("title"),
      specialty: formData.get("specialty"),
      tags,
      difficulty: parseInt(formData.get("difficulty")),
      visibility: formData.get("visibility")
    };

    await updateCase(caseId, updates, isStructural);

    toast("Caso atualizado com sucesso!", { type: "success" });
    const destination = currentCase.status === "draft"
      ? "/meus-casos.html"
      : `/caso.html?id=${caseId}`;
    setTimeout(() => location.replace(destination), 1000);
  } catch (err) {
    console.error(err);
    toast(err.message || "Erro ao atualizar caso.", { type: "danger" });
    btn.disabled = false;
    btn.textContent = "Salvar Alterações";
  }
});
