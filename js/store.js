/**
 * Streamlined Store for Invitation Tracking
 */

import { GoogleSheetSync } from './googleSync.js';

const STORAGE_KEY_PEOPLE = 'invitrack_streamlined_people_v2';
const STORAGE_KEY_CONFIG = 'invitrack_gsheet_config_v2';

const SAMPLE_PEOPLE = [
  {
    id: "p_1",
    name: "Alexandre Dumas",
    category: "Famille",
    status: "invited",
    invitedAt: "2026-05-12T14:30:00.000Z",
    comment: ""
  },
  {
    id: "p_2",
    name: "Sophie Marceau",
    category: "Amis",
    status: "invited",
    invitedAt: "2026-05-14T09:15:00.000Z",
    comment: ""
  },
  {
    id: "p_3",
    name: "Lucas Bernard",
    category: "Amis",
    status: "pending",
    invitedAt: null,
    comment: "À confirmer selon budget"
  },
  {
    id: "p_4",
    name: "Pierre & Lucie Martin",
    category: "Famille",
    status: "invited",
    invitedAt: "2026-05-16T18:00:00.000Z",
    comment: ""
  },
  {
    id: "p_5",
    name: "Julien Girard",
    category: "Collègues",
    status: "declined",
    invitedAt: null,
    comment: "Pas vu depuis plus de 2 ans"
  },
  {
    id: "p_6",
    name: "Claire Dubois",
    category: "Amis",
    status: "pending",
    invitedAt: null,
    comment: ""
  }
];

class Store {
  constructor() {
    this.subscribers = [];
    this.people = this.loadPeople();
    this.config = this.loadConfig();
    this.syncService = new GoogleSheetSync(this.config);
    this.isSyncing = false;
  }

  loadPeople() {
    const raw = localStorage.getItem(STORAGE_KEY_PEOPLE);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_PEOPLE, JSON.stringify(SAMPLE_PEOPLE));
      return [...SAMPLE_PEOPLE];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  loadConfig() {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) {
      return {
        rawUrl: '',
        endpointUrl: '',
        sheetCsvUrl: '',
        lastSync: null,
        importMode: 'replace' // 'replace' | 'merge'
      };
    }
    try {
      return { importMode: 'replace', ...JSON.parse(raw) };
    } catch {
      return { rawUrl: '', endpointUrl: '', sheetCsvUrl: '', lastSync: null, importMode: 'replace' };
    }
  }

  save() {
    localStorage.setItem(STORAGE_KEY_PEOPLE, JSON.stringify(this.people));
    this.notify();
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    this.syncService = new GoogleSheetSync(this.config);
    this.notify();
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(fn => fn !== callback);
    };
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.subscribers.forEach(cb => cb(snapshot));
  }

  getSnapshot() {
    const counts = {
      total: this.people.length,
      invited: this.people.filter(p => p.status === 'invited').length,
      pending: this.people.filter(p => p.status === 'pending').length,
      declined: this.people.filter(p => p.status === 'declined').length
    };

    return {
      people: this.people,
      counts,
      config: this.config,
      isSyncing: this.isSyncing
    };
  }

  // --- Actions ---

  addPerson(name, category = 'Général', status = 'pending', comment = '') {
    if (!name || !name.trim()) return null;

    const newPerson = {
      id: 'p_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      category: category.trim() || 'Général',
      status: status || 'pending',
      invitedAt: status === 'invited' ? new Date().toISOString() : null,
      comment: (comment || '').trim()
    };

    this.people.unshift(newPerson);
    this.save();

    if (this.config.endpointUrl) {
      this.syncService.saveGuestToSheet(newPerson).catch(console.error);
    }

    return newPerson;
  }

  markInvited(id) {
    const person = this.people.find(p => p.id === id);
    if (!person) return null;

    person.status = 'invited';
    person.invitedAt = new Date().toISOString();
    this.save();

    if (this.config.endpointUrl) {
      this.syncService.saveGuestToSheet(person).catch(console.error);
    }

    return person;
  }

  markDeclined(id, comment = '') {
    const person = this.people.find(p => p.id === id);
    if (!person) return null;

    person.status = 'declined';
    person.invitedAt = null;
    if (comment !== undefined) {
      person.comment = comment.trim();
    }
    this.save();

    if (this.config.endpointUrl) {
      this.syncService.saveGuestToSheet(person).catch(console.error);
    }

    return person;
  }

  markPending(id) {
    const person = this.people.find(p => p.id === id);
    if (!person) return null;

    person.status = 'pending';
    person.invitedAt = null;
    this.save();

    if (this.config.endpointUrl) {
      this.syncService.saveGuestToSheet(person).catch(console.error);
    }

    return person;
  }

  updateComment(id, comment) {
    const person = this.people.find(p => p.id === id);
    if (!person) return null;

    person.comment = (comment || '').trim();
    this.save();

    if (this.config.endpointUrl) {
      this.syncService.saveGuestToSheet(person).catch(console.error);
    }

    return person;
  }

  deletePerson(id) {
    this.people = this.people.filter(p => p.id !== id);
    this.save();
  }

  clearAll() {
    this.people = [];
    this.save();
  }

  // Import / Sync with test & preview support
  async syncFromGoogleSheet(forcedUrl = null, mode = 'replace') {
    const targetUrl = forcedUrl || this.config.rawUrl || this.config.endpointUrl || this.config.sheetCsvUrl;
    if (!targetUrl) {
      return { success: false, message: 'Aucune URL de Google Sheet configurée' };
    }

    this.isSyncing = true;
    this.notify();

    try {
      const diag = await this.syncService.testConnection(targetUrl);
      if (!diag.success) {
        return { success: false, message: diag.error };
      }

      const imported = diag.rawGuests || [];
      if (imported.length === 0) {
        return { success: false, message: 'Aucune personne trouvée dans ce tableau' };
      }

      if (mode === 'replace') {
        // Overwrite completely with spreadsheet data (removes sample/demo data)
        this.people = imported;
      } else {
        // Merge with existing
        const map = new Map();
        this.people.forEach(p => map.set(p.name.toLowerCase().trim(), p));
        imported.forEach(p => {
          const key = p.name.toLowerCase().trim();
          if (map.has(key)) {
            const existing = map.get(key);
            existing.category = p.category || existing.category;
            existing.status = p.status || existing.status;
            existing.comment = p.comment || existing.comment;
            if (p.invitedAt) existing.invitedAt = p.invitedAt;
          } else {
            map.set(key, p);
          }
        });
        this.people = Array.from(map.values());
      }

      // Save resolved URLs
      const resolved = GoogleSheetSync.resolveUrl(targetUrl);
      this.config.rawUrl = targetUrl;
      this.config.lastSync = new Date().toISOString();
      if (resolved.type === 'appsscript') {
        this.config.endpointUrl = resolved.url;
      } else {
        this.config.sheetCsvUrl = resolved.url;
      }

      this.saveConfig({
        rawUrl: this.config.rawUrl,
        endpointUrl: this.config.endpointUrl,
        sheetCsvUrl: this.config.sheetCsvUrl,
        lastSync: this.config.lastSync,
        importMode: mode
      });

      this.save();
      return { 
        success: true, 
        count: imported.length, 
        type: diag.type, 
        detectedHeaders: diag.detectedHeaders 
      };

    } catch (err) {
      return { success: false, message: err.message || String(err) };
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const store = new Store();
