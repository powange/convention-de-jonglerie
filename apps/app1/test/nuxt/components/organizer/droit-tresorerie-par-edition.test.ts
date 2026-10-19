import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import RightsFields from '../../../../app/components/organizer/RightsFields.vue'

/**
 * Le droit de TRÉSORERIE d'une édition disparaissait quand il restait le seul.
 *
 * ## Le défaut
 *
 * `EDITION_RIGHTS` compte onze droits. Ce composant les réécrivait à la main en **cinq** endroits
 * — l'interface des entrées, les unions de `hasEditionFlag` et `toggleEdition`, l'entrée vierge,
 * et la condition de nettoyage — et les cinq n'en comptaient que **dix** : `canManageTreasury`
 * manquait partout.
 *
 * C'est le cinquième qui faisait mal. Après chaque bascule, une entrée dont aucun droit n'est
 * accordé est retirée, pour ne pas envoyer au serveur une ligne vide. Mais la condition
 * n'examinait que dix drapeaux : **une entrée ne portant plus que la trésorerie était jugée vide
 * et supprimée**, emportant ce droit sans rien dire.
 *
 * ⚠️ **CORRECTION D'UN DIAGNOSTIC QUE J'AVAIS D'ABORD ÉCRIT, ET QUI ÉTAIT FAUX.** J'ai annoncé que
 * « cocher la trésorerie seule était impossible, l'entrée étant supprimée aussitôt créée ». Mesuré
 * contre le composant d'origine : ce cas-là **passe**. La raison est que `localValue` est
 * `reactive`, si bien qu'au PREMIER clic l'entrée fraîchement poussée est encore l'objet BRUT
 * alors que le `filter` du nettoyage lit des proxys — `p !== entree` n'y correspond jamais, et le
 * nettoyage ne retire donc rien à ce moment-là. Le défaut ne se produit qu'une fois l'entrée
 * devenue un proxy : chargée depuis les props, ou retrouvée par `find` à une bascule suivante.
 *
 * D'où le cas ci-dessous, qui part des props. C'est le sabotage qui a montré l'erreur : remettre
 * la condition amputée ne faisait PAS tomber la première version de ce test, qui ne prouvait donc
 * rien de ce qu'elle annonçait.
 *
 * ## Les deux parcours utilisateur touchés
 *
 * 1. un organisateur a, sur une édition, « informations » **et** « trésorerie ». On lui retire
 *    « informations » : la ligne entière saute, et la trésorerie avec ;
 * 2. dans une même session, cocher un droit, puis la trésorerie, puis décocher le premier produit
 *    le même effet — l'entrée a entre-temps été relue par `find`.
 *
 * Le gabarit, lui, était juste : il passait bien `'canManageTreasury'`. Seules les déclarations
 * TypeScript et cette condition étaient courtes — le compilateur le voyait (TS2345), mais la
 * porte de typage était éteinte (#859).
 */
const EDITION = {
  id: 42,
  name: 'Édition témoin',
  startDate: '2026-11-01T10:00:00.000Z',
  endDate: '2026-11-03T18:00:00.000Z',
}

const monter = (perEdition: Record<string, unknown>[] = []) =>
  mountSuspended(RightsFields, {
    props: {
      modelValue: { title: null, rights: {} as Record<string, boolean>, perEdition },
      editions: [EDITION],
      hideTitle: true,
    },
  })

/**
 * La ligne du tableau par édition qui porte l'édition témoin.
 *
 * ⚠️ C'est le repère qui compte : « Treasury » étiquette DEUX interrupteurs de ce composant — le
 * droit de convention, qui vaut pour toutes les éditions, et celui de cette édition-ci. Les
 * distinguer par leur rang dans la page désignerait l'un aujourd'hui et l'autre dès qu'une
 * colonne bouge ; on passe donc par la ligne, identifiée par le NOM de l'édition.
 */
const ligneDeLEdition = (composant: Awaited<ReturnType<typeof monter>>) => {
  const lignes = composant.findAll('tr').filter((l) => l.text().includes(EDITION.name))
  expect(lignes.length, `la ligne de « ${EDITION.name} » devrait être unique`).toBe(1)
  return lignes[0]!
}

/**
 * L'interrupteur de cette ligne portant l'un de ces libellés exacts.
 *
 * Plusieurs libellés admis, et comparés en ENTIER : l'environnement de test rend l'anglais
 * (« Treasury ») là où l'application rend le français (« Trésorerie »), et une i18n non chargée
 * rendrait la clé brute. Ce n'est pas une assertion sur le libellé — seulement un repère, qui ne
 * doit pas casser à la première synchronisation de traductions. Une comparaison par sous-chaîne
 * attraperait « Information (all editions) » en cherchant « Information ».
 */
