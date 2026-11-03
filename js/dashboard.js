import { getCategories, listCases } from "./catalog.js";

const FEED_LIMIT = 8;

function setEmptyState(containerId, message) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const empty = document.createElement("p");
  empty.className = "feed-empty";
  empty.textContent = message;
  container.replaceChildren(empty);
}

function createCaseCard(caseData, categories) {
  const card = document.createElement("a");
  card.className = "feed-case-card";
  card.href = `/caso.html?id=${encodeURIComponent(caseData.id)}`;

  const meta = document.createElement("div");
  meta.className = "feed-case-meta";

  const specialty = document.createElement("span");
  specialty.className = "feed-case-specialty";
  specialty.textContent =
    categories.find(category => category.slug === caseData.specialty)?.name ||
    String(caseData.specialty || "Caso clínico").replace(/[-_]/g, " ");
  meta.append(specialty);

  if (caseData.difficulty) {
    const level = document.createElement("span");
    level.className = "badge";
    level.textContent = `Nível ${caseData.difficulty}`;
    meta.append(level);
  }

  const title = document.createElement("h4");
  title.textContent = caseData.title || "Caso clínico sem título";

  const stats = document.createElement("div");
  stats.className = "feed-case-stats";
  stats.textContent = `${caseData.aggregate?.attemptCount || 0} tentativas`;

  const ratingCount = caseData.aggregate?.ratingCount || 0;
  if (ratingCount > 0) {
    const rating = document.createElement("span");
    rating.className = "feed-case-rating";
    rating.textContent = `★ ${Number(caseData.aggregate.ratingAvg || 0).toFixed(1)} (${ratingCount})`;
    stats.append(rating);
  }

  const author = document.createElement("span");
  author.className = "feed-case-author";
  author.textContent = `Por ${caseData.authorPublicName || "Comunidade LIDMED"}`;

  card.append(meta, title, stats, author);
  return card;
}

function renderCases(containerId, result, categories, label) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (result.status === "rejected") {
    console.error(`Erro ao carregar ${label}:`, result.reason);
    setEmptyState(containerId, "Não foi possível carregar esta seção. Tente novamente mais tarde.");
    return;
  }

  const cases = result.value.cases;
  if (cases.length === 0) {
    setEmptyState(containerId, "Ainda não há casos publicados nesta seção.");
    return;
  }

  container.replaceChildren(...cases.map(caseData => createCaseCard(caseData, categories)));
}

function renderTopics(recentCases, popularCases, categories) {
  const container = document.getElementById("feed-topics");
  const uniqueCases = new Map([...recentCases, ...popularCases].map(caseData => [caseData.id, caseData]));
  const counts = new Map();

  uniqueCases.forEach(caseData => {
    if (!caseData.specialty) return;
    counts.set(caseData.specialty, (counts.get(caseData.specialty) || 0) + 1);
  });

  const topics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6);

  if (topics.length === 0) {
    setEmptyState("feed-topics", "Os assuntos em alta aparecerão quando novos casos forem publicados.");
    return;
  }

  container.replaceChildren(...topics.map(([slug, count]) => {
    const topic = document.createElement("a");
    topic.className = "feed-topic";
    topic.href = `/casoteca.html?specialty=${encodeURIComponent(slug)}`;
    topic.textContent = `${categories.find(category => category.slug === slug)?.name || slug} · ${count}`;
    return topic;
  }));
}

function renderCreators(recentCases) {
  const creators = new Map();
  recentCases.forEach(caseData => {
    if (!caseData.authorId) return;
    const creator = creators.get(caseData.authorId) || {
      id: caseData.authorId,
      name: caseData.authorPublicName || "Criador da comunidade",
      cases: 0
    };
    creator.cases += 1;
    creators.set(caseData.authorId, creator);
  });

  const featuredCreators = [...creators.values()]
    .sort((a, b) => b.cases - a.cases || a.name.localeCompare(b.name))
    .slice(0, 4);
  const container = document.getElementById("feed-creators");

  if (featuredCreators.length === 0) {
    setEmptyState("feed-creators", "Os criadores aparecerão aqui após as primeiras publicações.");
    return;
  }

  container.replaceChildren(...featuredCreators.map(creator => {
    const card = document.createElement("a");
    card.className = "feed-creator-card";
    card.href = `/perfil.html?uid=${encodeURIComponent(creator.id)}`;

    const avatar = document.createElement("span");
    avatar.className = "feed-creator-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = creator.name.slice(0, 2).toLocaleUpperCase("pt-BR");

    const details = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = creator.name;
    const count = document.createElement("span");
    count.textContent = `${creator.cases} caso${creator.cases === 1 ? "" : "s"} entre os mais recentes`;
    details.append(name, count);
    card.append(avatar, details);
    return card;
  }));
}

export async function loadDashboardFeed() {
  const [recent, popular, rated, categoriesResult] = await Promise.allSettled([
    listCases({ sortBy: "recent" }, FEED_LIMIT),
    listCases({ sortBy: "popular" }, FEED_LIMIT),
    listCases({ sortBy: "rating" }, FEED_LIMIT)
      .then(result => ({
        ...result,
        cases: result.cases.filter(caseData => (caseData.aggregate?.ratingCount || 0) > 0)
      })),
    getCategories()
  ]);
  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];

  if (categoriesResult.status === "rejected") {
    console.error("Erro ao carregar especialidades do feed:", categoriesResult.reason);
  }

  renderCases("feed-recent", recent, categories, "casos recentes");
  renderCases("feed-popular", popular, categories, "casos populares");
  renderCases("feed-rated", rated, categories, "casos mais bem avaliados");
  renderTopics(
    recent.status === "fulfilled" ? recent.value.cases : [],
    popular.status === "fulfilled" ? popular.value.cases : [],
    categories
  );
  renderCreators(recent.status === "fulfilled" ? recent.value.cases : []);
}
