# Script d'ajout de hash d'email pour les utilisateurs

## Description

Ce script permet d'ajouter le hash MD5 de l'email à tous les utilisateurs existants dans la base de données qui n'en ont pas encore. Le hash d'email est utilisé pour générer les avatars Gravatar.

## Utilisation

```bash
npm run db:add-email-hash
```

## Fonctionnement

Le script :

1. Recherche tous les utilisateurs dont le champ `emailHash` est `null` ou vide
2. Pour chaque utilisateur trouvé :
   - Calcule le hash MD5 de son email (normalisé en minuscules)
   - Met à jour l'utilisateur avec le hash calculé
3. Affiche un résumé du nombre d'utilisateurs mis à jour

## Exemple de sortie

```
🔍 Recherche des utilisateurs sans emailHash...
📊 15 utilisateur(s) trouvé(s) sans emailHash
⚙️  Mise à jour des utilisateurs...
✅ User 1 (john@example.com): emailHash ajouté
✅ User 2 (jane@example.com): emailHash ajouté
...
✅ User 15 (bob@example.com): emailHash ajouté

📈 Résumé:
   ✅ 15 utilisateur(s) mis à jour avec succès
✨ Script terminé !
```

## Utilisation typique

Ce script doit être exécuté une seule fois après l'ajout du champ `emailHash` dans le schéma Prisma pour mettre à jour les utilisateurs existants. Les nouveaux utilisateurs auront automatiquement leur `emailHash` calculé lors de leur création.

## Sécurité

- Le script utilise la fonction `getEmailHash` qui normalise l'email (minuscules, sans espaces) avant de calculer le hash
- Le hash est mis en cache en mémoire pour améliorer les performances
- Le script ne modifie que le champ `emailHash`, aucune autre donnée utilisateur n'est touchée

## Migration recommandée

Après l'exécution de ce script, il est recommandé de :

1. Vérifier que tous les utilisateurs ont bien un `emailHash`
2. Optionnellement, rendre le champ `emailHash` obligatoire dans le schéma Prisma
3. Créer une migration pour refléter ce changement
