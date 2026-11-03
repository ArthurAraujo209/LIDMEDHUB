// Registra o Service Worker para funcionalidade PWA

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker não suportado neste navegador');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registrado:', registration.scope);

    // Verifica atualizações
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Nova versão disponível
          if (confirm('Nova versão disponível! Deseja atualizar?')) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }
        }
      });
    });
  } catch (err) {
    console.error('Erro ao registrar Service Worker:', err);
  }
}

// Detecta se está rodando como PWA instalado
export function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

// Prompt de instalação
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Mostra botão de instalação se quiser implementar
  const installBtn = document.getElementById('install-pwa-btn');
  if (installBtn) {
    installBtn.style.display = 'block';
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;

      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;

      if (result.outcome === 'accepted') {
        console.log('PWA instalado');
      }

      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  }
});

// Auto-registra em páginas autenticadas
if (location.pathname !== '/login.html' &&
    location.pathname !== '/cadastro.html' &&
    location.pathname !== '/index.html' &&
    location.pathname !== '/') {
  registerServiceWorker();
}
