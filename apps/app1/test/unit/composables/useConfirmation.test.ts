import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'

// Auto-imports Nuxt employés par le composable.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

import { useConfirmation } from '../../../app/composables/useConfirmation'

/** Une promesse qu'on résout à la main, pour observer l'état PENDANT l'action. */
function promesseSuspendue() {
  let resoudre!: () => void
  let rejeter!: (e: unknown) => void
  const promesse = new Promise<void>((ok, ko) => {
    resoudre = ok
    rejeter = ko
  })
  return { promesse, resoudre, rejeter }
}

describe('useConfirmation', () => {
  it('reste fermée tant que rien n’a été demandé', () => {
    const { ouverte, demande } = useConfirmation()
    expect(ouverte.value).toBe(false)
    expect(demande.value).toBeNull()
  })

  it('s’ouvre sur une demande et expose ce qu’elle doit afficher', () => {
    const { ouverte, demande, demanderConfirmation } = useConfirmation()
    demanderConfirmation({
      titre: 'Supprimer',
      description: 'Supprimer la rallonge 10 m ?',
      libelleConfirmer: 'Supprimer',
      agir: () => {},
    })
    expect(ouverte.value).toBe(true)
    expect(demande.value?.description).toBe('Supprimer la rallonge 10 m ?')
    expect(demande.value?.libelleConfirmer).toBe('Supprimer')
  })

  it('n’exécute rien si l’on annule', async () => {
    const agir = vi.fn()
    const { ouverte, demanderConfirmation, annuler } = useConfirmation()
    demanderConfirmation({ description: 'x', agir })
    annuler()
    expect(agir).not.toHaveBeenCalled()
    expect(ouverte.value).toBe(false)
  })

  it('exécute l’action puis referme', async () => {
    const agir = vi.fn()
    const { ouverte, demanderConfirmation, confirmer } = useConfirmation()
    demanderConfirmation({ description: 'x', agir })
    await confirmer()
    expect(agir).toHaveBeenCalledTimes(1)
    expect(ouverte.value).toBe(false)
  })

  it('tient le bouton en chargement jusqu’au terme d’une action asynchrone', async () => {
    const { promesse, resoudre } = promesseSuspendue()
    const { enCours, ouverte, demanderConfirmation, confirmer } = useConfirmation()
    demanderConfirmation({ description: 'x', agir: () => promesse })

    const attente = confirmer()
    expect(enCours.value).toBe(true)
    expect(ouverte.value).toBe(true)

    resoudre()
    await attente
    expect(enCours.value).toBe(false)
    expect(ouverte.value).toBe(false)
  })

  it('refuse de se refermer pendant l’action', async () => {
    const { promesse, resoudre } = promesseSuspendue()
    const { ouverte, demanderConfirmation, confirmer, annuler } = useConfirmation()
    demanderConfirmation({ description: 'x', agir: () => promesse })

    const attente = confirmer()
    // Un clic à côté, ou sur « Annuler », pendant que la suppression est déjà partie : la laisser
    // fermer ferait croire qu'on l'a interrompue.
    ouverte.value = false
    annuler()
    expect(ouverte.value).toBe(true)

    resoudre()
    await attente
    expect(ouverte.value).toBe(false)
  })

  it('n’exécute pas deux fois sur un double clic', async () => {
    const { promesse, resoudre } = promesseSuspendue()
    const agir = vi.fn(() => promesse)
    const { demanderConfirmation, confirmer } = useConfirmation()
    demanderConfirmation({ description: 'x', agir })

    const attente = confirmer()
    await confirmer()
    expect(agir).toHaveBeenCalledTimes(1)

    resoudre()
    await attente
  })

  it('referme et rend la main même si l’action échoue', async () => {
    const { enCours, ouverte, demanderConfirmation, confirmer } = useConfirmation()
    demanderConfirmation({
      description: 'x',
      agir: () => Promise.reject(new Error('500')),
    })
    await expect(confirmer()).rejects.toThrow('500')
    // Sans cela, la modale resterait ouverte avec son bouton en chargement, définitivement.
    expect(enCours.value).toBe(false)
    expect(ouverte.value).toBe(false)
  })
})

describe('useConfirmation — le renoncement', () => {
  it('prévient l’appelant quand on annule', () => {
    const renoncer = vi.fn()
    const { demanderConfirmation, annuler } = useConfirmation()
    demanderConfirmation({ description: 'x', agir: () => {}, renoncer })
    annuler()
    expect(renoncer).toHaveBeenCalledTimes(1)
  })

  it('prévient aussi quand on referme la modale autrement', () => {
    const renoncer = vi.fn()
    const { ouverte, demanderConfirmation } = useConfirmation()
    demanderConfirmation({ description: 'x', agir: () => {}, renoncer })
    // Un clic à côté, ou la touche d'échappement.
    ouverte.value = false
    expect(renoncer).toHaveBeenCalledTimes(1)
  })

  it('ne prévient PAS quand on a confirmé', async () => {
    const renoncer = vi.fn()
    const { demanderConfirmation, confirmer } = useConfirmation()
    demanderConfirmation({ description: 'x', agir: () => {}, renoncer })
    await confirmer()
    // Sans cette distinction, une garde de sortie annulerait la navigation qu'on vient d'accepter.
    expect(renoncer).not.toHaveBeenCalled()
  })

  it('ne prévient qu’une fois, même si l’on annule deux fois', () => {
    const renoncer = vi.fn()
    const { demanderConfirmation, annuler } = useConfirmation()
    demanderConfirmation({ description: 'x', agir: () => {}, renoncer })
    annuler()
    annuler()
    expect(renoncer).toHaveBeenCalledTimes(1)
  })
})
