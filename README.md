# 🌊 Eau Thermale Avène — Plateforme de Formation Interactive

## Stack technique
- **Backend**: Node.js + Express
- **Base de données**: Supabase (PostgreSQL + Auth)
- **Frontend**: Vanilla HTML/CSS/JavaScript (mobile-first)

## 🚀 Installation & Démarrage

```bash
npm install
npm start
# → http://localhost:3000
```

## 🗄️ Initialisation Supabase

1. Ouvrez votre tableau de bord Supabase
2. Allez dans **SQL Editor**
3. Copiez-collez le contenu de `database.sql`
4. Exécutez le script

## 👤 Créer le premier compte Admin

Dans Supabase SQL Editor, après avoir exécuté database.sql :

```sql
-- 1. Créez d'abord l'utilisateur via Supabase Auth Dashboard
--    (Authentication > Users > Invite user)
-- 2. Puis insérez son profil admin :
INSERT INTO user_profiles (id, email, nom, role)
VALUES ('UUID_DE_VOTRE_USER', 'admin@avene.com', 'Administrateur', 'admin');
```

OU utilisez la page /users.html après connexion admin.

## 📁 Structure du projet

```
avene-app/
├── server.js              # Serveur Express + Routes API
├── database.sql           # Script SQL d'initialisation
├── .env                   # Variables d'environnement
└── public/
    ├── css/
    │   ├── main.css       # Charte graphique Avène
    │   └── animations.css # Animations jeu & UI
    ├── js/
    │   ├── app.js         # Utilitaires partagés (Auth, API, Toast)
    │   ├── layout.js      # Navigation sidebar
    │   └── game.js        # Moteur de jeu complet
    ├── login.html         # Page de connexion
    ├── dashboard.html     # Tableau de bord
    ├── tournees.html      # Gestion des tournées + stock
    ├── pharmacies.html    # Gestion des pharmacies
    ├── agents.html        # Gestion des agents
    ├── questions.html     # Banque de questions (admin)
    ├── game.html          # Arène de jeu interactive
    ├── reporting.html     # Rapports + export Excel
    └── users.html         # Gestion utilisateurs (admin)
```

## 🎮 Fonctionnement du Jeu

1. Sélectionner la **Tournée → Pharmacie → Agent**
2. Le jeu démarre au **Niveau 1 (75%)**
3. Cliquer sur les mots pour construire la réponse
4. Si correct → choix entre **prendre le cadeau** ou **monter de niveau**
5. Si incorrect → fin de session, statut "Perdu"
6. Tout est enregistré automatiquement dans le **Bilan**

## 🔐 Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| **Admin** | Tout + Gestion utilisateurs + Suppression |
| **Manager** | Rapports + Tournées + Pharmacies + Jeu |
| **Délégué** | Jeu + Consultation |

## 📊 Export Excel

La page Rapports permet d'exporter un fichier `.xlsx` avec :
- 14 colonnes (pharmacie, agent, 4 Q&R, cadeau)
- Feuille statistiques automatique
- Formatage premium (entêtes colorées, bandes alternées)
