import { requireApproved } from "../guards.js";
import { getCase, getCaseVersion } from "../cases.js";
import { startAttempt, getActiveAttempt, submitHypothesis, revealNextStep, useHint, completeAttempt } from "../attempts.js";
import { calculateScore, getScoreLabel } from "../scoring.js";
import { toggleFavorite, isFavorite } from "../favorites.js";
import { canRateCase, rateCase } from "../ratings.js";
import { toast } from "../ui/toast.js";

const params = new URLSearchParams(location.search);
const caseId = params.get("id");

if (!caseId) {
  document.getElementById("loading-state").style.display = "none";
  document.getElementById("error-state").style.display = "block";
}

let currentUser = null;
let currentCase = null;
let caseVersion = null;
let attempt = null;

const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const caseContent = document.getElementById("case-content");
const stepsContainer = document.getElementById("steps-container");

(async () => {
  const ctx = await requireApproved();
  if (!ctx) return;
  currentUser = ctx.user;

  try {
    currentCase = await getCase(caseId);
    if (!currentCase) throw new Error("Caso não encontrado");

    caseVersion = await getCaseVersion(caseId, currentCase.currentVersion);
    if (!caseVersion) throw new Error("Versão do caso não encontrada");

    // Verifica tentativa ativa
    attempt = await getActiveAttempt(currentUser.uid, caseId);
    if (!attempt) {
      attempt = await startAttempt(currentUser.uid, caseId, currentCase.currentVersion);
    }

    // Verifica favorito
    const isFav = await isFavorite(currentUser.uid, caseId);
    document.getElementById("favorite-btn").textContent = isFav ? "♥" : "♡";

    renderCase();
    renderSteps();
    updateProgress();

    loadingState.style.display = "none";
    caseContent.style.display = "block";
  } catch (err) {
    console.error(err);
    loadingState.style.display = "none";
    errorState.style.display = "block";
  }
})();

function renderCase() {
  document.getElementById("case-title").textContent = currentCase.title;

  const metaEl = document.getElementById("case-meta");
  metaEl.innerHTML = `
    <span class="badge">Nível ${currentCase.difficulty}</span>
    <span class="badge">${currentCase.specialty}</span>
    <span class="text-sm text-subtle">Por ${currentCase.authorPublicName}</span>
  `;
}

function renderSteps() {
  stepsContainer.innerHTML = "";

  for (let i = 0; i <= attempt.currentStepIndex; i++) {
    const step = caseVersion.steps[i];
    if (!step) continue;

    const stepEl = document.createElement("div");
    stepEl.className = "case-step";
    stepEl.innerHTML = `
      <div class="case-step-header">
        <h3 class="case-step-title">${step.title}</h3>
        <span class="case-step-number">Etapa ${i + 1}</span>
      </div>
      <div class="case-step-content" id="step-content-${i}"></div>
    `;

    const contentEl = stepEl.querySelector(`#step-content-${i}`);

    Object.entries(step.fields).forEach(([key, value]) => {
      const fieldEl = document.createElement("div");
      fieldEl.className = "case-field";
      fieldEl.innerHTML = `
        <div class="case-field-label">${getFieldLabel(key)}</div>
        <div class="case-field-value">${value}</div>
      `;
      contentEl.appendChild(fieldEl);
    });

    if (step.imageUrl) {
      try {
        const imageUrl = new URL(step.imageUrl);
        if (imageUrl.protocol === "https:" && imageUrl.hostname === "i.ibb.co") {
          const image = document.createElement("img");
          image.className = "case-step-image";
          image.src = imageUrl.href;
          image.alt = `Imagem clínica anonimizada da etapa ${i + 1}`;
          image.loading = "lazy";
          image.referrerPolicy = "no-referrer";
          contentEl.appendChild(image);
        }
      } catch (error) {
        console.error("URL de imagem inválida no caso.", error);
      }
    }

    // Mostra dica se foi usada
    const hintUsed = attempt.hintsUsed?.find(h => h.stepIndex === i);
    if (hintUsed && step.hint) {
      const hintEl = document.createElement("div");
      hintEl.className = "hint-box";
      hintEl.innerHTML = `
        <div class="hint-box-header">💡 Dica</div>
        <div>${step.hint}</div>
      `;
      contentEl.appendChild(hintEl);
    }

    stepsContainer.appendChild(stepEl);
  }

  // Renderiza input de hipótese
  renderHypothesisInput();
}

