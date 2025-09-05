FROM alpine:latest

# Installation des outils nécessaires
RUN apk add --no-cache \
    mysql-client \
    postgresql-client \
    rsync \
    openssh-client \
    sshpass \
    tar \
    gzip \
    curl \
    bash \
    tzdata

# Configuration du timezone
ENV TZ=Europe/Paris

# Création du répertoire de travail
WORKDIR /backup

# Copie des scripts
COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

# Rendre les scripts exécutables
RUN chmod +x /usr/local/bin/backup.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

# Création des répertoires nécessaires
RUN mkdir -p /backup/temp /backup/logs /root/.ssh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["crond", "-f", "-l", "2"]