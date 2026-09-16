/**
 * Rattrapage : inscrire l'identifiant du champ personnalisé dans l'instantané des billets
 * existants qui n'en portent pas.
 *
 * ## Ce que ce script répare — et ce qu'il ne répare pas
 *
 * Un quota posé sur un champ personnalisé rapproche les billets par IDENTIFIANT quand l'instantané
 * en porte un, et retombe sur le libellé sinon. Les billets saisis avant que le serveur n'accepte
 * `customFieldId` n'ont que leur libellé : ils comptent correctement aujourd'hui, mais un
 * renommage du champ les détacherait tous, d'un coup et sans bruit.
 *
 * Ce script ne répare donc RIEN d'actuellement cassé : il assure ces billets contre un renommage
 * à venir. C'est délibérément un script et non une migration — une migration s'applique sans
 * confirmation au démarrage, et reconstruire un tableau JSON en SQL y serait à la fois délicat
 * (l'ordre des éléments n'est pas garanti par `JSON_ARRAYAGG`) et risqué : un échec bloque la
 * base entière.
 *
 * ## Ce qu'il ne touche jamais
 *
 * - un élément qui porte déjà `customFieldId` ou `id` ;
 * - un élément dont le libellé correspond à PLUSIEURS champs de l'édition — l'ambiguïté se
 *   constate, elle ne se tranche pas au hasard ;
 * - un élément dont le libellé ne correspond à aucun champ : ces billets-là sont déjà détachés,
 *   et le libellé ne permet plus de les retrouver.
 *
 * ## Usage
 *
 *   npx tsx scripts/backfill-custom-field-ids.ts            # constate, n'écrit rien
 *   npx tsx scripts/backfill-custom-field-ids.ts --appliquer # écrit
 */

import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from '../server/generated/prisma/client'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('❌ DATABASE_URL non définie')
  process.exit(1)
}

const url = new URL(databaseUrl)
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  connectionLimit: 2,
  bigIntAsNumber: true,
  allowPublicKeyRetrieval: true,
})
const prisma = new PrismaClient({ adapter })

const APPLIQUER = process.argv.includes('--appliquer')

type Element = Record<string, unknown>

async function main() {
  console.log(
    APPLIQUER
      ? '🚀 Rattrapage des identifiants de champs personnalisés — ÉCRITURE\n'
      : '🔍 Rattrapage des identifiants de champs personnalisés — constat seul\n' +
          '   (relancer avec --appliquer pour écrire)\n'
  )

  /**
   * Les champs de chaque édition, indexés par libellé.
   *
   * Un libellé porté par plusieurs champs est marqué ambigu : on ne tranchera pas à sa place.
   */
  const champs = await prisma.ticketingTierCustomField.findMany({
    select: { id: true, editionId: true, label: true },
  })

  const parEditionEtLibelle = new Map<string, number | 'ambigu'>()
  for (const champ of champs) {
    const cle = `${champ.editionId}::${champ.label}`
    parEditionEtLibelle.set(cle, parEditionEtLibelle.has(cle) ? 'ambigu' : champ.id)
  }

  const billets = await prisma.ticketingOrderItem.findMany({
    where: { customFields: { not: null } },
    select: { id: true, customFields: true, order: { select: { editionId: true } } },
  })

  let touches = 0
  let elementsRenseignes = 0
  let ambigus = 0
  let introuvables = 0
  let dejaIdentifies = 0

  for (const billet of billets) {
    const elements = billet.customFields
    if (!Array.isArray(elements)) continue

    let modifie = false
    const nouveaux = (elements as Element[]).map((element) => {
      // Déjà identifié, d'une façon ou de l'autre : on n'y touche pas.
      if (typeof element.customFieldId === 'number' || typeof element.id === 'number') {
        dejaIdentifies++
        return element
      }
      if (typeof element.name !== 'string') return element

      const trouve = parEditionEtLibelle.get(`${billet.order.editionId}::${element.name}`)
      if (trouve === undefined) {
        introuvables++
        return element
      }
      if (trouve === 'ambigu') {
        ambigus++
        console.warn(
          `  ⚠️  billet ${billet.id} : « ${element.name} » correspond à plusieurs champs de ` +
            `l'édition ${billet.order.editionId} — laissé tel quel`
        )
        return element
      }

      modifie = true
      elementsRenseignes++
      return { ...element, customFieldId: trouve }
    })

    if (!modifie) continue
    touches++

    if (APPLIQUER) {
      await prisma.ticketingOrderItem.update({
        where: { id: billet.id },
        data: { customFields: nouveaux },
      })
    }
  }

  console.log('\n──────── Résumé ────────')
  console.log(`billets parcourus              : ${billets.length}`)
  console.log(`éléments déjà identifiés       : ${dejaIdentifies}`)
  console.log(`éléments renseignés            : ${elementsRenseignes}`)
  console.log(`billets ${APPLIQUER ? 'mis à jour   ' : 'à mettre à jour'} : ${touches}`)
  console.log(`libellés ambigus (ignorés)     : ${ambigus}`)
  console.log(`libellés sans correspondance   : ${introuvables}`)
  if (!APPLIQUER) console.log('\nRien n’a été écrit. Relancer avec --appliquer.')
}

main()
  .catch((erreur) => {
    console.error('❌ Échec :', erreur)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
