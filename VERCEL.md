# Déploiement Vercel

Le dépôt contient un site statique dans `public/` et une API Vercel Edge dans `api/index.js`.

## Import

1. Dans Vercel, choisissez **Add New → Project**.
2. Importez `abderhman209-max/blh-xauusd`.
3. Laissez le répertoire racine vide.
4. Choisissez **Other** si Vercel demande un framework.
5. Lancez le déploiement.

La commande de build vérifie la syntaxe du serveur et de l’adaptateur.

## Authentification Supabase

Ajoutez dans **Project Settings → Environment Variables** pour Production, Preview et Development :

- `SUPABASE_URL` : URL du projet Supabase relié à BLH.
- `SUPABASE_PUBLISHABLE_KEY` : clé publishable (ou clé `anon` historique) de ce projet.

N’ajoutez pas de clé `service_role` : elle n’est ni demandée ni utilisée.

Dans Supabase, activez l’authentification e-mail/mot de passe, puis configurez l’URL du site Vercel et son URL de redirection sous **Authentication → URL Configuration**. L’application impose des mots de passe de 12 à 128 caractères avec majuscule, minuscule, chiffre et symbole.

## Données de marché

Ajoutez facultativement `TWELVEDATA_API_KEY` dans **Project Settings → Environment Variables**. Sans cette variable, le serveur tente sa source de secours.

## Validation

`npm run build` vérifie la syntaxe de l’API et des scripts principaux. Après chaque changement de variable d’environnement, relancez un déploiement pour que la nouvelle configuration soit prise en compte.
