# Logs LM Studio - Guide de débogage

Ce guide explique comment utiliser les logs détaillés du provider LM Studio pour diagnostiquer les problèmes d'extraction de workshops depuis des images.

## Activation des logs

Les logs LM Studio sont activés par défaut et s'affichent dans les logs du serveur Nuxt.

### En développement local

```bash
npm run dev
```

Les logs s'affichent directement dans le terminal.

### Avec Docker

```bash
# Afficher les logs en temps réel
npm run docker:dev:logs

# Ou avec docker-compose directement
docker-compose -f docker-compose.dev.yml logs -f app
```

## Format des logs

### Logs de requête (envoi)

```
[LM Studio] === Début de l'extraction de workshops ===
[LM Studio] Requête envoyée:
  URL: http://localhost:1234/v1/chat/completions
  Model: auto
  Prompt length: 1234 caractères
  Image type: jpeg
  Image size: 123456 caractères base64
  Temperature: 0.7
  Max tokens: 4096
```

**Informations fournies :**
- **URL** : Point d'accès de l'API LM Studio
- **Model** : Modèle utilisé (`auto` = modèle chargé dans LM Studio)
- **Prompt length** : Taille du prompt en caractères
- **Image type** : Type d'image (jpeg, png, etc.)
- **Image size** : Taille de l'image encodée en base64
- **Temperature** : Paramètre de créativité (0.7 par défaut)
- **Max tokens** : Nombre maximum de tokens pour la réponse

### Logs de réponse (réception)

```
[LM Studio] Réponse reçue:
  Status: 200 OK
  Response time: 15234 ms

[LM Studio] Données brutes:
  Choices: 1
  Model: llava-llama-3-8b-v1_1
  Usage: { prompt_tokens: 1234, completion_tokens: 567, total_tokens: 1801 }

[LM Studio] Contenu de la réponse:
  Length: 1234 caractères
  Preview: {"workshops":[{"title":"Atelier de jonglage","description":"Apprendre...

[LM Studio] JSON parsé avec succès:
  Workshops trouvés: 3
```

**Informations fournies :**
- **Status** : Code de statut HTTP (200 = succès)
- **Response time** : Temps de réponse en millisecondes
- **Choices** : Nombre de choix retournés (normalement 1)
- **Model** : Nom du modèle qui a traité la requête
- **Usage** : Statistiques d'utilisation des tokens
- **Preview** : Aperçu des 200 premiers caractères de la réponse
- **Workshops trouvés** : Nombre de workshops extraits

### Logs d'erreur

```
[LM Studio] Erreur lors de l'extraction:
  Error code: ECONNREFUSED
  Error message: fetch failed
  Error stack: Error: fetch failed at ...

[LM Studio] Service non accessible. Vérifiez que LM Studio est démarré.
```

**Types d'erreurs courantes :**

#### 1. Service non accessible (ECONNREFUSED)
```
Error code: ECONNREFUSED
```
**Causes :**
- LM Studio n'est pas démarré
- Mauvaise URL (vérifier `LMSTUDIO_BASE_URL`)
- Port bloqué par un firewall

**Solutions :**
- Démarrer LM Studio
- Vérifier que le serveur API est actif (onglet "Local Server")
- Vérifier l'URL : `curl http://localhost:1234/v1/models`

#### 2. Erreur API
```
[LM Studio] Erreur API: LM Studio API error: 400 Bad Request - ...
```
**Causes :**
- Modèle non chargé
- Modèle sans support vision
- Format de requête incorrect

**Solutions :**
- Charger un modèle avec support vision (LLaVA, BakLLaVA)
- Vérifier que le modèle est bien chargé dans l'onglet "Chat"

#### 3. Pas de JSON dans la réponse
```
[LM Studio] Pas de JSON trouvé dans la réponse complète: Some text without JSON...
```
**Causes :**
- Modèle non adapté (pas de vision)
- Prompt mal interprété
- Modèle trop petit/faible

**Solutions :**
- Utiliser un modèle avec support vision (LLaVA recommandé)
- Vérifier le preview de la réponse dans les logs
- Essayer un modèle plus performant

## Cas d'usage pratiques

### 1. Vérifier que LM Studio reçoit bien les requêtes

**Logs à surveiller :**
```
[LM Studio] Requête envoyée:
  URL: http://localhost:1234/v1/chat/completions
```

**Vérification supplémentaire :**
- Aller dans LM Studio > Local Server
- Les requêtes doivent apparaître en temps réel

