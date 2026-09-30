# Les champs de recherche et leur temporisation

Inventaire des champs de recherche de l'application, de ce qu'ils interrogent, et du délai qui
s'applique entre la dernière frappe et le filtrage.

Ce document existe parce que la question « ce champ filtre-t-il à chaque touche ? » ne se lit pas
sur le balisage : la temporisation vit parfois dans le composant, parfois dans la page qui
consomme le filtre, parfois nulle part.

## Le principe : deux valeurs, pas une

Un champ de recherche temporisé porte **deux** valeurs :

- la **saisie**, qui suit la frappe au caractère et alimente le champ à l'écran ;
- le **modèle**, qui déclenche le filtrage et n'est mis à jour qu'une fois la frappe retombée.

Les confondre — reposer le champ sur la seule valeur temporisée — produit un champ qui traîne : on
tape « rallonge » et on voit « rall » pendant un quart de seconde. C'est un défaut pire que celui
qu'on corrige, parce qu'il est visible.

`apps/app1/app/composables/useSaisieTemporisee.ts` porte ce mécanisme. Il rend `{ saisie,
appliquer }` : `appliquer()` vide la file et écrit tout de suite, pour les deux gestes qui ne
doivent jamais attendre — **la touche Entrée** et **la croix d'effacement**. Attendre après un clic
sur une croix donne l'impression que le clic n'a pas été pris, et on reclique.

C'est cette capacité à vider la file qui explique pourquoi le composable est écrit à la main plutôt
que de s'appuyer sur `refDebounced` de VueUse, qui ne rend qu'une valeur temporisée.

### Où le poser

**Dans le composant de filtres quand il y en a un**, et non dans la page qui filtre. Deux raisons :

1. une barre de filtres sert souvent à plusieurs écrans — celle du stock est posée trois fois —, et
   temporiser chez chaque appelant reviendrait à recopier le mécanisme autant de fois ;
2. un composant se monte dans un test ; une page de gestion, qui demande une dizaine de points
   d'API au montage, non. La temporisation serait livrée sans une seule mesure.

Effet de bord utile : la page reçoit une valeur déjà retombée, donc **l'écriture de l'adresse**
qu'elle fait au passage cesse elle aussi de partir à chaque lettre. Plusieurs de ces écrans
reportent leurs filtres dans la barre d'adresse par un `replace`, et c'est souvent le coût le plus
lourd — bien plus qu'un filtrage en mémoire.

## Écrans de gestion d'une édition

Les numéros de ligne servent de point d'entrée, pas de référence : c'est le nom du modèle qui reste
stable.

| Écran                       | Champ                              | Portée                                | Délai                    | Fichier (au 30/09/2026)                                                     |
| --------------------------- | ---------------------------------- | ------------------------------------- | ------------------------ | --------------------------------------------------------------------------- |
| Artistes                    | `saisieRecherche` → `globalFilter` | locale (colonnes affichées) + adresse | 250 ms                   | `layers/artists/app/pages/editions/[id]/gestion/artists/index.vue:178`      |
| Stock — manquants, emprunts | `saisie` → `recherche`             | locale                                | 250 ms                   | `layers/stock/app/components/stock/StockFiltresObjets.vue:29`               |
| Stock — liste d'un groupe   | `saisieNom` → `nom`                | locale + adresse                      | 250 ms                   | `layers/stock/app/components/stock/StockItemFilters.vue:25`                 |
| Stock — liste d'un groupe   | `saisieLieu` → `lieu`              | locale + adresse                      | 250 ms                   | `layers/stock/app/components/stock/StockItemFilters.vue:86`                 |
| Trésorerie                  | `saisie` → `texte`                 | locale + adresse                      | 250 ms                   | `apps/app1/app/components/treasury/Filters.vue:17`                          |
| Trésorerie — plan comptable | `saisie` → `recherche`             | locale                                | 250 ms                   | `apps/app1/app/components/treasury/PlanComptableModal.vue:33`               |
| FAQ                         | `searchQuery`                      | locale + adresse                      | 150 ms                   | `layers/faq/app/pages/editions/[id]/gestion/faq/index.vue:87`               |
| Repas — liste               | `searchQuery`                      | serveur                               | `debouncedSearch`        | `layers/meals/app/pages/editions/[id]/gestion/meals/list.vue:114`           |
| Repas — validation          | `searchQuery`                      | locale                                | 300 ms                   | `layers/meals/app/pages/editions/[id]/gestion/meals/validate.vue:342`       |
| Tâches                      | `search`                           | locale                                | 250 ms                   | `layers/tasks/app/components/tasks/TaskFilters.vue:5`                       |
| Billetterie — commandes     | `searchQuery`                      | serveur                               | 400 ms                   | `layers/ticketing/app/pages/editions/[id]/gestion/ticketing/orders.vue:144` |
| Bénévoles — tableau         | `globalFilter`                     | serveur                               | 350 ms (`setTimeout` nu) | `layers/volunteers/app/components/edition/volunteer/Table.vue:50`           |
| Organisateurs               | `newOrganizersearchTerm`           | serveur                               | 300 ms                   | `apps/app1/app/pages/editions/[id]/gestion/organizers.vue:331`              |

