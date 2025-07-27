# 🚀 Démarrage rapide avec Portainer

## Le problème
Portainer ne peut pas construire d'images Docker depuis un repository Git. Il faut soit :
1. Utiliser des images pré-construites
2. Construire l'image sur le serveur d'abord

## Solution 1 : Déployer seulement MySQL et Adminer d'abord

1. Dans Portainer, utilisez :
   - **Compose path** : `portainer-simple.yml`
   - **Variables** :
     ```
     MYSQL_ROOT_PASSWORD=votre_mot_de_passe_root
     MYSQL_PASSWORD=votre_mot_de_passe_user
     ```

2. Ceci déploiera MySQL et Adminer sans l'application

## Solution 2 : Utiliser docker-compose directement sur le serveur

Sur votre serveur (via SSH) :

```bash
# Cloner le projet
git clone https://github.com/powange/convention-de-jonglerie.git
cd convention-de-jonglerie

# Créer le fichier .env.docker
cp .env.docker.example .env.docker
# Éditer .env.docker avec vos valeurs

# Lancer avec docker-compose
docker-compose up -d
```

## Solution 3 : Construire et publier l'image

Si vous voulez vraiment utiliser Portainer avec Git :

1. Sur votre machine locale ou serveur :
```bash
# Construire l'image
docker build -t your-dockerhub-username/convention-de-jonglerie .

# Se connecter à Docker Hub
docker login

# Pousser l'image
docker push your-dockerhub-username/convention-de-jonglerie
```

2. Modifier `portainer-stack.yml` pour utiliser votre image :
```yaml
app:
  image: your-dockerhub-username/convention-de-jonglerie:latest
```

## Recommandation

**Utilisez docker-compose directement sur le serveur** (Solution 2). C'est plus simple et évite les problèmes de build dans Portainer.

Portainer pourra ensuite gérer les conteneurs une fois qu'ils sont démarrés.