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
