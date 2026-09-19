/**
 * Reprise : inscrire au journal des entrées les validations antérieures à sa mise en place.
 *
 * `EntryValidationLog` n'enregistre que depuis le 19 septembre 2026. Les entrées validées avant
 * cette date n'y figurent donc pas, alors que leur trace existe — sous une autre forme, dans
 * l'état courant des quatre tables : `entryValidated`, `entryValidatedAt`, `entryValidatedBy`.
 * Ce script transforme cet état en lignes de journal.
 *
 * ## ⚠️ Ces lignes sont RECONSTITUÉES, et rien en base ne le dira
 *
 * C'est une **décision explicite du 19/09/2026**, prise en connaissance de cause après que
 * l'alternative — un champ `source` distinguant `ENREGISTRE` de `RECONSTITUE` — a été proposée et
 * écartée. Ce commentaire est donc la seule trace de cette distinction : une ligne produite ici
 * est indiscernable, en base, d'une ligne écrite par un vrai scan.
 *
 * Trois choses en découlent, à connaître avant de relire le journal :
 *
 * - ce qui a été **validé puis annulé** n'apparaîtra pas : l'état a été effacé, il n'en reste
 *   rien. C'est précisément le trou que le journal est venu boucher ;
 * - **aucune annulation** n'est reconstituée, pour la même raison ;
 * - l'horodatage est celui de la **dernière** validation connue. Une personne présentée deux fois
 *   n'en laisse qu'une.
 *
 * Autrement dit, le journal dira après reprise « ces personnes sont entrées à ces heures-là » —
 * ce qui est vrai — en laissant entendre « et rien d'autre ne s'est passé », ce qu'on ne sait pas.
 *
 * ## Ce qu'il ne touche jamais
 *
 * - une entrée non validée, ou validée sans horodatage : sans instant, la ligne n'aurait pas de
 *   place dans un fil chronologique ;
 * - une ligne déjà présente au journal pour le même participant, le même sens et le même instant.
 *   Le script est donc **rejouable** sans créer de doublon.
 *
 * C'est délibérément un script et non une migration : une migration s'applique sans confirmation
 * au démarrage d'un déploiement, et celle-ci écrirait des dizaines de milliers de lignes dérivées
 * sur une base de production, sans possibilité de constater avant.
 *
 * ## Usage
 *
 *   npx tsx scripts/reprise-journal-des-entrees.ts             # constate, n'écrit rien
 *   npx tsx scripts/reprise-journal-des-entrees.ts --appliquer  # écrit
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

type Genre = 'TICKET' | 'VOLUNTEER' | 'ARTIST' | 'ORGANIZER'

interface EntreeAReprendre {
  editionId: number
  participantKind: Genre
  participantId: number
  actorId: number | null
  createdAt: Date
}

/**
 * Les quatre populations, chacune avec sa façon d'atteindre son édition.
 *
 * Le billet est le seul à ne pas la porter directement : elle vit sur sa commande. Les trois
 * autres ont leur propre colonne — `eventId` pour la candidature, `editionId` pour l'artiste et
 * l'organisateur.
 */
async function entreesValidees(): Promise<EntreeAReprendre[]> {
  const commun = { entryValidated: true, entryValidatedAt: { not: null } } as const

  const [billets, benevoles, artistes, organisateurs] = await Promise.all([
    prisma.ticketingOrderItem.findMany({
      where: { ...commun, order: { editionId: { not: undefined } } },
      select: {
        id: true,
        entryValidatedAt: true,
        entryValidatedBy: true,
        order: { select: { editionId: true } },
      },
    }),
    prisma.editionVolunteerApplication.findMany({
      where: commun,
      select: { id: true, eventId: true, entryValidatedAt: true, entryValidatedBy: true },
    }),
    prisma.editionArtist.findMany({
      where: commun,
      select: { id: true, editionId: true, entryValidatedAt: true, entryValidatedBy: true },
    }),
    prisma.editionOrganizer.findMany({
      where: commun,
      select: { id: true, editionId: true, entryValidatedAt: true, entryValidatedBy: true },
    }),
  ])

  return [
    ...billets.map((b) => ({
      editionId: b.order.editionId,
      participantKind: 'TICKET' as const,
      participantId: b.id,
      actorId: b.entryValidatedBy,
      createdAt: b.entryValidatedAt!,
    })),
    ...benevoles.map((v) => ({
      editionId: v.eventId,
      participantKind: 'VOLUNTEER' as const,
      participantId: v.id,
      actorId: v.entryValidatedBy,
      createdAt: v.entryValidatedAt!,
    })),
    ...artistes.map((a) => ({
      editionId: a.editionId,
      participantKind: 'ARTIST' as const,
      participantId: a.id,
      actorId: a.entryValidatedBy,
      createdAt: a.entryValidatedAt!,
    })),
    ...organisateurs.map((o) => ({
      editionId: o.editionId,
      participantKind: 'ORGANIZER' as const,
      participantId: o.id,
      actorId: o.entryValidatedBy,
      createdAt: o.entryValidatedAt!,
    })),
  ]
}

