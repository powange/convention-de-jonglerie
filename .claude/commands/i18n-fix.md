# Correction automatique des traductions i18n

Cette commande automatise le processus de nettoyage et de correction des traductions i18n.

## Processus automatisé :

1. **Analyse initiale** - Vérifie les clés manquantes et inutilisées avec `npm run check-i18n`
2. **Suppression des clés inutilisées** - Si détectées, lance `npm run check-i18n -- --delete-unused`
3. **Détection des faux positifs** - Vérifie si des clés manquantes sont en fait des objets
4. **Ajout des clés manquantes** - Ajoute les vraies clés manquantes au fichier français avec valeur "TODO: [clé]"
5. **Synchronisation finale** - Toujours exécuter `npm run check-translations -- -f --fill-mode todo` pour synchroniser toutes les langues

## Arrêt automatique :

- Si des faux positifs sont détectés (clés objets signalées comme manquantes)
- En cas d'erreur lors d'une étape

## Utilisation :

Cette commande s'exécute automatiquement étape par étape et affiche le progrès.
