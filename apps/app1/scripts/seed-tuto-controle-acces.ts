#!/usr/bin/env tsx
/**
 * Convention fictive servant au tutoriel « contrôle d'accès » destiné aux bénévoles
 * (`docs/tutoriels/controle-acces/`).
 *
 *   npx tsx scripts/seed-tuto-controle-acces.ts
 *
 * Relançable : la convention est supprimée puis recréée à l'identique, ce qui remet tous les
 * billets dans leur état de départ (entrées non validées, remboursements non faits) et recale
 * l'édition et le créneau de contrôle d'accès sur la date du jour — à relancer donc avant de
 * refaire des captures d'écran.
 *
 * Tout ce qu'il crée est repérable : la convention s'appelle « Balles Perdues (TUTO) » et les
 * comptes portent une adresse en `@tuto-balles-perdues.test`. Rien d'autre n'est touché.
 *
 * NE JAMAIS exécuter en production.
 */
import { createHash } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { config } from 'dotenv'

import { getEmailHash } from '../server/utils/email-hash.js'
import { syncEventMetadataFromEdition } from '../server/utils/event-sync.js'
import prisma from '../server/utils/prisma.js'

config()

const NOM_CONVENTION = 'Balles Perdues (TUTO)'
const NOM_EDITION = 'Festival des Balles Perdues 2026 — TUTO'
const DOMAINE = 'tuto-balles-perdues.test'
export const MOT_DE_PASSE = 'TutoBalles2026!'

function assertDev() {
  const url = process.env.DATABASE_URL || ''
  if (
    process.env.NODE_ENV === 'production' ||
    !/@(localhost|127\.0\.0\.1|database)[:/]/.test(url)
  ) {
    throw new Error('Base non locale : ce script ne tourne que sur la base de développement.')
  }
}

// Jetons fixes : les QR codes imprimés dans le tutoriel restent valables d'une exécution à l'autre.
const jeton = (qui: string) =>
  createHash('sha256').update(`tuto-balles-perdues:${qui}`).digest('hex').slice(0, 24)
const heures = (h: number) => new Date(Date.now() + h * 3600 * 1000)
const euros = (e: number) => Math.round(e * 100)

async function compte(prenom: string, nom: string, local: string) {
  const email = `${local}@${DOMAINE}`
  const password = await bcrypt.hash(MOT_DE_PASSE, 10)
  return prisma.user.upsert({
    where: { email },
    update: { prenom, nom, password, isEmailVerified: true },
    create: {
      email,
      emailHash: getEmailHash(email),
      pseudo: `tuto-${local}`,
      prenom,
      nom,
      password,
      isEmailVerified: true,
      preferredLanguage: 'fr',
    },
  })
}

