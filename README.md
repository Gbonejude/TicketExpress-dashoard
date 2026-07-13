<div align="center">
<img src="public/favicon.png" width="120" alt="Ticket Express Logo">

# 🎟️ Ticket Express · Dashboard Web

**Interface d'administration de la plateforme de billetterie et de gestion d'événements**

[![Status](https://img.shields.io/badge/status-en%20développement-yellow)](.)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-informational)](.)
[![Vue](https://img.shields.io/badge/Vue-3-42b883)](.)
[![Vuetify](https://img.shields.io/badge/Vuetify-3-1867c0)](.)

_Événements · Billetterie · Paiements en temps réel_

</div>

---

## 📋 Table des matières

- [À propos](#-à-propos)
- [Fonctionnalités](#-fonctionnalités)
- [Stack technique](#-stack-technique)
- [Démarrage rapide](#-démarrage-rapide)
- [Structure du projet](#-structure-du-projet)
- [Variables d'environnement](#-variables-denvironnement)
- [Sécurité](#-sécurité)
- [Contribuer](#-contribuer)

---

## 🎯 À propos

Ce dépôt contient le **dashboard web d'administration** de la plateforme **Ticket Express**, une solution de billetterie en ligne qui met en relation des organisateurs d'événements avec leur public.

Le dashboard permet aux administrateurs de superviser et gérer l'ensemble de la plateforme : événements, billets, commandes, salles, organisateurs, paiements et retraits.

> **Contexte** : Ticket Express centralise la création et la vente de billets, le suivi des commandes et des paiements, ainsi que la gestion des organisateurs et de leurs reversements, le tout en temps réel.

---

## ✨ Fonctionnalités

### Gestion des événements & de la billetterie

- 🎪 **Événements** — Création, édition et publication d'événements
- 🎟️ **Billets** — Configuration des catégories de billets, quotas et tarifs
- 🏟️ **Salles / Lieux (venues)** — Gestion des lieux d'accueil
- 🗂️ **Catégories** — Classement des événements par catégorie
- 🏷️ **Coupons & Promotions** — Codes de réduction et offres promotionnelles

### Ventes & finances

- 🧾 **Commandes** — Suivi des commandes et de leur statut
- 💳 **Paiements** — Historique et suivi des transactions
- 💸 **Retraits (withdrawals)** — Gestion des reversements aux organisateurs
- ⭐ **Avis (reviews)** — Modération des évaluations des participants

### Administration

- 🧑‍💼 **Organisateurs** — Gestion et validation des comptes organisateurs
- 👥 **Utilisateurs** — Vue d'ensemble des comptes et statuts
- 🔐 **Rôles & permissions** — Contrôle d'accès par rôle
- 🔔 **Notifications** — Centre de notifications
- ⚙️ **Paramètres & Compte** — Configuration de la plateforme et profil admin
- 📊 **Dashboard** — Indicateurs clés et vue synthétique de l'activité

---

## 🏗️ Stack technique

| Technologie | Rôle |
|---|---|
| **Vue 3** | Framework JavaScript |
| **Vuetify 3** | Composants UI Material Design |
| **Vite** | Bundler & serveur de développement |
| **Pinia** | Gestion d'état |
| **Vue Router 4** | Routing (file-based via unplugin-vue-router) |
| **VueUse** | Composables utilitaires (`useApi`, `useCookie`…) |
| **ofetch** | Requêtes HTTP vers l'API |

> Le dashboard communique avec le **backend** via une API REST sécurisée par token Bearer (Laravel Sanctum).

---

## 🚀 Démarrage rapide

### Prérequis

- Node.js 18+
- pnpm (recommandé) ou npm

### Installation

```bash
# 1. Cloner le projet
git clone <votre-repo-url>
cd TicketExpress-dashoard

# 2. Installer les dépendances
pnpm install

# 3. Configurer l'environnement
cp .env.example .env
# → Renseigner VITE_API_BASE_URL (voir section Variables d'environnement)

# 4. Lancer le serveur de développement
pnpm dev
```

### Build de production

```bash
pnpm build
pnpm preview
```

---

## 📁 Structure du projet

```
src/
├── pages/
│   └── app/                  # Pages de l'application (routing file-based)
│       ├── dashboard/        # Tableau de bord
│       ├── events/           # Gestion des événements
│       ├── tickets/          # Gestion des billets
│       ├── orders/           # Commandes
│       ├── venues/           # Salles / lieux
│       ├── organizers/       # Organisateurs
│       ├── payments/         # Paiements
│       ├── withdrawals/      # Retraits
│       ├── coupons/          # Coupons
│       ├── promotions/       # Promotions
│       ├── categories/       # Catégories
│       ├── reviews/          # Avis
│       ├── users/            # Utilisateurs
│       ├── roles/            # Rôles & permissions
│       └── settings/         # Paramètres
├── navigation/
│   └── vertical/             # Configuration du drawer de navigation
│       └── index.js          # Entrées du menu principal
├── composables/
│   └── useApi.js             # Client HTTP (baseUrl + token Bearer)
├── layouts/                  # Layouts (default avec drawer, blank…)
├── components/               # Composants réutilisables
├── plugins/                  # Vuetify, Pinia, Router, i18n…
└── assets/                   # Styles & images
```

---

## ⚙️ Variables d'environnement

Copier `.env.example` en `.env` et renseigner les valeurs :

```env
# URL de base de l'API backend
VITE_API_BASE_URL=https://<votre-domaine>/api/v1
```

Le composable `useApi` utilise automatiquement cette variable pour toutes les requêtes, et y injecte le token Bearer depuis le cookie `accessToken`.

---

## 🔒 Sécurité

- Les requêtes API sont authentifiées via **token Bearer** (Laravel Sanctum).
- Le token est stocké dans un cookie `accessToken` et injecté automatiquement dans chaque requête.
- Aucune donnée sensible n'est stockée en clair dans le localStorage.

---

## 🤝 Contribuer

1. Créer une branche : `git checkout -b feature/nom-de-la-feature`
2. Développer et tester localement : `pnpm dev`
3. Builder pour vérifier : `pnpm build`
4. Ouvrir une Pull Request vers `develop`.

---

<div align="center">

Fait avec ❤️ par l'équipe **Ticket Express**

_La billetterie d'événements, simple et en temps réel._

</div>
