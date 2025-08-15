# Configuration de Docker Desktop pour Windows

## Prérequis système

### Configuration minimale requise
- **Windows 10** 64-bit : Pro, Enterprise, ou Education (Build 19041 ou supérieur)
- **Windows 11** 64-bit : Pro, Enterprise, ou Education
- **RAM** : 4 GB minimum (8 GB recommandé)
- **Virtualisation** : Activée dans le BIOS
- **WSL 2** : Windows Subsystem for Linux version 2

## Installation de Docker Desktop

### 1. Télécharger Docker Desktop
1. Allez sur https://www.docker.com/products/docker-desktop/
2. Cliquez sur "Download for Windows"
3. Lancez l'installateur `Docker Desktop Installer.exe`

### 2. Activer WSL 2 (si pas déjà fait)
```powershell
# Ouvrir PowerShell en tant qu'administrateur

# Activer WSL
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Activer la fonctionnalité de machine virtuelle
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Redémarrer l'ordinateur
Restart-Computer

# Après redémarrage, définir WSL 2 comme version par défaut
wsl --set-default-version 2

# Installer le kernel Linux pour WSL 2 si demandé
# Télécharger depuis : https://aka.ms/wsl2kernel
```

### 3. Vérifier la virtualisation
1. Ouvrir le **Gestionnaire des tâches** (Ctrl+Shift+Esc)
2. Onglet **Performance**
3. Sélectionner **CPU**
4. Vérifier que **Virtualisation** est **Activée**

Si désactivée, activer dans le BIOS :
- Redémarrer et accéder au BIOS (F2, F12, DEL selon le fabricant)
- Chercher : Intel VT-x, AMD-V, SVM, ou Virtualization Technology
- Activer et sauvegarder

## Configuration optimale pour le projet

### 1. Paramètres généraux
Ouvrir Docker Desktop → **Settings** (icône engrenage)

#### General
- ✅ **Start Docker Desktop when you log in** : Activé pour démarrage automatique
- ✅ **Use the WSL 2 based engine** : OBLIGATOIRE (meilleures performances)
- ❌ **Send usage statistics** : Désactivé (optionnel)
- ✅ **Use Docker Compose V2** : Activé

#### Resources → Advanced
Configuration recommandée pour ce projet :
- **CPUs** : Au moins 2 (idéalement 4)
- **Memory** : Au moins 4 GB (idéalement 6-8 GB)
- **Swap** : 1 GB
- **Disk image size** : 60 GB minimum

```
Exemple de configuration optimale :
- CPUs: 4
- Memory: 6 GB
- Swap: 2 GB
- Disk: 80 GB
```

#### Resources → WSL Integration
- ✅ **Enable integration with my default WSL distro** : Activé
- Activer l'intégration avec votre distribution WSL si vous en avez une

#### Resources → File Sharing
Ajouter le dossier du projet :
1. Cliquer sur le **+**
2. Naviguer vers `D:\projet\convention-de-jonglerie-gemini-code`
3. Cliquer **Apply & Restart**

**Important** : Ceci est OBLIGATOIRE pour que les volumes Docker fonctionnent !

#### Docker Engine
Configuration JSON recommandée :
```json
{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "experimental": false,
  "features": {
    "buildkit": true
  },
  "registry-mirrors": [],
  "storage-driver": "overlay2",
  "debug": false,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### 2. Optimisations spécifiques Windows

#### Exclusions antivirus
Ajouter des exclusions pour améliorer les performances :

**Windows Defender** :
1. Ouvrir **Sécurité Windows**
2. **Protection contre les virus et menaces** → **Gérer les paramètres**
3. **Exclusions** → **Ajouter ou supprimer des exclusions**
4. Ajouter ces dossiers :
   - `C:\Program Files\Docker`
   - `C:\ProgramData\Docker`
   - `D:\projet\convention-de-jonglerie-gemini-code`
   - `%USERPROFILE%\.docker`

#### Désactiver l'indexation Windows
Pour le dossier du projet :
1. Clic droit sur `D:\projet\convention-de-jonglerie-gemini-code`
2. **Propriétés** → **Avancé**
3. Décocher **Autoriser l'indexation du contenu...**
4. Appliquer aux sous-dossiers

#### Mode développeur Windows
1. **Paramètres** → **Mise à jour et sécurité**
2. **Pour les développeurs**
3. Activer **Mode développeur**

### 3. Configuration réseau

#### Ports utilisés par le projet
Vérifier que ces ports sont libres :
```powershell
# Dans PowerShell
netstat -an | findstr :3000    # App Nuxt
netstat -an | findstr :3306    # MySQL
netstat -an | findstr :8080    # Adminer
netstat -an | findstr :24678   # WebSocket HMR
```

Si un port est occupé, identifier le processus :
```powershell
netstat -ano | findstr :3000
# Noter le PID à la fin
tasklist | findstr [PID]
```

#### Pare-feu Windows
Autoriser Docker dans le pare-feu :
1. **Panneau de configuration** → **Système et sécurité** → **Pare-feu Windows Defender**
2. **Autoriser une application**
3. Vérifier que **Docker Desktop Backend** est autorisé
4. Si absent, l'ajouter manuellement

### 4. Problèmes courants et solutions

#### Docker ne démarre pas
```powershell
# Réinitialiser WSL
wsl --shutdown
wsl --unregister docker-desktop
wsl --unregister docker-desktop-data