const interrupteurDeLaLigne = (ligne: ReturnType<typeof ligneDeLEdition>, libelles: string[]) => {
  const trouve = ligne
    .findAll('[aria-label]')
    .filter((n) => libelles.includes(n.attributes('aria-label') ?? ''))
  expect(
    trouve.length,
    `un seul interrupteur attendu parmi ${libelles.join(' / ')} sur la ligne de l'édition`
  ).toBe(1)
  return trouve[0]!
}

const TRESORERIE = ['Trésorerie', 'Treasury', 'common.treasury_short']
const INFORMATIONS = ['Informations', 'Information', 'common.information_short']

/** La dernière valeur émise du modèle. */
const dernierModele = (composant: Awaited<ReturnType<typeof monter>>) => {
  const emissions = composant.emitted('update:modelValue') as unknown[][] | undefined
  expect(emissions, 'aucun `update:modelValue` émis').toBeTruthy()
  return emissions![emissions!.length - 1]![0] as { perEdition: Record<string, unknown>[] }
}

describe('Droits par édition : la trésorerie', () => {
  it('le témoin : le tableau par édition est bien RENDU, avec ses onze interrupteurs', async () => {
    /*
     * Sans ce cas, tous les suivants seraient verts sur un tableau absent — il n'est rendu que si
     * `editions.length`, et un composant qui n'affiche rien ne prouve rien. Onze droits dans
     * `EDITION_RIGHTS`, donc onze interrupteurs sur la ligne de l'unique édition — et pas les
     * vingt-six de la page entière, qui comptent aussi les droits de convention.
     */
    const composant = await monter()

    expect(
      ligneDeLEdition(composant).findAll('[role="switch"]').length,
      'la ligne devrait porter exactement onze interrupteurs'
    ).toBe(11)
  })

  it('⚠️ retirer l’AUTRE droit ne doit pas emporter la trésorerie', async () => {
    /*
     * LE défaut, sur le parcours où il se produit vraiment. L'entrée vient des props, elle est
     * donc déjà un proxy : le nettoyage peut la retrouver, et l'ancienne condition la jugeait vide
     * parce qu'elle ne regardait pas `canManageTreasury`.
     */
    const composant = await monter([
      { editionId: EDITION.id, canEdit: true, canManageTreasury: true },
    ])

    await interrupteurDeLaLigne(ligneDeLEdition(composant), INFORMATIONS).trigger('click')

    const modele = dernierModele(composant)
    expect(
      modele.perEdition,
      'la ligne a été jugée vide et supprimée, alors que la trésorerie y restait accordée'
    ).toHaveLength(1)
    expect(modele.perEdition[0]!.editionId).toBe(EDITION.id)
    expect(modele.perEdition[0]!.canEdit).toBe(false)
    expect(modele.perEdition[0]!.canManageTreasury, 'le droit de trésorerie a disparu').toBe(true)
  })

  it('📍 l’entrée créée porte les ONZE droits, pas dix', async () => {
    /*
     * La cause en amont, et la seule chose que l'entrée vierge changeait : elle n'initialisait que
     * dix drapeaux. Un onzième absent de l'objet se lit `undefined`, ce qui passe pour « pas de
     * droit » — un chiffre faux mais plausible, le motif qu'on cherche à ne plus reproduire.
     */
    const composant = await monter()

    await interrupteurDeLaLigne(ligneDeLEdition(composant), INFORMATIONS).trigger('click')

    const entree = dernierModele(composant).perEdition[0] ?? {}

    expect(Object.keys(entree).sort()).toEqual(
      [
        'canDelete',
        'canEdit',
        'canManageArtists',
        'canManageFAQ',
        'canManageMeals',
        'canManageStock',
        'canManageTasks',
        'canManageTicketing',
        'canManageTreasury',
        'canManageVolunteers',
        'canManageWorkshops',
        'editionId',
      ].sort()
    )
  })

  it('et une entrée dont on retire le DERNIER droit disparaît bien', async () => {
    /*
     * L'autre sens, sans quoi on aurait pu « corriger » en ne nettoyant plus jamais : une entrée
     * vide de tout droit n'a pas à être envoyée au serveur. Elle vient des props, pour que le
     * nettoyage puisse la retrouver — voir l'avertissement de l'en-tête sur le premier clic.
     */
    const composant = await monter([{ editionId: EDITION.id, canManageTreasury: true }])

    await interrupteurDeLaLigne(ligneDeLEdition(composant), TRESORERIE).trigger('click')

    expect(
      dernierModele(composant).perEdition,
      'une entrée sans aucun droit doit être retirée'
    ).toHaveLength(0)
  })
})
