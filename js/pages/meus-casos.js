import { requireApproved } from "../guards.js";
import { logout } from "../auth.js";
import { listMyCases } from "../cases.js";
import { toast } from "../ui/toast.js";

const casesGrid = document.getElementById("my-cases-grid");
const statusMessage = document.getElementById("my-cases-status");
const emptyState = document.getElementById("my-cases-empty");
const emptyTitle = document.getElementById("my-cases-empty-title");
const emptyDescription = document.getElementById("my-cases-empty-description");
const loadMoreContainer = document.getElementById("my-cases-load-more");
const loadMoreButton = document.getElementById("load-more-cases");
const tabs = [...document.querySelectorAll(".my-cases-tab")];
let allCases = [];
let currentFilter = "all";
let lastDoc = null;
let hasMore = false;
let currentUser = null;

const CASE_GROUPS = {
  draft: {
    label: "Rascunho",
    badgeClass: "is-draft"
  },
  public: {
    label: "Público",
    badgeClass: ""
  },
  private: {
    label: "Privado",
    badgeClass: "is-private"
  }
};

async function initialize() {
  const context = await requireApproved();
  if (!context) return;
  currentUser = context.user;
  await loadNextPage();
}

async function loadNextPage() {
  loadMoreButton.disabled = true;
  statusMessage.textContent = "Carregando seus casos...";
  try {
    const result = await listMyCases(currentUser.uid, 20, lastDoc);
    allCases.push(...result.cases);
    lastDoc = result.lastDoc;
    hasMore = result.hasMore;
    updateCounts();
    renderCases();
  } catch (error) {
    console.error(error);
    statusMessage.textContent = "Não foi possível carregar seus casos.";
    toast("Erro ao carregar seus casos. Tente novamente.", { type: "danger" });
  } finally {
    loadMoreButton.disabled = false;
  }
}

function getGroup(caseData) {
  if (caseData.status === "draft") return "draft";
  if (caseData.status === "published" && caseData.visibility === "private") return "private";
  if (caseData.status === "published" && caseData.visibility === "public") return "public";
  return null;
}

function updateCounts() {
  const counts = { all: 0, public: 0, private: 0, draft: 0 };
  allCases.forEach((caseData) => {
    const group = getGroup(caseData);
    if (!group) return;
    counts.all += 1;
    counts[group] += 1;
  });

  Object.entries(counts).forEach(([group, count]) => {
    const element = document.querySelector(`[data-count="${group}"]`);
    element.textContent = String(count);
  });
}

function renderCases() {
  const filteredCases = allCases.filter((caseData) => {
    const group = getGroup(caseData);
    return currentFilter === "all" ? Boolean(group) : group === currentFilter;
  });

  casesGrid.replaceChildren(...filteredCases.map(createCaseCard));
  emptyState.hidden = filteredCases.length > 0;
  casesGrid.hidden = filteredCases.length === 0;
  loadMoreContainer.hidden = !hasMore;

  if (allCases.length === 0) {
    statusMessage.textContent = "Nenhum caso criado ainda.";
    emptyTitle.textContent = "Você ainda não criou casos";
    emptyDescription.textContent = "Crie um caso clínico para ele aparecer nesta página.";
    return;
  }

  const loadedText = `${allCases.length} caso${allCases.length === 1 ? "" : "s"} carregado${allCases.length === 1 ? "" : "s"}`;
  statusMessage.textContent = `${filteredCases.length} exibido${filteredCases.length === 1 ? "" : "s"} · ${loadedText}${hasMore ? " · há mais" : ""}`;
  if (filteredCases.length === 0) {
    const groupLabel = currentFilter === "all"
      ? "disponível"
      : currentFilter === "draft"
        ? "em rascunho"
        : CASE_GROUPS[currentFilter].label.toLowerCase();
    emptyTitle.textContent = `Nenhum caso ${groupLabel}`;
    emptyDescription.textContent = hasMore
      ? "Carregue mais casos para verificar os itens mais antigos."
      : currentFilter === "draft"
        ? "Seus rascunhos aparecerão aqui para você editar os dados salvos."
        : currentFilter === "all"
          ? "Não encontramos casos com status reconhecido nesta conta."
          : "Tente outra categoria para ver seus casos.";
  }
}

function createCaseCard(caseData) {
  const group = getGroup(caseData);
  const groupConfig = CASE_GROUPS[group];
  const card = document.createElement("article");
  card.className = "my-case-card";

  const meta = document.createElement("div");
  meta.className = "my-case-card-meta";
  const badge = document.createElement("span");
  badge.className = `my-case-badge ${groupConfig.badgeClass}`.trim();
  badge.textContent = groupConfig.label;
  meta.appendChild(badge);

  const title = document.createElement("h2");
  title.textContent = caseData.title || "Caso sem título";

  const specialty = document.createElement("p");
  specialty.textContent = caseData.specialty || "Especialidade não informada";

  const stats = document.createElement("div");
  stats.className = "my-case-card-stats";
  const updated = document.createElement("span");
  updated.textContent = `Atualizado ${formatDate(caseData.updatedAt || caseData.createdAt)}`;
  stats.appendChild(updated);

  if (group !== "draft") {
    const attempts = document.createElement("span");
    attempts.textContent = `${caseData.aggregate?.attemptCount || 0} tentativas`;
    stats.appendChild(attempts);
  }

  const actions = document.createElement("div");
  actions.className = "my-case-card-actions";
  const editLink = document.createElement("a");
  editLink.className = "btn btn-secondary btn-sm";
  editLink.href = `/editar-caso.html?id=${encodeURIComponent(caseData.id)}`;
  editLink.textContent = group === "draft" ? "Editar dados do rascunho" : "Editar caso";
  actions.appendChild(editLink);

  if (group === "public") {
    const openLink = document.createElement("a");
    openLink.className = "btn btn-ghost btn-sm";
    openLink.href = `/caso.html?id=${encodeURIComponent(caseData.id)}`;
    openLink.textContent = "Abrir caso";
    actions.appendChild(openLink);
  }

  card.append(meta, title, specialty, stats, actions);
  return card;
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
  if (!date || Number.isNaN(date.getTime())) return "recentemente";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.filter;
    tabs.forEach((item) => {
      const isActive = item === tab;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });
    renderCases();
  });
});

loadMoreButton.addEventListener("click", loadNextPage);

document.getElementById("logout-btn").addEventListener("click", async () => {
  try {
    await logout();
  } catch (error) {
    console.error(error);
    toast("Não foi possível encerrar a sessão.", { type: "danger" });
    return;
  }
  location.replace("/login.html");
});

initialize();
