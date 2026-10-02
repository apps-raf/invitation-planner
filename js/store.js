/**
 * Reactive data store for Invitation Planner
 */

const STORAGE_KEY_GUESTS = 'invitrack_guests_v1';
const STORAGE_KEY_SETTINGS = 'invitrack_settings_v1';

const DEFAULT_SETTINGS = {
  eventName: "Mariage de Célina & Thomas",
  eventDate: "2026-07-18",
  eventTime: "15:30",
  venue: "Château de la Fontaine, 77000 Melun",
  rsvpDeadline: "2026-06-01",
  invitationUrl: "https://celina-mariage.github.io/invitation/",
  whatsappTemplate: "Bonjour {name} ! ✨\n\nNous avons l'immense joie de vous inviter à notre événement : {event_name}.\n\n📅 Date : {date} à {time}\n📍 Lieu : {venue}\n👥 Nombre de places réservées : {seats}\n\n👉 Découvrez votre invitation interactive et confirmez votre présence ici :\n{invitation_url}?guest={guest_id}\n\nMerci de nous donner votre réponse avant le {rsvp_deadline}. À très bientôt !"
};

const SAMPLE_GUESTS = [
  {
    id: "g_1",
    name: "Alexandre Dumas & Famille",
    phone: "+33612345678",
    email: "alexandre.d@example.com",
    category: "Famille Marié",
    seats: 3,
    table: "Table d'Honneur",
    notes: "1 menu végétarien",
    status: "confirmed",
    sentAt: "2026-05-10T10:00:00.000Z",
    confirmedAt: "2026-05-12T14:30:00.000Z",
    checkedIn: false
  },
  {
    id: "g_2",
    name: "Sophie Marceau",
    phone: "+33698765432",
    email: "sophie.m@example.com",
    category: "Témoins",
    seats: 2,
    table: "Table 1 - Les Roses",
    notes: "Sans gluten",
    status: "confirmed",
    sentAt: "2026-05-10T10:05:00.000Z",
    confirmedAt: "2026-05-11T09:15:00.000Z",
    checkedIn: false
  },
  {
    id: "g_3",
    name: "Lucas & Chloé Bernard",
    phone: "+33655443322",
    email: "lucas.b@example.com",
    category: "Amis",
    seats: 2,
    table: "Table 2 - Les Étoiles",
    notes: "",
    status: "sent",
    sentAt: "2026-05-11T16:20:00.000Z",
    confirmedAt: null,
    checkedIn: false
  },
  {
    id: "g_4",
    name: "Famille Martin (Pierre & Lucie)",
    phone: "+33677889900",
    email: "pierre.martin@example.com",
    category: "Famille Mariée",
    seats: 4,
    table: "Table 3 - Les Lys",
    notes: "2 menus enfants",
    status: "delivered",
    sentAt: "2026-05-11T16:25:00.000Z",
    confirmedAt: null,
    checkedIn: false
  },
  {
    id: "g_5",
    name: "Dr. Julien Girard",
    phone: "+33611223344",
    email: "j.girard@example.com",
    category: "Collègues",
    seats: 1,
    table: "Table 4 - Les Oliviers",
    notes: "",
    status: "draft",
    sentAt: null,
    confirmedAt: null,
    checkedIn: false
  },
  {
    id: "g_6",
    name: "Claire & Vincent Dubois",
    phone: "+33644556677",
    email: "vincent.dubois@example.com",
    category: "Amis",
    seats: 2,
    table: "",
    notes: "Empêchement professionnel à l'étranger",
    status: "declined",
    sentAt: "2026-05-10T11:00:00.000Z",
    confirmedAt: "2026-05-13T18:00:00.000Z",
    checkedIn: false
  }
];

class Store {
  constructor() {
    this.subscribers = [];
    this.guests = this.loadGuests();
    this.settings = this.loadSettings();
  }

  loadGuests() {
    const raw = localStorage.getItem(STORAGE_KEY_GUESTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_GUESTS, JSON.stringify(SAMPLE_GUESTS));
      return [...SAMPLE_GUESTS];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  loadSettings() {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      return { ...DEFAULT_SETTINGS };
    }
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveGuests() {
    localStorage.setItem(STORAGE_KEY_GUESTS, JSON.stringify(this.guests));
    this.notify();
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    this.notify();
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(fn => fn !== callback);
    };
  }

