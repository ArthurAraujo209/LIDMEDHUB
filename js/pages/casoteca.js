import { requireApproved } from "../guards.js";
import { logout } from "../auth.js";
import { listCases, getCategories } from "../catalog.js";
import { toast } from "../ui/toast.js";

let currentFilters = {
  search: "",
  specialty: new URLSearchParams(location.search).get("specialty") || "",
  difficulty: "",
  sortBy: "recent"
};

let lastDoc = null;
let hasMore = true;
let categories = [];

const casesGrid = document.getElementById("cases-grid");
const emptyState = document.getElementById("empty-state");
const loadMoreContainer = document.getElementById("load-more-container");
const resultsCount = document.getElementById("results-count");

(async () => {
  const ctx = await requireApproved();
  if (!ctx) return;

  // Carrega categorias para o filtro
  categories = await getCategories();
  const specialtyFilter = document.getElementById("specialty-filter");
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.slug;
    option.textContent = cat.name;
    specialtyFilter.appendChild(option);
  });
  if (categories.some(category => category.slug === currentFilters.specialty)) {
    specialtyFilter.value = currentFilters.specialty;
  } else {
    currentFilters.specialty = "";
  }

  loadCases();
})();

// Carrega casos
async function loadCases(append = false) {
  if (!append) {
    casesGrid.innerHTML = '<p style="text-align: center; padding: var(--space-6);">Carregando...</p>';
    lastDoc = null;
    hasMore = true;
  }

  try {
    const result = await listCases(currentFilters, 12, append ? lastDoc : null);

    if (!append) {
      casesGrid.innerHTML = "";
    }

    if (result.cases.length === 0 && !append) {
      emptyState.style.display = "block";
      casesGrid.style.display = "none";
      loadMoreContainer.style.display = "none";
      resultsCount.textContent = "Nenhum caso encontrado";
      return;
    }

    emptyState.style.display = "none";
    casesGrid.style.display = "grid";

    result.cases.forEach(caseData => {
      const card = createCaseCard(caseData);
      casesGrid.appendChild(card);
    });

    lastDoc = result.lastDoc;
    hasMore = result.hasMore;

    loadMoreContainer.style.display = hasMore ? "block" : "none";

    const total = casesGrid.children.length;
    resultsCount.textContent = `${total} caso${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;
  } catch (err) {
    console.error(err);
    casesGrid.innerHTML = '<p style="text-align: center; color: var(--danger);">Erro ao carregar casos.</p>';
    toast("Erro ao carregar casos.", { type: "danger" });
  }
}

// Cria card de caso
function createCaseCard(caseData) {
  const card = document.createElement("a");
  card.className = "case-card";
  card.href = `/caso.html?id=${caseData.id}`;

  const difficultyClass = `diff-${caseData.difficulty}`;
  const stars = caseData.aggregate?.ratingAvg > 0
    ? '★'.repeat(Math.round(caseData.aggregate.ratingAvg))
    : '';
  const starsClass = caseData.aggregate?.ratingAvg > 0 ? '' : 'is-empty';

  const tags = (caseData.tags || []).slice(0, 3).map(tag =>
    `<span class="case-tag">${tag}</span>`
  ).join('');

  card.innerHTML = `
    <div class="case-card-header">
      <div>
        <h3 class="case-card-title">${caseData.title}</h3>
        <p class="case-card-specialty">${getCategoryName(caseData.specialty)}</p>
      </div>
    </div>
    <div class="case-card-meta">
      <span class="difficulty-badge ${difficultyClass}">
        Nível ${caseData.difficulty}
      </span>
      ${caseData.aggregate?.ratingAvg > 0 ? `
        <span class="rating-stars ${starsClass}">${stars}</span>
      ` : ''}
    </div>
    ${tags ? `<div class="case-tags">${tags}</div>` : ''}
    <div class="case-card-stats">
      <span class="case-card-stat">
        👥 ${caseData.aggregate?.attemptCount || 0} tentativas
      </span>
      <span class="case-card-stat">
        ✓ ${caseData.aggregate?.solvedCount || 0} resolvido${(caseData.aggregate?.solvedCount || 0) !== 1 ? 's' : ''}
      </span>
    </div>
    <div class="case-card-author">
      Por <a href="/perfil.html?uid=${caseData.authorId}" onclick="event.stopPropagation()">${caseData.authorPublicName}</a>
    </div>
  `;

  return card;
}

function getCategoryName(slug) {
  const cat = categories.find(c => c.slug === slug);
  return cat ? cat.name : slug;
}

// Filtros
document.getElementById("search-input").addEventListener("input", (e) => {
  currentFilters.search = e.target.value;
  debounce(() => loadCases(), 500)();
});

document.getElementById("specialty-filter").addEventListener("change", (e) => {
  currentFilters.specialty = e.target.value;
  loadCases();
});

document.getElementById("difficulty-filter").addEventListener("change", (e) => {
  currentFilters.difficulty = e.target.value;
  loadCases();
});

// Ordenação
document.querySelectorAll(".sort-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    currentFilters.sortBy = btn.dataset.sort;
    loadCases();
  });
});

// Load more
document.getElementById("load-more-btn").addEventListener("click", () => {
  loadCases(true);
});

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Logout
document.getElementById("logout-btn").addEventListener("click", async () => {
  try {
    await logout();
  } finally {
    location.replace("/login.html");
  }
});
