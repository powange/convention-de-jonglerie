# Import des zones depuis une carte Google My Maps

**État : étude de faisabilité, non implémenté.** Ce document fige la conception arrêtée en
discussion pour qu'elle ne se reperde pas, et consigne les mesures qui l'ont motivée.

Prérequis déjà livré : une édition peut référencer une carte externe
(`externalMapProvider` / `externalMapRef`, voir [`shared/utils/external-map.ts`](../apps/app1/shared/utils/external-map.ts)).
L'import se brancherait sur cette référence, sans rien demander de plus à l'organisateur.

## Faisabilité

Google My Maps expose un export KML public :

```
https://www.google.com/maps/d/kml?mid=<MID>&forcekml=1
```

Mesuré sur une carte réelle (EJC2026, `mid=1-7HQv2Tn1yd…`) : **HTTP 200, 94 ko, 109 objets**.

| Élément KML       | Nombre | Correspondance dans l'application |
| ----------------- | -----: | --------------------------------- |
| `Polygon`         |     46 | `EditionZone`                     |
| `Point`           |     46 | `EditionMarker`                   |
| `LineString`      |     17 | **aucune**                        |
| `Folder` (calque) |      4 | aucune                            |

Aucun polygone à trou (`innerBoundaryIs`) sur cet échantillon.

Deux conversions à ne pas rater, parce qu'elles échouent de façon plausible plutôt que
visible :

- **Ordre des coordonnées.** KML écrit `longitude,latitude,altitude` ; le modèle stocke du
  GeoJSON. Une inversion place la convention en Somalie sans lever d'erreur — à tester sur des
  coordonnées réelles, jamais sur des valeurs symétriques du type `[1, 1]`.
- **Couleurs.** KML encode `AABBGGRR` (`ff2bb4af` → `#AFB42B`), le modèle attend `#RRGGBB`.
  Sans l'inversion d'octets, les couleurs sortent fausses mais crédibles.

L'endpoint KML n'est pas documenté par Google. Il fonctionne aujourd'hui ; rien ne garantit
qu'il fonctionnera dans un an. Un échec est sans gravité — l'organisateur garde son
intégration — **à condition d'être affiché et non avalé**.

## Ce qui n'est pas importable

Les 17 `LineString` (chemins, délimitations) n'ont pas d'équivalent dans le modèle. **Décision :
ils sont listés et marqués incompatibles**, sans conversion. Les refermer en polygones
déformerait le tracé ; les omettre laisserait croire à un import complet.

## Conception retenue

### Un écran de relecture, pas un formulaire vierge

92 objets importables × 3 décisions = 276 saisies avant le premier résultat : le genre d'écran
qu'on abandonne à la trentième ligne. Les valeurs par défaut font l'essentiel du travail :

- **couleur pré-remplie** depuis le KML, modifiable ;
- **tout coché** par défaut, avec un compteur rendant la perte visible (« 88 sur 92 ») ;
- **catégories par calque.** C'est le point clé : l'organisateur a déjà catégorisé en dessinant
  (`Camp`, `Shows`, `Training`), et le KML le porte. Un choix par calque puis affinage des
  exceptions ramène 92 décisions à 4. Prévoir un repli propre pour les calques sans nom utile —
  l'échantillon en contient un (`Neimenovan sloj`).

`zoneTypes` n'est pas inférable autrement : le KML ne porte qu'un nom libre et une couleur.

### Import unitaire

Chaque ligne dispose de son bouton, et chaque clic écrit en base. Ce choix règle plusieurs
problèmes d'un coup :

- **plus d'état à conserver** — la base _est_ l'état, un rechargement accidentel ne coûte rien ;
- **reprise naturelle** : on peut s'arrêter à vingt objets et revenir le lendemain ;
- **échecs isolés** : un polygone mal formé fait échouer sa ligne, pas les 91 autres ;
- **résultat visible** au fur et à mesure sur la carte voisine.

Les actions groupées (« importer tout le calque _Camp_ ») ne sont qu'une boucle sur cette
opération unitaire — plus simple à écrire qu'un endpoint d'import en masse, et au comportement
identique en cas d'échec partiel.

L'analyse du KML se fait **une seule fois côté navigateur**, qui envoie ensuite chaque objet.
Laisser le client transmettre une géométrie n'est pas un droit nouveau : c'est déjà ce qu'il
fait quand l'organisateur dessine une zone à la main.

### Bascule vers la carte du site

Tant que `externalMapRef` est renseigné, l'iframe remplace la carte interne. Sans précaution,
l'organisateur importerait ses 92 objets, irait voir la page publique et **n'y verrait aucun
changement** — il en conclurait que l'import a échoué.

Proposer la bascule **après le premier import réussi**, au moment où le constat se fait.

## Réimport : identité et suppressions

### Les identifiants existent, mais pas dans l'export KML

Mesuré sur l'échantillon :

| Source                       | Identifiants                                  | Géométrie       |
| ---------------------------- | --------------------------------------------- | --------------- |
| `kml?mid=…&forcekml=1`       | **0** sur 109                                 | oui, XML propre |
| `kml?mid=…` (KMZ)            | **0** sur 109 (les 147 `id=` sont des styles) | oui             |
| `viewer?mid=…` → `_pageData` | **109 identifiants distincts**, un par objet  | oui             |

Un placemark KML se réduit à `name`, `styleUrl` et sa géométrie, et les noms ne sont pas uniques
— 17 doublons sur l'échantillon (`Showers`, `Toilets`, `Campers area`…), ce qui est normal sur un
terrain de festival.

Le payload du visualiseur, lui, porte identifiant, nom, cadre englobant et centroïde par objet :

