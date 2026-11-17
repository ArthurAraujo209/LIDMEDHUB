import { requireApproved } from "../guards.js";
import { getCase, getCaseVersion } from "../cases.js";
import {
  startAttempt,
  getActiveAttempt,
  getCaseAttempts,
  resumeAttempt,
  submitHypothesis,
  revealNextStep,
  useHint,
  completeAttempt
} from "../attempts.js";
import { calculateScore, getScoreLabel } from "../scoring.js";
import { toggleFavorite, isFavorite } from "../favorites.js";
import { canRateCase, getCaseRatings, getUserRating, rateCase } from "../ratings.js";
import { toast } from "../ui/toast.js";
import { getClinicalFieldLabel } from "../clinical-fields.js";

const params = new URLSearchParams(location.search);
const caseId = params.get("id");
const selectedAttemptId = params.get("attempt");
const forceRedo = params.get("redo") === "1";

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
const progressPanel = document.querySelector(".case-progress");
const hypothesisPanel = document.querySelector(".hypothesis-panel");
const resultView = document.getElementById("result-view");

(async () => {
  if (!caseId) return;
  const ctx = await requireApproved();
  if (!ctx) return;
  currentUser = ctx.user;

  try {
    currentCase = await getCase(caseId);
    if (!currentCase) throw new Error("Caso não encontrado");

    if (selectedAttemptId) {
      attempt = await resumeAttempt(selectedAttemptId);
      if (!attempt || attempt.userId !== currentUser.uid || attempt.caseId !== caseId || attempt.status !== "solved") {
        throw new Error("Tentativa concluída não encontrada");
      }
    } else {
      attempt = await getActiveAttempt(currentUser.uid, caseId);
      if (!attempt && !forceRedo) {
        const previousAttempts = await getCaseAttempts(currentUser.uid, caseId);
        attempt = previousAttempts[0] || null;
      }
    }

    if (!attempt) {
      attempt = await startAttempt(currentUser.uid, caseId, currentCase.currentVersion);
    }

    const versionNumber = Number(attempt.caseVersion) || currentCase.currentVersion;
    caseVersion = await getCaseVersion(caseId, versionNumber);
    if (!caseVersion) throw new Error("Versão do caso não encontrada");

    // Verifica favorito
    const isFav = await isFavorite(currentUser.uid, caseId);
    const favoriteButton = document.getElementById("favorite-btn");
    favoriteButton.textContent = isFav ? "♥" : "♡";
    favoriteButton.setAttribute("aria-label", isFav ? "Remover dos favoritos" : "Adicionar aos favoritos");

    renderCase();
    if (attempt.status === "solved") {
      renderSavedResult();
    } else {
      renderSteps();
      updateProgress();
    }

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
  metaEl.replaceChildren();
  const metadata = [
    `Nível ${currentCase.difficulty ?? "não informado"}`,
    currentCase.specialty || "Especialidade não informada",
    `Cenário: ${caseVersion.scenario || currentCase.scenario || "Não informado"}`
  ];
  const specialConditions = caseVersion.specialConditions || currentCase.specialConditions;
  if (specialConditions) metadata.push(`Condições especiais: ${specialConditions}`);
  metadata.forEach(text => {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = text;
    metaEl.appendChild(badge);
  });
  const author = document.createElement("span");
  author.className = "text-sm text-subtle";
  author.textContent = `Por ${currentCase.authorPublicName || "autor não informado"}`;
  metaEl.appendChild(author);
}

function renderSavedResult() {
  renderSteps();
  progressPanel.hidden = true;
  hypothesisPanel.style.display = "none";
  resultView.hidden = false;

  const score = attempt.score ?? "—";
  const lastHypothesis = [...(attempt.hypotheses || [])].reverse()
    .find(item => item.text && item.text.trim());
  document.getElementById("result-score").textContent = score;
  document.getElementById("result-score-label").textContent =
    attempt.score == null ? "" : getScoreLabel(Number(attempt.score));
  document.getElementById("result-hints").textContent = attempt.hintsCount || 0;
  document.getElementById("result-time").textContent = formatDuration(attempt.durationSeconds);
  document.getElementById("result-date").textContent = formatDate(attempt.completedAt);
  document.getElementById("result-answer").textContent =
    lastHypothesis?.text || "Nenhum diagnóstico foi registrado.";
  document.getElementById("result-justification").textContent =
    lastHypothesis?.justification || "Nenhuma justificativa foi registrada.";
  document.getElementById("result-correct-answer").textContent =
    caseVersion.diagnosis || currentCase.diagnosis || "Resposta esperada não informada.";

  const answerStatus = document.getElementById("result-answer-status");
  if (typeof lastHypothesis?.correct === "boolean") {
    answerStatus.className = `badge ${lastHypothesis.correct ? "badge-success" : "badge-danger"}`;
    answerStatus.textContent = lastHypothesis.correct ? "Resposta aceita" : "Resposta não aceita";
  } else {
    answerStatus.className = "badge";
    answerStatus.textContent = "Resposta não avaliada";
  }

  renderOptionalResult("conduct", caseVersion.conduct || currentCase.conduct);
  renderOptionalResult("explanation", caseVersion.explanation || currentCase.explanation);
  renderPreviousAnswers();
  renderCommunityFeedback();
}

function renderOptionalResult(field, value) {
  const section = document.getElementById(`result-${field}-section`);
  section.hidden = !value;
  if (value) document.getElementById(`result-${field}`).textContent = value;
}

function renderPreviousAnswers() {
  const previousAnswers = document.getElementById("previous-answers");
  const list = document.getElementById("previous-answers-list");
  const hypotheses = attempt.hypotheses || [];
  previousAnswers.hidden = hypotheses.length < 2;
  list.replaceChildren();

  hypotheses.slice(0, -1).forEach((hypothesis, index) => {
    const item = document.createElement("article");
    item.className = "previous-answer";
    const title = document.createElement("h4");
    title.textContent = `Resposta ${index + 1}`;
    const answer = document.createElement("p");
    answer.textContent = hypothesis.text || "Sem diagnóstico";
    const justification = document.createElement("p");
    justification.textContent = hypothesis.justification || "Sem justificativa";
    item.append(title, answer, justification);
    list.appendChild(item);
  });
}

async function renderCommunityFeedback() {
  const summary = document.getElementById("community-summary");
  const ratingsContainer = document.getElementById("community-ratings");
  const ratingForm = document.getElementById("rating-form");
  const feedback = document.getElementById("rating-feedback");

  try {
    const [ratings, userRating, isEligible] = await Promise.all([
      getCaseRatings(caseId, 10),
      getUserRating(currentUser.uid, caseId),
      canRateCase(currentUser.uid, caseId)
    ]);
    const aggregate = currentCase.aggregate || {};
    const ratingCount = Number(aggregate.ratingCount) || 0;
    const ratingAverage = Number(aggregate.ratingAvg) || 0;
    const solvedCount = Number(aggregate.solvedCount) || 0;
    summary.textContent =
      `${solvedCount} resolução(ões) registrada(s) · ${ratingCount} avaliação(ões) · média ${ratingAverage.toFixed(1)} de 5`;

    ratingsContainer.replaceChildren();
    if (!ratings.length) {
      const empty = document.createElement("p");
      empty.className = "text-sm text-subtle";
      empty.textContent = "Este caso ainda não recebeu avaliações.";
      ratingsContainer.appendChild(empty);
    } else {
      ratings.forEach(rating => {
        const card = document.createElement("article");
        card.className = "community-rating";
        const heading = document.createElement("div");
        heading.className = "community-rating-heading";
        const stars = document.createElement("span");
        const starCount = Math.max(0, Math.min(5, Number(rating.stars) || 0));
        stars.className = "rating-stars";
        stars.setAttribute("aria-label", `${starCount} de 5 estrelas`);
        stars.textContent = `${"★".repeat(starCount)}${"☆".repeat(5 - starCount)}`;
        const date = document.createElement("span");
        date.className = "text-xs text-subtle";
        date.textContent = formatDate(rating.createdAt);
        heading.append(stars, date);
        const comment = document.createElement("p");
        comment.textContent = rating.comment || "Sem comentário.";
        card.append(heading, comment);
        ratingsContainer.appendChild(card);
      });
    }

    ratingForm.hidden = !isEligible;
    if (!isEligible) {
      feedback.textContent = "A avaliação fica disponível depois que você concluir o caso.";
    } else if (userRating) {
      document.getElementById("rating-form-title").textContent = "Sua avaliação";
      document.getElementById("rating-stars").value = String(userRating.stars);
      document.getElementById("rating-comment").value = userRating.comment || "";
      document.getElementById("submit-rating-btn").textContent = "Atualizar avaliação";
      feedback.textContent = "Você já avaliou este caso; pode atualizar sua nota ou comentário.";
    } else {
      feedback.textContent = "Sua avaliação ajuda outras pessoas a escolher e aprimorar casos.";
    }
  } catch (error) {
    console.error("Não foi possível carregar as avaliações do caso.", error);
    summary.textContent = "Não foi possível carregar as avaliações agora.";
    ratingsContainer.replaceChildren();
    feedback.textContent = "Tente recarregar a página para consultar as avaliações.";
  }
}

function formatDuration(seconds = 0) {
  const totalMinutes = Math.floor((Number(seconds) || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function formatDate(timestamp) {
  if (!timestamp) return "Data não disponível";
  const date = timestamp?.toDate?.() || new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Data não disponível";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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
        <h3 class="case-step-title"></h3>
        <span class="case-step-number">Etapa ${i + 1}</span>
      </div>
      <div class="case-step-content" id="step-content-${i}"></div>
    `;
    stepEl.querySelector(".case-step-title").textContent = step.title || `Etapa ${i + 1}`;

    const contentEl = stepEl.querySelector(`#step-content-${i}`);

    Object.entries(step.fields || {}).forEach(([key, value]) => {
      const fieldEl = document.createElement("div");
      fieldEl.className = "case-field";
      const labelEl = document.createElement("div");
      labelEl.className = "case-field-label";
      labelEl.textContent = getClinicalFieldLabel(key);
      const valueEl = document.createElement("div");
      valueEl.className = "case-field-value";
      valueEl.textContent = value;
      fieldEl.append(labelEl, valueEl);
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
      const hintHeader = document.createElement("div");
      hintHeader.className = "hint-box-header";
      hintHeader.textContent = "💡 Dica";
      const hintText = document.createElement("div");
      hintText.textContent = step.hint;
      hintEl.append(hintHeader, hintText);
      contentEl.appendChild(hintEl);
    }

    stepsContainer.appendChild(stepEl);
  }

  // Renderiza input de hipótese
  renderHypothesisInput();
}

function renderHypothesisInput() {
  const container = document.getElementById("hypothesis-input-container");
  const optionSet = Array.isArray(caseVersion.optionSet)
    ? caseVersion.optionSet
    : currentCase.optionSet || [];

  if (optionSet.length > 0) {
    const title = document.createElement("p");
    title.className = "field-hint";
    title.textContent = "Diagnóstico / hipótese";
    const options = document.createElement("div");
    options.className = "hypothesis-options";
    options.id = "hypothesis-options";

    optionSet.forEach((option, index) => {
      const label = document.createElement("label");
      label.className = "hypothesis-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "hypothesis";
      input.value = option;
      input.id = `hyp-${index}`;
      const text = document.createElement("span");
      text.textContent = option;
      label.append(input, text);
      options.appendChild(label);
    });
    container.replaceChildren(title, options);

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
      <div class="field">
        <label for="hypothesis-text">Diagnóstico / hipótese</label>
        <input type="text" class="hypothesis-input" id="hypothesis-text"
               placeholder="Informe seu diagnóstico...">
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
  document.getElementById("next-step-btn").style.display =
    currentStep === totalSteps ? "none" : "inline-flex";
  if (currentStep === totalSteps) {
    document.getElementById("finish-btn").style.display = "block";
  }
}

// Submeter hipótese
document.getElementById("hypothesis-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  let hypothesis = "";
  const optionSet = Array.isArray(caseVersion.optionSet)
    ? caseVersion.optionSet
    : currentCase.optionSet || [];
  if (optionSet.length > 0) {
    const selected = document.querySelector('input[name="hypothesis"]:checked');
    if (!selected) {
      toast("Selecione uma opção", { type: "warning" });
      return;
    }
    hypothesis = selected.value;
  } else {
    hypothesis = document.getElementById("hypothesis-text").value.trim();
    if (!hypothesis) {
      toast("Informe seu diagnóstico", { type: "warning" });
      return;
    }
  }

  const justification = document.getElementById("hypothesis-justification").value.trim();
  if (!justification) {
    toast("Justifique seu diagnóstico antes de enviar.", { type: "warning" });
    document.getElementById("hypothesis-justification").focus();
    return;
  }

  const btn = document.getElementById("submit-hypothesis-btn");
  btn.disabled = true;

  try {
    const isCorrect = checkHypothesis(hypothesis);
    await submitHypothesis(attempt.id, hypothesis, attempt.currentStepIndex, isCorrect, justification);
    attempt.hypotheses = [
      ...(attempt.hypotheses || []),
      { text: hypothesis, justification, correct: isCorrect, stepIndex: attempt.currentStepIndex }
    ];

    const feedbackEl = document.getElementById("hypothesis-feedback");
    feedbackEl.style.display = "block";

    if (isCorrect) {
      feedbackEl.className = "hypothesis-feedback is-correct";
      feedbackEl.textContent = "✓ Diagnóstico aceito! Você pode encerrar o caso ou solicitar mais informações.";
    } else {
      feedbackEl.className = "hypothesis-feedback is-neutral";
      feedbackEl.textContent = "Esse diagnóstico não corresponde às respostas aceitas cadastradas para o caso. Revise os dados ou solicite uma dica.";
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

  const diagnosisKeywords = Array.isArray(caseVersion.diagnosisKeywords)
    ? caseVersion.diagnosisKeywords
    : currentCase.diagnosisKeywords || [];
  const acceptedAnswers = [
    ...diagnosisKeywords,
    caseVersion.diagnosis || currentCase.diagnosis
  ];
  return acceptedAnswers.filter(keyword => typeof keyword === "string" && keyword.trim()).some(keyword => {
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
  if (!attempt.hypotheses?.some(item => item.text && item.justification)) {
    toast("Envie seu diagnóstico e a justificativa antes de encerrar o caso.", { type: "warning" });
    document.getElementById("hypothesis-justification").focus();
    return;
  }
  if (!confirm("Encerrar o caso? Sua pontuação será registrada.")) return;

  try {
    const result = await completeAttempt(attempt.id, currentUser.uid, caseId);
    currentCase.aggregate = {
      ...(currentCase.aggregate || {}),
      solvedCount: (Number(currentCase.aggregate?.solvedCount) || 0) + 1
    };
    attempt.status = "solved";
    attempt.score = result.score;
    attempt.durationSeconds = result.durationSeconds;
    attempt.completedAt = new Date();
    renderSavedResult();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    toast("Erro ao encerrar caso", { type: "danger" });
  }
});

// Favoritar
document.getElementById("favorite-btn").addEventListener("click", async () => {
  try {
    const isFav = await toggleFavorite(currentUser.uid, caseId);
    const favoriteButton = document.getElementById("favorite-btn");
    favoriteButton.textContent = isFav ? "♥" : "♡";
    favoriteButton.setAttribute("aria-label", isFav ? "Remover dos favoritos" : "Adicionar aos favoritos");
    toast(isFav ? "Adicionado aos favoritos" : "Removido dos favoritos", { type: "success", duration: 2000 });
  } catch (err) {
    console.error(err);
    toast("Erro ao favoritar", { type: "danger" });
  }
});

document.getElementById("redo-case-btn").addEventListener("click", async () => {
  const button = document.getElementById("redo-case-btn");
  button.disabled = true;
  try {
    caseVersion = await getCaseVersion(caseId, currentCase.currentVersion);
    if (!caseVersion) throw new Error("Versão atual do caso não encontrada");
    attempt = await startAttempt(currentUser.uid, caseId, currentCase.currentVersion);
    history.replaceState(null, "", `/caso.html?id=${encodeURIComponent(caseId)}`);
    resultView.hidden = true;
    progressPanel.hidden = false;
    hypothesisPanel.style.display = "";
    renderCase();
    renderSteps();
    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    toast(error.message || "Não foi possível iniciar outra tentativa.", { type: "danger" });
    button.disabled = false;
  }
});

document.getElementById("rating-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = document.getElementById("submit-rating-btn");
  const stars = Number(document.getElementById("rating-stars").value);
  const comment = document.getElementById("rating-comment").value.trim();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    toast("Selecione uma avaliação de 1 a 5 estrelas.", { type: "warning" });
    return;
  }

  button.disabled = true;
  try {
    const updatedAggregate = await rateCase(currentUser.uid, caseId, stars, comment);
    currentCase.aggregate = { ...(currentCase.aggregate || {}), ...updatedAggregate };
    await renderCommunityFeedback();
    toast("Avaliação salva!", { type: "success" });
  } catch (error) {
    console.error(error);
    toast(error.message || "Erro ao salvar avaliação.", { type: "danger" });
  } finally {
    button.disabled = false;
  }
});
