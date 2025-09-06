# Système de Backup Docker pour Convention de Jonglerie

## 🎯 Fonctionnalités

- ✅ Backup automatique de la base de données MySQL
- ✅ Backup des volumes Docker (uploads, config)
- ✅ Transfert vers Synology NAS via rsync/SSH
- ✅ Rotation automatique des anciens backups
- ✅ Notifications webhook (Slack, Discord)
- ✅ Configuration 100% par variables d'environnement
- ✅ Logs détaillés avec rotation
- ✅ Container Docker isolé et sécurisé

## 🚀 Installation

### 1. Configuration initiale

```bash
# Copier le template de configuration
cp .env.backup.example .env.backup

# Éditer avec vos valeurs
nano .env.backup
```

### 2. Générer les clés SSH (pour Synology)

```bash
# Sur votre serveur Ubuntu
ssh-keygen -t rsa -b 4096 -f ~/.ssh/synology_backup -N ""

# Copier la clé publique sur le Synology
ssh-copy-id -i ~/.ssh/synology_backup.pub backup-user@192.168.1.100

# Récupérer la clé privée pour .env.backup
cat ~/.ssh/synology_backup

# Récupérer l'empreinte du serveur
ssh-keyscan -H 192.168.1.100
```

### 3. Configuration Synology

Sur votre NAS Synology :

1. **Activer SSH** : Panneau de configuration > Terminal & SNMP > Activer SSH
2. **Créer utilisateur** : Créer un utilisateur `backup-user` avec accès au dossier de backup
3. **Créer dossier** : Créer `/volume1/backups/convention` (ou autre chemin)
4. **Permissions** : Donner les droits en lecture/écriture à `backup-user`

### 4. Lancement du service

```bash
# Construire et lancer avec docker-compose de production
docker-compose -f docker-compose.prod.yml up -d backup

# Vérifier les logs
docker logs convention-backup-prod

# Lancer un backup manuel pour test
docker exec convention-backup-prod /usr/local/bin/backup.sh

# Pour relancer tout l'environnement de production
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Variables d'environnement

### Obligatoires

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DB_HOST` | Host MySQL | `mysql_db` |
| `DB_PORT` | Port MySQL | `3306` |
| `DB_NAME` | Nom de la base | `convention_db` |
| `DB_USER` | Utilisateur MySQL | `root` |
| `DB_PASSWORD` | Mot de passe MySQL | `secret123` |

### Synology (si BACKUP_DESTINATION=synology)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `SYNOLOGY_HOST` | IP/hostname du NAS | `192.168.1.100` |
| `SYNOLOGY_USER` | Utilisateur SSH | `backup-user` |
| `SYNOLOGY_PATH` | Chemin sur le NAS | `/volume1/backups` |
| `SSH_PRIVATE_KEY` | Clé privée SSH | `-----BEGIN RSA...` |

### Optionnelles

| Variable | Description | Défaut |
|----------|-------------|--------|
| `CRON_SCHEDULE` | Planning cron | `0 3 * * *` (3h du matin) |
| `RETENTION_DAYS` | Jours de rétention | `30` |
| `RUN_ON_STARTUP` | Backup au démarrage | `false` |
| `NOTIFICATION_WEBHOOK` | URL webhook | - |

## 🔧 Personnalisation

### Modifier le planning

Dans `.env.backup` :
```bash
# Tous les jours à 2h
CRON_SCHEDULE=0 2 * * *

# Toutes les 6 heures
CRON_SCHEDULE=0 */6 * * *

# Tous les dimanches à 4h
CRON_SCHEDULE=0 4 * * 0
```

### Ajouter des volumes

Dans `docker-compose.prod.yml`, section `backup` :
```yaml
volumes:
  - ./mon-dossier:/data/mon-dossier:ro
```

## 📊 Monitoring

### Consulter les logs

```bash
# Logs du container
docker logs -f convention-backup-prod

# Logs des backups
docker exec convention-backup-prod tail -f /backup/logs/backup_*.log

# Logs cron
docker exec convention-backup-prod tail -f /backup/logs/cron.log
```

### Vérifier les backups

```bash
# Sur le serveur
docker exec convention-backup-prod ls -lh /backup/archives/

# Sur Synology (SSH)
ssh backup-user@192.168.1.100 "ls -lh /volume1/backups/convention/daily/"
```

## 🔐 Sécurité

- ✅ Volumes montés en lecture seule (`:ro`)
- ✅ Mots de passe dans `.env.backup` (jamais commité)
- ✅ Container non-root par défaut
- ✅ SSH avec clés (pas de mot de passe)
- ✅ Isolation réseau Docker

## 🚨 Troubleshooting

### Le container ne démarre pas

```bash
# Vérifier les logs
docker logs convention-backup-prod

# Tester la connexion DB
docker exec convention-backup-prod mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e "SELECT 1"
```

### Erreur de connexion Synology

```bash
# Tester manuellement
docker exec -it convention-backup-prod bash
ssh -v backup-user@192.168.1.100
```

### Backup échoue

```bash
# Lancer manuellement avec debug
docker exec convention-backup-prod bash -x /usr/local/bin/backup.sh
```

## 🔄 Restauration

### Depuis Synology

```bash
# Récupérer le backup
scp backup-user@192.168.1.100:/volume1/backups/convention/daily/convention_database_*.sql.gz ./

# Restaurer la DB
gunzip convention_database_*.sql.gz
docker exec -i mysql_db mysql -u root -p$MYSQL_ROOT_PASSWORD convention_db < convention_database_*.sql
```

### Depuis archive locale

```bash
# Copier depuis le volume Docker
docker cp convention-backup-prod:/backup/archives/convention_database_*.sql.gz ./

# Restaurer
gunzip convention_database_*.sql.gz
docker exec -i database-prod mysql -u root -p$MYSQL_ROOT_PASSWORD < convention_database_*.sql
```

## 📦 Structure des backups

```
/volume1/backups/convention/
├── daily/
│   ├── convention_database_20240101_030000.sql.gz
│   ├── convention_uploads_20240101_030000.tar.gz
│   └── convention_config_20240101_030000.tar.gz
├── weekly/  (optionnel, à configurer)
└── monthly/ (optionnel, à configurer)
```

## 🎯 Best Practices

1. **Tester régulièrement** la restauration
2. **Vérifier** les logs après chaque backup
3. **Configurer Hyper Backup** sur Synology pour backup vers cloud
4. **Règle 3-2-1** : 3 copies, 2 supports différents, 1 hors-site
5. **Chiffrer** les backups sensibles avant transfert