async function main() {
  assertDev()

  // ── Remise à zéro ─────────────────────────────────────────────────────────
  const ancienne = await prisma.convention.findFirst({ where: { name: NOM_CONVENTION } })
  if (ancienne) {
    const editions = await prisma.edition.findMany({
      where: { conventionId: ancienne.id },
      select: { eventId: true },
    })
    // L'édition part avec son Event (cascade), la convention ensuite.
    await prisma.event.deleteMany({ where: { id: { in: editions.map((e) => e.eventId) } } })
    await prisma.convention.delete({ where: { id: ancienne.id } })
    console.log(`Ancienne convention ${ancienne.id} supprimée`)
  }

  // ── Comptes ───────────────────────────────────────────────────────────────
  const orga = await compte('Camille', 'Organisatrice', 'camille')
  const hugo = await compte('Hugo', 'Trésorier', 'hugo')
  const leo = await compte('Léo', 'Portier', 'leo')
  const ines = await compte('Inès', 'Buvette', 'ines')
  const malik = await compte('Malik', 'Montage', 'malik')
  const zoe = await compte('Zoé', 'Diabolo', 'zoe')

  // ── Convention et édition ─────────────────────────────────────────────────
  const convention = await prisma.convention.create({
    data: {
      name: NOM_CONVENTION,
      description: 'Convention fictive utilisée pour le tutoriel du contrôle d’accès.',
      authorId: orga.id,
    },
  })

  const debut = new Date()
  debut.setDate(debut.getDate() - 1)
  debut.setHours(10, 0, 0, 0)
  const fin = new Date(debut)
  fin.setDate(fin.getDate() + 3)
  fin.setHours(18, 0, 0, 0)

  const edition = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({ data: {} })
    const created = await tx.edition.create({
      data: {
        id: event.id,
        eventId: event.id,
        name: NOM_EDITION,
        description: 'Édition fictive du tutoriel « contrôle d’accès ».',
        creatorId: orga.id,
        conventionId: convention.id,
        startDate: debut,
        endDate: fin,
        addressLine1: '1 place des Massues',
        city: 'Jonglebourg',
        postalCode: '99999',
        country: 'France',
        timezone: 'Europe/Paris',
        status: 'PUBLISHED',
        ticketingEnabled: true,
        ticketingHandoutItemsEnabled: true,
        ticketingAllowOnsiteRegistration: true,
        artistsEnabled: true,
        hasTentCamping: true,
      },
    })
    await tx.eventVolunteerSettings.create({
      data: { eventId: event.id, enabled: true, open: true, planningPublished: true },
    })
    return created
  })
  await syncEventMetadataFromEdition(edition.id)
  const editionId = edition.id

  // ── Organisateurs ─────────────────────────────────────────────────────────
  const droitsComplets = {
    canAddEdition: true,
    canDeleteAllEditions: true,
    canDeleteConvention: true,
    canEditAllEditions: true,
    canEditConvention: true,
    canManageOrganizers: true,
    canManageVolunteers: true,
    canManageArtists: true,
    canManageMeals: true,
    canManageTicketing: true,
    canManageTasks: true,
    canManageStock: true,
    canManageWorkshops: true,
    canManageFAQ: true,
    canManageTreasury: true,
  }
  const orgaCamille = await prisma.conventionOrganizer.create({
    data: {
      conventionId: convention.id,
      userId: orga.id,
      addedById: orga.id,
      title: 'Présidente',
      ...droitsComplets,
    },
  })
  const orgaHugo = await prisma.conventionOrganizer.create({
    data: {
      conventionId: convention.id,
      userId: hugo.id,
      addedById: orga.id,
      title: 'Trésorier',
      canManageTreasury: true,
    },
  })
  await prisma.editionOrganizer.create({
    data: { editionId, organizerId: orgaCamille.id, qrCodeToken: jeton('camille') },
  })
  const edHugo = await prisma.editionOrganizer.create({
    data: { editionId, organizerId: orgaHugo.id, qrCodeToken: jeton('hugo') },
  })

  // ── Articles à remettre ───────────────────────────────────────────────────
  const article = (name: string) =>
    prisma.ticketingHandoutItem.create({ data: { editionId, name } })
  const bracelet3j = await article('Bracelet 3 jours')
  const braceletJour = await article('Bracelet journée')
  const braceletEnfant = await article('Bracelet enfant')
  const braceletCamping = await article('Bracelet camping')
  const teeShirt = await article('Tee-shirt de la convention')
  const teeBenevole = await article('Tee-shirt bénévole')
  const passArtiste = await article('Pass artiste')
  const badgeOrga = await article('Badge organisation')

  // ── Billetterie HelloAsso (fictive) ───────────────────────────────────────
  const externe = await prisma.externalTicketing.create({
    data: {
      editionId,
      provider: 'HELLOASSO',
      lastSyncAt: heures(-3),
      helloAssoConfig: {
        create: {
          clientId: 'tuto-client-id',
          clientSecret: 'tuto-non-fonctionnel',
          organizationSlug: 'balles-perdues-tuto',
          formType: 'Event',
          formSlug: 'festival-balles-perdues-2026-tuto',
        },
      },
    },
  })

  const tarif = (
    name: string,
    price: number,
    position: number,
    helloAssoTierId: number | null,
    handoutItemId: number
  ) =>
    prisma.ticketingTier.create({
      data: {
        editionId,
        name,
        price: euros(price),
        position,
        ...(helloAssoTierId ? { externalTicketingId: externe.id, helloAssoTierId } : {}),
        handoutItems: { create: { handoutItemId } },
      },
    })

  const pass3j = await tarif('Pass 3 jours', 45, 0, 9001, bracelet3j.id)
  const passEnfant = await tarif('Pass enfant (6-12 ans)', 20, 1, 9002, braceletEnfant.id)
  const passSamedi = await tarif('Pass journée samedi', 20, 2, 9003, braceletJour.id)
  // Tarifs vendus au guichet, sans HelloAsso.
  const pass3jPlace = await tarif('Pass 3 jours (sur place)', 50, 3, null, bracelet3j.id)
  const passJourPlace = await tarif('Pass journée (sur place)', 22, 4, null, braceletJour.id)

  const camping = await prisma.ticketingOption.create({
    data: {
      editionId,
      externalTicketingId: externe.id,
      helloAssoOptionId: '7001',
      name: 'Camping',
      type: 'CheckBox',
      price: euros(10),
      handoutItems: { create: { handoutItemId: braceletCamping.id } },
    },
  })
  for (const t of [pass3j, passEnfant, pass3jPlace]) {
    await prisma.ticketingTierOption.create({ data: { tierId: t.id, optionId: camping.id } })
  }

  const champTee = await prisma.ticketingTierCustomField.create({
    data: {
      editionId,
      externalTicketingId: externe.id,
      helloAssoCustomFieldId: 8001,
      label: 'Taille du tee-shirt',
      type: 'ChoiceList',
      values: ['Pas de tee-shirt', 'S', 'M', 'L', 'XL'],
    },
  })
  for (const choix of ['S', 'M', 'L', 'XL']) {
    await prisma.ticketingTierCustomFieldHandoutItem.create({
      data: { customFieldId: champTee.id, handoutItemId: teeShirt.id, choiceValue: choix },
    })
  }
  await prisma.ticketingTierCustomFieldAssociation.create({
    data: { tierId: pass3j.id, customFieldId: champTee.id },
  })

  // ── Bénévoles ─────────────────────────────────────────────────────────────
  const equipeAccueil = await prisma.volunteerTeam.create({
    data: {
      eventId: editionId,
      name: 'Accueil / Contrôle d’accès',
      color: '#3b82f6',
      isAccessControlTeam: true,
    },
  })
  const equipeBuvette = await prisma.volunteerTeam.create({
    data: { eventId: editionId, name: 'Buvette', color: '#f59e0b' },
  })
  const equipeMontage = await prisma.volunteerTeam.create({
    data: { eventId: editionId, name: 'Montage', color: '#10b981' },
  })
  await prisma.editionVolunteerHandoutItem.create({
    data: { editionId, handoutItemId: teeBenevole.id },
  })

  const candidature = async (userId: number, teamId: string, qui: string) => {
    const app = await prisma.editionVolunteerApplication.create({
      data: {
        eventId: editionId,
        userId,
        status: 'ACCEPTED',
        decidedAt: heures(-24 * 20),
        eventAvailability: true,
        setupAvailability: false,
        teardownAvailability: false,
        qrCodeToken: jeton(qui),
      },
    })
    await prisma.applicationTeamAssignment.create({ data: { applicationId: app.id, teamId } })
    return app
  }
  await candidature(leo.id, equipeAccueil.id, 'leo')
  const appInes = await candidature(ines.id, equipeBuvette.id, 'ines')
  const appMalik = await candidature(malik.id, equipeMontage.id, 'malik')

  // Le créneau de Léo couvre « maintenant » : c'est ce qui lui ouvre l'écran du contrôle d'accès.
  const debutCreneau = heures(-1)
  debutCreneau.setMinutes(0, 0, 0)
  const creneau = await prisma.volunteerTimeSlot.create({
    data: {
      eventId: editionId,
      teamId: equipeAccueil.id,
      title: 'Contrôle d’accès — entrée principale',
      startDateTime: debutCreneau,
      endDateTime: heures(12),
      maxVolunteers: 2,
    },
  })
  await prisma.volunteerAssignment.create({
    data: { timeSlotId: creneau.id, userId: leo.id, assignedById: orga.id },
  })

  // ── Artiste ───────────────────────────────────────────────────────────────
  const artisteZoe = await prisma.editionArtist.create({
    data: { editionId, userId: zoe.id, qrCodeToken: jeton('zoe') },
  })
  const cabaret = await prisma.show.create({
    data: { editionId, title: 'Cabaret du samedi soir', duration: 90 },
  })
  await prisma.showArtist.create({ data: { showId: cabaret.id, artistId: artisteZoe.id } })
  await prisma.editionArtistHandoutItem.create({
    data: { editionId, handoutItemId: passArtiste.id },
  })
  await prisma.editionOrganizerHandoutItem.create({
    data: { editionId, handoutItemId: badgeOrga.id },
  })

  // ── Commandes ─────────────────────────────────────────────────────────────
  let numeroHA = 880000 + (editionId % 1000) * 100
  let numeroItemHA = numeroHA * 10

  interface Billet {
    prenom: string
    nom: string
    tier: { id: number; name: string; price: number }
    qr: string
    camping?: boolean
    tee?: string
    etat?: 'Processed' | 'Pending' | 'Canceled'
    annuleIci?: boolean
    rembourse?: boolean
    valideIlYA?: number
  }

  const commande = async (opts: {
    helloAsso: boolean
    payeur: [string, string]
    status: 'Processed' | 'Onsite' | 'Pending' | 'Refunded'
    paymentMethod: 'card' | 'cash' | 'check' | null
    joursAvant: number
    billets: Billet[]
  }) => {
    const montant = opts.billets.reduce(
      (s, b) => s + b.tier.price + (b.camping ? camping.price! : 0),
      0
    )
    const email = (p: string, n: string) =>
      `${p}.${n}`
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z.]/g, '') + '@exemple.test'

    const order = await prisma.ticketingOrder.create({
      data: {
        editionId,
        ...(opts.helloAsso
          ? { externalTicketingId: externe.id, helloAssoOrderId: ++numeroHA }
          : {}),
        payerFirstName: opts.payeur[0],
        payerLastName: opts.payeur[1],
        payerEmail: email(opts.payeur[0], opts.payeur[1]),
        amount: montant,
        status: opts.status,
        paymentMethod: opts.paymentMethod,
        orderDate: heures(-24 * opts.joursAvant),
      },
    })

    for (const b of opts.billets) {
      const etat = b.etat ?? (opts.status === 'Pending' ? 'Pending' : 'Processed')
      const annule = etat === 'Canceled'
      const item = await prisma.ticketingOrderItem.create({
        data: {
          orderId: order.id,
          helloAssoItemId: opts.helloAsso ? ++numeroItemHA : null,
          tierId: b.tier.id,
          firstName: b.prenom,
          lastName: b.nom,
          email: email(b.prenom, b.nom),
          name: b.tier.name,
          type: 'Registration',
          amount: b.tier.price,
          state: etat,
          qrCode: b.qr,
          customFields: b.tee
            ? [{ id: 8001, name: 'Taille du tee-shirt', type: 'ChoiceList', answer: b.tee }]
            : undefined,
          ...(annule && b.annuleIci ? { canceledAt: heures(-24 * 2), canceledById: orga.id } : {}),
          ...(annule && !b.annuleIci ? { sourceCanceledAt: heures(-24 * 2) } : {}),
          ...(b.rembourse
            ? { refunded: true, refundedAt: heures(-24), refundedById: orga.id }
            : {}),
          ...(b.valideIlYA !== undefined
            ? {
                entryValidated: true,
                entryValidatedAt: heures(-b.valideIlYA),
                entryValidatedBy: leo.id,
              }
            : {}),
        },
      })
      if (b.camping) {
        await prisma.ticketingOrderItemOption.create({
          data: { orderItemId: item.id, optionId: camping.id, amount: camping.price! },
        })
      }
      if (b.valideIlYA !== undefined) {
        await prisma.entryValidationLog.create({
          data: {
            editionId,
            participantKind: 'TICKET',
            participantId: item.id,
            movement: 'VALIDATED',
            actorId: leo.id,
            createdAt: heures(-b.valideIlYA),
          },
        })
      }
    }
    return order
  }

  // 1. Cas nominal : un billet HelloAsso payé, avec camping et tee-shirt.
  await commande({
    helloAsso: true,
    payeur: ['Julie', 'Martin'],
    status: 'Processed',
    paymentMethod: 'card',
    joursAvant: 30,
    billets: [
      {
        prenom: 'Julie',
        nom: 'Martin',
        tier: pass3j,
        qr: 'TUTO-HA-JULIE',
        camping: true,
        tee: 'M',
      },
    ],
  })

  // 2. Homonyme, pour montrer qu'une recherche par nom peut rendre plusieurs personnes.
  await commande({
    helloAsso: true,
    payeur: ['Pierre', 'Martin'],
    status: 'Processed',
    paymentMethod: 'card',
    joursAvant: 12,
    billets: [{ prenom: 'Pierre', nom: 'Martin', tier: passSamedi, qr: 'TUTO-HA-PIERRE' }],
  })

  // 3. Commande familiale de trois billets : on choisit qui entre.
  await commande({
    helloAsso: true,
    payeur: ['Sophie', 'Bernard'],
    status: 'Processed',
    paymentMethod: 'card',
    joursAvant: 21,
    billets: [
      { prenom: 'Sophie', nom: 'Bernard', tier: pass3j, qr: 'TUTO-HA-SOPHIE', tee: 'S' },
      { prenom: 'Antoine', nom: 'Bernard', tier: pass3j, qr: 'TUTO-HA-ANTOINE', tee: 'L' },
      { prenom: 'Lou', nom: 'Bernard', tier: passEnfant, qr: 'TUTO-HA-LOU' },
    ],
  })

  // 4. Billet déjà validé (deuxième passage).
  await commande({
    helloAsso: true,
    payeur: ['Chloé', 'Moreau'],
    status: 'Processed',
    paymentMethod: 'card',
    joursAvant: 40,
    billets: [
      {
        prenom: 'Chloé',
        nom: 'Moreau',
        tier: pass3j,
        qr: 'TUTO-HA-CHLOE',
        tee: 'Pas de tee-shirt',
        valideIlYA: 2,
      },
    ],
  })

  // 5. Commande HelloAsso de trois billets, dont un annulé ici et pas encore remboursé.
  await commande({
    helloAsso: true,
    payeur: ['Thomas', 'Dupont'],
    status: 'Processed',
    paymentMethod: 'card',
    joursAvant: 25,
    billets: [
      { prenom: 'Thomas', nom: 'Dupont', tier: pass3j, qr: 'TUTO-HA-THOMAS', valideIlYA: 1 },
      { prenom: 'Sarah', nom: 'Dupont', tier: pass3j, qr: 'TUTO-HA-SARAH' },
      {
        prenom: 'Karim',
        nom: 'Dupont',
        tier: pass3j,
        qr: 'TUTO-HA-KARIM',
        etat: 'Canceled',
        annuleIci: true,
      },
    ],
  })

  // 6. Commande HelloAsso de deux billets, dont un annulé et déjà remboursé.
  await commande({
    helloAsso: true,
    payeur: ['Emma', 'Petit'],
    status: 'Processed',
    paymentMethod: 'card',
    joursAvant: 18,
    billets: [
      { prenom: 'Emma', nom: 'Petit', tier: passSamedi, qr: 'TUTO-HA-EMMA' },
      {
        prenom: 'Lucas',
        nom: 'Petit',
        tier: passSamedi,
        qr: 'TUTO-HA-LUCAS',
        etat: 'Canceled',
        annuleIci: true,
        rembourse: true,
      },
    ],
  })

  // 7. Vente sur place (hors HelloAsso) de deux billets, dont un annulé non remboursé.
  await commande({
    helloAsso: false,
    payeur: ['Nathalie', 'Roux'],
    status: 'Onsite',
    paymentMethod: 'cash',
    joursAvant: 1,
    billets: [
      { prenom: 'Nathalie', nom: 'Roux', tier: passJourPlace, qr: 'onsite-tuto-nathalie' },
      {
        prenom: 'Julien',
        nom: 'Roux',
        tier: passJourPlace,
        qr: 'onsite-tuto-julien',
        etat: 'Canceled',
        annuleIci: true,
      },
    ],
  })

  // 8. Commande sur place entièrement annulée, payée en espèces, pas encore remboursée.
  await commande({
    helloAsso: false,
    payeur: ['Marc', 'Lefebvre'],
    status: 'Refunded',
    paymentMethod: 'cash',
    joursAvant: 1,
    billets: [
      {
        prenom: 'Marc',
        nom: 'Lefebvre',
        tier: pass3jPlace,
        qr: 'onsite-tuto-marc',
        etat: 'Canceled',
        annuleIci: true,
      },
    ],
  })

  // 9. Participant inscrit sans paiement : on encaisse à l'entrée.
  await commande({
    helloAsso: false,
    payeur: ['Paul', 'Girard'],
    status: 'Pending',
    paymentMethod: null,
    joursAvant: 3,
    billets: [
      { prenom: 'Paul', nom: 'Girard', tier: pass3jPlace, qr: 'onsite-tuto-paul', camping: true },
    ],
  })

  // Un peu de volume pour que les statistiques ne soient pas vides.
  const figurants: Array<[string, string]> = [
    ['Alice', 'Lambert'],
    ['Bruno', 'Faure'],
    ['Clara', 'Rousseau'],
    ['David', 'Blanc'],
    ['Élise', 'Guerin'],
    ['Fabien', 'Muller'],
    ['Gaëlle', 'Henry'],
    ['Hélène', 'Perrin'],
    ['Ismaël', 'Morel'],
    ['Jeanne', 'Fournier'],
    ['Kevin', 'Girard'],
    ['Laura', 'Andre'],
  ]
  for (const [i, [p, n]] of figurants.entries()) {
    await commande({
      helloAsso: true,
      payeur: [p, n],
      status: 'Processed',
      paymentMethod: 'card',
      joursAvant: 10 + i,
      billets: [
        {
          prenom: p,
          nom: n,
          tier: i % 3 === 0 ? passSamedi : pass3j,
          qr: `TUTO-HA-FIG-${i + 1}`,
          camping: i % 2 === 0,
          valideIlYA: i < 7 ? 3 + i * 0.4 : undefined,
        },
      ],
    })
  }

  // Deux entrées déjà faites parmi les « autres populations ».
  await prisma.editionVolunteerApplication.update({
    where: { id: appMalik.id },
    data: { entryValidated: true, entryValidatedAt: heures(-5), entryValidatedBy: leo.id },
  })
  await prisma.entryValidationLog.create({
    data: {
      editionId,
      participantKind: 'VOLUNTEER',
      participantId: appMalik.id,
      movement: 'VALIDATED',
      actorId: leo.id,
      createdAt: heures(-5),
    },
  })
  await prisma.editionOrganizer.update({
    where: { id: edHugo.id },
    data: { entryValidated: true, entryValidatedAt: heures(-6), entryValidatedBy: leo.id },
  })
  await prisma.entryValidationLog.create({
    data: {
      editionId,
      participantKind: 'ORGANIZER',
      participantId: edHugo.id,
      movement: 'VALIDATED',
      actorId: leo.id,
      createdAt: heures(-6),
    },
  })

  // L'identifiant fait partie du code : il change à chaque exécution, le jeton non.
  const codes = {
    benevoleInes: `volunteer-${appInes.id}-${appInes.qrCodeToken}`,
    artisteZoe: `artist-${artisteZoe.id}-${artisteZoe.qrCodeToken}`,
  }

  console.log('\nConvention tutoriel prête.')
  console.log(JSON.stringify({ editionId, conventionId: convention.id, codes }, null, 2))
  console.log(`Comptes : <prénom>@${DOMAINE} / ${MOT_DE_PASSE}`)
  console.log(
    '  camille = organisatrice (tous droits), leo = bénévole en créneau de contrôle d’accès'
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
