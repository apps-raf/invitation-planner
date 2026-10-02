/**
 * Streamlined Store with Supabase Cloud Sync, Audit Logging, and Real-time Support
 */

import { GoogleSheetSync } from './googleSync.js';
import { INITIAL_SPREADSHEET_PEOPLE } from './defaultPeople.js';
import {
  fetchAllGuests,
  updateGuest,
  batchUpdateGuests,
  deleteGuestRecord,
  logAction,
  batchLogActions,
  undoLogAction,
  getCurrentManager,
  setupRealtimeSubscriptions
} from './supabaseClient.js';

const STORAGE_KEY_PEOPLE = 'invitrack_people_v5';
const STORAGE_KEY_CONFIG = 'invitrack_gsheet_config_v5';

class Store {
  constructor() {
    this.subscribers = [];
    this.people = this.loadPeople();
    this.config = this.loadConfig();
    this.syncService = new GoogleSheetSync(this.config);
    this.isSyncing = false;
    this.isOnline = navigator.onLine;

    // Supabase Real-time connection status
    this.cloudConnected = false;
    this.auditSubscribers = [];

    this.initSupabaseSync();
  }

  async initSupabaseSync() {
    try {
      // 1. Fetch remote guests from Supabase
      const remoteGuests = await fetchAllGuests();
      if (remoteGuests && remoteGuests.length > 0) {
        this.people = remoteGuests;
        this.saveLocallyOnly();
        this.cloudConnected = true;
        this.notify();
      }

      // 2. Setup Realtime subscription
      setupRealtimeSubscriptions({
        onGuestsChange: (payload) => {
          this.handleRemoteGuestChange(payload);
        },
        onAuditChange: (payload) => {
          this.auditSubscribers.forEach(cb => cb(payload));
        }
      });
    } catch (err) {
      console.warn('Supabase initial sync error, using local storage:', err);
    }
  }

  handleRemoteGuestChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const idx = this.people.findIndex(p => p.id === newRecord.id);
      const mapped = {
        id: newRecord.id,
        name: newRecord.name,
        category: newRecord.category,
        familyName: newRecord.family_name || '',
        branch: newRecord.branch || '',
        gender: newRecord.gender || '',
        status: newRecord.status || 'pending',
        comment: newRecord.comment || '',
        invitedAt: newRecord.invited_at || null,
        updatedAt: newRecord.updated_at || null,
        updatedBy: newRecord.updated_by || 'Cloud'
      };

