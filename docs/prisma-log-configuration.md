# Configuration des logs Prisma

## Vue d'ensemble

Le niveau de log de Prisma peut être configuré via la variable d'environnement `PRISMA_LOG_LEVEL` pour ajuster la verbosité des logs de la base de données.

## Niveaux de log disponibles

Prisma supporte 4 niveaux de log :

- **`query`** : Affiche toutes les requêtes SQL exécutées
- **`info`** : Informations générales sur les opérations Prisma
- **`warn`** : Avertissements (opérations lentes, deprecated features, etc.)
- **`error`** : Erreurs uniquement

## Configuration

### Dans le fichier `.env`

```env
# Minimal (erreurs uniquement)
PRISMA_LOG_LEVEL=error

# Par défaut (erreurs + avertissements)
PRISMA_LOG_LEVEL=error,warn

# Verbose (toutes les requêtes + erreurs + avertissements)
PRISMA_LOG_LEVEL=query,error,warn

# Maximum (tout)
PRISMA_LOG_LEVEL=query,info,warn,error
```

### Dans Docker (docker-compose.dev.yml)

La variable est automatiquement récupérée depuis votre fichier `.env` et passée au conteneur Docker.

Si vous voulez la surcharger temporairement sans modifier `.env` :

```bash
PRISMA_LOG_LEVEL=query,error,warn npm run docker:dev
```

## Cas d'usage

### Debug des requêtes SQL

Pour débugger une requête lente ou problématique :

```env
PRISMA_LOG_LEVEL=query,error,warn,info
```

Puis redémarrez le conteneur :

```bash
npm run docker:dev:down
npm run docker:dev
```

Vous verrez alors toutes les requêtes SQL dans les logs :

```bash
npm run docker:dev:logs
```

### Production (minimal)

En production, seules les erreurs devraient être loggées :

```env
PRISMA_LOG_LEVEL=error
```

### Développement (recommandé)

Un bon équilibre entre visibilité et bruit :

```env
PRISMA_LOG_LEVEL=error,warn
```

## Exemple de sortie

### Avec `PRISMA_LOG_LEVEL=query,error,warn`

```
prisma:query SELECT `conventions`.`id`, `conventions`.`name` FROM `conventions`
prisma:query INSERT INTO `users` (`email`, `name`) VALUES (?, ?)
prisma:warn Query is slow (took 1234ms): SELECT * FROM `editions`
```

### Avec `PRISMA_LOG_LEVEL=error`

```
prisma:error PrismaClientKnownRequestError: Unique constraint violation
```

## Notes

- Les logs sont configurés au démarrage de l'application via `server/utils/prisma.ts`
- Le changement de `PRISMA_LOG_LEVEL` nécessite un redémarrage du serveur/conteneur
- En mode développement local (sans Docker), la valeur par défaut est `['query', 'error', 'warn']`
- En production, la valeur par défaut est `['error']`