### Les deux qui ne filtrent PAS à la frappe, volontairement

| Écran                             | Champ         | Déclencheur      | Fichier (au 30/09/2026)                                                                        |
| --------------------------------- | ------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| Billetterie — contrôle d'accès    | `searchTerm`  | Entrée ou bouton | `layers/ticketing/app/pages/editions/[id]/gestion/ticketing/access-control.vue:82`             |
| Appel à spectacles — candidatures | `searchQuery` | Entrée ou bouton | `apps/app1/app/pages/editions/[id]/gestion/shows-call/[showCallId]/applications/index.vue:198` |

Ces deux-là interrogent le serveur sur une saisie que l'on compose en entier — une adresse
électronique, un numéro de billet. Chercher à la frappe y enverrait une requête par caractère pour
des résultats intermédiaires dont personne ne veut. Leur watcher de filtres ne fait qu'écrire
l'adresse. **Ne pas les « corriger » en y ajoutant une temporisation** : ce serait retarder un
geste déjà explicite.

## Écrans d'administration

| Écran                         | Champ                             | Délai            | Fichier (au 30/09/2026)                                |
| ----------------------------- | --------------------------------- | ---------------- | ------------------------------------------------------ |
| Conventions                   | `searchQuery`                     | 300 ms           | `apps/app1/app/pages/admin/conventions.vue:87`         |
| Utilisateurs                  | `searchQuery`                     | 300 ms           | `apps/app1/app/pages/admin/users/index.vue:42`         |
| Retours                       | `filters.search`                  | présente         | `apps/app1/app/pages/admin/feedback.vue:114`           |
| Fusion de comptes             | `searchTerm`                      | 300 ms           | `apps/app1/app/components/admin/UserMergeModal.vue:10` |
| Journal d'erreurs             | `filters.search` et trois voisins | **aucune**       | `apps/app1/app/components/admin/ErrorLogFilters.vue:5` |
| Recherche dans une sauvegarde | `filterValue`                     | Entrée seulement | `apps/app1/app/components/admin/BackupSearch.vue:58`   |

Le journal d'erreurs est le seul endroit de l'application où une frappe part encore en requête
serveur sans temporisation. Il est hors du périmètre de ce document — écran d'administration, usage
rare — mais c'est celui qui coûte le plus en réseau, et il reste à traiter.

## Textes d'aide

Chaque barre de filtres porte une ligne qui dit **quels champs sont fouillés**. C'est la vraie
surprise à l'usage : chercher « rallonge » dans le stock ne remonte pas un objet dont seule la
description mentionne une rallonge, et rien ne le disait.

> ⚠️ Ce texte ne dit PAS que la recherche « porte sur les éléments chargés ». Aucun de ces écrans ne
> pagine côté serveur : artistes, objets de stock et lignes de trésorerie sont chargés en entier,
> et le filtre local les voit tous. Annoncer un résultat partiel qui n'existe pas ferait douter
> d'une recherche exacte.

### ⚠️ Sous la barre, jamais dans un `UFormField`

La première version les posait en `help` d'un `UFormField` autour de chaque champ. C'est le
composant prévu pour cela, et **c'est pourtant le mauvais choix ici** : le texte pend sous la
saisie, ce qui rend le champ PLUS HAUT que ses voisins. Or ces barres alignent leurs contrôles sur
une ligne — par le bas pour le stock et la trésorerie, centrés pour les artistes. Un champ plus
haut y remonte donc sa saisie au-dessus de celle des autres.

Le réflexe suivant — passer la rangée en `items-start` — déplace le problème sans le résoudre : les
libellés n'ont pas tous la même hauteur. « Lieu de récupération ou de retour » tient sur deux lignes
là où « Nom de l'objet » en tient une, et les saisies se décalent alors de vingt pixels dans
l'autre sens.

Ce n'est pas une déduction. `test/e2e/playwright/edition-management/stock-filtres-alignement.spec.ts`
compare les **ordonnées** des saisies d'une même rangée et refuse plus de deux pixels d'écart. C'est
lui qui a mesuré les vingt pixels, et rien d'autre ne les aurait signalés : ni le typage, ni les
tests de composant, ni un code 200.

La règle en découle : **une ligne sous la barre**, en `text-xs text-gray-500`, qui décrit la barre
entière. Elle ne touche à aucun alignement, et dit la chose une fois au lieu d'une fois par champ.
Seule exception, la modale du plan comptable, dont les champs sont empilés en colonne : un
`UFormField :help` y est sans risque.

## Les délais, et pourquoi ils diffèrent encore

Cinq valeurs coexistent : 150, 250, 300, 350 et 400 ms. Ce n'est pas un choix d'ensemble, c'est une
sédimentation — deux mécanismes différents (`useDebounce`, écrit dans le dépôt, et `refDebounced`
de VueUse) plus un `setTimeout` nu dans le tableau des bénévoles.

250 ms est la valeur retenue pour les nouveaux : assez court pour ne pas se sentir, assez long pour
absorber une frappe continue. Les délais existants n'ont pas été alignés, parce qu'un changement de
délai sur une recherche SERVEUR se juge sur le trafic qu'il produit, et qu'aucune mesure ne
l'appuierait ici. À reprendre si l'occasion s'en présente.
