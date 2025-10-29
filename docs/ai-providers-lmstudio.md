# Configuration de LM Studio pour l'IA

LM Studio est un outil desktop pour exécuter des modèles de langage localement avec une interface graphique conviviale. Il expose une API compatible OpenAI, ce qui facilite son intégration.

## Avantages de LM Studio

- ✅ **Interface graphique intuitive** - Pas besoin de ligne de commande
- ✅ **Gratuit et open-source** - Pas de coût par requête
- ✅ **Gestion simple des modèles** - Téléchargement et chargement en 1 clic
- ✅ **API compatible OpenAI** - Facile à intégrer
- ✅ **Support GPU natif** - Performances optimisées automatiquement
- ✅ **Confidentialité totale** - Données locales uniquement
- ✅ **Monitoring en temps réel** - Voir les requêtes et réponses

## Installation

### 1. Télécharger LM Studio

Rendez-vous sur [lmstudio.ai](https://lmstudio.ai) et téléchargez la version pour votre système d'exploitation :

- **Windows** : LMStudio-win.exe
- **macOS** : LMStudio-mac.dmg
- **Linux** : LMStudio-linux.AppImage

### 2. Installer l'application

Suivez les instructions d'installation standard pour votre système.

## Configuration

### 1. Télécharger un modèle avec support vision

LM Studio permet de télécharger facilement des modèles depuis Hugging Face.

**Modèles recommandés avec support vision** :

#### Option 1 : LLaVA (Recommandé pour commencer)

- **Nom** : `xtuner/llava-llama-3-8b-v1_1-gguf`
- **Taille** : ~5-8 GB selon la quantification
- **RAM requise** : 8 GB minimum
- **Qualité** : Bonne
- **Vitesse** : Rapide

#### Option 2 : BakLLaVA

- **Nom** : `mys/ggml_bakllava-1`
- **Taille** : ~4 GB
- **RAM requise** : 6 GB minimum
- **Qualité** : Bonne
- **Vitesse** : Très rapide

#### Option 3 : LLaVA 13B (Pour de meilleures performances)

- **Nom** : `cjpais/llava-1.6-mistral-7b-gguf`
- **Taille** : ~8-12 GB
- **RAM requise** : 16 GB minimum
- **Qualité** : Excellente
- **Vitesse** : Moyenne

**Dans LM Studio** :

1. Ouvrir l'onglet "Search" (🔍)
2. Rechercher "llava" ou "bakllava"
3. Cliquer sur "Download" pour le modèle choisi
4. Choisir une quantification (Q4_K_M recommandé pour un bon équilibre)

### 2. Charger le modèle

1. Aller dans l'onglet "Chat" (💬)
2. En haut, cliquer sur "Select a model"
3. Choisir le modèle LLaVA que vous avez téléchargé
4. Attendre que le modèle se charge (barre de progression)

### 3. Démarrer le serveur API

1. Aller dans l'onglet "Local Server" (🖥️)
2. Cliquer sur "Start Server"
3. Le serveur démarre par défaut sur `http://localhost:1234`
4. **Important** : Laisser LM Studio ouvert avec le serveur actif

### 4. Configurer l'application

Ajouter ces variables dans votre fichier `.env` :

```env
# Provider IA à utiliser
AI_PROVIDER=lmstudio

# Configuration LM Studio
LMSTUDIO_BASE_URL=http://localhost:1234
LMSTUDIO_MODEL=auto
```

**Note** : `LMSTUDIO_MODEL=auto` utilise automatiquement le modèle chargé dans LM Studio.

### 5. Redémarrer l'application

```bash
# En développement
npm run dev

# Ou avec Docker
npm run docker:dev:down && npm run docker:dev
```

## Configuration Docker

### Option 1 : LM Studio sur l'hôte (Recommandé)

C'est l'approche la plus simple car LM Studio ne fonctionne pas bien en conteneur.

1. **Installer et démarrer LM Studio sur votre machine**
2. **Charger un modèle vision** (voir ci-dessus)
3. **Démarrer le serveur API** dans LM Studio
4. **Configurer l'application** :

```env
AI_PROVIDER=lmstudio

# Windows/Mac (depuis Docker)
LMSTUDIO_BASE_URL=http://host.docker.internal:1234

# Linux (depuis Docker)
LMSTUDIO_BASE_URL=http://172.17.0.1:1234

LMSTUDIO_MODEL=auto
```

5. **Redémarrer les conteneurs** :

```bash
npm run docker:dev:down && npm run docker:dev
```

## Utilisation

Une fois configuré, l'utilisation est identique aux autres providers :

1. Accéder à la page de gestion de l'édition
2. Section "Workshops" > "Importer depuis une photo"
3. Sélectionner une image
4. LM Studio extraira automatiquement les workshops

## Monitoring et débogage

### Voir les requêtes en temps réel

Dans LM Studio :

1. Aller dans l'onglet "Local Server"
2. Les requêtes s'affichent en temps réel avec :
   - Le prompt envoyé
   - La réponse générée
   - Le temps de traitement
   - Les tokens utilisés

### Logs de l'application

```bash
# Voir les logs Docker
npm run docker:dev:logs

# Ou en développement local
# Les logs s'affichent dans le terminal
```

## Performances

### Sans GPU (CPU uniquement)

- **Temps de réponse** : 15-45 secondes
- **RAM recommandée** : 16 GB
- **Modèle recommandé** : LLaVA 8B en Q4_K_M

### Avec GPU NVIDIA

- **Temps de réponse** : 5-15 secondes
- **VRAM recommandée** : 6+ GB
- **Modèle recommandé** : LLaVA 13B en Q5_K_M

### Avec GPU Apple Silicon (Mac M1/M2/M3)

- **Temps de réponse** : 8-20 secondes
- **RAM recommandée** : 16 GB
- **Modèle recommandé** : LLaVA 8B en Q5_K_M
- **Note** : LM Studio optimise automatiquement pour Apple Silicon

## Paramètres avancés

### Ajuster les paramètres dans LM Studio

Dans l'onglet "Local Server", vous pouvez ajuster :

- **Context Length** : Augmenter pour de longs prompts (défaut : 2048)
- **GPU Offload** : Nombre de couches sur GPU (auto recommandé)
- **Temperature** : Créativité des réponses (0.7 par défaut)

### Spécifier un modèle particulier

Si vous avez plusieurs modèles chargés :

```env
LMSTUDIO_MODEL=xtuner/llava-llama-3-8b-v1_1-gguf
```

## Troubleshooting

### Erreur : "Service non accessible"

**Causes possibles** :

- LM Studio n'est pas démarré
- Le serveur API n'est pas actif dans LM Studio
- Mauvaise URL dans `LMSTUDIO_BASE_URL`

**Solutions** :

1. Vérifier que LM Studio est ouvert
2. Aller dans "Local Server" et cliquer sur "Start Server"
3. Tester avec curl :
   ```bash
   curl http://localhost:1234/v1/models
   ```

### Erreur : "Aucun modèle chargé"

**Solution** :

1. Aller dans l'onglet "Chat" de LM Studio
2. Sélectionner un modèle avec support vision (LLaVA)
3. Attendre que le modèle se charge complètement

### Performance très lente

**Solutions** :

- Utiliser un modèle plus petit (LLaVA 7B au lieu de 13B)
- Augmenter "GPU Offload" dans les paramètres
- Fermer les autres applications gourmandes
- Utiliser une quantification plus agressive (Q4 au lieu de Q5)

### Erreur : "Out of memory"

**Solutions** :

- Utiliser un modèle plus petit
- Réduire "Context Length" dans les paramètres
- Fermer les autres applications
- Augmenter la RAM si possible

### Réponses de mauvaise qualité

**Solutions** :

- Utiliser un modèle plus gros (13B au lieu de 8B)
- Utiliser une quantification moins agressive (Q5 au lieu de Q4)
- Ajuster la température dans LM Studio
- Vérifier que l'image est claire et lisible

## Comparaison avec les autres providers

| Critère             | Anthropic Claude | Ollama            | **LM Studio**     |
| ------------------- | ---------------- | ----------------- | ----------------- |
| **Interface**       | API uniquement   | Ligne de commande | **Interface GUI** |
| **Installation**    | Simple (clé API) | Moyenne           | **Très simple**   |
| **Gestion modèles** | N/A              | CLI               | **GUI 1 clic**    |
| **Monitoring**      | Dashboard web    | Logs              | **Temps réel**    |
| **Coût**            | ~$0.01-0.03/img  | Gratuit           | **Gratuit**       |
| **Vitesse**         | ~3-5 sec         | ~5-60 sec         | ~8-20 sec         |
| **Précision**       | Excellente       | Bonne             | **Bonne**         |
| **Ressources**      | Aucune           | 8-16 GB RAM       | **8-16 GB RAM**   |

## Recommandations

### Pour le développement

✅ **LM Studio** - Interface intuitive, monitoring en temps réel, gratuit

### Pour la production avec faible volume

✅ **LM Studio** - Gratuit, performances acceptables, confidentialité

### Pour la production avec fort volume

⚠️ **Anthropic** - Meilleure qualité, plus rapide, mais payant

## Ressources

- [Site officiel LM Studio](https://lmstudio.ai)
- [Documentation LM Studio](https://lmstudio.ai/docs)
- [Discord LM Studio](https://discord.gg/lmstudio)
- [Modèles Hugging Face](https://huggingface.co/models?pipeline_tag=image-text-to-text)

## Support

En cas de problème :

1. Consulter les logs dans LM Studio (onglet "Local Server")
2. Vérifier que le serveur API est actif
3. Tester avec curl : `curl http://localhost:1234/v1/models`
4. Consulter le Discord officiel LM Studio
5. Consulter cette documentation
