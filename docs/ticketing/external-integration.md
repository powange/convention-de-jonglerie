# L'intégration d'une billetterie externe

Une édition peut adosser sa billetterie à un prestataire : les tarifs, les options, les champs
personnalisés et les commandes sont alors importés chez nous, et le guichet travaille sur cette
copie.

> ⚠️ **Un seul prestataire est réellement implémenté : HelloAsso.** L'énumération en propose cinq.
> Voir « L'état de chaque prestataire » plus bas avant de promettre quoi que ce soit à un
> organisateur.

## Le modèle

```prisma
model ExternalTicketing {
  id         String
  editionId  Int      @unique   // une seule configuration par édition
  provider   ExternalTicketingProvider
  status     ExternalTicketingStatus   @default(ACTIVE)
  lastSyncAt DateTime?

  helloAssoConfig  HelloAssoConfig?
  infomaniakConfig InfomaniakConfig?
}

enum ExternalTicketingProvider { HELLOASSO  INFOMANIAK  BILLETWEB  WEEZEVENT  OTHER }
enum ExternalTicketingStatus   { ACTIVE  INACTIVE  ERROR }
```

`editionId` est unique : une édition a **une** billetterie externe, ou aucune.

### Les secrets

Tous les identifiants sont chiffrés en base (AES-256-GCM, `server/utils/encryption.ts`, forme
`iv:chiffré:authTag` en base64) et déchiffrés au moment de l'appel.

| Modèle             | Champs chiffrés                                        |
| ------------------ | ------------------------------------------------------ |
| `HelloAssoConfig`  | `clientSecret`                                         |
| `InfomaniakConfig` | `apiKey`, `apiKeyGuichet`, `applicationPassword`       |
| `SumupConfig`      | `affiliateKey` (en `Text` : la forme chiffrée dépasse 191 caractères) |

`SumupConfig` n'est pas une billetterie : c'est l'encaissement par carte au guichet, via le lien
profond `sumupmerchant://`. Sa clé est **déchiffrée et renvoyée au navigateur**, parce que
l'application SumUp n'accepte ses paramètres que dans l'URL. Le compromis est argumenté en tête de
`sumup/config.get.ts`, et l'une de ses mitigations est que l'accès exige `canManageTicketing`.

## L'état de chaque prestataire

| Prestataire  | Configuration | Test de connexion | Import des tarifs | Import des commandes |
| ------------ | ------------- | ----------------- | ----------------- | -------------------- |
| `HELLOASSO`  | oui           | oui               | **oui**           | **oui**              |
| `INFOMANIAK` | oui           | oui               | non               | **non**              |
| `BILLETWEB`  | l'énumération seule | non         | non               | non                  |
| `WEEZEVENT`  | l'énumération seule | non         | non               | non                  |
| `OTHER`      | l'énumération seule | non         | non               | non                  |

**Infomaniak se configure de bout en bout et n'importe jamais rien.** Les fonctions
`getInfomaniakOrders` et `getInfomaniakTickets` existent, mais leur seul appelant est
`infomaniak/raw.get.ts`, réservé à l'administration globale, qui se contente d'afficher la réponse
brute. Aucun code n'écrit de `TicketingOrder` depuis Infomaniak.

## La synchronisation des tarifs, options et champs personnalisés

`POST …/ticketing/helloasso/tiers`. Deux transactions successives : les tarifs et leurs champs
personnalisés, puis les options.

**Ce qui est créé ou mis à jour** — rapprochement par `helloAssoTierId`, `helloAssoOptionId`,
`helloAssoCustomFieldId`. Le `name` du fournisseur écrase le `name` local ; `customName`, lui,
survit (voir [les tarifs](tiers.md)).

**Ce qui est supprimé** — tout ce qui porte un identifiant fournisseur absent de la réponse.

| Objet                    | Garde contre une réponse incomplète                          |
| ------------------------ | ------------------------------------------------------------ |
| Tarifs                   | `decisionSuppression` : refuse de supprimer si la réponse ne contient **aucun** tarif |
| Options                  | **aucune**                                                   |
| Champs personnalisés     | suppression des orphelins, sans garde équivalente            |

La garde des tarifs est motivée dans son propre fichier : la cascade emporte les quotas, les articles
à remettre et les liens de champs personnalisés — « le travail saisi ici, et que HelloAsso ne pourra
jamais restituer ». Aucun seuil de proportion n'est appliqué au-delà : passer de dix tarifs à deux
est un geste d'organisateur banal, et le refuser bloquerait un usage légitime.

## L'import des commandes

> ⚠️ **L'import se déclenche sur un `GET`** : `GET …/ticketing/helloasso/orders`. Le voisin
> `POST …/ticketing/helloasso/orders` ne fait, lui, que **lire** une page de commandes chez
> HelloAsso sans rien écrire. Les deux verbes sont donc à l'envers de ce qu'ils font.

