# PIPVORIA — utilisation des améliorations

## Graphique et démonstration

Le bouton **Démonstration** masque le compte et les indicateurs supplémentaires. Le graphique conserve les bougies, ENTRY en bleu, SL en rouge et TP1–TP3 en vert. Le stop peut rejoindre l’entrée lorsque le suivi arrive au point mort ; les deux étiquettes restent distinctes. Le dernier plan peut être historique : il ne constitue pas une nouvelle entrée.

Les périodes disponibles sont 1m, 5m, 15m, 30m et 1h. Le plein écran possède aussi son propre sélecteur de période. **Quitter la démonstration** rétablit l’espace personnel.

La source, l’âge de réception et l’heure de la dernière bougie restent visibles. Un échec du fournisseur est signalé et bloque l’ajout du signal courant. Le site ne remplace plus XAU/USD par PAXG.

## Paramètres et alertes

Ouvrir **Profil → Paramètres**. Le mode sombre reste permanent. Le fuseau horaire, la taille du contrat, le pas de lot, les préférences de calcul et les profils sont liés au compte. Les réglages des indicateurs sont conservés pour chaque marché et période ; un profil nommé permet de réutiliser une configuration. Export/import JSON et annulation de la dernière modification sont disponibles.

Les calculs et alertes utilisent par défaut des bougies confirmées. Désactiver cette préférence permet les signaux provisoires, susceptibles de changer avant la clôture. Les alertes distinguent nouveau signal, entrée, TP1/2/3, stop et modification/annulation. Le bouton de test crée une alerte dans le centre de notifications ; les notifications de l’appareil nécessitent leur activation et l’autorisation du navigateur.

La **surveillance des périodes** analyse successivement les cinq périodes du marché choisi, selon les réglages correspondants. Trade Planner fonctionne sur les cinq périodes ; BLH CLEAN reste limité à XAU/USD M5, comme sa stratégie d’origine. Les requêtes sont espacées et mises en cache pour limiter les quotas du fournisseur.

**La surveillance et les alertes de cette version fonctionnent avec le site ouvert.** Le navigateur peut ralentir un onglet en arrière-plan. Aucun service planifié ou abonnement Web Push n’est activé. Un fonctionnement navigateur fermé requiert une configuration serveur, un stockage des événements et, pour recevoir des notifications hors site, des abonnements Push. Les accès d’hébergement actuellement connectés ne permettent pas de configurer le projet du propriétaire. Ne pas utiliser le projet Supabase de restauration connecté pour cette fonctionnalité.

## Journal et statistiques

Le journal conserve les modifications localement en cas de coupure et réessaie après reconnexion. Un conflit propose explicitement la version locale ou celle du serveur. Les sauvegardes d’autres comptes ne sont pas mélangées.

Les résultats journaliers utilisent la date de clôture dans le fuseau choisi. **7 jours** couvre aujourd’hui et les six jours précédents, plutôt qu’une semaine lundi–dimanche. Win/loss/breakeven, taux, net R et drawdown concernent les trades clôturés du journal. Les TP comptent les cases cochées des trades clôturés de la période ; ce n’est pas un relevé automatique de l’heure à laquelle chaque TP a été touché. Les résultats R absents restent inconnus et sont indiqués séparément. Le net et le drawdown utilisent uniquement les R renseignés.

Les chiffres **Backtest · Trade Planner** sont une simulation historique de la stratégie, séparée du journal personnel. Un TP1 sur une position encore active n’est plus compté comme un trade gagné clôturé ; un stop suiveur utilise son résultat de sortie. La priorité stop/objectifs sur une même bougie est explicite. La simulation sur bougies ne reconstitue pas les ticks, les frais ou la qualité d’exécution d’un courtier.

Les filtres du journal et des positions portent sur le marché, la stratégie et le statut. Export **CSV** reprend les filtres courants ; depuis Résumé, il reprend la période sélectionnée. **PDF / Print** ouvre l’impression du navigateur : choisir « Enregistrer au format PDF ». Le rapport inclut les niveaux, les dates, les résultats, les notes et le fuseau.

## Vérification reproductible

- `npm run build` : vérification JavaScript et tests métier/API, sans réseau réel.
- `npm test` : tests du cycle des trades, risque, dates/DST, sauvegardes, alertes et API.
- `node tests/browser-fixture.mjs public` : serveur de données synthétiques, uniquement sur `127.0.0.1:4173`.
- Ouvrir ce serveur, ouvrir Profil, puis exécuter `tests/browser-workspace-check.js` dans un navigateur de vérification. Ce script refuse les sites de production et les comptes réels.

Vérifications effectuées : 25 tests métier/API ; 20 assertions navigateur ; reprise hors connexion et conflits ; plein écran et changement de période ; cinq périodes surveillées ; interface arabe en 390 px sans débordement ; déconnexion échouée, rechargement verrouillé et nouvelle tentative réussie. Aucun compte de production n’a été modifié pour ces tests.
