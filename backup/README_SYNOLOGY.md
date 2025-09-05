# Configuration Backup Synology

## Variables d'environnement à configurer dans Portainer

### Configuration de base
- `BACKUP_DESTINATION`: `synology`
- `BACKUP_PREFIX`: `convention-prod`
- `RETENTION_DAYS`: `30` (nombre de jours à conserver)

### Connexion Synology
- `SYNOLOGY_HOST`: IP ou nom d'hôte de votre NAS (ex: `192.168.1.100` ou `nas.local`)
- `SYNOLOGY_USER`: Utilisateur SSH sur le NAS (ex: `backup_user`)
- `SYNOLOGY_PATH`: Chemin sur le NAS (ex: `/volume1/backups/convention`)

### Authentification SSH

#### Option 1 : Clé SSH (recommandé)
1. Générer une paire de clés sur votre machine locale :
   ```bash
   ssh-keygen -t rsa -b 4096 -f synology_backup_key -N ""
   ```

2. Copier la clé publique sur le Synology :
   ```bash
   ssh-copy-id -i synology_backup_key.pub backup_user@nas.local
   ```

3. Dans Portainer, définir `SSH_PRIVATE_KEY` avec le contenu de `synology_backup_key`

#### Option 2 : Mot de passe (moins sécurisé)
- Modifier le script pour utiliser sshpass (nécessite modification du Dockerfile)

## Préparation du NAS Synology

1. **Activer SSH** :
   - Panneau de configuration → Terminal & SNMP
   - Activer le service SSH

2. **Créer un utilisateur dédié** :
   - Panneau de configuration → Utilisateur
   - Créer `backup_user`
   - Donner les permissions sur le dossier de destination

3. **Créer le dossier de backup** :
   - File Station → Créer `/volume1/backups/convention`
   - Donner les permissions à `backup_user`

## Alternative : Montage SMB/CIFS

Si vous préférez monter un partage SMB directement :

```yaml
# Dans docker-compose.prod.yml
volumes:
  - type: cifs
    source: //192.168.1.100/backups
    target: /backup/remote
    options:
      - username=backup_user
      - password=your_password
      - uid=1000
      - gid=1000
```

## Test de connexion

Depuis le container de backup :
```bash
docker exec -it convention-backup-prod bash
ssh backup_user@192.168.1.100 "echo 'Connexion OK'"
```

## Planification

Le cron dans le container est configuré pour :
- Backup quotidien à 2h du matin
- Backup hebdomadaire le dimanche
- Backup mensuel le 1er du mois