### 2. Diagnostiquer un temps de réponse lent

**Logs à surveiller :**
```
[LM Studio] Réponse reçue:
  Response time: 45000 ms
```

**Temps normaux :**
- **Avec GPU** : 5-15 secondes (5000-15000 ms)
- **Sans GPU** : 15-45 secondes (15000-45000 ms)

**Si trop lent :**
- Vérifier l'utilisation GPU dans LM Studio
- Essayer un modèle plus petit (LLaVA 7B)
- Augmenter GPU Offload dans les paramètres

### 3. Vérifier la qualité de l'extraction

**Logs à surveiller :**
```
[LM Studio] Contenu de la réponse:
  Preview: {"workshops":[{"title":"Atelier...

[LM Studio] JSON parsé avec succès:
  Workshops trouvés: 3
```

**Vérifications :**
- Le JSON est-il bien formé dans le preview ?
- Le nombre de workshops correspond-il à l'image ?
- Si 0 workshops : vérifier le preview pour comprendre la réponse

### 4. Déboguer les problèmes de tokens

**Logs à surveiller :**
```
[LM Studio] Données brutes:
  Usage: { prompt_tokens: 2500, completion_tokens: 3500, total_tokens: 6000 }
```

**Vérifications :**
- **prompt_tokens** : Taille du prompt + image
  - Trop élevé (>3000) : image très grande ou prompt très long
- **completion_tokens** : Taille de la réponse
  - Proche de max_tokens (4096) : réponse peut être tronquée
- **total_tokens** : Total utilisé
  - Si limite atteinte : augmenter max_tokens dans le code

## Logs dans les différents environnements

### Développement local (npm run dev)
Les logs s'affichent directement dans le terminal où le serveur tourne.

### Docker développement
```bash
# Logs en temps réel
npm run docker:dev:logs

# Filtrer uniquement les logs LM Studio
npm run docker:dev:logs | grep "LM Studio"

# Dernières 50 lignes
docker-compose -f docker-compose.dev.yml logs --tail=50 app
```

### Production/Release
```bash
# Logs du conteneur
docker logs convention-app-prod

# Filtrer LM Studio
docker logs convention-app-prod 2>&1 | grep "LM Studio"

# Suivre en temps réel
docker logs -f convention-app-prod | grep "LM Studio"
```

## Désactiver les logs (optionnel)

Si vous souhaitez désactiver les logs détaillés en production, vous pouvez ajouter une condition :

```typescript
// Dans server/utils/ai-providers.ts
const isDev = process.env.NODE_ENV === 'development'

if (isDev) {
  console.log('[LM Studio] Requête envoyée:')
  // ... autres logs
}
```

Cependant, ces logs sont utiles pour diagnostiquer les problèmes, même en production.

## Analyse d'un exemple complet

### Requête réussie typique

```
[LM Studio] === Début de l'extraction de workshops ===
[LM Studio] Requête envoyée:
  URL: http://localhost:1234/v1/chat/completions
  Model: auto
  Prompt length: 1456 caractères
  Image type: jpeg
  Image size: 234567 caractères base64
  Temperature: 0.7
  Max tokens: 4096

[LM Studio] Réponse reçue:
  Status: 200 OK
  Response time: 12345 ms

[LM Studio] Données brutes:
  Choices: 1
  Model: llava-llama-3-8b-v1_1
  Usage: { prompt_tokens: 1823, completion_tokens: 456, total_tokens: 2279 }

[LM Studio] Contenu de la réponse:
  Length: 987 caractères
  Preview: {"workshops":[{"title":"Initiation au jonglage","description":"Découverte des bases du jonglage pour débutants","startDateTime":"2024-10-23T14:00:00",...

[LM Studio] JSON parsé avec succès:
  Workshops trouvés: 5
```

**Analyse :**
- ✅ Connexion établie (200 OK)
- ✅ Temps de réponse raisonnable (~12 secondes)
- ✅ Modèle LLaVA utilisé (support vision)
- ✅ Tokens bien utilisés (2279 total sur 4096 max)
- ✅ Réponse JSON valide
- ✅ 5 workshops extraits avec succès

## Support

Si vous rencontrez des problèmes :

1. Consultez d'abord les logs détaillés
2. Vérifiez que LM Studio est démarré avec un modèle vision
3. Consultez la documentation : `docs/ai-providers-lmstudio.md`
4. Vérifiez le monitoring dans LM Studio (onglet "Local Server")