async function main() {
  console.log(
    APPLIQUER
      ? '🚀 Reprise du journal des entrées — ÉCRITURE\n'
      : '🔍 Reprise du journal des entrées — constat seul\n' +
          '   (relancer avec --appliquer pour écrire)\n'
  )

  const candidates = await entreesValidees()

  /**
   * Ce que le journal contient déjà, pour ne rien inscrire deux fois.
   *
   * L'empreinte comprend l'INSTANT : deux scans de la même personne à deux moments différents
   * sont deux mouvements, et le second ne doit pas être pris pour un doublon du premier.
   */
  const dejaLa = new Set(
    (
      await prisma.entryValidationLog.findMany({
        where: { movement: 'VALIDATED' },
        select: {
          editionId: true,
          participantKind: true,
          participantId: true,
          createdAt: true,
        },
      })
    ).map((l) => `${l.editionId}|${l.participantKind}|${l.participantId}|${l.createdAt.getTime()}`)
  )

  const aInscrire = candidates.filter(
    (c) =>
      !dejaLa.has(`${c.editionId}|${c.participantKind}|${c.participantId}|${c.createdAt.getTime()}`)
  )

  // La ventilation porte sur ce qui a été TROUVÉ, comme la ligne qu'elle détaille — et non sur
  // ce qui reste à écrire, qui vaut zéro à chaque rejeu.
  const parGenre = (genre: Genre) => candidates.filter((c) => c.participantKind === genre).length

  if (APPLIQUER && aInscrire.length > 0) {
    // Par paquets : une seule insertion de plusieurs milliers de lignes tient mal sur une base
    // de production, et un échec en cours de route laisserait tout à recommencer. Le script
    // étant rejouable, une reprise après incident repart de ce qui manque.
    const PAQUET = 500
    for (let i = 0; i < aInscrire.length; i += PAQUET) {
      await prisma.entryValidationLog.createMany({
        data: aInscrire.slice(i, i + PAQUET).map((c) => ({ ...c, movement: 'VALIDATED' as const })),
      })
      console.log(`   … ${Math.min(i + PAQUET, aInscrire.length)} / ${aInscrire.length}`)
    }
  }

  console.log('\n──────── Résumé ────────')
  console.log(`entrées validées trouvées      : ${candidates.length}`)
  console.log(`  billets                      : ${parGenre('TICKET')}`)
  console.log(`  bénévoles                    : ${parGenre('VOLUNTEER')}`)
  console.log(`  artistes                     : ${parGenre('ARTIST')}`)
  console.log(`  organisateurs                : ${parGenre('ORGANIZER')}`)
  console.log(`déjà au journal (ignorées)     : ${candidates.length - aInscrire.length}`)
  console.log(`lignes ${APPLIQUER ? 'inscrites       ' : 'à inscrire     '} : ${aInscrire.length}`)
  console.log(
    '\n⚠️  Ces lignes sont RECONSTITUÉES depuis l’état courant : aucune annulation n’y figure,\n' +
      '   et rien en base ne les distingue d’un mouvement réellement enregistré.'
  )
  if (!APPLIQUER) console.log('\nRien n’a été écrit. Relancer avec --appliquer.')
}

main()
  .catch((erreur) => {
    console.error('❌ Échec :', erreur)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
