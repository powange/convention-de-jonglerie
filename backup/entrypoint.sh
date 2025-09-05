#!/bin/bash

# Entrypoint pour le container de backup
# Configure cron et lance le service

set -e

# Configuration du crontab depuis variable d'environnement
setup_cron() {
    CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"  # Par défaut: 3h du matin
    
    echo "Configuration du cron: $CRON_SCHEDULE"
    
    # Création du fichier crontab avec toutes les variables d'environnement
    cat > /etc/crontabs/root <<EOF
# Backup automatique
$CRON_SCHEDULE /usr/local/bin/backup.sh >> /backup/logs/cron.log 2>&1

# Variables d'environnement pour le cron
$(env | grep -E '^(DB_|BACKUP_|SYNOLOGY_|SSH_|LOCAL_|RETENTION_|NOTIFICATION_)' | sed 's/^/export /')
EOF

    echo "Crontab configuré avec succès"
}

# Test de connexion à la base de données
test_db_connection() {
    echo "Test de connexion à la base de données..."
    
    for i in {1..30}; do
        if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" &>/dev/null; then
            echo "Connexion à la base de données réussie!"
            return 0
        fi
        echo "Attente de la base de données... ($i/30)"
        sleep 2
    done
    
    echo "ERREUR: Impossible de se connecter à la base de données"
    return 1
}

# Test de connexion Synology (optionnel)
test_synology_connection() {
    if [ "$BACKUP_DESTINATION" = "synology" ]; then
        echo "Test de connexion au Synology NAS..."
        
        # Configuration SSH
        if [ -n "$SSH_PRIVATE_KEY" ]; then
            echo "$SSH_PRIVATE_KEY" > /root/.ssh/id_rsa
            chmod 600 /root/.ssh/id_rsa
        fi
        
        if [ -n "$SSH_KNOWN_HOSTS" ]; then
            echo "$SSH_KNOWN_HOSTS" > /root/.ssh/known_hosts
        fi
        
        if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
            "$SYNOLOGY_USER@$SYNOLOGY_HOST" "echo 'Connection OK'" &>/dev/null; then
            echo "Connexion au Synology réussie!"
        else
            echo "AVERTISSEMENT: Impossible de se connecter au Synology"
            echo "Les backups seront stockés localement"
        fi
    fi
}

# Backup initial au démarrage (optionnel)
initial_backup() {
    if [ "$RUN_ON_STARTUP" = "true" ]; then
        echo "Exécution du backup initial..."
        /usr/local/bin/backup.sh
    fi
}

# Main
main() {
    echo "========================================="
    echo "Initialisation du service de backup"
    echo "========================================="
    
    # Création des répertoires
    mkdir -p /backup/temp /backup/logs /backup/archives /root/.ssh
    
    # Tests de connexion
    test_db_connection
    test_synology_connection
    
    # Configuration du cron
    setup_cron
    
    # Backup initial si demandé
    initial_backup
    
    echo "========================================="
    echo "Service de backup démarré"
    echo "Prochaine exécution: $CRON_SCHEDULE"
    echo "========================================="
    
    # Lancement du service cron ou autre commande
    exec "$@"
}

# Exécution
main "$@"