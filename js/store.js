/**
 * Streamlined Store for Invitation Tracking (v5 with Belle Famille)
 */

import { GoogleSheetSync } from './googleSync.js';
import { INITIAL_SPREADSHEET_PEOPLE } from './defaultPeople.js';

const STORAGE_KEY_PEOPLE = 'invitrack_people_v5';
const STORAGE_KEY_CONFIG = 'invitrack_gsheet_config_v5';

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
      localStorage.setItem(STORAGE_KEY_PEOPLE, JSON.stringify(INITIAL_SPREADSHEET_PEOPLE));
      return [...INITIAL_SPREADSHEET_PEOPLE];
    }
    try {
      const parsed = JSON.parse(raw);
      // Auto-migrate if Belle Famille was missing
      if (parsed.length < 250 || !parsed.some(p => p.category === 'Belle Famille')) {
        localStorage.setItem(STORAGE_KEY_PEOPLE, JSON.stringify(INITIAL_SPREADSHEET_PEOPLE));
        return [...INITIAL_SPREADSHEET_PEOPLE];
      }
      return parsed;
    } catch {
      return [...INITIAL_SPREADSHEET_PEOPLE];
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
        viewMode: 'grouped'
      };
    }
    try {
      return { viewMode: 'grouped', ...JSON.parse(raw) };
    } catch {
      return { rawUrl: '', endpointUrl: '', sheetCsvUrl: '', lastSync: null, viewMode: 'grouped' };
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
      declined: this.people.filter(p => p.status === 'declined').length,
      femmes: this.people.filter(p => p.gender === 'F').length,
      hommes: this.people.filter(p => p.gender === 'H').length
    };

    const categories = {
      'Famille': this.people.filter(p => p.category === 'Famille').length,
      'Belle Famille': this.people.filter(p => p.category === 'Belle Famille').length,
      'Voisins': this.people.filter(p => p.category === 'Voisins').length,
      'Amis': this.people.filter(p => p.category === 'Amis').length
    };

    const branches = {};
    this.people.filter(p => p.category === 'Famille').forEach(p => {
      let b = '';
      if (p.branch) {
        b = `Branche ${p.branch}`;
      } else if (p.familyName && p.familyName !== 'Ourahmoune') {
        b = `Famille ${p.familyName}`;
      } else {
        b = 'Famille Ourahmoune (Membres directs)';
      }
      branches[b] = (branches[b] || 0) + 1;
    });

    return {
      people: this.people,
      counts,
      categories,
      branches,
      config: this.config,
      isSyncing: this.isSyncing
    };
  }

  // --- Actions ---

  addPerson(name, category = 'Famille', branch = '', gender = '', comment = '') {
    if (!name || !name.trim()) return null;

    const newPerson = {
      id: 'p_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      category: category.trim() || 'Famille',
      branch: (branch || '').trim(),
      gender: gender || '',
      status: 'pending',
      invitedAt: null,
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

  markBatchInvited(personIds) {
    if (!Array.isArray(personIds) || personIds.length === 0) return 0;
    const now = new Date().toISOString();
    let updated = 0;

    this.people.forEach(p => {
      if (personIds.includes(p.id)) {
        p.status = 'invited';
        p.invitedAt = now;
        updated++;
        if (this.config.endpointUrl) {
          this.syncService.saveGuestToSheet(p).catch(console.error);
        }
      }
    });

    this.save();
    return updated;
  }

  markBatchPending(personIds) {
    if (!Array.isArray(personIds) || personIds.length === 0) return 0;
    let updated = 0;

    this.people.forEach(p => {
      if (personIds.includes(p.id)) {
        p.status = 'pending';
        p.invitedAt = null;
        updated++;
        if (this.config.endpointUrl) {
          this.syncService.saveGuestToSheet(p).catch(console.error);
        }
      }
    });

    this.save();
    return updated;
  }

  deletePerson(id) {
    this.people = this.people.filter(p => p.id !== id);
    this.save();
  }

  resetToInitialList() {
    this.people = [...INITIAL_SPREADSHEET_PEOPLE];
    this.save();
  }
}

export const store = new Store();
