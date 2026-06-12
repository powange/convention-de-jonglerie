---
description: 'Redéploie une stack en production ou release via le webhook Portainer'
thinking: false
---

# Redéploiement via webhook Portainer

Cette commande déclenche le redéploiement d'une stack hébergée chez le partenaire en appelant
le webhook Portainer correspondant (re-pull des images + recréation des conteneurs).

L'argument détermine la cible :

- `prod` (ou aucun argument) → stack de **production** (`PORTAINER_PROD_WEBHOOK_URL`)
- `release` → stack de **release** (`PORTAINER_RELEASE_WEBHOOK_URL`)

## Étapes à suivre

1. **Déterminer la cible** à partir de l'argument fourni. Par défaut : `prod`.

2. **Récupérer l'URL du webhook** depuis le fichier `.env` (jamais committé), sans afficher
   l'URL complète dans la sortie (elle contient un secret) :

   ```bash
   # Pour prod :
   grep -E '^PORTAINER_PROD_WEBHOOK_URL=' .env | cut -d= -f2-
   # Pour release :
   grep -E '^PORTAINER_RELEASE_WEBHOOK_URL=' .env | cut -d= -f2-
   ```

   Si la variable est vide ou absente, **arrêter** et demander à l'utilisateur de renseigner
   l'URL du webhook dans `.env` (récupérable dans Portainer : édition de la stack > toggle « Webhook »).

3. **Demander confirmation explicite** avant de déployer, surtout pour la production.
   Indiquer clairement la cible (prod/release) et attendre un « oui » de l'utilisateur.
   Ne jamais déployer en production sans confirmation.

4. **Déclencher le webhook** une fois confirmé. Ne pas afficher l'URL en clair ;
   lire la variable directement dans la commande et n'afficher que le code HTTP de réponse.
   Le `sed` retire d'éventuels guillemets entourant la valeur dans `.env` (sinon
   curl renvoie `HTTP 000` / exit 3 « URL malformed ») :

   ```bash
   URL=$(grep -E '^PORTAINER_PROD_WEBHOOK_URL=' .env | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')
   curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$URL"
   ```

   (Adapter le nom de la variable selon la cible.)

5. **Interpréter le résultat** :
   - `HTTP 200` / `204` → redéploiement déclenché avec succès.
   - `HTTP 404` → webhook introuvable (UUID invalide ou webhook désactivé dans Portainer).
   - `HTTP 409` → un déploiement est probablement déjà en cours.
   - Autre / pas de réponse → afficher le code et signaler l'échec.

   Rappeler que le webhook redéploie la stack **telle qu'elle est définie dans Portainer**
   (il re-pull les images mais ne modifie pas le `docker-compose`).