function getFieldLabel(key) {
  const labels = {
    queixa: "Queixa Principal",
    hda: "História da Doença Atual",
    antecedentes: "Antecedentes",
    medicamentos: "Medicamentos em Uso",
    "exame-fisico": "Exame Físico",
    "sinais-vitais": "Sinais Vitais",
    "exames-lab": "Exames Laboratoriais",
    evolucao: "Evolução"
  };
  return labels[key] || key;
}

function renderHypothesisInput() {
  const container = document.getElementById("hypothesis-input-container");

  if (currentCase.optionSet && currentCase.optionSet.length > 0) {
    // Radio buttons
    container.innerHTML = `
      <div class="hypothesis-options" id="hypothesis-options">
        ${currentCase.optionSet.map((option, index) => `
          <label class="hypothesis-option">
            <input type="radio" name="hypothesis" value="${option}" id="hyp-${index}">
            <span>${option}</span>
          </label>
        `).join('')}
      </div>
    `;

    container.querySelectorAll(".hypothesis-option").forEach(label => {
      label.addEventListener("click", () => {
        container.querySelectorAll(".hypothesis-option").forEach(l => l.classList.remove("is-selected"));
        label.classList.add("is-selected");
        label.querySelector("input").checked = true;
      });
    });
  } else {
    // Campo livre
    container.innerHTML = `
      <div class="hypothesis-input-group">
        <input type="text" class="hypothesis-input" id="hypothesis-text"
               placeholder="Digite sua hipótese diagnóstica..." required>
      </div>
    `;
  }
}

function updateProgress() {
  const currentStep = attempt.currentStepIndex + 1;
  const totalSteps = caseVersion.steps.length;
  const percentage = (currentStep / totalSteps) * 100;

  document.getElementById("progress-text").textContent = `Etapa ${currentStep} de ${totalSteps}`;
  document.getElementById("progress-fill").style.width = `${percentage}%`;

  const score = calculateScore(attempt.hintsCount || 0);
  document.getElementById("score-preview").textContent = score;

  // Mostra botão de encerrar na última etapa
  if (currentStep === totalSteps) {
    document.getElementById("finish-btn").style.display = "block";
  }
}

// Submeter hipótese
document.getElementById("hypothesis-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  let hypothesis = "";
  if (currentCase.optionSet && currentCase.optionSet.length > 0) {
    const selected = document.querySelector('input[name="hypothesis"]:checked');
    if (!selected) {
      toast("Selecione uma opção", { type: "warning" });
      return;
    }
    hypothesis = selected.value;
  } else {
    hypothesis = document.getElementById("hypothesis-text").value.trim();
    if (!hypothesis) {
      toast("Digite uma hipótese", { type: "warning" });
      return;
    }
  }

  const btn = document.getElementById("submit-hypothesis-btn");
  btn.disabled = true;

  try {
    const isCorrect = checkHypothesis(hypothesis);
    await submitHypothesis(attempt.id, hypothesis, attempt.currentStepIndex, isCorrect);

    const feedbackEl = document.getElementById("hypothesis-feedback");
    feedbackEl.style.display = "block";

    if (isCorrect) {
      feedbackEl.className = "hypothesis-feedback is-correct";
      feedbackEl.textContent = "✓ Hipótese correta! Você pode encerrar o caso ou solicitar mais informações.";
    } else {
      feedbackEl.className = "hypothesis-feedback is-neutral";
      feedbackEl.textContent = "A hipótese ainda não corresponde ao esperado neste ponto. Revise os dados disponíveis ou solicite uma dica.";
    }

    setTimeout(() => {
      feedbackEl.style.display = "none";
    }, 5000);
  } catch (err) {
    console.error(err);
    toast("Erro ao submeter hipótese", { type: "danger" });
  } finally {
    btn.disabled = false;
  }
});