  notify() {
    this.subscribers.forEach(cb => cb(this.getSnapshot()));
  }

  getSnapshot() {
    return {
      guests: this.guests,
      settings: this.settings,
      stats: this.calculateStats()
    };
  }

  // --- Guest CRUD actions ---

  addGuest(guestData) {
    const newGuest = {
      id: 'g_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      name: guestData.name.trim(),
      phone: (guestData.phone || '').trim(),
      email: (guestData.email || '').trim(),
      category: guestData.category || 'Général',
      seats: parseInt(guestData.seats) || 1,
      table: (guestData.table || '').trim(),
      notes: (guestData.notes || '').trim(),
      status: guestData.status || 'draft',
      sentAt: guestData.status === 'sent' ? new Date().toISOString() : null,
      confirmedAt: guestData.status === 'confirmed' ? new Date().toISOString() : null,
      checkedIn: false
    };

    this.guests.unshift(newGuest);
    this.saveGuests();
    return newGuest;
  }

  updateGuest(id, updateData) {
    const idx = this.guests.findIndex(g => g.id === id);
    if (idx !== -1) {
      const current = this.guests[idx];
      // Auto-set timestamps if status changes
      if (updateData.status && updateData.status !== current.status) {
        if (updateData.status === 'sent' && !current.sentAt) {
          updateData.sentAt = new Date().toISOString();
        } else if (updateData.status === 'confirmed' && !current.confirmedAt) {
          updateData.confirmedAt = new Date().toISOString();
        }
      }
      this.guests[idx] = { ...current, ...updateData };
      this.saveGuests();
      return this.guests[idx];
    }
    return null;
  }

  deleteGuest(id) {
    this.guests = this.guests.filter(g => g.id !== id);
    this.saveGuests();
  }

  updateStatus(id, newStatus) {
    return this.updateGuest(id, { status: newStatus });
  }

  toggleCheckIn(id) {
    const guest = this.guests.find(g => g.id === id);
    if (guest) {
      return this.updateGuest(id, { checkedIn: !guest.checkedIn });
    }
    return null;
  }

  importBatchGuests(importedGuests) {
    if (!Array.isArray(importedGuests) || importedGuests.length === 0) return 0;
    this.guests = [...importedGuests, ...this.guests];
    this.saveGuests();
    return importedGuests.length;
  }

  resetToDefault() {
    this.guests = [...SAMPLE_GUESTS];
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveGuests();
    this.saveSettings(this.settings);
  }

  clearAllData() {
    this.guests = [];
    this.saveGuests();
  }

  // --- Statistics Calculation ---
  calculateStats() {
    const totalInvitations = this.guests.length;
    let totalSeats = 0;
    let confirmedSeats = 0;
    let declinedSeats = 0;
    let pendingSeats = 0;
    let checkedInSeats = 0;

    const counts = {
      draft: 0,
      sent: 0,
      delivered: 0,
      confirmed: 0,
      declined: 0
    };

    const categories = {};

    this.guests.forEach(g => {
      const seats = parseInt(g.seats) || 1;
      totalSeats += seats;

      const st = g.status || 'draft';
      counts[st] = (counts[st] || 0) + 1;

      if (st === 'confirmed') confirmedSeats += seats;
      else if (st === 'declined') declinedSeats += seats;
      else pendingSeats += seats;

      if (g.checkedIn) checkedInSeats += seats;

      const cat = g.category || 'Non classé';
      categories[cat] = (categories[cat] || 0) + seats;
    });

    const sentCount = counts.sent + counts.delivered + counts.confirmed + counts.declined;
    const responseRate = totalInvitations > 0 ? Math.round(((counts.confirmed + counts.declined) / totalInvitations) * 100) : 0;
    const confirmationRate = totalInvitations > 0 ? Math.round((counts.confirmed / totalInvitations) * 100) : 0;

    return {
      totalInvitations,
      totalSeats,
      sentCount,
      confirmedSeats,
      declinedSeats,
      pendingSeats,
      checkedInSeats,
      responseRate,
      confirmationRate,
      counts,
      categories
    };
  }
}

export const store = new Store();
