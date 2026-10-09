# BLH XAUUSD

Plateforme Pipvoria avec le design original fourni dans « Site trading en JavaScript.zip ». Interface intégrée directement, sans iframe, avec les API Supabase existantes.

La page publique reprend la landing page du design fourni. Les boutons ouvrent `#login` et `#signup` ; les liens directs vers le terminal restent protégés. Le tarif de 49 USDT est celui prévu dans le design, avec paiement explicitement indisponible tant que le prestataire n’est pas connecté.

## Fonctionnalités actuelles

- Graphiques XAU/USD, BTC/USD, ETH/USD et SOL/USD ; EUR/USD et Nasdaq 100 selon disponibilité du fournisseur (cotation susceptible d’être différée)
- Périodes 1m, 5m, 15m, 30m et 1h
- Structure de marché, Fibonacci et risque/rendement
- Zones achat/vente, TP1, TP2 et TP3
- Heatmap de régression et profil de volume
- Interface multilingue et espace client
- Fiche de signal avec entrée, Stop Loss, TP1–TP3 et ratio risque/rendement
- Calculateur de risque et taille de position
- Journal de trading et performances synchronisés avec Supabase
- Centre de notifications et préférences par utilisateur
- Zoom, déplacement, plein écran, replay bougie par bougie et annotations manuelles

## Interface originale

- `terminal-original.js` : rendu et outils du design fourni, débarrassés des comptes, transactions et calendriers fictifs.
- `terminal.js` : connexion aux comptes, journal, tickets, paramètres et moteurs existants.
- `terminal-api.js` : isolation des sessions et verrouillage de la déconnexion non confirmée.
- `vendor/` et `fonts/` : dépendances du design hébergées localement. Aucun `unsafe-eval`, CDN React ou iframe.
- Les anciens scripts, styles, vidéos et logos de l’interface ont été supprimés de `public/`.

Le BLH M5 conserve sa restriction XAU/USD 5 min. Les autres moteurs utilisent les périodes disponibles. Le flux or n’est jamais remplacé par PAXG ou des données synthétiques sans choix explicite du mode démonstration. Le journal personnel et les simulations des indicateurs restent distincts.

Les paiements crypto, factures, parrainages rémunérés et 2FA du prototype nécessitent leurs services réels ; ils ne sont pas simulés en production. Les tickets nécessitent la migration `20261007145628_pipvoria_support_tickets.sql` sur le projet du site. Tant qu’elle n’est pas disponible, l’ancienne conversation reste accessible et la création de nouveaux tickets est explicitement désactivée.

## Organisation

- `public/` : site statique, écran de connexion et traductions.
- `api/index.js` : API Vercel Edge, authentification Supabase et données de marché protégées.
- `worker/index.js` : archive de la version importée, non utilisée au déploiement.
- `vercel.json` : en-têtes de sécurité.
- `VERCEL.md` : procédure d’import dans Vercel.

## Configuration

Le déploiement requiert `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY`. La clé publique/publishable est utilisée uniquement par l’API serveur du site ; les routes administrateur et support requièrent également la clé serveur `SUPABASE_SERVICE_ROLE_KEY`.

La variable `TWELVEDATA_API_KEY` est facultative. Sans elle, le serveur tente sa source de secours. Aucune clé n’est incluse dans ce dépôt.

## Accès

L’accès utilise Supabase Auth avec e-mail et mot de passe. Les sessions sont conservées dans des cookies `HttpOnly`, `Secure` et `SameSite=Lax`. La connexion, l’inscription, la confirmation d’e-mail et la réinitialisation de mot de passe sont séparées. L’interface est disponible en français, anglais, espagnol et arabe (RTL).

Les données de marché sont refusées sans session valide. Les tables applicatives utilisent RLS : chaque utilisateur peut uniquement lire et modifier son propre journal, ses notifications et ses préférences.

## Base de données

La migration Supabase `20260927175500_enhance_personal_trading_workspace.sql` ajoute la synchronisation du journal et des notifications. Elle est déjà appliquée au projet BLH Markets.
