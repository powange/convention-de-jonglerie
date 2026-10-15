import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Les onze chargements de l'écran des articles à remettre partent ensemble.
 *
 * Le même défaut que sur les quotas (constat F5), en pire : **onze** chargeurs au lieu de sept,
 * à la file, et les onze `await` écrits DEUX FOIS à l'identique — au montage, et au passage en
 * super-admin. Le temps avant affichage était leur somme au lieu de celui du plus lent.
 *
 * ⚠️ Différence avec la garde des quotas : là-bas les deux endroits portent chacun leur
 * `Promise.all`, donc elle en attend **deux**. Ici la file a été extraite en **une seule**
 * fonction, `chargerTout()`, que les deux endroits appellent — d'où **un** groupe, et deux
 * appels. C'est ce qui ferme la duplication : ajouter un chargeur ne peut plus l'oublier d'un
 * côté.
 *
 * ⚠️ Pourquoi une garde de source, et pas un montage : éprouver le parallélisme demanderait de
 * doubler onze points d'API et de mesurer un temps — ce qui mesurerait la machine. Ce qui compte
 * est la forme de l'appel, et elle se lit. Même raisonnement que
 * `quotas-chargements-paralleles.test.ts`.
 */
const SOURCE = join(
  import.meta.dirname,
  '../../../../../layers/ticketing/app/pages/editions/[id]/gestion/ticketing/handout-items.vue'
)

/*
 * ⚠️ `readFileSync` ET NON UNE LECTURE TOLÉRANTE : un chemin faux doit faire ÉCHOUER les cas, pas
 * les rendre verts sur une chaîne vide.
 *
 * ⚠️ ET LES COMMENTAIRES SONT RETIRÉS : le commentaire que ce lot a posé dans la source CONTIENT
 * les mots « Promise.all » et décrit les `await` d'avant. Sans ce retrait, la garde se prouverait
 * sur l'explication du défaut au lieu du code — piège déjà payé sept fois dans ce dépôt.
 */
const code = () =>
  readFileSync(SOURCE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')

/** Les onze, et pas dix : en oublier un le laisserait en série sans que rien ne le dise. */
const LES_ONZE = [
  'loadHandoutItems()',
  'loadVolunteerHandoutItems()',
  'loadOrganizerItems()',
  'loadEditionOrganizers()',
  'loadTiers()',
  'loadOptions()',
  'loadCustomFields()',
  'loadArtistItems()',
  'loadShows()',
  'loadArtists()',
  'loadMeals()',
]

describe('articles à remettre — les onze chargements', () => {
  it('⚠️ PARTENT ENSEMBLE, LES ONZE DANS UN SEUL GROUPE', () => {
    /*
     * ⚠️ ON NE COMPTE PAS TOUS LES `Promise.all` DU FICHIER, pour la même raison que sur les
     * quotas : d'autres peuvent exister à l'intérieur des chargeurs. On ne retient que le groupe
     * qui lance les chargeurs de l'écran.
     */
    /*
     * ⚠️ LA FERMETURE EST ANCRÉE SUR UN RETOUR À LA LIGNE (`\n\s*\]\)`). Le motif de la garde des
     * quotas — `[\s\S]*?\]\)` — s'arrête ici au PREMIER `])`, qui est celui du `[]` du `spread`
     * conditionnel des artistes : le groupe était tronqué avant `loadMeals()`, et le cas échouait
     * sur un code juste. Les quotas n'ont pas de `spread`, d'où le motif plus simple là-bas.
     */
    const groupes = (code().match(/Promise\.all\(\[[\s\S]*?\n\s*\]\)/g) ?? []).filter((g) =>
      g.includes('loadHandoutItems()')
    )

    expect(groupes, 'les chargements sont de retour en file').toHaveLength(1)
    for (const chargement of LES_ONZE) {
      expect(groupes[0], `${chargement} est hors du groupe`).toContain(chargement)
    }
  })

  it('⚠️ AUCUNE FILE DE CHARGEURS NE SUBSISTE', () => {
    /*
     * Le témoin du précédent : on peut très bien ajouter un `Promise.all` ET laisser les anciens
     * `await` au-dessus, ce qui DOUBLERAIT les requêtes au lieu de les accélérer.
     *
     * ⚠️ On ne peut pas interdire tout `await load…()` : l'écran en garde un légitime, le
     * rechargement CIBLÉ d'une seule liste après une action. Ce qu'on interdit est la SIGNATURE
     * du défaut : trois `await load…()` ou plus à la file.
     */
    const file = code().match(/(?:await load\w+\(\)\s*){3,}/g) ?? []

    expect(file, 'des chargeurs sont enchaînés au lieu de partir ensemble').toEqual([])
  })

  it('⚠️ LA FILE N’EST PLUS ÉCRITE DEUX FOIS : UN SEUL ENDROIT LA PORTE', () => {
    /*
     * Le cœur de la seconde moitié du défaut. Les deux endroits qui lançaient les onze —
     * `onMounted` et le `watch` sur les droits — doivent désormais passer par la même fonction.
     * Deux appels, une définition.
     */
    const src = code()

    expect(src.match(/const chargerTout = async/g) ?? [], 'la fonction a disparu').toHaveLength(1)
    expect(
      src.match(/await chargerTout\(\)/g) ?? [],
      'les deux endroits ne l’appellent pas tous les deux'
    ).toHaveLength(2)
  })

  it('le balayage lit bien le fichier — il ne conclut pas sur le vide', () => {
    expect(code().length, 'source vide ou introuvable').toBeGreaterThan(5000)
  })
})
