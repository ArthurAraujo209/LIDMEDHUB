// Sistema minimalista de notificações (toasts).
// Uso: toast('Mensagem', { type: 'success' | 'info' | 'warning' | 'danger', duration: 4000 })

let _container = null;

function ensureContainer() {
  if (_container) return _container;
  _container = document.createElement("div");
  _container.className = "toast-container";
  _container.setAttribute("role", "status");
  _container.setAttribute("aria-live", "polite");
  _container.setAttribute("aria-atomic", "false");
  document.body.appendChild(_container);
  return _container;
}

export function toast(message, options = {}) {
  if (!message) return;
  const { type = "info", duration = 4000 } = options;
  const container = ensureContainer();

  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = String(message);
  container.appendChild(el);

  requestAnimationFrame(() => el.classList.add("is-visible"));

  const remove = () => {
    el.classList.remove("is-visible");
    setTimeout(() => el.remove(), 250);
  };

  const timer = setTimeout(remove, Math.max(1200, duration));
  el.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
}