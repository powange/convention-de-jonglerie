# Script d'assignation des repas aux bénévoles acceptés

## Description

Ce script permet d'assigner automatiquement les repas aux bénévoles qui ont déjà été acceptés mais qui n'ont pas encore de sélections de repas. C'est utile pour rattraper les bénévoles existants après la mise en place du système de gestion des repas.

## Utilisation

```bash
npm run db:assign-meals
```

## Fonctionnement

Le script :

1. **Recherche** tous les bénévoles avec le statut `ACCEPTED`
2. **Filtre** ceux qui n'ont aucune sélection de repas (`VolunteerMealSelection`)
3. **Crée automatiquement** les sélections de repas pour chaque bénévole :
   - Filtre les repas selon les disponibilités du bénévole (setup/event/teardown)
   - Filtre selon les dates d'arrivée et de départ si renseignées
   - Tous les repas sont cochés par défaut (`accepted=true`)

## Exemple de sortie

```
🍽️  Recherche des bénévoles acceptés sans repas...

✅ Trouvé 15 bénévole(s) accepté(s)

📋 3 bénévole(s) sans sélections de repas

⏳ Traitement: John Doe (john@example.com) - EJC 2025 - Grenoble
   ✅ Repas assignés avec succès

⏳ Traitement: Jane Smith (jane@example.com) - EJC 2025 - Grenoble
   ✅ Repas assignés avec succès

⏳ Traitement: Bob Martin (bob@example.com) - EJC 2025 - Grenoble
   ✅ Repas assignés avec succès

============================================================
📊 Résumé:
   ✅ Succès: 3
   ❌ Erreurs: 0
   📝 Total traité: 3
============================================================

✨ Script terminé avec succès !
```

## Sécurité

- Le script ne modifie **jamais** les sélections de repas existantes
- Il traite **uniquement** les bénévoles avec statut `ACCEPTED`
- Il peut être exécuté plusieurs fois sans risque (idempotent)
- En cas d'erreur sur un bénévole, le script continue avec les suivants

## Notes

- Ce script utilise la même fonction (`createVolunteerMealSelections`) que le système automatique lors de l'acceptation d'un bénévole
- Les repas créés respectent les mêmes règles de filtrage que le système normal
- Le script se connecte à la base de données configurée dans `.env`
