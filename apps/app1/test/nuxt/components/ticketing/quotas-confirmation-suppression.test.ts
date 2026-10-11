import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import ConfirmModal from '../../../../app/components/ui/ConfirmModal.vue'
import QuotasList from '../../../../../../layers/ticketing/app/components/ticketing/QuotasList.vue'

/**
 * Le BRANCHEMENT de la confirmation de suppression d'un quota — constat F3.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE, alors que la règle est déjà couverte par 6 cas
 *
 * `associations-du-quota.ts` est éprouvé à part. Mais **un util juste et branché nulle part ne
 * corrige rien** : ce dépôt a payé ce défaut cinq fois, et la couverture du code mort le fait
 * passer pour vivant. Ce qui se vérifie ici est le câblage — que la confirmation affiche bien
 * autre chose quand le quota porte des associations.
 *
 * ## ⚠️⚠️ ET POURQUOI ON NE PEUT PAS ASSERTER LE TEXTE
 *
 * L'environnement de test est en **anglais** : une clé i18n neuve, créée en français seulement, y
 * ressort **brute** — et vue-i18n ne fait **aucune interpolation** sur une clé absente, donc même
 * les nombres n'apparaissent pas. Asserter « 5 association(s) » échouerait aujourd'hui pour une
 * raison qui n'a rien à voir avec le lot, et asserter la clé brute serait vrai jusqu'à la
 * synchronisation des traductions — trois tests sont déjà tombés un soir pour cela.
 *
 * On assère donc une **différence** : la description d'un quota avec associations n'est pas celle
 * d'un quota sans. C'est vrai en clé brute **comme** après traduction.
 */
const QUOTA_BASE = {
  id: 1,
  title: 'Entrées samedi',
  description: null,
  quantity: 50,
}

const descriptionPour = async (quota: Record<string, unknown>) => {
  const composant = await mountSuspended(QuotasList, {
    props: { quotas: [quota], loading: false, editionId: 42 },
  })

  /*
   * ⚠️ ON CLIQUE RÉELLEMENT LE BOUTON, et c'est le second enseignement de ce fichier. Mon premier
   * essai visait un `aria-label` contenant « supprim » — or le bouton porte un `title` TRADUIT,
   * donc introuvable en anglais. Le test prenait alors un repli qui posait le quota directement :
   * il passait, en ne couvrant PAS le clic. L'ancre `data-*` est la seule prise insensible à la
   * langue, et il n'y a plus de repli pour masquer son absence.
   */
  const bouton = composant.find('[data-supprimer-quota]')
  expect(bouton.exists(), 'le bouton de suppression est introuvable').toBe(true)
  await bouton.trigger('click')

  const modale = composant.findComponent(ConfirmModal)
  expect(modale.exists(), 'la modale de confirmation est introuvable').toBe(true)
  return modale.props('description') as string
}

describe('QuotasList — ce que la suppression annonce', () => {
  it('⚠️ DIT AUTRE CHOSE QUAND LE QUOTA PORTE DES ASSOCIATIONS', async () => {
    const sans = await descriptionPour({ ...QUOTA_BASE, _count: {} })
    const avec = await descriptionPour({
      ...QUOTA_BASE,
      _count: { tiers: 3, options: 2, customFields: 0, organizers: 0, volunteers: 0, artists: 0 },
    })

    expect(avec).not.toBe(sans)
    expect(avec.length).toBeGreaterThan(0)
  })

  it('garde le libellé SIMPLE quand le quota n’est posé sur rien', async () => {
    /*
     * LE TÉMOIN. Sans lui, un composant qui emploierait TOUJOURS le libellé détaillé satisferait
     * le cas précédent — et annoncerait « ses 0 association(s) disparaîtront », ce qui est absurde
     * et fait douter du reste du message.
     */
    const aucunCompte = await descriptionPour({ ...QUOTA_BASE })
    const comptesNuls = await descriptionPour({
      ...QUOTA_BASE,
      _count: { tiers: 0, options: 0, customFields: 0, organizers: 0, volunteers: 0, artists: 0 },
    })
    const peuple = await descriptionPour({
      ...QUOTA_BASE,
      _count: { tiers: 3, options: 0, customFields: 0, organizers: 0, volunteers: 0, artists: 0 },
    })

    // Un `_count` absent et un `_count` à zéro disent la même chose : il n'y a rien à annoncer.
    expect(comptesNuls).toBe(aucunCompte)
    /*
     * ⚠️ ET LA MOITIÉ QUI MANQUAIT À CE TÉMOIN. Sans cette seconde assertion, un composant qui
     * emploierait TOUJOURS le libellé détaillé le satisfaisait : les deux descriptions devenaient
     * la même, et l'égalité ci-dessus restait vraie. C'est le premier cas qui l'attrapait, par
     * accident. Un témoin doit tomber sur le défaut qu'il prétend garder.
     */
    expect(comptesNuls).not.toBe(peuple)
  })
})
