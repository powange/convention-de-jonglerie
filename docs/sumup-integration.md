# Intégration SumUp — Payment Switch (App Link)

## Statut actuel

L'intégration SumUp est partiellement implémentée :

- Un toggle "Intégration SumUp" dans la configuration billetterie (page `/gestion/ticketing/config`)
- Un bouton "Ouvrir SumUp" lors du paiement par carte dans la modale d'ajout de participant
- Le lien ouvre l'app SumUp avec le montant et le nom de l'édition pré-remplis
- **Pas de retour automatique** : l'organisateur doit confirmer manuellement que le paiement est passé

## Ce qu'il reste à faire

### 1. Obtenir un Affiliate Key SumUp

- Créer un compte développeur sur [developer.sumup.com](https://developer.sumup.com)
- Créer une application pour obtenir un **Affiliate Key**
- L'Affiliate Key est **obligatoire** pour que le Payment Switch fonctionne

### 2. Stocker les credentials dans la configuration

Ajouter dans les settings de billetterie :

- `sumupAffiliateKey` : clé d'affiliation SumUp (string, par édition)

### 3. Corriger le format de l'URL

L'URL actuelle est simplifiée. Le format complet diffère entre iOS et Android :

**iOS** (`amount`) :

```
sumupmerchant://pay/1.0?affiliate-key=KEY&amount=12.34&currency=EUR&title=Edition&foreign-tx-id=UNIQUE_ID&callbacksuccess=https://monsite.com/callback&callbackfail=https://monsite.com/callback&skip-screen-success=true
```

**Android** (`total`, `app-id`) :

```
sumupmerchant://pay/1.0?affiliate-key=KEY&app-id=APP_ID&total=12.34&currency=EUR&title=Edition&callback=myapp://sumup-callback&foreign-tx-id=UNIQUE_ID&skip-screen-success=true
```

#### Paramètres obligatoires

| Paramètre          | Description                  |   iOS    | Android |
| ------------------ | ---------------------------- | :------: | :-----: |
| `affiliate-key`    | Clé d'affiliation SumUp      |   Oui    |   Oui   |
| `amount` / `total` | Montant en euros (ex: 12.34) | `amount` | `total` |
| `currency`         | Code devise (ex: EUR)        |   Oui    |   Oui   |
| `app-id`           | ID de l'application Android  |   Non    |   Oui   |

#### Paramètres optionnels

| Paramètre             | Description                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `title`               | Libellé affiché dans l'historique SumUp                                                                |
| `foreign-tx-id`       | Référence externe unique (max 128 caractères) — permet d'éviter les doublons et de matcher le callback |
| `receipt-email`       | Pré-remplir l'email pour le reçu                                                                       |
| `receipt-mobilephone` | Pré-remplir le téléphone pour le reçu SMS                                                              |
| `skip-screen-success` | `true` pour bypasser l'écran de succès SumUp                                                           |
| `callbacksuccess`     | (iOS) URL de callback en cas de succès                                                                 |
| `callbackfail`        | (iOS) URL de callback en cas d'échec                                                                   |
| `callback`            | (Android) URL de callback unique                                                                       |

### 4. Gérer le callback (retour de paiement)

Le callback SumUp renvoie vers une URL avec ces paramètres :

| Paramètre          | Description                               |
| ------------------ | ----------------------------------------- |
| `smp-status`       | `success`, `failed` ou `invalidstate`     |
| `smp-tx-code`      | Code de transaction SumUp                 |
| `foreign-tx-id`    | Référence externe (renvoyée telle quelle) |
| `smp-message`      | Message d'erreur (si échec)               |
| `smp-receipt-sent` | Statut d'envoi du reçu                    |

**Problème** : le callback attend un **scheme d'app native** (`myapp://sumup-callback`), pas une URL `https://`. Pour une webapp, deux options :

#### Option A : Pas de callback (implémentation actuelle)

L'organisateur confirme manuellement dans la webapp. Simple mais pas automatisé.

#### Option B : Deep Links / Universal Links

Enregistrer un Universal Link (iOS) ou App Link (Android) pour que `https://monsite.com/sumup-callback` soit intercepté par le navigateur et redirige vers la webapp. Nécessite :

- Un fichier `/.well-known/assetlinks.json` (Android)
- Un fichier `/.well-known/apple-app-site-association` (iOS)
- Mais cela ne fonctionne que si l'utilisateur accède au site via une PWA installée

#### Option C : `foreign-tx-id` + polling

1. Générer un `foreign-tx-id` unique avant d'ouvrir SumUp
2. Stocker cet ID en BDD avec le statut "pending"
3. Après le retour sur la webapp, interroger l'API SumUp pour vérifier le statut de la transaction
4. Nécessite l'API REST SumUp (authentification OAuth2)

### 5. Détecter la plateforme

L'URL diffère entre iOS et Android. Il faudrait détecter le user-agent pour construire la bonne URL :

- iOS : utiliser `amount`, `callbacksuccess`, `callbackfail`
- Android : utiliser `total`, `app-id`, `callback`

## Ressources

- [Documentation Payment Switch](https://developer.sumup.com/terminal-payments/payment-switch)
- [Payment Switch Android](https://developer.sumup.com/terminal-payments/payment-switch/android)
- [Payment Switch iOS](https://developer.sumup.com/terminal-payments/payment-switch/ios)
- [Repo GitHub Android URL Scheme](https://github.com/sumup/sumup-android-url-scheme)
- [Repo GitHub iOS URL Scheme](https://github.com/sumup/sumup-ios-url-scheme)
- [API REST SumUp (Checkouts)](https://developer.sumup.com/api/checkouts)

## Note

Le Payment Switch est une **intégration legacy** selon SumUp ("no longer actively being developed"). Pour une intégration plus complète, SumUp recommande leur SDK natif (iOS/Android). Cependant, pour une webapp, le Payment Switch reste la seule option pour piloter le terminal physique.
