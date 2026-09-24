# BLH XAUUSD

Code source de la plateforme BLH XAUUSD, importé depuis la version 10 publiée avec ChatGPT Sites.

## Fonctionnalités actuelles

- Graphiques XAU/USD et BTC/USD
- Périodes 1m, 5m, 15m, 30m et 1h
- Structure de marché, Fibonacci et risque/rendement
- Zones achat/vente, TP1, TP2 et TP3
- Heatmap de régression et profil de volume
- Interface multilingue et espace client
- Historique local des analyses

## Source importée

Le serveur et les ressources du site sont conservés dans `worker/index.js`. Les manifestes Sites d'origine sont inclus pour assurer la traçabilité de la version importée.

## Configuration

La clé `TWELVEDATA_API_KEY` doit être enregistrée dans les variables secrètes de l'hébergeur. Aucune clé secrète n'est incluse dans ce dépôt.

## Migration Vercel

L'authentification de la version importée utilise actuellement ChatGPT Sites. Elle doit être adaptée avant un déploiement public sur Vercel. L'abonnement Stripe, le dashboard Admin et les animations Three.js restent à construire.