```
[[[15.8667962,46.4200047,15.8670055,46.4198198]],"0",null,"WTNf6pdRdZU",
 [46.41991451201999,15.866894649452366],[0,0],"5B7A09F404FD5722"]
```

**Avec cet identifiant, déplacement et suppression se distinguent de façon certaine**, et
l'idempotence du double-clic devient exacte.

#### Stabilité vérifiée

Testé sur une carte dédiée en modifiant quatre choses puis en comparant les deux instantanés :

| Test                                                                                | Identifiant        | Résultat                     |
| ----------------------------------------------------------------------------------- | ------------------ | ---------------------------- |
| **Déplacement** — polygone redessiné (`0.306323,46.62374` → `0.3047794,46.6245901`) | `5A445D5507000001` | **conservé**                 |
| **Renommage** — `Camping` → `Nouveau nom`                                           | `5DBF745E4E446213` | **conservé**                 |
| **Suppression**                                                                     | `5A445D5508000003` | **disparu**                  |
| **Ajout**                                                                           | `5DBF78093358209C` | nouveau, **aucun recyclage** |

L'identifiant survit donc à une modification de géométrie — un objet déplacé reste reconnaissable
comme le même — et à un renommage, ce qui règle aussi le cas des noms en double puisqu'on n'en
dépend plus. L'identifiant d'un objet supprimé n'est pas réattribué : un réimport ne peut pas
rattacher silencieusement une zone à la mauvaise.

Portée du test : une carte, une série de modifications, sur quelques minutes. Voir les points
ouverts pour ce qui n'est pas couvert.

La contrepartie : `_pageData` est un blob JavaScript interne, non documenté et non versionné, fait
de **tableaux positionnels sans clés**. Si Google insère un champ, tout décale d'un cran — le
lecteur ne planterait pas, il lirait un centroïde là où il y a un cadre englobant et continuerait.
C'est un mode de défaillance pire qu'une rupture franche. Le KML est lui aussi non documenté côté
Google, mais c'est un **format standard** : tant que Google en émet, notre lecteur fonctionne. Les
deux sources n'ont pas le même profil de risque.

### Conception : chaque source pour ce qu'elle fait de mieux

- **KML pour la géométrie** — robuste, standard, validé sur une carte réelle ;
- **`_pageData` pour l'identité** — apparié au moment de l'import, sur un instantané cohérent
  puisque les deux sont récupérés dans la même seconde. Le rapprochement par nom + centroïde,
  fragile pour comparer à des semaines d'intervalle, est ici très fiable ;
- **repli sur l'empreinte** (`nom + calque + centroïde` enregistrée à l'import) si `_pageData`
  devient illisible : on perd la certitude, pas la fonctionnalité. En mode dégradé, une zone
  déplacée ressemble à une disparition suivie d'une création, et deux `Toilets` proches sont
  difficiles à distinguer.

Garde-fou : si les deux sources ne donnent pas le même nombre d'objets, on n'apparie pas et on
bascule sur le repli. Et **quelle que soit la source d'identité, une suppression reste confirmée
par l'humain** — un décalage de parseur ne doit jamais pouvoir effacer des zones tout seul.

### Trois états, et une formulation prudente

| État                               | Action proposée         |
| ---------------------------------- | ----------------------- |
| Dans le KML, absent en base        | Importer                |
| Dans le KML et en base             | Retirer / mettre à jour |
| En base, plus retrouvé dans le KML | Supprimer               |

En mode dégradé (identité heuristique), **le troisième état ne doit pas être présenté comme un
fait** : « plus retrouvée sur la carte Google », pas « supprimée sur Google ». Avec les
identifiants du visualiseur, la distinction est certaine et peut être affirmée. Dans les deux cas,
jamais de suppression automatique.

### La disparition massive est un incident, pas une intention

Si l'appel échoue à moitié, ou si le partage de la carte est repassé en privé, **tous les objets
importés paraissent disparus d'un coup**. Un écran proposant alors « supprimer les 92 »
détruirait la carte de l'organisateur sur un simple incident réseau.

Parade : si le KML revient vide ou nettement plus pauvre qu'au dernier import, l'écran refuse de
s'afficher et signale un problème de récupération.

### Supprimer une zone détache ses dépendances en silence

Les quatre relations d'`EditionZone` sont en `onDelete: SetNull` :

| Ce qui pointe vers une zone | Effet de la suppression        |
| --------------------------- | ------------------------------ |
| `Show`                      | perd son lieu, silencieusement |
| `WorkshopLocation`          | perd son lieu, silencieusement |
| `StockItem`                 | perd son emplacement           |
| `StockReservation`          | perd son emplacement           |

La base ne s'y oppose pas et ne lève aucune erreur : le spectacle reste programmé, simplement
sans lieu, et personne ne s'en aperçoit avant que quelqu'un cherche où il se passe.

La ligne doit donc afficher ce qui en dépend — « 3 spectacles, 2 ateliers » — avant de proposer
la suppression.

### Zones retouchées après import

Une zone importée puis modifiée à la main contient un travail qui n'a jamais existé chez Google.
Si elle disparaît côté Google, la supprimer efface ce travail. Comparer sa date de modification
à sa date d'import permet de le signaler sur la ligne.

## Points ouverts

- Stabilité de l'ordre des placemarks entre deux exports : non vérifiée, ne pas s'y fier.
- Déplacement d'un objet d'un calque à l'autre : non testé.
- Duplication d'une carte, et persistance des identifiants sur plusieurs mois : non testées.
- Cartes comportant des polygones à trous ou des `MultiGeometry` : absentes de l'échantillon,
  comportement à définir.
