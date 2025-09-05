#!/bin/bash

# Script de backup sécurisé avec variables d'environnement
# Toutes les informations sensibles sont dans l'environnement

set -e  # Arrêter en cas d'erreur

# Variables avec valeurs par défaut
BACKUP_PREFIX="${BACKUP_PREFIX:-backup}"
DATE=$(date +%Y%m%d_%H%M%S)
TEMP_DIR="/backup/temp/$DATE"
LOG_FILE="/backup/logs/backup_${DATE}.log"

# Fonction de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Vérification des variables requises
check_env() {
    local required_vars=""
    
    if [ -z "$DB_HOST" ]; then required_vars="$required_vars DB_HOST"; fi
    if [ -z "$DB_NAME" ]; then required_vars="$required_vars DB_NAME"; fi
    if [ -z "$DB_USER" ]; then required_vars="$required_vars DB_USER"; fi
    if [ -z "$DB_PASSWORD" ]; then required_vars="$required_vars DB_PASSWORD"; fi
    
    if [ "$BACKUP_DESTINATION" = "synology" ]; then
        if [ -z "$SYNOLOGY_HOST" ]; then required_vars="$required_vars SYNOLOGY_HOST"; fi
        if [ -z "$SYNOLOGY_USER" ]; then required_vars="$required_vars SYNOLOGY_USER"; fi
        if [ -z "$SYNOLOGY_PATH" ]; then required_vars="$required_vars SYNOLOGY_PATH"; fi
    fi
    
    if [ -n "$required_vars" ]; then
        log "ERREUR: Variables manquantes: $required_vars"
        exit 1
    fi
}

# Création du répertoire temporaire
prepare_backup() {
    log "Démarrage du backup..."
    mkdir -p "$TEMP_DIR"
    log "Répertoire temporaire créé: $TEMP_DIR"
}

# Backup de la base de données MySQL
backup_database() {
    log "Backup de la base de données MySQL..."
    
    mysqldump \
        -h "$DB_HOST" \
        -u "$DB_USER" \
        -p"$DB_PASSWORD" \
        --single-transaction \
        --routines \
        --triggers \
        --add-drop-table \
        --extended-insert \
        "$DB_NAME" | gzip > "$TEMP_DIR/${BACKUP_PREFIX}_database_$DATE.sql.gz"
    
    log "Backup de la base de données terminé ($(du -h "$TEMP_DIR/${BACKUP_PREFIX}_database_$DATE.sql.gz" | cut -f1))"
}

# Backup des volumes Docker si montés
backup_volumes() {
    if [ -d "/data/uploads" ]; then
        log "Backup du dossier uploads..."
        tar czf "$TEMP_DIR/${BACKUP_PREFIX}_uploads_$DATE.tar.gz" -C /data/uploads .
        log "Backup des uploads terminé ($(du -h "$TEMP_DIR/${BACKUP_PREFIX}_uploads_$DATE.tar.gz" | cut -f1))"
    fi
    
    if [ -d "/data/config" ]; then
        log "Backup de la configuration..."
        tar czf "$TEMP_DIR/${BACKUP_PREFIX}_config_$DATE.tar.gz" -C /data/config .
        log "Backup de la configuration terminé"
    fi
}

