-- Script d'initialisation pour la base de données Convention de Jonglerie
-- Ce script est exécuté automatiquement au premier démarrage de MySQL
-- (uniquement quand le volume mysql_data est vide)

-- Création de la base de données si elle n'existe pas
CREATE DATABASE IF NOT EXISTS convention_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Création de l'utilisateur si il n'existe pas
CREATE USER IF NOT EXISTS 'convention_user'@'%' IDENTIFIED BY 'convention_password';

-- Attribution des permissions sur la base principale
GRANT ALL PRIVILEGES ON convention_db.* TO 'convention_user'@'%';

-- Permissions nécessaires pour Prisma Migrate (shadow database)
-- Prisma crée temporairement une base `prisma_migrate_shadow_db_*` pour comparer
-- les schémas lors de `prisma migrate dev`. Voir https://pris.ly/d/migrate-shadow
GRANT CREATE, ALTER, DROP, REFERENCES, INDEX ON *.* TO 'convention_user'@'%';
GRANT ALL PRIVILEGES ON `prisma_migrate_shadow_db_%`.* TO 'convention_user'@'%';

FLUSH PRIVILEGES;

-- Utilisation de la base de données
USE convention_db;

-- Les migrations Prisma seront exécutées automatiquement par l'application