      if (idx !== -1) {
        this.people[idx] = mapped;
      } else {
        this.people.unshift(mapped);
      }
      this.saveLocallyOnly();
      this.notify();
    } else if (eventType === 'DELETE') {
      this.people = this.people.filter(p => p.id !== oldRecord.id);
      this.saveLocallyOnly();
      this.notify();
    }
  }

  onAuditUpdate(callback) {
    this.auditSubscribers.push(callback);
    return () => {
      this.auditSubscribers = this.auditSubscribers.filter(fn => fn !== callback);
    };
  }

  loadPeople() {
    const raw = localStorage.getItem(STORAGE_KEY_PEOPLE);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_PEOPLE, JSON.stringify(INITIAL_SPREADSHEET_PEOPLE));
      return [...INITIAL_SPREADSHEET_PEOPLE];
    }
    try {
      const parsed = JSON.parse(raw);
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

  saveLocallyOnly() {
    localStorage.setItem(STORAGE_KEY_PEOPLE, JSON.stringify(this.people));
  }

  save() {
    this.saveLocallyOnly();
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
      isSyncing: this.isSyncing,
      cloudConnected: this.cloudConnected
    };
  }

  getDetailedStats(category = 'all') {
    const list = category === 'all' 
      ? this.people 
      : this.people.filter(p => p.category === category);

    const sub = (status) => {
      const items = status === 'total' ? list : list.filter(p => p.status === status);
      return {
        total: items.length,
        f: items.filter(p => p.gender === 'F').length,
        h: items.filter(p => p.gender === 'H').length
      };
    };

    return {
      total: sub('total'),
      invited: sub('invited'),
      pending: sub('pending'),
      declined: sub('declined')
    };
  }

  getAllCategoriesStats() {
    const cats = ['Famille', 'Belle Famille', 'Voisins', 'Amis'];
    return cats.map(cat => {
      const list = this.people.filter(p => p.category === cat);
      const sub = (status) => {
        const items = status === 'total' ? list : list.filter(p => p.status === status);
        return {
          total: items.length,
          f: items.filter(p => p.gender === 'F').length,
          h: items.filter(p => p.gender === 'H').length
        };
      };
      return {
        category: cat,
        total: sub('total'),
        invited: sub('invited'),
        pending: sub('pending'),
        declined: sub('declined')
      };
    });
  }

  getActiveManagerName() {
    const mgr = getCurrentManager();
    return mgr ? mgr.name : 'rafik';
  }

  // --- Actions with Cloud Sync & Audit Log ---

  addPerson(name, category = 'Famille', branch = '', gender = '', comment = '') {
    if (!name || !name.trim()) return null;
    const managerName = this.getActiveManagerName();

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

    // Async Cloud Sync
    updateGuest(newPerson, managerName).catch(console.error);
    logAction({
      managerName,
      guestId: newPerson.id,
      guestName: newPerson.name,
      actionType: 'add',
      previousStatus: null,
      newStatus: 'pending',
      previousComment: '',
      newComment: newPerson.comment
    }).catch(console.error);

    return newPerson;
  }

  markInvited(id) {
    const person = this.people.find(p => p.id === id);
    if (!person) return null;

    const previousStatus = person.status;
    const previousComment = person.comment || '';
    const managerName = this.getActiveManagerName();

    person.status = 'invited';
    person.invitedAt = new Date().toISOString();
    this.save();

    // Async Cloud Sync & Audit Log
    updateGuest(person, managerName).catch(console.error);
    logAction({
      managerName,
      guestId: person.id,
      guestName: person.name,
      actionType: 'invited',
      previousStatus,
      newStatus: 'invited',
      previousComment,
      newComment: person.comment || ''
    }).catch(console.error);

    return person;
  }

  markDeclined(id, comment = '') {
    const person = this.people.find(p => p.id === id);
    if (!person) return null;

    const previousStatus = person.status;
    const previousComment = person.comment || '';
    const managerName = this.getActiveManagerName();

    person.status = 'declined';
    person.invitedAt = null;
    if (comment !== undefined) {
      person.comment = comment.trim();
    }
    this.save();

    // Async Cloud Sync & Audit Log
    updateGuest(person, managerName).catch(console.error);
    logAction({
      managerName,
      guestId: person.id,
      guestName: person.name,
      actionType: 'declined',
      previousStatus,
      newStatus: 'declined',
      previousComment,
      newComment: person.comment || ''
    }).catch(console.error);

    return person;
  }

  markPending(id) {
    const person = this.people.find(p => p.id === id);
    if (!person) return null;

    const previousStatus = person.status;
    const previousComment = person.comment || '';
    const managerName = this.getActiveManagerName();

    person.status = 'pending';
    person.invitedAt = null;
    this.save();

    // Async Cloud Sync & Audit Log
    updateGuest(person, managerName).catch(console.error);
    logAction({
      managerName,
      guestId: person.id,
      guestName: person.name,
      actionType: 'pending',
      previousStatus,
      newStatus: 'pending',
      previousComment,
      newComment: person.comment || ''
    }).catch(console.error);

    return person;
  }

  markBatchInvited(personIds) {
    if (!Array.isArray(personIds) || personIds.length === 0) return 0;
    const now = new Date().toISOString();
    const managerName = this.getActiveManagerName();
    const updatedPersons = [];
    const auditEntries = [];

    this.people.forEach(p => {
      if (personIds.includes(p.id) && p.status !== 'invited') {
        const previousStatus = p.status;
        p.status = 'invited';
        p.invitedAt = now;
        updatedPersons.push(p);

        auditEntries.push({
          managerName,
          guestId: p.id,
          guestName: p.name,
          actionType: 'invited',
          previousStatus,
          newStatus: 'invited',
          previousComment: p.comment || '',
          newComment: p.comment || ''
        });
      }
    });

    if (updatedPersons.length > 0) {
      this.save();
      // Batch sync in background
      batchUpdateGuests(updatedPersons, managerName).catch(console.error);
      batchLogActions(auditEntries).catch(console.error);
    }

    return updatedPersons.length;
  }

  deletePerson(id) {
    const person = this.people.find(p => p.id === id);
    if (!person) return false;

    const managerName = this.getActiveManagerName();
    this.people = this.people.filter(p => p.id !== id);
    this.save();

    deleteGuestRecord(id).catch(console.error);
    logAction({
      managerName,
      guestId: id,
      guestName: person.name,
      actionType: 'delete',
      previousStatus: person.status,
      newStatus: null,
      previousComment: person.comment || '',
      newComment: ''
    }).catch(console.error);

    return true;
  }

  async undoAction(logId) {
    const managerName = this.getActiveManagerName();
    const res = await undoLogAction(logId, managerName);
    if (res.success && res.guestId) {
      const person = this.people.find(p => p.id === res.guestId);
      if (person) {
        person.status = res.previousStatus || 'pending';
        if (person.status !== 'invited') {
          person.invitedAt = null;
        }
        this.save();
      }
    }
    return res;
  }

  resetToDefault() {
    this.people = [...INITIAL_SPREADSHEET_PEOPLE];
    this.save();
    const managerName = this.getActiveManagerName();
    batchUpdateGuests(this.people, managerName).catch(console.error);
  }
}

export const store = new Store();
