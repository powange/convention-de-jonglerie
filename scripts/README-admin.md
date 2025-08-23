# Script de gestion des super administrateurs

Ce script permet de gérer les utilisateurs ayant le statut de super administrateur dans l'application.

## Utilisation

### Lister tous les super administrateurs

```bash
npm run admin:list
```

### Promouvoir un utilisateur en super administrateur

```bash
npm run admin:add <email>
```

### Rétrograder un super administrateur

```bash
npm run admin:remove <email>
```

## Exemples

```bash
# Voir qui sont les super admins actuels
npm run admin:list

# Promouvoir un utilisateur existant
npm run admin:add admin@monsite.com

# Rétrograder un super admin
npm run admin:remove ancien-admin@monsite.com
```

## Sécurités intégrées

- **Vérification d'existence** : L'utilisateur doit exister dans la base avant promotion
- **Messages informatifs** : Affichage clair du statut et des actions effectuées
- **Gestion d'erreurs** : Messages d'erreur explicites en cas de problème
- **Pas de restriction sur le dernier admin** : Possible de supprimer tous les super admins (le script permet de les rajouter)

## Permissions requises

- Accès à la base de données (variable DATABASE_URL configurée)
- Droits d'écriture sur la table `User`

## Cas d'usage typiques

1. **Première installation** : Promouvoir le premier utilisateur en super admin
2. **Changement d'équipe** : Ajouter de nouveaux admins, retirer les anciens
3. **Audit** : Lister régulièrement les super admins pour la sécurité
