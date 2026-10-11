import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const SCHEMAS = join(process.cwd(), 'prisma', 'schema')

/**
 * Sous MySQL, deux NULL sont DISTINCTS dans un index unique — constat O3.
 *
 * Une contrainte `@@unique([editionId, handoutItemId, teamId])` dont `teamId` est nullable
 * **n'empêche donc pas** d'empiler plusieurs lignes « tous » identiques. Ce que la contrainte
 * semble garantir, elle ne le garantit pas.
 *
 * ## 📍 CE QUE LA MESURE A CORRIGÉ DANS LA FICHE
 *
 * Elle nommait **deux** tables (`EditionOrganizerHandoutItem`, puis `EditionVolunteerHandoutItem`
 * en ajout), et sa revérification du 21 septembre parlait de « quatre index uniques » relus dans
 * `information_schema`. Mesuré sur le schéma courant : **14 index uniques composés** portent une
 * colonne nullable, et **20** si l'on compte ceux à une seule colonne.
 *
 * ## ⚠️ MAIS LES 14 NE SONT PAS LE MÊME SUJET, et c'est tout l'intérêt de ce test
 *
 * Deux familles s'y mélangent, et les confondre ferait « corriger » des contraintes qui font
 * exactement ce qu'on leur demande :
 *
 * 1. **LE NULL QUI VEUT DIRE « TOUS »** — la ligne globale. Plusieurs NULL identiques y sont un
 *    DÉFAUT : rien n'empêche deux lignes « tous les bénévoles » pour le même article.
 * 2. **LE NULL QUI VEUT DIRE « PAS IMPORTÉ »** — un tarif saisi à la main n'a ni
 *    `externalTicketingId` ni identifiant HelloAsso, une zone dessinée à la main n'a pas
 *    d'`externalMapObjectId`. Plusieurs NULL y sont NÉCESSAIRES : les interdire empêcherait de
 *    créer deux tarifs locaux.
 *
 * ## Ce que ce test fait, et ce qu'il ne fait pas
 *
 * Il **ne corrige rien** : le choix du correctif — valeur sentinelle, colonne générée indexée, ou
 * garde applicative — change le modèle de données et appartient à l'utilisateur. La question lui
 * est posée.
 *
 * Ce qu'il garantit : **aucune contrainte de ce genre n'apparaît sans qu'on la classe**. Une
 * quinzième, ajoutée demain, fait tomber ce test, et celui qui l'ajoute doit dire dans quelle
 * famille elle tombe.
 */

/** Le NULL y signifie « tous » : empiler deux lignes globales est un défaut. */
const LIGNE_TOUS: Record<string, string> = {
  'EditionVolunteerHandoutItem(editionId,handoutItemId,teamId)': 'teamId NULL = tous les bénévoles',
  'EditionOrganizerHandoutItem(editionId,handoutItemId,organizerId)':
    'organizerId NULL = tous les organisateurs',
  'EditionVolunteerQuota(editionId,quotaId,teamId)': 'teamId NULL = toutes les équipes',
  'EditionOrganizerQuota(editionId,quotaId,organizerId)':
    'organizerId NULL = tous les organisateurs',
  'EditionArtistQuota(editionId,quotaId,showId)': 'showId NULL = tous les spectacles',
  'TicketingTierCustomFieldQuota(customFieldId,quotaId,choiceValue)':
    'choiceValue NULL = tous les choix du champ',
  'TicketingTierCustomFieldHandoutItem(customFieldId,handoutItemId,choiceValue)':
    'choiceValue NULL = tous les choix du champ',
  'ShowArtist(showId,actId,artistId)':
    'actId NULL = artiste du spectacle sans numéro précis — même risque de doublon',
}

/** Le NULL y signifie « pas importé » : plusieurs NULL sont NÉCESSAIRES. */
const PLUSIEURS_NULL_VOULUS: Record<string, string> = {
  'TicketingTier(externalTicketingId,helloAssoTierId)':
    'un tarif saisi à la main n’a ni l’un ni l’autre',
  'TicketingOption(externalTicketingId,helloAssoOptionId)': 'idem pour une option locale',
  'TicketingOrder(externalTicketingId,helloAssoOrderId)': 'idem pour une commande de guichet',
  'TicketingTierCustomField(externalTicketingId,helloAssoCustomFieldId)':
    'idem pour un champ personnalisé local',
  'EditionZone(editionId,externalMapObjectId)': 'une zone dessinée à la main n’est pas importée',
  'EditionMarker(editionId,externalMapObjectId)': 'un repère dessiné à la main non plus',
}

