/**
 * Settings & Configuration View
 */

import { Utils } from '../utils.js';

export function renderSettings(store) {
  const { settings, guests } = store.getSnapshot();

  const container = document.createElement('div');
  container.className = 'space-y-6 animate-fade-in max-w-4xl mx-auto';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  container.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-white">Paramètres de l'Événement & Messages</h1>
      <p class="text-xs text-slate-400 mt-0.5">Personnalisez les détails de l'événement et vos modèles de messages WhatsApp.</p>
    </div>

    <!-- Event Details Form -->
    <div class="glass-panel rounded-2xl p-6 border border-slate-700/60 space-y-4">
      <h2 class="text-base font-bold text-white flex items-center gap-2">
        <span>🎉 Détails de l'Événement</span>
      </h2>

      <form id="settings-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Nom de l'événement</label>
          <input type="text" id="set-event-name" value="${escapeHtml(settings.eventName)}" required class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Date</label>
            <input type="date" id="set-event-date" value="${settings.eventDate || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Heure de début</label>
            <input type="time" id="set-event-time" value="${settings.eventTime || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Lieu / Salle</label>
            <input type="text" id="set-event-venue" value="${escapeHtml(settings.venue)}" placeholder="Nom et adresse du lieu" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Date limite de réponse (RSVP)</label>
            <input type="date" id="set-event-deadline" value="${settings.rsvpDeadline || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Lien de l'invitation interactive (Site Web)</label>
          <input type="url" id="set-event-url" value="${escapeHtml(settings.invitationUrl)}" placeholder="https://celina-mariage.github.io/invitation/" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          <p class="text-[11px] text-slate-400 mt-1">Ce lien sera inséré dans vos messages WhatsApp pour que les invités puissent ouvrir leur carton d'invitation en ligne.</p>
        </div>

        <!-- WhatsApp Template Editor -->
        <div class="pt-4 border-t border-slate-800">
          <label class="block text-xs font-semibold text-slate-300 mb-1">Modèle de message WhatsApp</label>
          
          <!-- Variable Tags Pill bar -->
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span class="text-xs text-slate-400 self-center mr-1">Variables :</span>
            <button type="button" data-insert="{name}" class="tag-insert-btn px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition">{name}</button>
            <button type="button" data-insert="{seats}" class="tag-insert-btn px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition">{seats}</button>
            <button type="button" data-insert="{event_name}" class="tag-insert-btn px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition">{event_name}</button>
            <button type="button" data-insert="{date}" class="tag-insert-btn px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition">{date}</button>
            <button type="button" data-insert="{time}" class="tag-insert-btn px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition">{time}</button>
            <button type="button" data-insert="{venue}" class="tag-insert-btn px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition">{venue}</button>
            <button type="button" data-insert="{rsvp_deadline}" class="tag-insert-btn px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition">{rsvp_deadline}</button>
            <button type="button" data-insert="{invitation_url}" class="tag-insert-btn px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition">{invitation_url}</button>
          </div>

          <textarea id="set-wa-template" rows="8" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-sans leading-relaxed">${escapeHtml(settings.whatsappTemplate)}</textarea>
        </div>

        <div class="pt-4 flex justify-end">
          <button type="submit" class="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition">
            Sauvegarder les modifications
          </button>
        </div>
      </form>
    </div>

    <!-- Data Backup & Restore -->
    <div class="glass-panel rounded-2xl p-6 border border-slate-700/60 space-y-4">
      <h2 class="text-base font-bold text-white flex items-center gap-2">
        <span>💾 Sauvegarde & Restauration des Données</span>
      </h2>
      <p class="text-xs text-slate-400">Toutes vos données sont stockées de façon sécurisée et privée sur votre appareil. Vous pouvez exporter un fichier de sauvegarde pour ne jamais perdre vos informations.</p>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Download JSON backup -->
        <button id="btn-export-backup" class="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition flex items-center gap-2">
          <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Télécharger la sauvegarde complète (JSON)
        </button>

        <!-- Restore JSON backup -->
        <button id="btn-import-backup" class="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition flex items-center gap-2">
          <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Restaurer une sauvegarde
        </button>
        <input type="file" id="file-backup-input" accept=".json" class="hidden" />

        <!-- Reset to defaults -->
        <button id="btn-reset-demo" class="px-4 py-2 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition">
          Réinitialiser avec les données d'exemple
        </button>
      </div>
    </div>
  `;

  setTimeout(() => {
    const form = container.querySelector('#settings-form');
    const templateTextarea = container.querySelector('#set-wa-template');

    // Insert variable tag into textarea at cursor
    container.querySelectorAll('.tag-insert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-insert');
        const start = templateTextarea.selectionStart;
        const end = templateTextarea.selectionEnd;
        const text = templateTextarea.value;
        templateTextarea.value = text.substring(0, start) + tag + text.substring(end);
        templateTextarea.focus();
        templateTextarea.selectionStart = templateTextarea.selectionEnd = start + tag.length;
      });
    });

    // Save settings
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      store.saveSettings({
        eventName: container.querySelector('#set-event-name').value,
        eventDate: container.querySelector('#set-event-date').value,
        eventTime: container.querySelector('#set-event-time').value,
        venue: container.querySelector('#set-event-venue').value,
        rsvpDeadline: container.querySelector('#set-event-deadline').value,
        invitationUrl: container.querySelector('#set-event-url').value,
        whatsappTemplate: templateTextarea.value
      });
      Utils.showToast('Paramètres et modèle sauvegardés avec succès !', 'success');
    });

    // Export backup JSON
    container.querySelector('#btn-export-backup')?.addEventListener('click', () => {
      const data = {
        exportedAt: new Date().toISOString(),
        settings: store.settings,
        guests: store.guests
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sauvegarde_invitations_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      Utils.showToast('Fichier de sauvegarde téléchargé', 'success');
    });

    // Restore backup JSON
    const fileBackup = container.querySelector('#file-backup-input');
    container.querySelector('#btn-import-backup')?.addEventListener('click', () => {
      fileBackup.click();
    });

    fileBackup?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed.guests && Array.isArray(parsed.guests)) {
            store.guests = parsed.guests;
            store.saveGuests();
          }
          if (parsed.settings && typeof parsed.settings === 'object') {
            store.saveSettings(parsed.settings);
          }
          Utils.showToast('Sauvegarde restaurée avec succès !', 'success');
          // Re-render settings view
          const parent = container.parentElement;
          if (parent) {
            container.remove();
            parent.appendChild(renderSettings(store));
          }
        } catch (err) {
          Utils.showToast('Erreur lors de la lecture du fichier JSON', 'error');
        }
      };
      reader.readAsText(file);
      fileBackup.value = '';
    });

    // Reset demo
    container.querySelector('#btn-reset-demo')?.addEventListener('click', () => {
      if (confirm('Voulez-vous réinitialiser les données avec les exemples par défaut ?')) {
        store.resetToDefault();
        Utils.showToast('Données réinitialisées avec succès', 'info');
        const parent = container.parentElement;
        if (parent) {
          container.remove();
          parent.appendChild(renderSettings(store));
        }
      }
    });
  }, 0);

  return container;
}
