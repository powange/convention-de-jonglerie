# Accélérer `prisma migrate dev` — shadow database en RAM

## Problème

Créer une migration avec `npx prisma migrate dev` était **très lent** (plusieurs minutes),
même pour un changement trivial (ajout d'une colonne).

## Diagnostic (mesuré)

À chaque `migrate dev`, Prisma crée une **shadow database** temporaire et **rejoue tout
l'historique de migrations** dessus pour détecter les divergences et générer la nouvelle
migration. Avant ce correctif, cette shadow était auto-créée sur le serveur `convention-db`,
dont les données vivent sur un **volume Docker (disque)** sous WSL2.

Le goulot n'est ni le seed (vide), ni le stockage général, mais le **fsync par instruction DDL**
de MySQL 8 (DDL atomique + data dictionary) sur ce volume disque. Mesures sur une base jetable :

| Scénario | Temps |
| --- | --- |
| `CREATE`/`DROP DATABASE` vide (latence DDL de base) | 0,45 s |
| `0_init` (238 instructions DDL) — volume disque, défaut | **1 min 36 s** |
| `0_init` — `innodb_flush_log_at_trx_commit=2` | 1 min 05 s |
| `0_init` — `innodb_flush=2` + `sync_binlog=0` | 1 min 03 s |
| **`0_init` — sur tmpfs (RAM)** | **3 s** (×32) |
| Rejeu des 32 migrations = coût shadow par `migrate dev` | **2 min 28 s** |

Relâcher la durabilité ne gagne qu'~34 % (le fsync du data dictionary reste). **Seul tmpfs
(RAM) élimine réellement le coût disque.**

## Correctif : shadow database dédiée sur tmpfs

Une base MySQL jetable en RAM sert de shadow ; Prisma y reconstruit le schéma quasi
instantanément. Attendu : le rejeu passe de **~2 min 28 s à ~5-8 s**.

Trois éléments (déjà en place dans le dépôt) :

1. **Service `shadow-db`** dans `apps/app1/docker-compose.dev.yml` : MySQL 8 avec
   `tmpfs: [/var/lib/mysql]`, durabilité relâchée (`--innodb-flush-log-at-trx-commit=2
   --skip-log-bin --innodb-doublewrite=0`), exposé sur `localhost:3308`.
2. **`prisma.config.ts`** : `datasource.shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL || undefined`.
   Le `process.env` (et non `env()`) est volontaire : si la variable est absente (CI, autre dev,
   conteneur qui ne fait que `migrate deploy`), on retombe sans erreur sur la shadow auto-créée.
3. **`.env`** : `SHADOW_DATABASE_URL="mysql://root:rootpassword@localhost:3308/convention_shadow"`
   (le service `shadow-db` utilise le même `MYSQL_ROOT_PASSWORD` que la DB principale).

## Utilisation

```bash
# Depuis apps/app1 : démarrer (ou redémarrer) la stack pour inclure le service shadow-db
npm run docker:dev:detached      # ou: docker compose -f docker-compose.dev.yml up -d shadow-db

# Puis créer une migration comme d'habitude (depuis l'hôte)
npx prisma migrate dev --name ma_migration
```

## Points d'attention

- **La shadow db doit être démarrée** avant `migrate dev` (elle écoute sur `localhost:3308`).
- La base `convention_shadow` est **100 % jetable** : son contenu est réinitialisé à chaque
  migration, rien à sauvegarder. Un `docker compose down` vide la RAM, elle se réinitialise au
  prochain `up` (~10 s d'init MySQL).
- **RAM** : un MySQL idle consomme ~300-400 Mo. Si c'est gênant, on peut mettre le service
  derrière un `profiles:` et ne le démarrer qu'à la demande.
- `migrate deploy` (démarrage de l'app en dev/release/prod) **n'utilise pas** de shadow db ;
  ce correctif ne concerne que la **création** de migrations via `migrate dev`.

## Piste complémentaire (non appliquée)

Relâcher aussi la durabilité de la DB **principale** de dev (`--innodb-flush-log-at-trx-commit=2
--skip-log-bin`) accélérerait d'~30 % l'**application** de la migration sur la vraie base (DB de
dev jetable, durabilité non critique). À évaluer si besoin.
