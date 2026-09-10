import { refDebounced } from '@vueuse/core'

import type { UserSelectItem } from '~/components/UserSelector.vue'

import type { Ref } from 'vue'

import { rechercheResponsable } from '~~/shared/utils/recherche-responsable'

/**
 * Le champ « qui s'en occupe », partout où il apparaît.
 *
 * Deux écrans le proposent désormais — la fiche d'un objet et la modification en lot — et le geste
 * n'y est pas anodin : deux recherches cohabitent dans le même champ, avec une portée différente,
 * plus un anti-rebond et une garde contre les réponses arrivées dans le désordre. Recopié, cet
 * ensemble aurait divergé au premier correctif porté d'un seul côté.
 */

/** Ce qu'un écran doit brancher sur `UserSelector`. */
export interface RechercheResponsable {
  /** La saisie, liée à `v-model:search-term`. */
  terme: Ref<string>
  /** Les personnes trouvées, liées à `:searched-users`. */
  resultats: Ref<UserSelectItem[]>
  /** Liée à `:searching-users`. */
  enCours: Ref<boolean>
}

/** Prénom et nom quand ils sont renseignés — deux pseudos proches se distinguent ainsi. */
function nomComplet(u: { prenom?: string | null; nom?: string | null }): string {
  return [u.prenom, u.nom].filter(Boolean).join(' ').trim()
}

export function useRechercheResponsable(editionId: number): RechercheResponsable {
  const terme = ref('')
  const resultats = ref<UserSelectItem[]>([])
  const enCours = ref(false)

  // Une frappe ne vaut pas une requête : la recherche par pseudo part dès deux caractères, là où
  // l'adresse exacte n'aboutissait qu'une fois l'adresse entière écrite.
  const termeDiffere = refDebounced(terme, 300)

  async function chercher(saisie: string): Promise<UserSelectItem[]> {
    const recherche = rechercheResponsable(saisie)
    if (!recherche) return []

    try {
      if (recherche.type === 'email') {
        const reponse = await $fetch<{ data: { users: any[] } }>('/api/users/search', {
          params: { emailExact: recherche.valeur },
        })
        return (reponse.data.users || []).map((u) => ({
          id: u.id,
          label: `${u.pseudo} (${u.email})`,
          pseudo: u.pseudo,
          email: u.email,
          emailHash: u.emailHash,
          profilePicture: u.profilePicture,
        }))
      }

      const reponse = await $fetch<{ data: { users: any[] } }>(
        `/api/editions/${editionId}/stock-responsables`,
        { params: { pseudo: recherche.valeur } }
      )
      return (reponse.data.users || []).map((u) => ({
        id: u.id,
        // L'adresse n'est volontairement pas rendue par cette recherche-là : le pseudo et l'état
        // civil suffisent à reconnaître quelqu'un de sa propre équipe.
        label: nomComplet(u) ? `${u.pseudo} (${nomComplet(u)})` : u.pseudo,
        pseudo: u.pseudo,
        email: '',
        emailHash: u.emailHash || '',
        profilePicture: u.profilePicture,
      }))
    } catch {
      return []
    }
  }

  // Un jeton, parce que les appels s'enchaînent au fil de la frappe : sans lui, une réponse lente
  // à « jo » écrasait celle, déjà affichée, de « jonglerie ».
  let dernierJeton = 0

  watch(termeDiffere, async (saisie) => {
    if (!rechercheResponsable(saisie)) {
      resultats.value = []
      enCours.value = false
      return
    }

    const jeton = ++dernierJeton
    enCours.value = true
    const trouves = await chercher(saisie)
    if (jeton !== dernierJeton || saisie !== termeDiffere.value) return
    resultats.value = trouves
    enCours.value = false
  })

  return { terme, resultats, enCours }
}
