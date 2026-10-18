import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

/**
 * Aucune prop de Nuxt UI v2 ne subsiste sur un composant de v4.
 *
 * ## Pourquoi cette garde existe
 *
 * Une prop inconnue d'un composant Nuxt UI est **acceptée en silence** : ni erreur, ni
 * avertissement, ni trace en console. Le réglage qu'elle portait n'existe simplement pas, et l'on
 * cherche la cause dans les données ou le CSS.
 *
 * Trois reliquats de la montée en v4 ont été trouvés et corrigés à quelques heures d'intervalle,
 * tous sur des `USelectMenu`, et chacun avait un effet visible :
 *
 * - `#option` au lieu de `#item` : les drapeaux du sélecteur de pays ne s'affichaient pas ;
 * - `#option-empty` au lieu de `#empty` : « aucun pays trouvé » ne s'affichait jamais ;
 * - `searchable-placeholder` au lieu de `search-input` : le champ de recherche affichait
 *   **`Search…`, en dur et en anglais, dans les treize langues** — la clé traduite n'atteignait
 *   pas l'écran. Quatorze occurrences sur sept fichiers (#858 pour la première, le reste ensuite).
 *
 * Aucun test ne les rattrapait, et le typage non plus : une prop en trop sur un composant Vue
 * n'est pas une erreur de type.
 *
 * ## Ce que cette garde attrape, et ce qu'elle n'attrape pas
 *
 * Elle attrape **le retour en arrière** : réintroduire une de ces props la fait échouer en
 * nommant le fichier et la ligne. Elle n'énumère pas une liste d'exceptions — un tel dispositif
 * exempte en silence ce qu'on y ajoute, erreur déjà payée sur la garde des icônes de module.
 *
 * ⚠️ **`#label` n'est PAS couvert, et c'est délibéré.** Une première version l'incluait, en
 * écartant les fichiers porteurs d'un `USwitch`/`UCheckbox`/`UCheckboxGroup` — composants où ce
 * créneau est parfaitement valide, quinze fois dans ce dépôt. Mesuré avant de livrer : cette
 * exclusion écartait **139 des 401 fichiers (34 %)** et, surtout, **les 7 fichiers portant un
 * `#label`, soit 100 %**. Le cas inspectait donc ZÉRO fichier et passait au vert pour la pire des
 * raisons. Une garde qui ne garde rien est pire qu'une garde absente : elle fait croire que le
 * sujet est couvert.
 *
 * Le couvrir correctement exige de déterminer le composant PARENT de chaque occurrence, ce
 * qu'aucun détecteur textuel ne fait de façon fiable — le mien s'est trompé trois fois dans la
 * même session, en s'accrochant à une balise écrite *à l'intérieur* du créneau. À reprendre le
 * jour où l'on dispose d'un analyseur de gabarit, pas avant.
 *
 * Elle ne prétend donc pas couvrir **toutes** les props de v2 : seules celles effectivement
 * trouvées dans ce dépôt, et seulement là où la mesure prouve qu'elle regarde vraiment. Pour une prop ou un créneau dont on doute, la métadonnée du composant fait foi
 * (serveur MCP `nuxt-ui`, `get-component-metadata`) — ne jamais déduire un nom par analogie avec
 * un composant voisin.
 *
 * ⚠️ **Et elle vise la forme d'une PROP, pas la sous-chaîne.** `BackupSearch.vue` appelle
 * `/api/admin/backup/searchable-schema` : une recherche de « searchable » la signalerait à tort.
 * Quatre faux positifs par sous-chaîne sont déjà consignés dans l'historique de ce dépôt — d'où
 * l'ancrage sur un début d'attribut.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const MONOREPO = join(RACINE, '..', '..')

/** Les arborescences qui portent des gabarits : l'application, et chaque layer partagé. */
const ARBRES = [
  join(RACINE, 'app'),
  ...readdirSync(join(MONOREPO, 'layers'))
    .map((layer) => join(MONOREPO, 'layers', layer, 'app'))
    .filter((chemin) => {
      try {
        return statSync(chemin).isDirectory()
      } catch {
        return false
      }
    }),
]

/**
 * Les noms bannis, avec le remplaçant à nommer dans le message d'échec.
 *
 * Le motif exige que le nom soit en **début d'attribut** — précédé d'un blanc ou d'un `:`, et
 * suivi de `=`, d'un blanc ou d'une fin de ligne. C'est ce qui le distingue d'un segment d'URL ou
 * d'un identifiant plus long.
 */
const BANNIES: { motif: RegExp; nom: string; remplacant: string }[] = [
  {
    motif: /(?:^|\s):?searchable-placeholder(?=[=\s]|$)/m,
    nom: 'searchable-placeholder',
    remplacant: ':search-input="{ placeholder: … }"',
  },
  {
    motif: /(?:^|\s):?searchable(?=[=\s]|$)/m,
    nom: 'searchable',
    remplacant: 'rien — `searchInput` vaut déjà `true`, la recherche s’affiche sans cette prop',
  },
  {
    motif: /(?:^|\s)(?:v-bind)?:?(?:value|option)-attribute(?=[=\s]|$)/m,
    nom: 'value-attribute / option-attribute',
    remplacant:
      '`value-key` / `label-key` — ⚠️ MAIS lire `valuekey-nest-pas-un-renommage` d’abord : sur `USelectMenu`, `valueKey` CHANGE la forme du modèle (objet → champ) et a déjà cassé la création d’édition',
  },
  {
    motif: /<template\s+#option(?:-empty)?(?=[=\s>])/m,
    nom: '#option / #option-empty',
    remplacant: '`#item` / `#empty`',
  },
]

const listerVue = (dossier: string): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) return listerVue(chemin)
    return entree.name.endsWith('.vue') ? [chemin] : []
  })

const GABARITS = ARBRES.flatMap(listerVue)

describe('Props et créneaux de Nuxt UI v2', () => {
  it('le témoin : la garde balaie bien un vrai corpus', () => {
    /*
     * Sans ce cas, tous les suivants passeraient sur une liste VIDE — un chemin trop court d'un
     * seul niveau suffit, et c'est déjà arrivé deux fois dans ce dépôt. Le seuil est délibérément
     * bas et stable : il ne suit pas la taille du dépôt.
     */
    expect(
      GABARITS.length,
      `aucun .vue balayé — chemins cherchés : ${ARBRES.join(', ')}`
    ).toBeGreaterThan(300)
  })

  it.each(BANNIES)('aucun `$nom` ne subsiste', ({ motif, nom, remplacant }) => {
    const coupables: string[] = []

    for (const chemin of GABARITS) {
      const contenu = readFileSync(chemin, 'utf8')
      // Les commentaires de gabarit citent forcément les anciens noms : les écarter.
      const sansCommentaires = contenu.replace(/<!--[\s\S]*?-->/g, '')
      if (!motif.test(sansCommentaires)) continue

      sansCommentaires.split('\n').forEach((ligne, i) => {
        if (motif.test(ligne)) {
          coupables.push(`${relative(MONOREPO, chemin)}:${i + 1}`)
        }
      })
    }

    expect(
      coupables,
      `\`${nom}\` est une prop de Nuxt UI v2 : elle est acceptée EN SILENCE et ne fait rien.\nRemplacer par ${remplacant}.\nOccurrences :\n${coupables.join('\n')}`
    ).toEqual([])
  })
})
