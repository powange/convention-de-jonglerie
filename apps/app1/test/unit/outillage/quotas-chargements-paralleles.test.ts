import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Les sept chargements de l'écran des quotas partent ensemble — constat F5.
 *
 * 📍 **La prémisse de la fiche était fausse dans le sens qui l'aggrave** : elle décrivait « cinq
 * listes en parallèle ». Il y en avait **sept**, et elles étaient **séquentielles** — sept `await`
 * à la file, chacune attendant la précédente alors qu'aucune n'a besoin de son résultat. Aux
 * **deux** endroits qui les lancent (montage, et changement de droits en mode super admin).
 *
 * ⚠️ Pourquoi une garde de source : éprouver le parallélisme par un montage demanderait de
 * doubler sept points d'API et de mesurer un temps — ce qui mesurerait la machine. Ce qui compte
 * est la forme de l'appel, et elle se lit.
 */
const SOURCE = join(
  import.meta.dirname,
  '../../../../../layers/ticketing/app/pages/editions/[id]/gestion/ticketing/quotas.vue'
)

/*
 * ⚠️ `readFileSync` ET NON UNE LECTURE TOLÉRANTE : un chemin faux doit faire ÉCHOUER les trois
 * cas, pas les rendre verts sur une chaîne vide. Mon premier essai s'est trompé d'un niveau
 * (`../../../../` au lieu de cinq) — les deux interdictions seraient passées sans rien lire si
 * la lecture avait rendu `''`.
 */
const code = () =>
  readFileSync(SOURCE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    // Les commentaires de gabarit aussi : ce fichier EXPLIQUE l'ancien défaut, et les compter
    // ferait de l'explication une infraction. Piège déjà payé six fois dans ce dépôt.
    .replace(/<!--[\s\S]*?-->/g, '')

describe('écran des quotas — les sept chargements', () => {
  it('⚠️ PARTENT ENSEMBLE, aux DEUX endroits qui les lancent', () => {
    /*
     * ⚠️ ON NE COMPTE PAS TOUS LES `Promise.all` DU FICHIER : il y en a trois autres,
     * préexistants, à l'intérieur des chargeurs eux-mêmes (associations + inscrits, + équipes,
     * + spectacles). Mon premier essai les comptait et attendait 2 groupes pour 5 — il échouait
     * sur un code juste. On ne retient que les groupes qui contiennent les sept chargeurs.
     */
    const src = code()
    const groupes = (src.match(/Promise\.all\(\[[\s\S]*?\]\)/g) ?? []).filter((g) =>
      g.includes('loadQuotas()')
    )

    expect(groupes, 'les chargements sont de retour en file').toHaveLength(2)
    for (const groupe of groupes) {
      // Les sept, et pas six : en oublier une la laisserait séquentielle sans que rien ne le dise.
      for (const chargement of [
        'loadQuotas()',
        'loadTiers()',
        'loadOptions()',
        'loadChamps()',
        'loadOrganisateurs()',
        'loadBenevoles()',
        'loadArtistes()',
      ]) {
        expect(groupe, `${chargement} est hors du groupe`).toContain(chargement)
      }
    }
  })

  it('⚠️ AUCUNE FILE DE CHARGEURS NE SUBSISTE', () => {
    /*
     * Le témoin du précédent : on peut très bien ajouter un `Promise.all` ET laisser les anciens
     * `await` au-dessus, ce qui DOUBLERAIT les requêtes au lieu de les accélérer.
     *
     * ⚠️ Mais on ne peut pas interdire tout `await load…()` : l'écran en garde de légitimes — un
     * rechargement CIBLÉ après une action (`await loadChamps()`, et les cinq branches qui
     * rechargent la seule liste touchée). Mon premier essai les interdisait et échouait dessus.
     *
     * Ce qu'on interdit est la SIGNATURE du défaut : trois `await load…()` ou plus à la file.
     */
    const file = code().match(/(?:await load\w+\(\)\s*){3,}/g) ?? []

    expect(file, 'des chargeurs sont enchaînés au lieu de partir ensemble').toEqual([])
  })

  it('le balayage lit bien le fichier — il ne conclut pas sur le vide', () => {
    expect(code().length, 'source vide ou introuvable').toBeGreaterThan(5000)
  })
})
