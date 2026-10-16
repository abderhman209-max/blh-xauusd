# Paiements Pipvoria avec PayerURL

## Parcours livré

Profil → **Renouveler en crypto** ouvre le choix du moyen de paiement. PayerURL est disponible seulement après configuration effective du serveur et création des tables. NOWPayments et Binance Pay sont affichés comme indisponibles ; aucun Pay ID, compte de réception ou lien de paiement fictif n’est utilisé.

Le tarif du dépôt est repris : **49 USD pour 30 jours**. La page publique est libellée en USD ; PayerURL convertit ce prix dans la crypto choisie. Il ne faut pas promettre exactement 49 USDT indépendamment du taux et des frais. Le client choisit le réseau sur le checkout hébergé PayerURL (USDT BEP20, TRC20, ERC20 selon la configuration du marchand), comme dans la capture fournie. Les réseaux et les adresses de réception se configurent dans le compte PayerURL, pas dans le navigateur de Pipvoria.

Le retour au site affiche une vérification en attente. Seule une notification serveur signée, avec statut final `200`, montant reçu suffisant en USD et commande connue, inscrit le paiement et prolonge la date d’échéance. Un paiement partiel n’active pas l’abonnement, même si le prestataire applique une tolérance. Une notification répétée n’ajoute pas de jours. Un même identifiant de transaction ne peut pas régler plusieurs commandes.

Ces enregistrements apparaissent dans le profil ; les règles existantes d’acceptation des comptes par le super admin sont conservées. Cette intégration ne transforme pas l’ensemble des accès existants en paywall et n’active pas de prélèvements récurrents automatiques.

## Activation par le propriétaire

1. Créer le compte sur <https://payerurl.com/> et faire confirmer par le prestataire l’admissibilité de l’activité et de la juridiction. L’intégration technique ne vaut pas autorisation d’accepter des cryptomonnaies au Maroc.
2. Configurer les cryptos, réseaux et portefeuilles destinataires dans PayerURL. Vérifier aussi les frais et les conditions de garde/retrait du plan retenu ; ils ne sont pas nécessairement identiques selon le plan.
3. Appliquer `supabase/migrations/20261016175425_pipvoria_crypto_billing.sql` au **projet Supabase réellement relié à Pipvoria**. Ne pas l’appliquer à un projet de restauration ou à un autre compte.
4. Dans les variables secrètes du projet d’hébergement de Pipvoria, ajouter `PAYERURL_PUBLIC_KEY` et `PAYERURL_SECRET_KEY`. Conserver la clé Supabase administrative existante (`SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`) uniquement côté serveur. Ne jamais utiliser de préfixe public ni committer ces valeurs.
5. Configurer `PIPVORIA_PUBLIC_URL` avec l’origine HTTPS de production (exemple : `https://votre-domaine.example`), puis `PAYERURL_ENABLED=true`. Redéployer la version testée.
6. Faire un test marchand contrôlé via le parcours normal, avec le propriétaire exécutant lui-même le paiement. Vérifier le montant, le webhook, l’échéance et le rejeu de la notification avant d’annoncer le service aux clients.

Notifications : `https://VOTRE-DOMAINE/api?route=billing/notify`. Cette route accepte JSON ou formulaire URL-encodé et vérifie la signature HMAC SHA-256 compatible avec l’intégration officielle. Les appels à PayerURL utilisent la Web Crypto API, compatible Vercel Edge.

Un échec de création peut laisser une commande `creating` : ne pas la renvoyer automatiquement au prestataire en cas de délai d’attente ambigu. Le marchand doit rapprocher cette commande de son tableau de bord PayerURL. Les commandes payées et les échéances sont réservées à la clé serveur ; les rôles publics ne peuvent ni les lire directement ni les modifier.

## Vérification

- `npm run build` : syntaxe et suite complète, dont paiements et migration PostgreSQL en PGlite.
- `node tests/browser-fixture.mjs public --billing-preview` : serveur local sur `http://127.0.0.1:4173`, compte et données synthétiques uniquement. Profil → Renouveler en crypto. La création est volontairement rejetée par la fixture ; aucun appel réel à PayerURL, aucune adresse de réception et aucun mouvement de fonds.
- Sans `--billing-preview`, les moyens de paiement sont indisponibles dans la fixture.

Compatibilité vérifiée avec l’API réelle : `amount` est exprimé dans l’unité majeure de la devise (`49` pour 49 USD), tandis que la base conserve des centimes (`4900`). Le lien retourné peut utiliser `api-v2.payerurl.com` avant de rediriger vers `dash.payerurl.com` ; seuls ces deux hôtes HTTPS, sans identifiants ni port non standard, sont acceptés.

Limites de la validation : le compte marchand, les secrets de production et les adresses Binance USDT sont configurés. Les tests automatiques et l’ouverture du checkout ne remplacent pas un essai de paiement réel exécuté par le propriétaire, avec vérification de la notification et de l’échéance.

Références : <https://payerurl.com/payerurl-api-integration-using-nodejs/>, protocole de signature <https://github.com/muhitmonsur/crypto-payment-gateway-binance-api>.

