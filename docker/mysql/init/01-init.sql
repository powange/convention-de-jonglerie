-- Script d'initialisation pour la base de données Convention de Jonglerie
-- Ce script est exécuté automatiquement au premier démarrage de MySQL

-- Création de la base de données si elle n'existe pas
CREATE DATABASE IF NOT EXISTS convention_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Création de l'utilisateur si il n'existe pas
CREATE USER IF NOT EXISTS 'convention_user'@'%' IDENTIFIED BY 'convention_password';

-- Attribution des permissions
GRANT ALL PRIVILEGES ON convention_db.* TO 'convention_user'@'%';
FLUSH PRIVILEGES;

-- Utilisation de la base de données
USE convention_db;

-- Les migrations Prisma seront exécutées automatiquement par l'application