# Consultation hors ligne

En convention, le réseau est souvent mauvais voire absent. Ce qui a déjà été consulté doit rester
lisible : la carte du site avec ses zones et ses points de repère, la page d'accueil et ses
éditions, les libellés de l'interface.

**Rien n'est pré-téléchargé.** Seul ce que le visiteur a réellement affiché est conservé. Arriver
sur place sans avoir jamais ouvert la carte ne donnera donc rien — c'est aussi ce qu'impose la
politique d'usage des tuiles OpenStreetMap, qui interdit le téléchargement en masse.

## Les trois pièces

| Fichier | Rôle |
| --- | --- |
| `shared/utils/offline-cache.ts` | La politique : quoi conserver, où, en quelle quantité |
| `server/routes/firebase-messaging-sw.js.ts` | Le service worker, qui intercepte les requêtes |
| `app/plugins/offline-cache.client.ts` | L'enregistrement du worker et l'amorçage du cache |

### Une seule décision, un seul endroit

`classifyRequest()` répond à « faut-il conserver cette requête, et comment ». Elle est utilisée
**par le worker et par le plugin**.

Cette unicité n'est pas cosmétique : le plugin filtrait autrefois sur un préfixe écrit à la main,
et corriger la règle du worker sans corriger ce filtre a produit deux correctifs sans effet.

Le worker étant un script autonome, il n'importe pas les modules de l'application : **le source de
la fonction lui est injecté** par la route Nitro. Un test reconstruit la fonction depuis son propre
source pour vérifier qu'elle survit à cette injection.

## Ce qui est conservé

| Nature | Stratégie | Pourquoi |
| --- | --- | --- |
| Pages (`/`, `/editions/:id/map`) | réseau d'abord | Une page fraîche vaut mieux ; le cache ne sert qu'en secours |
| Zones, points de repère, liste et fiches d'éditions | cache puis rafraîchissement | Une carte datée reste utile |
| Fichiers de build, traductions, icônes | cache d'abord | Le nom porte une empreinte : le contenu ne change jamais |
| Tuiles du fond de carte | cache d'abord | Immuables, et seules celles réellement affichées |

**Le reste de l'API n'est pas conservé.** Une commande ou un droit périmé induit en erreur, là où
une liste d'éditions datée reste utile. C'est la règle par défaut, et elle doit le rester.

## Les pièges rencontrés

Chacun a coûté un aller-retour en production. Ils sont documentés ici pour ne pas être repayés.

### Un seul service worker par portée

Le worker de notifications push occupait déjà la racine. En enregistrer un second l'aurait évincé
et **coupé les notifications sans aucun signal**. Le cache vit donc dans le même fichier.

Son import Firebase vient d'un CDN, injoignable précisément hors ligne : il est isolé dans un
`try`, faute de quoi une exception emporterait le script entier — donc le cache avec.

### Le worker ne contrôle pas la page qui l'installe

`navigator.serviceWorker.ready` ne suffit pas : sur la première visite, le worker s'active alors
que la page est déjà chargée. Tout ce qui est demandé avant `clients.claim()` lui échappe et
n'entre jamais dans le cache.

D'où l'attente explicite du contrôle, puis une mise en cache déclenchée depuis le plugin.

### Le relevé des ressources est plafonné

`performance.getEntriesByType('resource')` ne rend que **deux cent cinquante** entrées. La page en
charge davantage, et les traductions — demandées tardivement — en étaient absentes.

Un `PerformanceObserver` posé dès le démarrage du plugin ignore cette limite.

### Les traductions ne sont pas des fichiers de build

Le module i18n prérend ses messages en fichiers statiques hachés, servis depuis `/_i18n/` et non
depuis le dossier de build. Trois correctifs ont supposé le contraire.

### La mise en cache ne peut pas se faire en une fois

Les traductions partent **après** l'événement de chargement. Un passage unique déclenché à ce
moment-là passe juste avant elles. Chaque ressource nouvelle relance donc une mise en cache,
groupée par tranches.

### Ne pas vider les caches lors d'une mise à jour

Effacer les anciens caches à l'activation semblait hygiénique. En pratique, un visiteur passant
hors ligne avant d'avoir revisité se retrouvait **sans rien** — moins bien servi qu'avant la mise
à jour.

Les anciens caches sont donc conservés, et les lectures les traversent. Les entrées obsolètes ne
gênent pas : les noms portant une empreinte, elles ne sont plus jamais demandées.

### Une écriture de cache ne doit pas casser une réponse valide

L'écriture se fait **hors du chemin de la réponse**. Elle peut échouer — quota du navigateur
atteint, notamment sur un téléphone — et cet échec ne doit pas transformer une réponse
parfaitement valide en erreur, ce qui reviendrait à casser le site faute de place.

De même, une réponse en erreur n'est jamais conservée : ces caches servent en priorité et sans
expiration, si bien qu'un 404 passager condamnerait la ressource durablement.

### Le CDN met le worker en cache

Le chemin se termine par `.js` : Cloudflare l'a servi pendant **vingt-trois heures** malgré le
`no-store` de l'application. Les navigateurs recevaient donc un worker périmé, et une correction
déployée ne les atteignait pas.

L'URL d'enregistrement porte l'identifiant du build. Une règle CDN excluant ce chemin du cache
reste souhaitable, côté infrastructure.

## Vérifier un déploiement

Un code HTTP 204 du webhook signifie « déclenché », pas « déployé ». Un identifiant de build ne
suffit pas non plus : `/_nuxt/builds/latest.json` est lui-même mis en cache par le CDN.

Les deux méthodes fiables :

```bash
# Le worker, en contournant le cache du CDN
curl -s "https://test.juggling-convention.com/firebase-messaging-sw.js?v=$RANDOM" | grep <marqueur>

# Le code client : l'empreinte de la liste des scripts change à chaque build
curl -s "https://test.juggling-convention.com/?v=$RANDOM" \
  | grep -oE '/_nuxt/[A-Za-z0-9._-]+\.js' | sort -u | md5sum
```

Compter environ trois minutes de construction après le déclenchement.

## Vérifier le comportement

Le cache est **inactif en développement** : le dossier des fichiers de build y sert des modules qui
changent à chaque édition du code, et les figer casserait le rechargement à chaud. Le comportement
ne s'observe donc que sur un build de production.

Le parcours automatique vit dans
`test/e2e/playwright/edition-management/offline.spec.ts`. Il visite deux fois avant de couper le
réseau — le worker ne contrôlant pas la page qui l'installe — et crée lui-même la zone dont il a
besoin, sa première version s'étant déclarée ignorée faute de données.

Pour une vérification manuelle, la seule mesure qui prouve quelque chose :

```js
// Dans la console, après UNE visite en ligne
for (const n of await caches.keys()) {
  const k = (await (await caches.open(n)).keys()).map((r) => r.url)
  console.log(n, k.length, 'dont i18n :', k.filter((u) => u.includes('/_i18n/')).length)
}
```

L'affichage seul ne prouve rien : le rendu serveur peut donner une page correcte en français tout
en masquant l'absence totale de cache.

## Ce qui reste ouvert

- **`/api/session/me` n'est pas conservée** et ne peut pas l'être telle quelle : elle dépend de
  l'utilisateur. Hors ligne, elle échoue et retarde encore l'affichage.
- **Le fond de carte ne couvre que la zone parcourue.** Aller plus loin supposerait d'héberger nos
  propres tuiles ou d'embarquer des tuiles vectorielles.
- **Aucun repère de fraîcheur sur l'accueil.** La carte affiche un bandeau lorsqu'elle vient du
  cache ; l'accueil, non.
