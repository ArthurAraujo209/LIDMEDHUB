import { auth, onAuthStateChanged } from "../firebase.js";
import { getUserDoc } from "../auth.js";

const LINKS = [
  { label: "Painel", href: "/dashboard.html", matches: ["/dashboard.html"] },
  { label: "Casoteca", href: "/casoteca.html", matches: ["/casoteca.html", "/caso.html"] },
  { label: "Criar caso", href: "/criar-caso.html", matches: ["/criar-caso.html", "/editar-caso.html"] },
  { label: "Meus casos", href: "/meus-casos.html", matches: ["/meus-casos.html"] },
  { label: "Histórico", href: "/historico.html", matches: ["/historico.html"] },
  { label: "Favoritos", href: "/favoritos.html", matches: ["/favoritos.html"] }
];

let accountActions = null;
let authStateRequest = 0;

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

  const isPublicEntryPage = ["/", "/index.html", "/index-futuramente.html", "/login.html", "/cadastro.html", "/404.html"]
    .includes(location.pathname);
  accountActions = container.querySelector(":scope > .row, :scope > nav");
  if (!accountActions && !isPublicEntryPage) {
    accountActions = document.createElement("div");
    accountActions.className = "site-nav-actions";
  }
  if (accountActions) {
    accountActions.classList.add("site-nav-actions");
    accountActions.querySelectorAll('a[href="/meu-perfil.html"]').forEach(link => link.remove());
    if (accountActions.tagName === "NAV") accountActions.setAttribute("aria-label", "Ações da conta");
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

  if (!accountActions && isPublicEntryPage) {
    const authActions = document.createElement("div");
    authActions.className = "site-nav-actions";
    authActions.append(
      createLink("Entrar", "/login.html", "btn btn-ghost btn-sm"),
      createLink("Criar conta", "/cadastro.html", "btn btn-primary btn-sm")
    );
    container.replaceChildren(brand, nav, authActions);
    accountActions = authActions;
  } else {
    container.replaceChildren(brand, nav, ...(accountActions ? [accountActions] : []));
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
onAuthStateChanged(auth, async user => {
  const requestId = ++authStateRequest;
  accountActions?.querySelector("[data-site-profile]")?.remove();
  if (!user || !accountActions) return;

  accountActions.querySelectorAll('a[href="/login.html"], a[href="/cadastro.html"]').forEach(link => link.remove());

  let profile = null;
  try {
    profile = await getUserDoc(user.uid);
  } catch (error) {
    console.error("Não foi possível carregar a foto do perfil no cabeçalho.", error);
  }
  if (requestId !== authStateRequest) return;

  const profileLink = createLink("Perfil", "/meu-perfil.html", "site-profile-link");
  profileLink.dataset.siteProfile = "true";
  profileLink.setAttribute("aria-label", "Abrir perfil");

  const photoURL = profile?.photoURL || user.photoURL;
  profileLink.prepend(createProfileAvatar(photoURL));

  const logoutButton = accountActions.querySelector("#logout-btn");
  accountActions.insertBefore(profileLink, logoutButton || null);
});

window.addEventListener("profile-updated", event => {
  const avatar = accountActions?.querySelector("[data-site-profile] .site-profile-avatar");
  if (!avatar) return;
  avatar.replaceWith(createProfileAvatar(event.detail?.photoURL || ""));
});

function createProfileAvatar(photoURL) {
  const avatar = document.createElement("span");
  avatar.className = "site-profile-avatar";
  avatar.setAttribute("aria-hidden", "true");
  if (!photoURL) {
    avatar.appendChild(createDefaultAvatar());
    return avatar;
  }

  const image = document.createElement("img");
  image.src = photoURL;
  image.alt = "";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    avatar.replaceChildren(createDefaultAvatar());
  }, { once: true });
  avatar.appendChild(image);
  return avatar;
}

function createDefaultAvatar() {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.8");
  icon.setAttribute("aria-hidden", "true");
  const head = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  head.setAttribute("cx", "12");
  head.setAttribute("cy", "8");
  head.setAttribute("r", "3.25");
  const shoulders = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shoulders.setAttribute("d", "M5.5 20a6.5 6.5 0 0 1 13 0");
  icon.append(head, shoulders);
  return icon;
}
