# InviTrack - Suivi Rapide d'Invitations

Application web mobile ultra-légère conçue pour suivre facilement qui est invité, à décider ou non invité, avec recherche instantanée et synchronisation directe Google Sheets.

## 🚀 Fonctionnalités Clés
- **Recherche Spotlight Instantanée** : Tapez le nom d'une personne dans la barre de recherche et cochez son statut immédiatement.
- **Ajout Direct** : Si la personne n'existe pas, ajoutez-la en 1 clic directement depuis la barre de recherche.
- **3 États Simples** :
  - 🟢 **Invité** : Enregistre automatiquement la date et l'heure de l'invitation.
  - 🟡 **À décider** : Pour les personnes en cours de réflexion.
  - 🔴 **Non invité (Écarté)** : Avec possibilité de saisir une raison/note optionnelle (*Hors budget, Trop loin, etc.*).
- **Synchronisation Google Sheets 2 Sens** : Connectez votre Google Spreadsheet via le script `google_apps_script.js` inclus. Vos changements sur téléphone se répercutent automatiquement dans votre tableau !
- **PWA & Hors-Ligne** : Fonctionne sans connexion internet grâce au Service Worker et s'installe sur smartphone comme une application native.

## 📊 Liaison Google Sheets
1. Ouvrez votre tableau Google Sheets.
2. Allez dans **Extensions > Apps Script**.
3. Copiez-collez le contenu de [`google_apps_script.js`](./google_apps_script.js).
4. Cliquez sur **Déployer > Nouveau déploiement** (Application Web, Accès : Tout le monde).
5. Collez l'URL dans l'application InviTrack (bouton en haut à droite).