Pour chaque commande reçue :

1. `upsert` de `TicketingOrder` sur `(externalTicketingId, helloAssoOrderId)` ;
2. pour chaque ligne, recherche du tarif, puis création ou mise à jour de `TicketingOrderItem` ;
3. pour chaque option prise, `upsert` de `TicketingOrderItemOption`, puis création des accès repas
   que l'option ouvre ;
4. `lastSyncAt` est mis à jour, hors transaction.

### Ce que la synchronisation écrase à chaque passage

```ts
status: 'Processed',    // TODO: récupérer le statut réel
paymentMethod: 'card',  // HelloAsso = paiement par carte
```

Ces deux valeurs sont forcées **en création comme en mise à jour**. Donc :

- **un remboursement HelloAsso ne redescend jamais** — la commande reste `Processed` chez nous ;
- **un moyen de paiement corrigé à la main** (`PATCH …/orders/:orderId/payment-method`) est réécrit
  à la synchronisation suivante, comme le nom et l'adresse du payeur.

### Ce que l'import ne fait pas

- Il ne **supprime** jamais une commande ni une ligne disparue en amont.
- Il ne retire pas une option ni un accès repas qui n'est plus sur la commande.
- Il crée les lignes sans tarif rapproché avec `tierId: null`, en le signalant **dans les
  journaux seulement** — voir l'avertissement des [tarifs](tiers.md) sur ce que perd un billet sans
  tarif.

### Le coût

Une transaction interactive unique, sans `timeout` explicite : Prisma applique donc **5 s** par
défaut, et un dépassement (`P2028`) annule **tout** l'import. Sur l'édition la plus fournie d'une
copie de production — 201 commandes, 271 lignes — la boucle émet environ **743 requêtes**, soit
~0,73 s. La marge est confortable aujourd'hui ; elle se réduit avec le volume, avec la latence du
lien vers la base, et parce qu'une écriture coûte plus qu'une lecture.

## Les points d'API

| Route                                    | Droit                              | Rôle                              |
| ---------------------------------------- | ---------------------------------- | --------------------------------- |
| `GET    …/ticketing/external`             | `canManageTicketingById`           | la configuration (sans les secrets) |
| `POST   …/ticketing/external`             | `canManageTicketingById`           | créer ou remplacer la configuration |
| `DELETE …/ticketing/external`             | `canManageTicketingById`           | supprimer la configuration        |
| `POST   …/ticketing/helloasso/test`       | `canManageTicketingById`           | tester les identifiants           |
| `POST   …/ticketing/helloasso/tiers`      | `canManageTicketingById`           | synchroniser tarifs / options / champs |
| `GET    …/ticketing/helloasso/orders`     | `canManageTicketingById`           | **importer** les commandes        |
| `POST   …/ticketing/helloasso/orders`     | `canManageTicketingById`           | lire une page de commandes        |
| `GET    …/ticketing/helloasso/raw`        | **administration globale**         | la réponse brute du fournisseur   |
| `POST   …/ticketing/infomaniak/test`      | `canManageTicketingById`           | tester les identifiants           |
| `GET    …/ticketing/infomaniak/raw`       | **administration globale**         | la réponse brute du fournisseur   |
| `GET/PUT/DELETE …/ticketing/sumup/config` | `canManageTicketing`               | l'encaissement par carte          |

Le corps de `POST …/ticketing/external` : `provider` (obligatoire), puis un bloc `helloAsso`
(`clientId`, `clientSecret?`, `organizationSlug`, `formType`, `formSlug`) ou `infomaniak`
(`apiKey?`, `apiKeyGuichet?`, `applicationPassword?`, `currency`, `eventId?`, `eventName?`). Un
secret omis conserve la valeur déjà chiffrée en base.

## Les écrans

- `gestion/ticketing/external.vue` — la page de configuration et de synchronisation
- `HelloAssoConfigModal.vue`, `InfomaniakConfigModal.vue` — la saisie des identifiants
- `HelloAssoRawJsonModal.vue`, `InfomaniakRawJsonModal.vue` — la réponse brute, pour
  l'administration globale

## Les journaux

Les deux synchronisations sont très bavardes : celle des tarifs écrit la réponse entière de l'API en
JSON indenté, celle des commandes écrit **une ligne par billet** importé. Sur une édition de
271 lignes, cela noie les messages qui comptent — notamment les « aucun tarif trouvé », qui sont
précisément les billets qui vont se retrouver détachés.

## Voir aussi

- [Les tarifs](tiers.md) · [Les options](options.md) · [Les commandes](orders.md)
- [Le contrôle d'accès](access-control.md) — ce que le guichet fait de ces données
