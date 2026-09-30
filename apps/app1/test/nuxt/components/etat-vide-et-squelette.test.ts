import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import EtatVide from '../../../app/components/ui/EtatVide.vue'
import SqueletteDeListe from '../../../app/components/ui/SqueletteDeListe.vue'

/**
 * Les deux composants qui disent « il n'y a rien » et « ça arrive ».
 *
 * ⚠️ POURQUOI ILS EXISTENT. Vingt-six écrans de gestion d'une édition annoncent une liste vide,
 * chacun à sa manière ; vingt partageaient déjà la même forme, recopiée vingt fois avec vingt
 * variantes de classes. Et trente affichent une roue pendant le chargement d'une liste, contre un
 * seul un squelette.
 *
 * 📍 DEUX CORRECTIONS À L'ÉNONCÉ DU RAPPORT, mesurées le 1er octobre 2026 :
 * • il annonçait « 19 écrans affichent un UAlert pour le vide, 7 un bloc centré à la main ».
 *   C'est l'INVERSE : vingt blocs centrés, trois `UAlert`. C'est donc la forme centrée qui devient
 *   le standard ;
 * • il annonçait trente-cinq roues. Il y en a trente.
 *
 * ⚠️ CE QUE CES TESTS GARDENT, et ce n'est pas l'apparence : qu'un état vide DISE quelque chose.
 * Une liste vide qui n'affiche rien ne se distingue pas d'une panne — on attend, ça ne vient pas,
 * et l'on ne sait pas si c'est la réponse ou l'échec.
 */

describe('UiEtatVide', () => {
  it('affiche le titre, qui est obligatoire', async () => {
    /*
     * 🔬 L'assertion qui porte le composant. Le titre n'a pas de valeur par défaut : on ne peut
     * pas employer ce composant sans dire ce qui manque. C'est ce qui le distingue d'un `<div>`
     * vide, et ce qui a motivé de le mutualiser.
     */
    const composant = await mountSuspended(EtatVide, {
      props: { titre: 'Aucun emprunt en cours' },
    })

    expect(composant.text()).toContain('Aucun emprunt en cours')
  })

  it('affiche la description quand il y en a une, et rien sinon', async () => {
    const avec = await mountSuspended(EtatVide, {
      props: { titre: 'Aucune équipe', description: 'Créez-en une pour commencer' },
    })
    expect(avec.text()).toContain('Créez-en une pour commencer')

    const sans = await mountSuspended(EtatVide, { props: { titre: 'Aucune équipe' } })
    // Pas de paragraphe vide qui ajouterait une marge sans contenu.
    expect(sans.findAll('p')).toHaveLength(1)
  })

  it('n’affiche la zone d’action QUE si on la remplit', async () => {
    /*
     * Une zone d'action vide ajouterait une marge sous le texte, et l'état vide ne serait plus
     * centré de la même façon d'un écran à l'autre — précisément l'incohérence qu'on corrige.
     */
    const sans = await mountSuspended(EtatVide, { props: { titre: 'Rien' } })
    expect(sans.text()).not.toContain('Ajouter')

    const avec = await mountSuspended(EtatVide, {
      props: { titre: 'Rien' },
      slots: { action: () => h('button', 'Ajouter') },
    })
    expect(avec.text()).toContain('Ajouter')
  })

  it('porte une icône neutre par défaut, et celle qu’on demande sinon', async () => {
    /*
     * ⚠️ Le défaut est NEUTRE, volontairement : un vide est le plus souvent un simple constat. Les
     * écrans où le vide est une bonne nouvelle — plus aucun emprunt à relancer, plus aucun doublon
     * de repas — passent une teinte verte, et c'est alors la couleur qui porte l'information.
     */
    const defaut = await mountSuspended(EtatVide, { props: { titre: 'Rien' } })
    expect(defaut.html()).toContain('text-gray-400')

    const bonneNouvelle = await mountSuspended(EtatVide, {
      props: {
        titre: 'Plus aucun emprunt',
        icone: 'i-heroicons-check-circle',
        classeIcone: 'text-green-500',
      },
    })
    expect(bonneNouvelle.html()).toContain('text-green-500')
  })

  it('resserre ses marges en mode compact', async () => {
    // Un vide à l'intérieur d'une carte ou d'un onglet n'a pas la place d'un vide pleine page.
    const large = await mountSuspended(EtatVide, { props: { titre: 'Rien' } })
    expect(large.html()).toContain('py-12')

    const compact = await mountSuspended(EtatVide, { props: { titre: 'Rien', compact: true } })
    expect(compact.html()).toContain('py-6')
    expect(compact.html()).not.toContain('py-12')
  })
})

describe('UiSqueletteDeListe', () => {
  it('feint cinq lignes par défaut', async () => {
    // Cinq suffisent à remplir un écran sans mentir sur le volume attendu.
    const composant = await mountSuspended(SqueletteDeListe)

    expect(composant.findAll('[class*="border"]').length).toBeGreaterThanOrEqual(5)
  })

  it('en feint autant qu’on lui en demande', async () => {
    const composant = await mountSuspended(SqueletteDeListe, { props: { lignes: 2 } })

    const lignes = composant.findAll('.flex.items-center')
    expect(lignes).toHaveLength(2)
  })

  it('S’ANNONCE aux lecteurs d’écran', async () => {
    /*
     * 🔬 Sans `role="status"` et un libellé, un lecteur d'écran annonce une douzaine de blocs vides
     * et rien d'utile. C'est le seul aspect du squelette qu'un test peut vraiment garder — le reste
     * est de l'apparence.
     */
    const composant = await mountSuspended(SqueletteDeListe, {
      props: { libelle: 'Chargement des candidatures' },
    })

    const zone = composant.find('[role="status"]')
    expect(zone.exists()).toBe(true)
    expect(zone.attributes('aria-label')).toBe('Chargement des candidatures')
  })

  it('n’INVENTE PAS de libellé quand on ne lui en donne pas', async () => {
    /*
     * ⚠️ Un défaut écrit en français dans le composant s'afficherait tel quel à un lecteur
     * allemand — c'est exactement le genre de reste que ce dépôt traque, et il serait d'autant plus
     * discret ici qu'il ne concerne que les lecteurs d'écran. L'appelant passe
     * `$t('common.loading')` ; sans libellé, l'attribut est simplement absent.
     */
    const composant = await mountSuspended(SqueletteDeListe)

    expect(composant.find('[role="status"]').attributes('aria-label')).toBeUndefined()
  })

  it('ajoute une pastille ronde pour les listes de personnes', async () => {
    const sans = await mountSuspended(SqueletteDeListe, { props: { lignes: 1 } })
    expect(sans.html()).not.toContain('rounded-full')

    const avec = await mountSuspended(SqueletteDeListe, {
      props: { lignes: 1, avecAvatar: true },
    })
    expect(avec.html()).toContain('rounded-full')
  })

  it('fait varier les largeurs d’une ligne à l’autre', async () => {
    /*
     * Des barres de longueur identique lisent comme un tableau figé, pas comme du texte en
     * attente. C'est ce qui distingue un squelette d'un simple bloc gris.
     */
    const composant = await mountSuspended(SqueletteDeListe, { props: { lignes: 3 } })
    const html = composant.html()

    expect(html).toContain('w-3/4')
    expect(html).toContain('w-2/3')
    expect(html).toContain('w-5/6')
  })
})
