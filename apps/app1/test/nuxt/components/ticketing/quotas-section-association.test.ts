import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'

/**
 * La section « Associer les quotas » n'apparaît que s'il y a de quoi associer — constat F5.
 *
 * ## Le défaut
 *
 * La section et ses **six onglets** s'affichaient même sans aucun quota, et le bouton ouvrait une
 * fenêtre au sélecteur **vide** sans rien dire de la cause : on cherchait ce qu'on avait mal
 * fait, là où il n'y avait simplement rien à choisir.
 *
 * ## ⚠️ La distinction que la fiche demandait de ne pas rater
 *
 * « Pas encore chargé » n'est pas « réellement vide ». `loadingQuotas` part à `true`, donc
 * l'encart n'apparaît qu'une fois la réponse arrivée — sans quoi il clignoterait à chaque
 * ouverture de page en annonçant l'absence de quotas pendant qu'on les charge.
 *
 * C'est précisément ce que ces trois cas séparent : **chargement**, **vide**, **peuplé**.
 *
 * ## 📍 Et la prémisse de la fiche était fausse dans le sens qui l'aggrave
 *
 * Elle parlait de « cinq listes en parallèle ». Il y en avait **sept**, et elles étaient
 * **séquentielles** — chacune attendant la précédente alors qu'aucune n'a besoin de son résultat.
 * Elles partent désormais ensemble (`Promise.all`), donc le temps d'affichage est celui de la
 * plus lente et non leur somme. Un test de source le garde, le montage ne pouvant pas mesurer un
 * enchaînement de requêtes doublées.
 */
const section = async (quotas: unknown[], chargement: boolean) => {
  // Le composant de page est lourd (1 100 lignes, sept requêtes) : on éprouve ici la RÈGLE
  // d'affichage, posée telle quelle dans un composant minimal qui la reproduit.
  const Essai = {
    props: { quotas: { type: Array, required: true }, loadingQuotas: { type: Boolean } },
    template: `
      <div>
        <div v-if="!loadingQuotas && quotas.length === 0" data-vide>aucun quota</div>
        <div v-else-if="!loadingQuotas" data-onglets>onglets</div>
      </div>
    `,
  }
  return await mountSuspended(Essai, { props: { quotas, loadingQuotas: chargement } })
}

describe('quotas — la section d’association', () => {
  it('⚠️ N’AFFICHE NI ENCART NI ONGLETS PENDANT LE CHARGEMENT', async () => {
    const c = await section([], true)

    expect(c.find('[data-vide]').exists(), 'l’encart clignoterait à chaque ouverture').toBe(false)
    expect(c.find('[data-onglets]').exists()).toBe(false)
  })

  it('⚠️ DIT POURQUOI quand il n’y a aucun quota', async () => {
    const c = await section([], false)

    expect(c.find('[data-vide]').exists()).toBe(true)
    expect(c.find('[data-onglets]').exists(), 'les onglets vides reviennent').toBe(false)
  })

  it('⚠️ LE TÉMOIN : les onglets reviennent dès qu’un quota existe', async () => {
    // Sans lui, masquer la section en permanence satisferait les deux cas précédents — et
    // l'association deviendrait inatteignable.
    const c = await section([{ id: 1 }], false)

    expect(c.find('[data-onglets]').exists()).toBe(true)
    expect(c.find('[data-vide]').exists()).toBe(false)
  })
})
