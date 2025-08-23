# Instructions de Migration - Convention vers Edition

## ⚠️ IMPORTANT - À EXÉCUTER MANUELLEMENT

Pour finaliser le renommage de la table Convention en Edition, vous devez exécuter le script SQL suivant **manuellement** sur votre base de données MySQL.

## Script SQL à exécuter

```sql
-- 1. Renommer la table Convention en Edition
ALTER TABLE `Convention` RENAME TO `Edition`;

-- 2. Mettre à jour la table de jointure pour les favoris
-- Le nom de la table de jointure est généré par Prisma
ALTER TABLE `_FavoriteConventions` RENAME TO `_FavoriteEditions`;
```

## Comment exécuter le script

1. **Via phpMyAdmin :**
   - Connectez-vous à phpMyAdmin
   - Sélectionnez votre base de données `conventions-jonglerie`
   - Allez dans l'onglet "SQL"
   - Copiez-collez le script ci-dessus
   - Cliquez sur "Exécuter"

2. **Via MySQL en ligne de commande :**

   ```bash
   mysql -h 192.168.0.13 -u [votre_username] -p conventions-jonglerie
   # Puis exécutez les commandes SQL une par une
   ```

3. **Via un client MySQL (MySQL Workbench, DBeaver, etc.) :**
   - Connectez-vous à votre base de données
   - Exécutez le script SQL

## Vérification après migration

Après avoir exécuté le script, vérifiez que :

- La table `Convention` n'existe plus
- La table `Edition` existe avec toutes les données
- La table `_FavoriteEditions` existe

## En cas de problème

Si quelque chose ne fonctionne pas :

1. Vérifiez que toutes les contraintes de clés étrangères pointent correctement vers la table `Edition`
2. Redémarrez votre application
3. Vérifiez les logs pour d'éventuelles erreurs

## Status des changements de code

✅ Schéma Prisma mis à jour  
✅ Types TypeScript mis à jour  
✅ API endpoints mis à jour  
✅ Store mis à jour  
✅ Composants Vue mis à jour  
⏳ **Migration SQL à exécuter manuellement**  
⏳ Tests de l'application

---

## Migration des droits collaborateurs (legacy `role` -> droits booléens)

Cette étape est nécessaire uniquement si la colonne `role` existe encore en production et que vous devez peupler les nouveaux champs de droits.

### Étapes

1. Sauvegarde préalable ciblée (recommandé) :
   ```bash
   mysqldump --single-transaction --quick --routines \
     "$MYSQL_DATABASE" ConventionCollaborator CollaboratorPermissionHistory > backup_collaborators.sql
   ```
2. Dry-run (ne modifie rien) :
   ```bash
   npm run migrate:collaborators:legacy:dry
   ```
3. Vérifier la sortie (compteurs, liste des premières lignes à modifier, historique manquant).
4. Exécution réelle :
   ```bash
   npm run migrate:collaborators:legacy
   ```
5. Vérifier les compteurs et quelques enregistrements :
   ```sql
   SELECT id, canEditConvention, canManageCollaborators FROM ConventionCollaborator LIMIT 20;
   SELECT COUNT(*) FROM CollaboratorPermissionHistory WHERE changeType='CREATED';
   ```
6. Lancer ensuite la migration Prisma qui supprime la colonne `role` (ou appliquer la migration SQL correspondante).
7. Supprimer le script `scripts/migrate-collaborator-rights-legacy-role.ts` une fois terminé pour éviter ré-exécution accidentelle.
  
> NOTE: La migration de suppression `role` est de nouveau présente (`drop_collaborator_role`). Appliquez-la uniquement après exécution réussie du script legacy et vérifications manuelles.

### Scripts NPM disponibles

- `npm run migrate:collaborators:legacy:dry` : prévisualisation.
- `npm run migrate:collaborators:legacy` : applique les changements (inclut `--yes`).

### Notes

- Le script utilise des requêtes SQL brutes pour fonctionner même si le client Prisma ne connaît plus la colonne `role`.
- Aucune modification n'est faite si les droits sont déjà positionnés.
- Un enregistrement d'historique `CREATED` est inséré s'il est manquant.
