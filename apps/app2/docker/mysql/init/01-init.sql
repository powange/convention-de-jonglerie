-- Initialisation MySQL pour Flowvent (exécuté au PREMIER démarrage, volume mysql_data vide).

CREATE DATABASE IF NOT EXISTS flowvent_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'flowvent_user'@'%' IDENTIFIED BY 'flowvent_password';
GRANT ALL PRIVILEGES ON flowvent_db.* TO 'flowvent_user'@'%';

-- Permissions nécessaires pour Prisma Migrate (shadow database) lors de `prisma migrate dev`.
-- Prisma crée temporairement une base `prisma_migrate_shadow_db_*`. Voir https://pris.ly/d/migrate-shadow
GRANT CREATE, ALTER, DROP, REFERENCES, INDEX ON *.* TO 'flowvent_user'@'%';
GRANT ALL PRIVILEGES ON `prisma_migrate_shadow_db_%`.* TO 'flowvent_user'@'%';

FLUSH PRIVILEGES;

USE flowvent_db;
