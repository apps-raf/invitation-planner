/**
 * Main Application Controller & Router
 */

import { store } from './store.js';
import { Utils } from './utils.js';
import { renderDashboard } from './views/dashboard.js';
import { renderGuests } from './views/guests.js';
import { renderInvitations } from './views/invitations.js';
import { renderCheckIn } from './views/checkin.js';
import { renderSettings } from './views/settings.js';

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.viewParams = {};
    this.deferredPrompt = null;

    this.initPWA();
    this.initNavigation();
    this.navigate('dashboard');
  }

  initPWA() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('Service Worker registered successfully:', reg.scope))
          .catch(err => console.log('Service Worker registration failed:', err));
      });
    }

    // Capture install prompt for PWA install button
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const installBtn = document.getElementById('btn-pwa-install');
      const mobileInstallBtn = document.getElementById('btn-mobile-pwa-install');
      if (installBtn) installBtn.classList.remove('hidden');
      if (mobileInstallBtn) mobileInstallBtn.classList.remove('hidden');
    });

    const triggerInstall = async () => {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          Utils.showToast('Application installée avec succès !', 'success');
        }
        this.deferredPrompt = null;
        document.getElementById('btn-pwa-install')?.classList.add('hidden');
        document.getElementById('btn-mobile-pwa-install')?.classList.add('hidden');
      }
    };

    document.getElementById('btn-pwa-install')?.addEventListener('click', triggerInstall);
    document.getElementById('btn-mobile-pwa-install')?.addEventListener('click', triggerInstall);
  }

  initNavigation() {
    // Navigation link clicks (desktop sidebar & mobile bottom bar)
    document.querySelectorAll('[data-nav]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-nav');
        this.navigate(view);
      });
    });

    // Handle browser back/forward or hash
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      if (hash !== this.currentView) {
        this.navigate(hash);
      }
    });
  }

  navigate(viewName, params = {}) {
    this.currentView = viewName;
    this.viewParams = params;
    window.location.hash = viewName;

    // Update active state in navigation
    document.querySelectorAll('[data-nav]').forEach(link => {
      const target = link.getAttribute('data-nav');
      if (target === viewName) {
        link.classList.add('active-nav');
        link.classList.remove('text-slate-400');
        link.classList.add('text-indigo-400', 'bg-indigo-500/10');
      } else {
        link.classList.remove('active-nav', 'text-indigo-400', 'bg-indigo-500/10');
        link.classList.add('text-slate-400');
      }
    });

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = '';

    const navHandler = (targetView, newParams) => this.navigate(targetView, newParams);

    let viewElement;
    switch (viewName) {
      case 'dashboard':
        viewElement = renderDashboard(store, navHandler);
        break;
      case 'guests':
        viewElement = renderGuests(store, navHandler, params);
        break;
      case 'invitations':
        viewElement = renderInvitations(store, navHandler);
        break;
      case 'checkin':
        viewElement = renderCheckIn(store);
        break;
      case 'settings':
        viewElement = renderSettings(store);
        break;
      default:
        viewElement = renderDashboard(store, navHandler);
    }

    mainContent.appendChild(viewElement);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
