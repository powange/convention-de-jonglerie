# Guide de configuration Synology pour les backups

## Étapes sur le NAS Synology (DSM 7.x)

### 1. Activer SSH
1. Ouvrir **Panneau de configuration**
2. Aller dans **Terminal & SNMP**
3. Onglet **Terminal**
4. Cocher **"Activer le service SSH"**
5. Port : `22` (ou personnalisé si vous préférez)
6. Cliquer sur **Appliquer**

### 2. Activer le service rsync
1. Ouvrir **Panneau de configuration**
2. Aller dans **Services de fichiers**
3. Onglet **rsync**
4. Cocher **"Activer le service rsync"**
5. Port rsync : `873` (par défaut)
6. Cliquer sur **Appliquer**

### 3. Créer un utilisateur dédié aux backups
1. **Panneau de configuration** → **Utilisateur**
2. Cliquer sur **Créer**
3. Configuration :
   - Nom : `backup_user`
   - Description : "Utilisateur pour backups Docker"
   - Mot de passe : (choisir un mot de passe fort)
   - Confirmer le mot de passe
4. **Suivant** → Rejoindre le groupe **users**
5. **Suivant** → Permissions des dossiers partagés :
   - Donner accès **Lecture/Écriture** uniquement au dossier de backup
   - **Pas d'accès** aux autres dossiers
6. **Suivant** → Quota : laisser par défaut
7. **Suivant** → Applications : **Refuser tout**
8. **Suivant** → Limite de vitesse : laisser par défaut
9. **Appliquer**

### 4. Créer le dossier de destination
1. Ouvrir **File Station**
2. Naviguer vers le volume principal (généralement `volume1`)
3. Créer la structure de dossiers :
   ```
   /volume1/
   └── backups/
       └── convention/
           ├── daily/
           ├── weekly/
           └── monthly/
   ```
4. Clic droit sur le dossier `backups` → **Propriétés**
5. Onglet **Permission**
6. Cliquer sur **Créer** → Sélectionner `backup_user`
7. Permissions : **Lecture** + **Écriture**
8. Cocher **Appliquer aux sous-dossiers**
9. **OK**

### 5. Activer l'accès SSH pour l'utilisateur
1. **Panneau de configuration** → **Utilisateur** → **Avancé**
2. Cocher **"Activer le service utilisateur personnel"**
3. Appliquer

### 6. Configuration de l'authentification par clé SSH

#### Sur votre machine locale (ou serveur Docker) :

```bash
# Générer une paire de clés SSH (sans passphrase pour automatisation)
ssh-keygen -t rsa -b 4096 -C "backup@convention" -f ~/.ssh/synology_backup -N ""

# Afficher la clé publique
cat ~/.ssh/synology_backup.pub
```

#### Sur le Synology (via SSH) :

```bash
# Se connecter en SSH avec l'utilisateur backup_user
ssh backup_user@[IP_SYNOLOGY]

# Créer le dossier .ssh s'il n'existe pas
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Ajouter la clé publique
echo "[COLLER_LA_CLE_PUBLIQUE_ICI]" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Sortir
exit
```

#### Tester la connexion :

```bash
# Depuis votre serveur
ssh -i ~/.ssh/synology_backup backup_user@[IP_SYNOLOGY] "echo 'Connexion SSH OK'"
```

## Configuration dans Portainer

Dans les variables d'environnement de la stack :

```env
# Configuration Synology
BACKUP_DESTINATION=synology
SYNOLOGY_HOST=192.168.1.100     # Remplacer par l'IP de votre NAS
SYNOLOGY_USER=backup_user
SYNOLOGY_PATH=/volume1/backups/convention
RETENTION_DAYS=30

# Clé SSH privée (copier le contenu complet)
SSH_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
[Contenu de la clé privée]
-----END RSA PRIVATE KEY-----
```

## Test du backup

Une fois configuré, vous pouvez tester manuellement :

```bash
# Entrer dans le container de backup
docker exec -it convention-backup-prod bash

# Tester la connexion SSH
ssh -o StrictHostKeyChecking=no backup_user@$SYNOLOGY_HOST "ls -la $SYNOLOGY_PATH"

# Lancer un backup manuel
/backup/backup.sh
```

## Vérification sur le Synology

1. **File Station** : Vérifier que les fichiers de backup apparaissent dans `/volume1/backups/convention/daily/`
2. **Gestionnaire de stockage** : Surveiller l'espace utilisé
3. **Journal** : Vérifier les connexions SSH dans Centre de sécurité → Journal

## Sécurité supplémentaire (optionnel)

### Restreindre l'accès SSH par IP
1. **Panneau de configuration** → **Sécurité**
2. Onglet **Pare-feu**
3. Créer une règle pour n'autoriser SSH que depuis l'IP du serveur Docker

### Activer la double authentification
1. **Panneau de configuration** → **Utilisateur**
2. Sélectionner `backup_user`
3. Activer l'authentification à 2 facteurs (peut compliquer l'automatisation)

## Surveillance

### Sur Synology
- **Gestionnaire de stockage** : Pour surveiller l'espace disque
- **Journal des connexions** : Pour voir les connexions SSH
- **File Station** : Pour vérifier les backups

### Notifications (optionnel)
Configurer dans Portainer :
```env
NOTIFICATION_WEBHOOK=https://discord.com/api/webhooks/...
```

## Dépannage

### Erreur "Permission denied"
- Vérifier les permissions du dossier dans File Station
- Vérifier que l'utilisateur a accès SSH
- Vérifier les permissions de `.ssh/authorized_keys` (doit être 600)

### Erreur "Connection refused"
- Vérifier que SSH est activé
- Vérifier le pare-feu Synology
- Tester avec : `telnet [IP_SYNOLOGY] 22`

### Erreur "Host key verification failed"
- Normal lors de la première connexion
- Le script utilise `StrictHostKeyChecking=no` pour éviter ce problème