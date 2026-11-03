const LINKS = [
  { label: "Painel", href: "/dashboard.html", matches: ["/dashboard.html"] },
  { label: "Casoteca", href: "/casoteca.html", matches: ["/casoteca.html", "/caso.html"] },
  { label: "Criar caso", href: "/criar-caso.html", matches: ["/criar-caso.html", "/editar-caso.html"] },
  { label: "Meus casos", href: "/meus-casos.html", matches: ["/meus-casos.html"] },
  { label: "Histórico", href: "/historico.html", matches: ["/historico.html"] },
  { label: "Favoritos", href: "/favoritos.html", matches: ["/favoritos.html"] }
];

function createLink(label, href, className) {
  const link = document.createElement("a");
  link.href = href;
  link.className = className;
  link.textContent = label;
  return link;
}

function installSiteNavigation() {
  const existingHeader = document.querySelector(".app-header");
  const adminHeader = document.querySelector(".admin-header");
  const header = existingHeader || document.createElement("header");
  header.classList.add("app-header");

  const container = existingHeader?.querySelector(".container") || document.createElement("div");
  container.classList.add("container");

  const brand = container.querySelector(".brand") || createLink("LIDMED HUB", "/dashboard.html", "brand");
  if (!brand.querySelector(".brand-mark")) {
    const mark = document.createElement("span");
    mark.className = "brand-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "L";
    brand.prepend(mark);
  }
  brand.setAttribute("aria-label", "LIDMED HUB, ir para o painel");

  const actions = container.querySelector(":scope > .row, :scope > nav");
  if (actions) {
    actions.classList.add("site-nav-actions");
    if (actions.tagName === "NAV") actions.setAttribute("aria-label", "Ações da conta");
  }

  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "Navegação principal");

  const navLinks = document.createElement("div");
  navLinks.className = "site-nav-links";
  const currentPath = location.pathname === "/" ? "/dashboard.html" : location.pathname;

  LINKS.forEach(item => {
    const link = createLink(item.label, item.href, "site-nav-link");
    if (item.matches.includes(currentPath)) link.setAttribute("aria-current", "page");
    navLinks.append(link);
  });
  nav.append(navLinks);

  const isPublicEntryPage = ["/", "/index.html", "/index-futuramente.html", "/login.html", "/cadastro.html", "/404.html"]
    .includes(location.pathname);
  if (!actions && !existingHeader && isPublicEntryPage) {
    const authActions = document.createElement("div");
    authActions.className = "site-nav-actions";
    authActions.append(
      createLink("Entrar", "/login.html", "btn btn-ghost btn-sm"),
      createLink("Criar conta", "/cadastro.html", "btn btn-primary btn-sm")
    );
    container.replaceChildren(brand, nav, authActions);
  } else {
    container.replaceChildren(brand, nav, ...(actions ? [actions] : []));
  }

  if (!existingHeader) {
    header.append(container);
    if (adminHeader) {
      adminHeader.before(header);
    } else {
      document.body.prepend(header);
    }
  }
}

installSiteNavigation();
