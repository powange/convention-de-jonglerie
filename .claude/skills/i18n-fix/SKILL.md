---
description: 'Correction automatique des traductions i18n : suppression des clés inutilisées, ajout des manquantes et synchronisation'
---

# Correction automatique des traductions i18n

Cette commande automatise le processus de nettoyage et de correction des traductions i18n.

## Processus automatisé :

1. **Analyse des clés inutilisées** - Vérifie les clés inutilisées avec `npm run check-i18n -- -s 2`
2. **Suppression des clés inutilisées** - Si détectées, lance `npm run check-i18n -- --delete-unused` puis `npm run check-translations -- -p` pour supprimer les clés inutilisées et synchroniser les fichiers
3. **Analyse des clés manquantes** - Vérifie les clés manquantes avec `npm run check-i18n -- -s 1`
4. **Détection des faux positifs** - Vérifie si des clés manquantes sont en fait des objets
5. **Ajout des clés manquantes** - Ajoute les vraies clés manquantes au fichier français avec valeur "TODO: [clé]"
6. **Synchronisation finale** - Toujours exécuter `npm run check-translations -- -f --fill-mode todo` pour synchroniser toutes les langues

## Arrêt automatique :

- Si des faux positifs sont détectés (clés objets signalées comme manquantes)
- En cas d'erreur lors d'une étape

## Utilisation :

Cette commande s'exécute automatiquement étape par étape et affiche le progrès.
