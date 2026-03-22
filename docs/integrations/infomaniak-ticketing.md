# Intégration Infomaniak Billetterie - Documentation

## Vue d'ensemble

Infomaniak propose un service de billetterie en ligne (eTickets) avec une API REST (SHOP API v0.4.0) permettant d'intégrer la vente et la gestion de billets dans des applications tierces. Cette intégration est similaire à celle de HelloAsso : synchronisation des tarifs, commandes et participants.

## Comparaison HelloAsso vs Infomaniak

| Fonctionnalité       | HelloAsso                                                                     | Infomaniak                                                                              |
| -------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Authentification** | OAuth2 Client Credentials                                                     | Clé API via header `key`                                                                |
| **Base URL API**     | `https://api.helloasso.com`                                                   | `https://etickets.infomaniak.com/api/shop/`                                             |
| **Format**           | REST / JSON                                                                   | REST / JSON                                                                             |
| **Rate limit**       | Non documenté                                                                 | 60 requêtes/minute (non modifiable)                                                     |
| **Coût**             | Gratuit                                                                       | Gratuit                                                                                 |
| **Documentation**    | [api.helloasso.com/v5/swagger](https://api.helloasso.com/v5/swagger/ui/index) | [etickets.infomaniak.com/docs/app](https://etickets.infomaniak.com/docs/app/index.html) |
| **Devises**          | EUR uniquement                                                                | CHF (1) ou EUR (2)                                                                      |

## API Infomaniak — Référence complète

### Authentification

La clé API est passée dans le **header HTTP** de chaque requête.

**Headers communs à toutes les requêtes :**

| Header            | Type   | Description                                  |
| ----------------- | ------ | -------------------------------------------- |
| `key`             | String | Clé API générée depuis le Manager Infomaniak |
| `currency`        | String | ID de la devise : `1` = CHF, `2` = EUR       |
| `Accept-Language` | String | Langue : `fr_FR`, `en_GB`, `de_DE`           |

**Création de la clé API :**

1. Accéder au Manager Infomaniak → produit Billetterie
2. Menu latéral → "Boutique / Mise en ligne" → "Accès API"
3. Bouton "Ajouter" pour créer une clé
4. Options :
   - **Nom de la clé** : identifiant pour la reconnaître
   - **Adresse(s) IP interdite(s)** (optionnel) : bloquer certaines IPs
   - **Accès guichet** : autoriser ou non la vente de billets (mode guichet)

### Base URL

```
https://etickets.infomaniak.com/api/shop/
```

### Rate Limiting

- **60 requêtes par minute** — limite non modifiable

### Endpoints identifiés

#### EVENTS — Lister les événements

```
GET https://etickets.infomaniak.com/api/shop/events
```

**Paramètres (optionnels) :**

| Paramètre        | Type    | Description                                                                        |
| ---------------- | ------- | ---------------------------------------------------------------------------------- |
| `ids`            | String  | Filtrer par IDs (séparateur `,`)                                                   |
| `search`         | String  | Rechercher par nom ou date                                                         |
| `limit`          | Number  | Nombre de résultats                                                                |
| `offset`         | Number  | Offset du premier résultat                                                         |
| `withQuota`      | Boolean | Inclure les quotas (total, reserved, warning_low)                                  |
| `withProperties` | Boolean | Inclure les propriétés custom du manager                                           |
| `sort`           | Enum    | Trier par : `id`, `date`, `name`, `end`. Préfixe `-` pour DESC (ex: `?sort=-name`) |

**Réponse :**

```json
[
  {
    "event_id": 61948,
    "name": "Concert #1 (événement test)",
    "description": "",
    "date": "2017-02-01 20:30:00",
    "category": "Pop-Rock – Electro",
    "status": "visible",
    "capacity": null,
    "total": 1000,
    "reserved": 600,
    "warning_low": 30,
    "address": {
      "title": "Salle Métropole",
      "street": "Rue de Genève",
      "number": null,
      "zipcode": "",
      "city": "Lausanne",
      "country": "SWITZERLAND",
      "google": {
        "title": null,
        "place_id": null,
        "latitude": 46.5236971,
        "longitude": 46.5236971
      }
    }
  }
]
```

**Notes :** `total`, `reserved`, `warning_low` ne sont retournés que si `withQuota=true`. Le statut peut être `visible` ou `full` (complet mais visible).

#### EVENT — Détails d'un événement

```
GET https://etickets.infomaniak.com/api/shop/event/{id}
```

**Réponse :**

```json
{
  "event_id": 61948,
  "name": "Concert #1 (événement test)",
  "description": "",
  "date": "2017-02-01 20:30:00",
  "category": "Pop-Rock – Electro",
  "status": "visible",
  "capacity": null,
  "address": { ... },
  "properties": [
    { "name": "Age minimum", "value": "aucune", "status": "visible" },
    { "name": "Artist", "value": "John Doe", "status": "visible" }
  ]
}
```

#### EVENT ZONES — Zones et tarifs d'un événement (endpoint principal pour les tarifs)

```
GET https://etickets.infomaniak.com/api/shop/event/{id}/zones
```

**Réponse :** tableau de zones, chaque zone contenant ses catégories de tarifs

```json
[
  {
    "zone_id": 118271,
    "name": "Catégorie 1",
    "status": "visible",
    "bg_color": "87C070",
    "numbered": 1,
    "free_seats": 961,
    "categories": [
      {
        "category_id": 283338,
        "name": "Plein tarif",
        "status": "visible",
        "amount": 59,
        "free_seats": 961,
        "limit": 2
      },
      {
        "category_id": 283346,
        "name": "Etudiant",
        "status": "visible",
        "amount": 49,
        "free_seats": 961
      }
    ]
  }
]
```

**Note importante :** Les tarifs dans Infomaniak sont organisés par **zones** (`zone_id`) contenant des **catégories** (`category_id`). Ce n'est pas le même concept que les "pass categories" qui sont des abonnements multi-événements. Pour la billetterie événementielle, il faut utiliser cet endpoint.

**Mapping vers TicketingTier :**

| Infomaniak (zone.category) | TicketingTier                                             |
| -------------------------- | --------------------------------------------------------- |
| `category_id`              | `infomaniakCategoryId` (nouveau champ)                    |
| `name`                     | `name`                                                    |
| `amount`                   | `price` (attention : peut être en euros, pas en centimes) |
| `status`                   | `isActive` (`visible` → true)                             |
| `free_seats`               | quota disponible                                          |
| zone `name`                | regroupement logique                                      |

#### PASS CATEGORIES — Catégories de pass (abonnements multi-événements)

```
GET https://etickets.infomaniak.com/api/shop/categorypasses
```

Les pass categories sont des abonnements donnant accès à plusieurs événements. À ne pas confondre avec les tarifs d'un événement (qui sont dans les zones).

#### ORDERS — Lister les commandes (guichet)

```
GET https://etickets.infomaniak.com/api/shop/orders
```

**Note :** Cet endpoint nécessite le header `Credential/Authorization` en plus de `key` (token obtenu via login).

#### ORDER — Détails d'une commande

```
GET https://etickets.infomaniak.com/api/shop/order/{id}
```

Sous-endpoints utiles :

- `GET /api/shop/order/{id}/content` — Contenu de la commande
- `GET /api/shop/order/{id}/tickets` — Billets de la commande
- `GET /api/shop/order/{id}/passes` — Pass de la commande
- `GET /api/shop/order/{id}/payments` — Paiements de la commande

#### TICKET — Scan et validation

```
POST /api/shop/ticket/scan         — Scanner un billet
POST /api/shop/ticket/scan-in      — Scanner entrée
POST /api/shop/ticket/scan-out     — Scanner sortie
GET  /api/shop/ticket/{id}         — Détails d'un billet (guichet)
```

#### TICKETS — Lister les billets

```
GET /api/shop/tickets              — Lister les billets (guichet)
```

### Toutes les sections de l'API

| Section              | Endpoints principaux                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| **CUSTOMER**         | create, edit, get, get orders, login, password                             |
| **CUSTOMERS**        | get customer's form, get customers (guichet)                               |
| **EVENT**            | get event, event capacity, hall map, zones                                 |
| **EVENTS**           | get events                                                                 |
| **GIFTS**            | get gifts                                                                  |
| **GROUP**            | get group's users (guichet)                                                |
| **IMPORTED TICKETS** | get imported tickets (guichet)                                             |
| **LOGIN**            | get credential/authorization (guichet)                                     |
| **ORDER**            | create, get, content, tickets, passes, payments, add tickets, cancel, scan |
| **ORDERS**           | get orders (guichet)                                                       |
| **PASS**             | get, enable, disable, content, tickets, zones, picture                     |
| **PASS CATEGORIES**  | get pass categories                                                        |
| **PASS CATEGORY**    | get pass category, zones                                                   |
| **PASSES**           | get passes (guichet)                                                       |
| **REPORT**           | events report, payments report, send report (guichet)                      |
| **TICKET**           | get, scan, scan-in, scan-out, set status                                   |
| **TICKETS**          | get tickets, customize, set form (guichet)                                 |
| **ZONE**             | get zone                                                                   |

## Architecture

### Structure des fichiers

```
server/
├── api/editions/[id]/ticketing/
│   ├── infomaniak/
│   │   ├── test.post.ts             # Tester la connexion
│   │   ├── events.get.ts            # Lister les événements
│   │   ├── tiers.get.ts             # Récupérer tarifs (pass categories)
│   │   └── orders.get.ts            # Récupérer commandes
├── utils/
│   └── editions/ticketing/
│       └── infomaniak.ts            # Utilitaire API Infomaniak

app/components/edition/ticketing/
└── InfomaniakConfigModal.vue        # Modal de configuration

prisma/schema/
└── ticketing.prisma                 # Ajouter modèle InfomaniakConfig
```

### Modèle de données

```prisma
model InfomaniakConfig {
  id                  Int               @id @default(autoincrement())
  externalTicketingId Int               @unique
  apiKey              String            // Clé API chiffrée (AES-256-GCM)
  currency            String            @default("2") // 1 = CHF, 2 = EUR
  eventId             Int?              // ID de l'événement sélectionné
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  externalTicketing   ExternalTicketing  @relation(fields: [externalTicketingId], references: [id], onDelete: Cascade)
}
```

Nécessite l'ajout de `INFOMANIAK` dans l'enum `TicketingProvider`.

## Plan d'implémentation

### Phase 1 — Configuration et connexion ✅ En cours

1. Ajouter `INFOMANIAK` à l'enum `TicketingProvider`
2. Créer le modèle `InfomaniakConfig` (clé API chiffrée)
3. Créer la card Infomaniak sur `external.vue` avec modal de configuration
4. Implémenter `server/utils/editions/ticketing/infomaniak.ts` :
   - Appels API avec headers `key`, `currency`, `Accept-Language`
   - Test de connexion (appel `get events`)
5. Créer endpoint `test.post.ts` pour valider les credentials
6. Créer endpoint `events.get.ts` pour lister les événements et permettre la sélection

### Phase 2 — Synchronisation des tarifs

1. Créer endpoint `tiers.get.ts` pour récupérer les pass categories
2. Mapper `category_id` → `TicketingTier` (via nouveau champ `infomaniakCategoryId`)
3. Mapper `amount` → `price` (déjà en centimes)
4. Gérer le statut `visible`/`full` → `isActive`

### Phase 3 — Synchronisation des commandes

1. Créer endpoint `orders.get.ts` avec pagination (limit/offset)
2. Mapper les commandes vers `TicketingOrder` / `TicketingOrderItem`
3. Stocker les QR codes pour le scan
4. Implémenter le throttling (60 req/min max)
5. **Note** : le endpoint orders nécessite un token `Credential/Authorization` en plus de la clé API

### Phase 4 — Scan et validation

1. Intégrer le scan de billets via `POST /api/shop/ticket/scan`
2. Scan d'entrée/sortie via `scan-in` / `scan-out`

## Ressources existantes à réutiliser

- **Chiffrement** : `server/utils/encryption.ts` (AES-256-GCM) → pour la clé API
- **ExternalTicketing** : le modèle supporte déjà plusieurs providers
- **Page externe** : `app/pages/editions/[id]/gestion/ticketing/external.vue` → card Infomaniak ajoutée
- **Pattern de sync** : même flux que HelloAsso (fetch → map → upsert en transaction)

## Liens utiles

- [Documentation API Billetterie (SHOP API)](https://etickets.infomaniak.com/docs/app/index.html) — Documentation interactive (JS dynamique, consulter dans un navigateur)
- [Guide de création de clé API](https://www.infomaniak.com/fr/support/faq/2661/ticketing-use-the-api) — Comment créer une clé API billetterie
- [API Générale Infomaniak](https://developer.infomaniak.com/docs/api) — Portail développeur
- [Client TypeScript (communautaire)](https://github.com/lifaon74/infomaniak-ts-api-client) — Client TS non officiel
- [Billetterie Infomaniak](https://www.infomaniak.com/fr/etickets) — Page produit officielle

## Points d'attention

1. **Rate limiting strict** : 60 req/min — prévoir un mécanisme de throttling pour les gros volumes
2. **Pas de webhooks documentés** : synchronisation manuelle uniquement
3. **Double auth pour les commandes** : le endpoint orders nécessite un `Credential/Authorization` en plus de la clé API (token obtenu via endpoint login)
4. **Pass categories globales** : `get pass categories` retourne toutes les catégories de la boutique, pas celles d'un événement spécifique — il faudra peut-être filtrer côté client
5. **Devise configurable** : contrairement à HelloAsso (EUR uniquement), Infomaniak supporte CHF et EUR
