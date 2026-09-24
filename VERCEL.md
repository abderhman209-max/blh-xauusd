# Déploiement Vercel

Le dépôt contient un adaptateur Vercel Edge dans `api/index.js` et une réécriture globale dans `vercel.json`.

## Import

1. Dans Vercel, choisissez **Add New → Project**.
2. Importez `abderhman209-max/blh-xauusd`.
3. Laissez le répertoire racine vide.
4. Choisissez **Other** si Vercel demande un framework.
5. Lancez le déploiement.

La commande de build vérifie la syntaxe du serveur et de l’adaptateur.

## Données de marché

Ajoutez facultativement `TWELVEDATA_API_KEY` dans **Project Settings → Environment Variables**. Sans cette variable, le serveur tente sa source de secours.

## Accès

L’adaptateur expose la version actuelle comme démonstration publique sur Vercel. Avant d’ajouter des abonnements ou des comptes clients, remplacez ce mode par une authentification serveur et une base de données.