# Transfert vers Synology
transfer_to_synology() {
    log "Transfert vers Synology NAS ($SYNOLOGY_HOST)..."
    
    # Utilisation de mot de passe ou clé SSH
    if [ -n "$SYNOLOGY_PASSWORD" ]; then
        # Connexion par mot de passe avec sshpass
        export SSHPASS="$SYNOLOGY_PASSWORD"
        
        # Création du répertoire sur Synology si nécessaire
        sshpass -e ssh -o StrictHostKeyChecking=no \
            "$SYNOLOGY_USER@$SYNOLOGY_HOST" \
            "mkdir -p $SYNOLOGY_PATH/daily"
        
        # Transfert avec rsync via sshpass
        sshpass -e rsync -avz --progress \
            -e "ssh -o StrictHostKeyChecking=no" \
            "$TEMP_DIR/" \
            "$SYNOLOGY_USER@$SYNOLOGY_HOST:$SYNOLOGY_PATH/daily/"
            
    elif [ -n "$SSH_PRIVATE_KEY" ]; then
        # Configuration SSH avec clé
        echo "$SSH_PRIVATE_KEY" > /root/.ssh/id_rsa
        chmod 600 /root/.ssh/id_rsa
        
        # Création du répertoire sur Synology si nécessaire
        ssh -o StrictHostKeyChecking=no \
            "$SYNOLOGY_USER@$SYNOLOGY_HOST" \
            "mkdir -p $SYNOLOGY_PATH/daily"
        
        # Transfert avec rsync
        rsync -avz --progress \
            -e "ssh -o StrictHostKeyChecking=no" \
            "$TEMP_DIR/" \
            "$SYNOLOGY_USER@$SYNOLOGY_HOST:$SYNOLOGY_PATH/daily/"
    else
        log "ERREUR: Ni SYNOLOGY_PASSWORD ni SSH_PRIVATE_KEY définis"
        return 1
    fi
    
    log "Transfert terminé avec succès"
}

# Transfert local (pour tests)
transfer_local() {
    local dest="${LOCAL_BACKUP_PATH:-/backup/archives}"
    log "Sauvegarde locale vers $dest"
    mkdir -p "$dest"
    cp -r "$TEMP_DIR/"* "$dest/"
    log "Sauvegarde locale terminée"
}

# Nettoyage des anciens backups
cleanup() {
    log "Nettoyage..."
    
    # Nettoyage local
    rm -rf "$TEMP_DIR"
    find /backup/temp -type d -mtime +1 -exec rm -rf {} + 2>/dev/null || true
    find /backup/logs -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    # Nettoyage sur Synology (garder X jours)
    if [ "$BACKUP_DESTINATION" = "synology" ] && [ -n "$RETENTION_DAYS" ]; then
        log "Nettoyage des backups de plus de $RETENTION_DAYS jours sur Synology..."
        if [ -n "$SYNOLOGY_PASSWORD" ]; then
            export SSHPASS="$SYNOLOGY_PASSWORD"
            sshpass -e ssh -o StrictHostKeyChecking=no \
                "$SYNOLOGY_USER@$SYNOLOGY_HOST" \
                "find $SYNOLOGY_PATH/daily -name '${BACKUP_PREFIX}_*.gz' -mtime +$RETENTION_DAYS -delete"
        else
            ssh -o StrictHostKeyChecking=no \
                "$SYNOLOGY_USER@$SYNOLOGY_HOST" \
                "find $SYNOLOGY_PATH/daily -name '${BACKUP_PREFIX}_*.gz' -mtime +$RETENTION_DAYS -delete"
        fi
    fi
    
    log "Nettoyage terminé"
}

# Notification (optionnel)
notify() {
    if [ -n "$NOTIFICATION_WEBHOOK" ]; then
        local status="$1"
        local message="$2"
        curl -X POST "$NOTIFICATION_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"Backup $BACKUP_PREFIX: $status - $message\"}" \
            2>/dev/null || true
    fi
}

# Main
main() {
    log "========================================="
    log "Début du backup: $BACKUP_PREFIX"
    log "========================================="
    
    # Vérifications
    check_env
    
    # Étapes du backup
    prepare_backup
    backup_database
    backup_volumes
    
    # Transfert selon destination
    case "$BACKUP_DESTINATION" in
        "synology")
            transfer_to_synology
            ;;
        "local")
            transfer_local
            ;;
        *)
            log "AVERTISSEMENT: Aucune destination configurée, backup local uniquement"
            transfer_local
            ;;
    esac
    
    # Nettoyage
    cleanup
    
    log "========================================="
    log "Backup terminé avec succès!"
    log "========================================="
    
    # Notification de succès
    notify "SUCCESS" "Backup completed at $(date)"
}

# Gestion des erreurs
trap 'log "ERREUR: Backup échoué!"; notify "ERROR" "Backup failed at $(date)"; exit 1' ERR

# Exécution
main