/** Les `@@unique` COMPOSÉS dont au moins une colonne est nullable, lus dans le schéma. */
async function contraintesARisque(): Promise<string[]> {
  const trouvees: string[] = []
  for (const nom of await readdir(SCHEMAS)) {
    if (!nom.endsWith('.prisma')) continue
    const src = await readFile(join(SCHEMAS, nom), 'utf8')
    for (const bloc of src.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      const [, modele, corps] = bloc
      const nullables = new Set<string>()
      for (const ligne of corps!.split('\n')) {
        // `  champ  Type?` — deux espaces d'indentation, et le `?` du type.
        const m = ligne.match(/^ {2}(\w+)\s+\w+\?/)
        if (m) nullables.add(m[1]!)
      }
      for (const u of corps!.matchAll(/@@unique\(\[([^\]]+)\]/g)) {
        const colonnes = u[1]!.split(',').map((c) => c.trim())
        if (colonnes.length > 1 && colonnes.some((c) => nullables.has(c))) {
          trouvees.push(`${modele}(${colonnes.join(',')})`)
        }
      }
    }
  }
  return trouvees.sort()
}

describe('unicité portant une colonne nullable', () => {
  it('⚠️ CHAQUE CONTRAINTE EST CLASSÉE — aucune n’apparaît sans qu’on dise ce qu’elle vaut', async () => {
    const connues = new Set([...Object.keys(LIGNE_TOUS), ...Object.keys(PLUSIEURS_NULL_VOULUS)])
    const inconnues = (await contraintesARisque()).filter((c) => !connues.has(c))

    expect(
      inconnues,
      `Sous MySQL, deux NULL sont DISTINCTS dans un index unique : ces contraintes ne ` +
        `garantissent pas ce qu'elles semblent garantir. Classer chacune dans ce fichier — ` +
        `« ligne tous » (empiler est un défaut) ou « plusieurs NULL voulus » (un objet non ` +
        `importé n'a pas d'identifiant distant) :\n${inconnues.join('\n')}`
    ).toEqual([])
  })

  it('les deux classements sont encore vrais — une entrée périmée exempte en silence', async () => {
    /*
     * LA GARDE DES LISTES. Une contrainte renommée ou supprimée laisserait son entrée derrière
     * elle : la liste grossirait sans que personne ne la relise, et elle finirait par exempter
     * une contrainte qu'on n'a jamais classée.
     */
    const presentes = new Set(await contraintesARisque())
    for (const [cle, raison] of Object.entries({ ...LIGNE_TOUS, ...PLUSIEURS_NULL_VOULUS })) {
      expect(
        presentes.has(cle),
        `« ${cle} » n'existe plus dans le schéma : retirer l'entrée « ${raison} »`
      ).toBe(true)
    }
  })

  it('le balayage lit bien des schémas — il ne conclut pas sur le vide', async () => {
    /*
     * Le premier cas est une interdiction, donc **vert sur une liste vide**. Une erreur de chemin
     * et il ne vérifierait plus rien tout en restant au vert — défaut déjà payé plusieurs fois
     * ici. On mesure ce qui est LU, jamais la taille de la dette.
     */
    const contraintes = await contraintesARisque()
    expect(contraintes.length, 'aucune contrainte trouvée : le balayage est cassé').toBeGreaterThan(
      10
    )
  })

  it('📍 LA FAMILLE « LIGNE TOUS » COMPTE HUIT TABLES, pas deux', async () => {
    /*
     * La fiche O3 en nommait DEUX. Ce chiffre est figé ici pour que la décision — valeur
     * sentinelle, colonne générée indexée, ou garde applicative — se prenne sur l'étendue réelle
     * du sujet et non sur son échantillon.
     */
    expect(Object.keys(LIGNE_TOUS)).toHaveLength(8)
  })
})