function checkHypothesis(hypothesis) {
  const normalized = hypothesis.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

  return currentCase.diagnosisKeywords.some(keyword => {
    const normalizedKeyword = keyword.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    return normalized.includes(normalizedKeyword);
  });
}

// Próxima etapa
document.getElementById("next-step-btn").addEventListener("click", async () => {
  if (attempt.currentStepIndex + 1 >= caseVersion.steps.length) {
    toast("Você já está na última etapa", { type: "info" });
    return;
  }

  try {
    await revealNextStep(attempt.id);
    attempt.currentStepIndex++;
    renderSteps();
    updateProgress();
    toast("Nova etapa revelada", { type: "success", duration: 2000 });
  } catch (err) {
    console.error(err);
    toast("Erro ao avançar etapa", { type: "danger" });
  }
});

// Solicitar dica
document.getElementById("hint-btn").addEventListener("click", async () => {
  const currentStep = caseVersion.steps[attempt.currentStepIndex];
  if (!currentStep.hint) {
    toast("Esta etapa não possui dica", { type: "info" });
    return;
  }

  const hasHint = attempt.hintsUsed?.some(h => h.stepIndex === attempt.currentStepIndex);
  if (hasHint) {
    toast("Você já usou a dica desta etapa", { type: "info" });
    return;
  }

  if (!confirm("Solicitar dica reduzirá sua pontuação em 15 pontos. Deseja continuar?")) {
    return;
  }

  try {
    const hintsCount = await useHint(attempt.id, attempt.currentStepIndex);
    attempt.hintsCount = hintsCount;
    if (!attempt.hintsUsed) attempt.hintsUsed = [];
    attempt.hintsUsed.push({ stepIndex: attempt.currentStepIndex, usedAt: new Date() });

    renderSteps();
    updateProgress();
    toast("Dica revelada", { type: "success" });
  } catch (err) {
    console.error(err);
    toast("Erro ao solicitar dica", { type: "danger" });
  }
});

// Encerrar caso
document.getElementById("finish-btn").addEventListener("click", async () => {
  if (!confirm("Encerrar o caso? Sua pontuação será registrada.")) return;

  try {
    const result = await completeAttempt(attempt.id, currentUser.uid, caseId);
    showCompletionModal(result.score, result.durationSeconds);
  } catch (err) {
    console.error(err);
    toast("Erro ao encerrar caso", { type: "danger" });
  }
});

function showCompletionModal(score, durationSeconds) {
  const modal = document.getElementById("completion-modal");
  document.getElementById("final-score").textContent = score;
  document.getElementById("completion-message").textContent = getScoreLabel(score);
  document.getElementById("hints-used").textContent = attempt.hintsCount || 0;
  document.getElementById("time-taken").textContent = Math.floor(durationSeconds / 60) + "min";

  modal.style.display = "flex";
}

// Favoritar
document.getElementById("favorite-btn").addEventListener("click", async () => {
  try {
    const isFav = await toggleFavorite(currentUser.uid, caseId);
    document.getElementById("favorite-btn").textContent = isFav ? "♥" : "♡";
    toast(isFav ? "Adicionado aos favoritos" : "Removido dos favoritos", { type: "success", duration: 2000 });
  } catch (err) {
    console.error(err);
    toast("Erro ao favoritar", { type: "danger" });
  }
});

// Avaliar caso
document.getElementById("rate-btn").addEventListener("click", async () => {
  const canRate = await canRateCase(currentUser.uid, caseId);
  if (!canRate) {
    toast("Você precisa resolver o caso para avaliá-lo", { type: "warning" });
    return;
  }

  const stars = prompt("Avalie de 1 a 5 estrelas:");
  if (!stars || stars < 1 || stars > 5) return;

  const comment = prompt("Comentário (opcional):");

  try {
    await rateCase(currentUser.uid, caseId, parseInt(stars), comment || "");
    toast("Avaliação enviada!", { type: "success" });
  } catch (err) {
    console.error(err);
    toast(err.message || "Erro ao avaliar", { type: "danger" });
  }
});
