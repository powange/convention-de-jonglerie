# Configuration des Providers IA (Anthropic & Ollama)

Cette documentation explique comment configurer et utiliser les différents providers d'IA pour l'extraction de workshops depuis des images.

## Vue d'ensemble

L'application supporte deux providers d'IA pour l'extraction de workshops depuis des images :

1. **Anthropic Claude** (par défaut) - API cloud payante, très performante
2. **Ollama** - Modèles open-source locaux, gratuits, nécessite des ressources locales

## Configuration

### Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` :

```env
# Provider IA à utiliser (anthropic ou ollama)
AI_PROVIDER=anthropic

# Configuration Anthropic (si AI_PROVIDER=anthropic)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Configuration Ollama (si AI_PROVIDER=ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llava
```

## Option 1 : Utiliser Anthropic Claude (par défaut)

### Avantages

- ✅ Très performant et précis
- ✅ Aucune installation locale requise
- ✅ Supporte de nombreux formats d'image
- ✅ Réponses rapides

### Inconvénients

- ❌ Payant (coût par requête)
- ❌ Nécessite une connexion internet
- ❌ Dépend d'un service tiers

### Configuration

1. **Obtenir une clé API** :
   - Créer un compte sur [console.anthropic.com](https://console.anthropic.com)
   - Générer une clé API dans les paramètres
   - Ajouter des crédits au compte

2. **Configurer l'application** :

   ```env
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxx
   ```

3. **Redémarrer l'application** :
   ```bash
   npm run dev
   # ou en Docker
   npm run docker:dev:down && npm run docker:dev
   ```

### Coûts estimés

- **Modèle** : Claude 3.5 Sonnet
- **Coût par image** : ~$0.01-0.03 selon la taille
- **Volume** : Environ 30-100 images par dollar

Consultez la [tarification Anthropic](https://www.anthropic.com/pricing) pour les prix actuels.

## Option 2 : Utiliser Ollama (local)

### Avantages

- ✅ Gratuit et open-source
- ✅ Pas de limite de requêtes
- ✅ Confidentialité totale (données locales)
- ✅ Pas de dépendance internet

### Inconvénients

- ❌ Nécessite des ressources matérielles (RAM, GPU recommandé)
- ❌ Installation et configuration requises
- ❌ Potentiellement moins précis qu'Anthropic
- ❌ Plus lent sans GPU

### Prérequis matériels

**Minimum** (CPU uniquement) :

- 8 GB RAM
- 10 GB espace disque
- Temps de réponse : ~30-60 secondes

**Recommandé** (avec GPU) :

- 16 GB RAM
- NVIDIA GPU avec 6+ GB VRAM
- 10 GB espace disque
- Temps de réponse : ~5-15 secondes

### Installation

#### 1. Installer Ollama

**Linux / WSL** :

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**macOS** :

```bash
brew install ollama
```

**Windows** :

- Télécharger depuis [ollama.com](https://ollama.com/download)

#### 2. Télécharger le modèle avec vision

```bash
ollama pull llava
```

Modèles alternatifs avec vision :

- `llava:7b` - Petit, rapide (7 GB)
- `llava:13b` - Moyen, bon équilibre (13 GB)
- `llava:34b` - Grand, très précis (34 GB) - nécessite GPU puissant
- `bakllava` - Alternative performante

#### 3. Tester Ollama

```bash
# Vérifier que le service est accessible
curl http://localhost:11434/api/tags

# Devrait retourner une liste des modèles installés
```

### Configuration avec Docker

#### Option A : Ollama sur l'hôte (recommandé)

1. **Installer Ollama sur l'hôte** (voir ci-dessus)

2. **Démarrer Ollama** :

   ```bash
   ollama serve
   ```

3. **Configurer l'application** :
   ```env
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://host.docker.internal:11434  # Windows/Mac
   # ou
   OLLAMA_BASE_URL=http://172.17.0.1:11434            # Linux
   OLLAMA_MODEL=llava
   ```

#### Option B : Ollama en conteneur Docker

1. **Décommenter le service Ollama** dans `docker-compose.dev.yml` :

   ```yaml
   ollama:
     image: ollama/ollama:latest
     container_name: convention-ollama
     restart: unless-stopped
     ports:
       - '11434:11434'
     volumes:
       - ollama_data:/root/.ollama
   ```

2. **Décommenter le volume** :

   ```yaml
   volumes:
     ollama_data:
       driver: local
   ```

3. **Démarrer les services** :

   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Installer le modèle dans le conteneur** :

   ```bash
   docker exec -it convention-ollama ollama pull llava
   ```

5. **Configurer l'application** :
   ```env
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://ollama:11434
   OLLAMA_MODEL=llava
   ```

#### Option C : Ollama avec GPU (NVIDIA)

1. **Installer nvidia-container-toolkit** :

   ```bash
   # Ubuntu/Debian
   distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
   curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
   curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
   sudo systemctl restart docker
   ```

2. **Décommenter la section GPU** dans `docker-compose.dev.yml` :
   ```yaml
   ollama:
     image: ollama/ollama:latest
     deploy:
       resources:
         reservations:
           devices:
             - driver: nvidia
               count: 1
               capabilities: [gpu]
   ```

### Configuration de production

Pour les environnements `release` et `prod`, ajoutez les variables d'environnement :

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llava
```

## Comparaison des providers

| Critère             | Anthropic Claude          | Ollama (llava)       |
| ------------------- | ------------------------- | -------------------- |
| **Coût**            | ~$0.01-0.03/image         | Gratuit              |
| **Vitesse**         | ~3-5 secondes             | ~5-60 secondes       |
| **Précision**       | Excellente                | Bonne                |
| **Ressources**      | Aucune                    | 8-16 GB RAM          |
| **Internet**        | Requis                    | Optionnel            |
| **Confidentialité** | Données envoyées au cloud | 100% local           |
| **Setup**           | Simple (clé API)          | Moyen (installation) |

## Utilisation

Une fois configuré, l'utilisation est identique quel que soit le provider :

1. Accéder à la page de gestion de l'édition
2. Section "Workshops" > "Importer depuis une photo"
3. Sélectionner une image
4. L'IA extraira automatiquement les workshops

## Troubleshooting

### Anthropic

**Erreur : "Crédits insuffisants"**

- Ajouter des crédits sur [console.anthropic.com](https://console.anthropic.com)

**Erreur : "Clé API invalide"**

- Vérifier que `ANTHROPIC_API_KEY` est correct
- Régénérer une nouvelle clé si nécessaire

### Ollama

**Erreur : "Service non accessible"**

```bash
# Vérifier qu'Ollama est démarré
curl http://localhost:11434/api/tags

# Si pas de réponse, démarrer Ollama
ollama serve
```

**Erreur : "Modèle non trouvé"**

```bash
# Télécharger le modèle
ollama pull llava
```

**Performance lente**

- Utiliser un GPU si possible
- Essayer un modèle plus petit (`llava:7b`)
- Augmenter la RAM allouée

**Erreur mémoire**

- Fermer d'autres applications
- Utiliser un modèle plus petit
- Augmenter la swap (Linux)

### Docker

**Erreur : "Cannot connect to Ollama"**

- Vérifier l'URL dans `OLLAMA_BASE_URL`
- Windows/Mac : utiliser `host.docker.internal`
- Linux : utiliser l'IP du bridge Docker

**GPU non détecté**

- Installer nvidia-container-toolkit
- Redémarrer Docker
- Vérifier avec `docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi`

## Basculer entre providers

Pour changer de provider, il suffit de modifier la variable d'environnement :

```bash
# Passer à Ollama
echo "AI_PROVIDER=ollama" >> .env

# Passer à Anthropic
echo "AI_PROVIDER=anthropic" >> .env

# Redémarrer l'application
npm run docker:dev:down && npm run docker:dev
```

## Recommandations

### Pour le développement

- **Anthropic** si vous avez des crédits et une bonne connexion
- **Ollama** si vous développez hors ligne ou avec un budget limité

### Pour la production

- **Anthropic** pour une meilleure qualité et simplicité
- **Ollama** pour réduire les coûts avec un volume important

### Hybride

Vous pouvez aussi utiliser :

- Anthropic en production (qualité)
- Ollama en développement (gratuit)

## Ressources

- [Documentation Anthropic](https://docs.anthropic.com/)
- [Documentation Ollama](https://ollama.com/docs)
- [Modèles Ollama](https://ollama.com/library)
- [LLaVA Model](https://ollama.com/library/llava)

## Support

En cas de problème :

1. Consulter les logs : `npm run docker:dev:logs`
2. Vérifier la configuration des variables d'environnement
3. Tester le provider manuellement (curl)
4. Consulter cette documentation