# Redémarrer Docker Desktop
```

#### Erreur "Docker daemon not running"
1. Ouvrir **Services** (services.msc)
2. Trouver **Docker Desktop Service**
3. Clic droit → **Redémarrer**

#### Performances lentes
1. Vérifier l'utilisation de WSL 2 (pas Hyper-V)
2. Augmenter les ressources allouées
3. Désactiver **Fast Startup** :
   ```powershell
   powercfg /h off
   ```

#### Problème de synchronisation de fichiers
Dans Docker Desktop :
1. **Settings** → **Resources** → **File Sharing**
2. Retirer le dossier du projet
3. **Apply & Restart**
4. Rajouter le dossier
5. **Apply & Restart**

## Commandes de vérification

### Vérifier l'installation
```powershell
# Version de Docker
docker --version
docker-compose --version

# Infos système Docker
docker system info

# Vérifier WSL
wsl --list --verbose

# Tester Docker
docker run hello-world
```

### Monitoring des ressources
```powershell
# Utilisation des ressources Docker
docker system df

# Statistiques en temps réel
docker stats

# Voir tous les conteneurs
docker ps -a

# Logs Docker Desktop
%LOCALAPPDATA%\Docker\log.txt
```

## Configuration spécifique au projet

### 1. Cloner le projet
```powershell
# Se placer dans D:\projet
cd D:\projet
git clone [URL_DU_REPO] convention-de-jonglerie-gemini-code
cd convention-de-jonglerie-gemini-code
```

### 2. Créer le fichier .env
```powershell
# Copier l'exemple
copy .env.example .env

# Éditer avec notepad ou VSCode
notepad .env
```

### 3. Lancer le projet
```powershell
# Installation des dépendances (une fois)
npm install

# Démarrer les services Docker
docker-compose -f docker-compose.dev.yml up -d

# Vérifier que tout fonctionne
docker-compose -f docker-compose.dev.yml ps
```

### 4. Accès aux services
- Application : http://localhost:3000
- Adminer : http://localhost:8080
- Base de données : localhost:3306

## Maintenance et nettoyage

### Nettoyage régulier
```powershell
# Nettoyer les conteneurs arrêtés
docker container prune

# Nettoyer les images non utilisées
docker image prune -a

# Nettoyer les volumes non utilisés
docker volume prune

# Nettoyer tout (ATTENTION : supprime tout)
docker system prune -a --volumes
```

### Sauvegarde des données
```powershell
# Sauvegarder les volumes Docker
docker run --rm -v convention-de-jonglerie-gemini-code_mysql_data:/data -v D:\backups:/backup alpine tar czf /backup/mysql_backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.tar.gz -C /data .

docker run --rm -v convention-de-jonglerie-gemini-code_uploads_data:/data -v D:\backups:/backup alpine tar czf /backup/uploads_backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.tar.gz -C /data .
```

## Scripts utiles pour Windows

### Créer start-dev.bat
```batch
@echo off
echo Démarrage de l'environnement de développement...
docker-compose -f docker-compose.dev.yml up -d
echo.
echo Services démarrés :
echo - Application : http://localhost:3000
echo - Adminer : http://localhost:8080
echo - MySQL : localhost:3306
echo.
docker-compose -f docker-compose.dev.yml ps
pause
```

### Créer stop-dev.bat
```batch
@echo off
echo Arrêt de l'environnement de développement...
docker-compose -f docker-compose.dev.yml down
echo Services arrêtés.
pause
```

### Créer restart-app.bat
```batch
@echo off
echo Redémarrage de l'application...
docker-compose -f docker-compose.dev.yml restart app
echo Application redémarrée.
pause
```

### Créer logs.bat
```batch
@echo off
docker-compose -f docker-compose.dev.yml logs -f --tail=100 app
```

## Ressources et aide

### Documentation officielle
- [Docker Desktop for Windows](https://docs.docker.com/desktop/windows/)
- [WSL 2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [Docker Compose](https://docs.docker.com/compose/)

### Communauté
- [Docker Community Forums](https://forums.docker.com/)
- [Stack Overflow - Docker tag](https://stackoverflow.com/questions/tagged/docker)

### Support du projet
- Issues GitHub du projet
- Documentation DOCKER.md pour l'utilisation générale