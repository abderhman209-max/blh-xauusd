# BLH XAUUSD

Code source de la plateforme BLH XAUUSD, importé depuis la version 10 publiée avec ChatGPT Sites et préparé pour Vercel.

## Fonctionnalités actuelles

- Graphiques XAU/USD et BTC/USD
- Périodes 1m, 5m, 15m, 30m et 1h
- Structure de marché, Fibonacci et risque/rendement
- Zones achat/vente, TP1, TP2 et TP3
- Heatmap de régression et profil de volume
- Interface multilingue et espace client
- Fiche de signal avec entrée, Stop Loss, TP1–TP3 et ratio risque/rendement
- Calculateur de risque et taille de position
- Journal de trading et performances synchronisés avec Supabase
- Centre de notifications et préférences par utilisateur
- Zoom, pincement et plein écran dédiés au graphique

## Organisation

- `public/` : site statique, écran de connexion et traductions.
- `api/index.js` : API Vercel Edge, authentification Supabase et données de marché protégées.
- `vercel.json` : en-têtes de sécurité.
- `VERCEL.md` : procédure d’import dans Vercel.

## Configuration

Le déploiement requiert `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY`. La clé publique/publishable est utilisée uniquement par l’API serveur du site ; aucune clé `service_role` n’est nécessaire.

La variable `TWELVEDATA_API_KEY` est facultative. Sans elle, le serveur tente sa source de secours. Aucune clé n’est incluse dans ce dépôt.

## Accès

L’accès utilise Supabase Auth avec e-mail et mot de passe. Les sessions sont conservées dans des cookies `HttpOnly`, `Secure` et `SameSite=Lax`. La connexion, l’inscription, la confirmation d’e-mail et la réinitialisation de mot de passe sont séparées. L’interface est disponible en français, anglais, espagnol et arabe (RTL).

Les comptes `super_admin` doivent valider une double authentification (TOTP Supabase) avant d’accéder aux routes d’administration ; l’écran Administration guide l’activation au premier accès. Les liens reçus par e-mail demandent une confirmation du compte avant d’ouvrir une session. Les connexions, inscriptions et demandes de réinitialisation sont limitées par adresse IP.

Les données de marché sont refusées sans session valide. Les tables applicatives utilisent RLS : chaque utilisateur peut uniquement lire et modifier son propre journal, ses notifications et ses préférences.

## Base de données

La migration Supabase `20260927175500_enhance_personal_trading_workspace.sql` ajoute la synchronisation du journal et des notifications. Elle est déjà appliquée au projet BLH Markets.

La migration `20261007150000_security_hardening.sql` réserve l’identifiant des réglages de chaque compte et ajoute des limites de taille en base. Elle doit être appliquée au projet BLH Markets.
