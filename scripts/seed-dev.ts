#!/usr/bin/env tsx
import { spawn } from 'node:child_process'

import bcrypt from 'bcryptjs'
import { config } from 'dotenv'

import { prisma } from '../server/utils/prisma'

config()

// Fonction utilitaire pour générer des dates aléatoires
function getRandomDate(daysFromNow: number, variationDays: number): Date {
  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() + daysFromNow)
  const variation = Math.floor(Math.random() * variationDays * 2) - variationDays
  baseDate.setDate(baseDate.getDate() + variation)
  return baseDate
}

// Fonction utilitaire pour générer du contenu aléatoire
function getRandomComment(): string {
  const comments = [
    "Super événement ! J'ai hâte d'y être 🤹‍♂️",
    "Quelqu'un sait s'il y aura des ateliers de diabolo ?",
    "C'était génial l'année dernière, je recommande !",
    'Des infos sur le camping ?',
    'Première fois que je viens, des conseils ?',
    "L'ambiance est toujours au top dans cette convention !",
    "J'espère qu'il y aura de la bonne musique cette année",
    'Qui amène des massues à échanger ?',
    'Les enfants sont-ils les bienvenus ?',
    'Y a-t-il des spectacles prévus le soir ?',
  ]
  return comments[Math.floor(Math.random() * comments.length)]
}

async function main() {
  console.log('Démarrage du seed dev...')

  const args = process.argv.slice(2)
  const doReset = args.includes('--reset') || args.includes('--clear')
  if (doReset) {
    console.log('⚠️  Option --reset: exécution de prisma migrate reset (DEV uniquement).')
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        'npx',
        ['prisma', 'migrate', 'reset', '--force', '--skip-generate', '--skip-seed'],
        {
          stdio: 'inherit',
          env: process.env,
        }
      )
      proc.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`prisma migrate reset exited with code ${code}`))
      })
      proc.on('error', reject)
    })
    console.log('✅ Reset Prisma terminé, insertion des données de seed...')
  }

  // Créer / récupérer un user seed qui sera auteur des conventions/éditions
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'seed-admin@example.com'
  const adminPseudo = process.env.SEED_ADMIN_PSEUDO || 'seedadmin'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'devpass'

  const passwordHash = await bcrypt.hash(adminPassword, 10)

  let user = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: adminEmail,
        pseudo: adminPseudo,
        nom: 'Seed',
        prenom: 'Admin',
        password: passwordHash,
        isEmailVerified: true,
      },
    })
    console.log(`User créé: ${user.email} (id=${user.id})`)
  } else {
    console.log(`User existant: ${user.email} (id=${user.id})`)
  }

  // Créer un superadmin
  const superAdminEmail = 'powange@gmail.com'
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'superadmin123'

  let superAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } })
  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        pseudo: 'SuperAdmin',
        nom: 'Powange',
        prenom: 'Admin',
        password: await bcrypt.hash(superAdminPassword, 10),
        isEmailVerified: true,
        isGlobalAdmin: true,
      },
    })
    console.log(`SuperAdmin créé: ${superAdmin.email} (id=${superAdmin.id})`)
  } else {
    console.log(`SuperAdmin existant: ${superAdmin.email} (id=${superAdmin.id})`)
  }

  // Créer un utilisateur powange non-admin
  const powangeUserEmail = 'powange@hotmail.com'
  const powangeUserPassword = process.env.POWANGE_PASSWORD || 'powange123'

  let powangeUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: powangeUserEmail }, { pseudo: 'PowangeUser' }],
    },
  })
  if (!powangeUser) {
    powangeUser = await prisma.user.create({
      data: {
        email: powangeUserEmail,
        pseudo: 'PowangeUser',
        nom: 'Comble',
        prenom: 'Pierre',
        password: await bcrypt.hash(powangeUserPassword, 10),
        isEmailVerified: true,
        isGlobalAdmin: false,
      },
    })
    console.log(`Utilisateur Powange créé: ${powangeUser.email} (id=${powangeUser.id})`)
  } else {
    console.log(`Utilisateur Powange existant: ${powangeUser.email} (id=${powangeUser.id})`)
  }

  // Créer des utilisateurs de test
  const testUsers = [
    { email: 'alice.jongleuse@example.com', pseudo: 'AliceJongle', nom: 'Dubois', prenom: 'Alice' },
    { email: 'bob.cirque@example.com', pseudo: 'BobCircus', nom: 'Martin', prenom: 'Bob' },
    {
      email: 'charlie.diabolo@example.com',
      pseudo: 'CharlieDiab',
      nom: 'Rousseau',
      prenom: 'Charlie',
    },
    { email: 'diana.massues@example.com', pseudo: 'DianaMassues', nom: 'Lefevre', prenom: 'Diana' },
    { email: 'eve.contact@example.com', pseudo: 'EveContact', nom: 'Moreau', prenom: 'Eve' },
  ]

  // Créer des utilisateurs spécialement pour les candidatures de bénévolat
  const volunteerUsers = [
    {
      email: 'marie.benevole@example.com',
      pseudo: 'MarieVolunteer',
      nom: 'Dupont',
      prenom: 'Marie',
    },
    { email: 'paul.aidant@example.com', pseudo: 'PaulHelper', nom: 'Lemoine', prenom: 'Paul' },
    {
      email: 'sophie.entraide@example.com',
      pseudo: 'SophieSupport',
      nom: 'Bernard',
      prenom: 'Sophie',
    },
    { email: 'lucas.engagement@example.com', pseudo: 'LucasCommit', nom: 'Petit', prenom: 'Lucas' },
    { email: 'emma.solidaire@example.com', pseudo: 'EmmaSolid', nom: 'Roux', prenom: 'Emma' },
    { email: 'thomas.devoue@example.com', pseudo: 'ThomasDevoted', nom: 'Blanc', prenom: 'Thomas' },
    { email: 'chloe.investie@example.com', pseudo: 'ChloeInvested', nom: 'Lopez', prenom: 'Chloé' },
    { email: 'alex.motive@example.com', pseudo: 'AlexMotiv', nom: 'Garcia', prenom: 'Alex' },
  ]

  const createdUsers = [user, superAdmin, powangeUser] // Inclure l'admin, le superadmin et powange

  for (const userData of testUsers) {
    let testUser = await prisma.user.findUnique({ where: { email: userData.email } })
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          ...userData,
          password: await bcrypt.hash('testpass', 10),
          isEmailVerified: true,
        },
      })
      console.log(`Utilisateur de test créé: ${testUser.email} (id=${testUser.id})`)
    } else {
      console.log(`Utilisateur de test existant: ${testUser.email} (id=${testUser.id})`)
    }
    createdUsers.push(testUser)
  }

  // Créer les utilisateurs bénévoles
  for (const volunteerData of volunteerUsers) {
    let volunteerUser = await prisma.user.findUnique({ where: { email: volunteerData.email } })
    if (!volunteerUser) {
      volunteerUser = await prisma.user.create({
        data: {
          ...volunteerData,
          password: await bcrypt.hash('volunteer123', 10),
          isEmailVerified: true,
        },
      })
      console.log(`Utilisateur bénévole créé: ${volunteerUser.email} (id=${volunteerUser.id})`)
    } else {
      console.log(`Utilisateur bénévole existant: ${volunteerUser.email} (id=${volunteerUser.id})`)
    }
    createdUsers.push(volunteerUser)
  }

  // Définitions de conventions à insérer
  const conventions = [
    {
      name: 'Convention Nationale de Jonglerie',
      description: 'Rassemblement national des jongleurs.',
      authorId: user.id,
    },
    {
      name: 'Festival Jongle & Cirque',
      description: 'Festival convivial avec scènes et ateliers.',
      authorId: superAdmin.id,
    },
    {
      name: 'Convention Régionale de Jonglerie',
      description: 'Edition régionale, ambiance locale.',
      authorId: user.id,
    },
    {
      name: 'Festival International du Cirque',
      description: 'Grand rendez-vous des artistes du monde entier.',
      authorId: superAdmin.id,
    },
  ]

  const createdEditions: any[] = []

  for (const convDef of conventions) {
    let conv = await prisma.convention.findFirst({ where: { name: convDef.name } })
    if (!conv) {
      conv = await prisma.convention.create({
        data: {
          name: convDef.name,
          description: convDef.description,
          authorId: convDef.authorId,
        },
      })
      console.log(`Convention créée: ${conv.name} (id=${conv.id})`)

      // Ajouter automatiquement l'auteur comme collaborateur ADMINISTRATOR
      await prisma.conventionCollaborator.create({
        data: {
          conventionId: conv.id,
          userId: convDef.authorId,
          addedById: convDef.authorId,
          title: 'Organisateur',
          canEditConvention: true,
          canDeleteConvention: true,
          canManageCollaborators: true,
          canAddEdition: true,
          canEditAllEditions: true,
          canDeleteAllEditions: true,
        },
      })
      console.log(`  → Auteur ajouté comme collaborateur ADMINISTRATOR`)
    } else {
      console.log(`Convention existante: ${conv.name} (id=${conv.id})`)

      // Vérifier si l'auteur est déjà collaborateur, sinon l'ajouter
      const existingCollab = await prisma.conventionCollaborator.findFirst({
        where: {
          conventionId: conv.id,
          userId: conv.authorId,
        },
      })

      if (!existingCollab) {
        await prisma.conventionCollaborator.create({
          data: {
            conventionId: conv.id,
            userId: conv.authorId,
            addedById: conv.authorId,
            title: 'Organisateur',
            canEditConvention: true,
            canDeleteConvention: true,
            canManageCollaborators: true,
            canAddEdition: true,
            canEditAllEditions: true,
            canDeleteAllEditions: true,
          },
        })
        console.log(`  → Auteur ajouté comme collaborateur ADMINISTRATOR`)
      }
    }

    // Ajouter des collaborateurs supplémentaires pour certaines conventions
    // Pour rendre la base de données plus réaliste
    if (Math.random() > 0.5) {
      const numCollaborators = Math.floor(Math.random() * 3) + 1 // 1-3 collaborateurs
      const availableUsers = createdUsers.filter((u) => u.id !== conv.authorId)

      for (let j = 0; j < Math.min(numCollaborators, availableUsers.length); j++) {
        const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)]

        // Vérifier si cet utilisateur n'est pas déjà collaborateur
        const existingCollab = await prisma.conventionCollaborator.findFirst({
          where: {
            conventionId: conv.id,
            userId: randomUser.id,
          },
        })

        if (!existingCollab) {
          const role = Math.random() > 0.6 ? 'ADMINISTRATOR' : 'MODERATOR'
          await prisma.conventionCollaborator.create({
            data: {
              conventionId: conv.id,
              userId: randomUser.id,
              addedById: conv.authorId,
              title: role === 'ADMINISTRATOR' ? 'Co-organisateur' : undefined,
              // Mapping rôle -> nouveaux droits
              // NOTE: legacy mapping basé sur role (ADMINISTRATOR/MODERATOR) conservé uniquement pour seed local.
              canEditConvention: role === 'ADMINISTRATOR',
              canDeleteConvention: role === 'ADMINISTRATOR',
              canManageCollaborators: role === 'ADMINISTRATOR',
              canAddEdition: true, // MODERATOR et ADMIN peuvent ajouter
              canEditAllEditions: true, // les deux peuvent éditer toutes les éditions
              canDeleteAllEditions: true, // per spec: MODERATOR => canDeleteAllEditions true
            },
          })
          console.log(`  → Collaborateur ajouté: ${randomUser.pseudo} (${role})`)
        }
      }
    }

    // Créer 4 éditions par convention avec des dates variées (passées, présentes, futures)
    const cities = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Nantes', 'Strasbourg']

    for (let i = 1; i <= 4; i++) {
      const editionName = `${conv.name} — Édition ${i}`
      let edition = await prisma.edition.findFirst({
        where: { name: editionName, conventionId: conv.id },
      })
      if (!edition) {
        let startDate: Date

        // Répartir les éditions : passées, en cours, futures proches
        if (i === 1) {
          // Édition passée récente (il y a 2-8 semaines)
          startDate = getRandomDate(-35, 20) // Entre -55 et -15 jours
        } else if (i === 2) {
          // Édition en cours ou très récente (il y a 1 semaine à dans 1 semaine)
          startDate = getRandomDate(-3, 10) // Entre -13 et 7 jours
        } else if (i === 3) {
          // Édition future proche (dans 2-6 semaines)
          startDate = getRandomDate(21, 14) // Entre 7 et 35 jours
        } else {
          // Édition future (dans 2-4 mois)
          startDate = getRandomDate(75, 30) // Entre 45 et 105 jours
        }

        const endDate = new Date(startDate)
        // Éditions de 3 à 6 jours (typique pour les conventions de jonglerie)
        endDate.setDate(startDate.getDate() + Math.floor(Math.random() * 4) + 3) // 3-6 jours

        const randomCity = cities[Math.floor(Math.random() * cities.length)]

        edition = await prisma.edition.create({
          data: {
            name: editionName,
            description: `${conv.name} — édition ${i}`,
            creatorId: conv.authorId,
            conventionId: conv.id,
            startDate,
            endDate,
            addressLine1: `${Math.floor(Math.random() * 100) + 1} Rue de la Jonglerie`,
            city: randomCity,
            country: 'France',
            postalCode: `${Math.floor(Math.random() * 90000) + 10000}`,
            hasWorkshops: Math.random() > 0.3,
            hasConcert: Math.random() > 0.5,
            hasTentCamping: Math.random() > 0.4,
            hasShowers: Math.random() > 0.2,
            hasToilets: Math.random() > 0.1,
            hasCantine: Math.random() > 0.6,
            isOnline: true,
          },
        })
        console.log(
          `Edition créée: ${edition.name} (id=${edition.id}, ${startDate.toLocaleDateString()})`
        )
        createdEditions.push(edition)
      } else {
        console.log(`Edition existante: ${edition.name} (id=${edition.id})`)
        createdEditions.push(edition)
      }
    }

    // Exemple: ajouter quelques permissions spécifiques par édition pour le premier collaborateur non-auteur si présent
    const extraCollaborators = await prisma.conventionCollaborator.findMany({
      where: { conventionId: conv.id, userId: { not: conv.authorId } },
      take: 1,
      orderBy: { addedAt: 'asc' },
    })
    if (extraCollaborators.length && createdEditions.length) {
      const targetCollab = extraCollaborators[0]
      // Sélectionner 1 à 2 éditions pour des droits spécifiques si pas déjà globalement admin
      const editionSample = createdEditions.filter((e) => e.conventionId === conv.id).slice(0, 2)
      for (const ed of editionSample) {
        await prisma.editionCollaboratorPermission.upsert({
          where: {
            collaboratorId_editionId: { collaboratorId: targetCollab.id, editionId: ed.id },
          },
          create: {
            collaboratorId: targetCollab.id,
            editionId: ed.id,
            canEdit: true,
            canDelete: false,
          },
          update: {},
        })
      }
    }
  }

  // Ajouter des posts (commentaires) sur les éditions
  console.log('Ajout des posts sur les éditions...')
  for (const edition of createdEditions) {
    const numPosts = Math.floor(Math.random() * 5) + 1 // 1-5 posts par édition

    for (let i = 0; i < numPosts; i++) {
      const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)]

      const existingPost = await prisma.editionPost.findFirst({
        where: {
          editionId: edition.id,
          userId: randomUser.id,
        },
      })

      if (!existingPost) {
        const post = await prisma.editionPost.create({
          data: {
            editionId: edition.id,
            userId: randomUser.id,
            content: getRandomComment(),
          },
        })

        // Ajouter parfois des commentaires sur les posts
        if (Math.random() > 0.6) {
          const numComments = Math.floor(Math.random() * 3) + 1
          for (let j = 0; j < numComments; j++) {
            const commentUser = createdUsers[Math.floor(Math.random() * createdUsers.length)]
            await prisma.editionPostComment.create({
              data: {
                editionPostId: post.id,
                userId: commentUser.id,
                content: getRandomComment(),
              },
            })
          }
        }
      }
    }
  }

  // Ajouter des propositions de covoiturage
  console.log('Ajout des propositions de covoiturage...')
  const departureCities = [
    'Paris',
    'Lyon',
    'Marseille',
    'Toulouse',
    'Bordeaux',
    'Lille',
    'Nice',
    'Nantes',
  ]

  for (const edition of createdEditions) {
    const numOffers = Math.floor(Math.random() * 4) + 1 // 1-4 offres par édition

    for (let i = 0; i < numOffers; i++) {
      // S'assurer que le superadmin crée au moins une offre par édition (la première)
      const randomUser =
        i === 0 ? superAdmin : createdUsers[Math.floor(Math.random() * createdUsers.length)]
      const locationCity = departureCities[Math.floor(Math.random() * departureCities.length)]

      // Date de départ 1-2 jours avant le début de l'édition
      const tripDate = new Date(edition.startDate)
      tripDate.setDate(tripDate.getDate() - Math.floor(Math.random() * 2) - 1)

      const offer = await prisma.carpoolOffer.create({
        data: {
          userId: randomUser.id,
          editionId: edition.id,
          tripDate,
          locationCity,
          locationAddress: `${Math.floor(Math.random() * 100) + 1} Avenue de la Gare, ${locationCity}`,
          availableSeats: Math.floor(Math.random() * 4) + 1, // 1-4 places
          description: `Covoiturage au départ de ${locationCity}. Ambiance conviviale garantie ! Place pour matériel de jonglerie.`,
          phoneNumber: `06${Math.floor(Math.random() * 90000000) + 10000000}`,
        },
      })

      // Ajouter des commentaires sur certaines offres de covoiturage
      if (Math.random() > 0.5) {
        const numComments = Math.floor(Math.random() * 3) + 1
        for (let j = 0; j < numComments; j++) {
          const commentUser = createdUsers[Math.floor(Math.random() * createdUsers.length)]
          if (commentUser.id !== randomUser.id) {
            // Pas de commentaire de l'auteur sur sa propre offre
            await prisma.carpoolComment.create({
              data: {
                carpoolOfferId: offer.id,
                userId: commentUser.id,
                content: [
                  'Est-ce que tu peux passer par Orléans ?',
                  'Super ! Je suis intéressé(e)',
                  'À quelle heure exactement ?',
                  'Y a-t-il de la place pour mes massues ?',
                  'Merci pour la proposition !',
                  'Possible de faire un détour ?',
                  "Je peux participer aux frais d'essence",
                ][Math.floor(Math.random() * 7)],
              },
            })
          }
        }
      }
    }

    // Ajouter aussi quelques demandes de covoiturage
    const numRequests = Math.floor(Math.random() * 3) + 1 // 1-3 demandes par édition

    for (let i = 0; i < numRequests; i++) {
      // Le superadmin crée parfois des demandes aussi (30% de chance)
      const randomUser =
        Math.random() < 0.3
          ? superAdmin
          : createdUsers[Math.floor(Math.random() * createdUsers.length)]
      const locationCity = departureCities[Math.floor(Math.random() * departureCities.length)]

      const tripDate = new Date(edition.startDate)
      tripDate.setDate(tripDate.getDate() - Math.floor(Math.random() * 2) - 1)

      const request = await prisma.carpoolRequest.create({
        data: {
          userId: randomUser.id,
          editionId: edition.id,
          tripDate,
          locationCity,
          seatsNeeded: Math.floor(Math.random() * 2) + 1, // 1-2 places
          description: `Recherche covoiturage depuis ${locationCity}. Flexible sur l'horaire !`,
          phoneNumber:
            Math.random() > 0.5 ? `06${Math.floor(Math.random() * 90000000) + 10000000}` : null,
        },
      })

      // Commentaires sur les demandes
      if (Math.random() > 0.6) {
        const commentUser = createdUsers[Math.floor(Math.random() * createdUsers.length)]
        if (commentUser.id !== randomUser.id) {
          await prisma.carpoolRequestComment.create({
            data: {
              carpoolRequestId: request.id,
              userId: commentUser.id,
              content: [
                "Je peux peut-être t'emmener !",
                'Regarde mon offre, ça pourrait coller',
                "Tu as trouvé quelqu'un ?",
                'Je cherche aussi depuis cette ville',
              ][Math.floor(Math.random() * 4)],
            },
          })
        }
      }
    }
  }

  // Configurer les appels à bénévoles sur certaines éditions et créer des candidatures
  console.log('Configuration des appels à bénévoles...')
  let volunteerApplicationsCount = 0
  let volunteerSettingsCount = 0

  for (const edition of createdEditions) {
    // Configurer un appel à bénévoles sur environ 60% des éditions
    if (Math.random() > 0.4) {
      const setupStartDate = new Date(edition.startDate)
      setupStartDate.setDate(setupStartDate.getDate() - Math.floor(Math.random() * 3) - 1) // 1-3 jours avant

      const teardownEndDate = new Date(edition.endDate)
      teardownEndDate.setDate(teardownEndDate.getDate() + Math.floor(Math.random() * 2) + 1) // 1-2 jours après

      // Configurer les paramètres de bénévolat de l'édition
      await prisma.edition.update({
        where: { id: edition.id },
        data: {
          volunteersOpen: true,
          volunteersDescription: `Rejoins l'équipe bénévole de ${edition.name} ! Nous recherchons des personnes motivées pour nous aider dans l'organisation de cet événement incroyable. Différentes missions sont disponibles : accueil, logistique, technique, restauration...`,
          volunteersMode: 'INTERNAL',
          volunteersSetupStartDate: setupStartDate,
          volunteersTeardownEndDate: teardownEndDate,
          volunteersAskDiet: true,
          volunteersAskAllergies: true,
          volunteersAskTimePreferences: Math.random() > 0.5,
          volunteersAskTeamPreferences: Math.random() > 0.3,
          volunteersAskPets: Math.random() > 0.7,
          volunteersAskMinors: Math.random() > 0.6,
          volunteersAskVehicle: Math.random() > 0.4,
          volunteersAskCompanion: Math.random() > 0.5,
          volunteersAskAvoidList: Math.random() > 0.8,
          volunteersAskSkills: true,
          volunteersAskExperience: true,
          volunteersAskSetup: true,
          volunteersAskTeardown: true,
        },
      })
      volunteerSettingsCount++

      // Créer des équipes bénévoles si demandées
      const teams: { name: string; slots: number }[] = []
      if (Math.random() > 0.5) {
        const teamNames = [
          'Accueil',
          'Logistique',
          'Technique',
          'Restauration',
          'Animation',
          'Sécurité',
        ]
        const numTeams = Math.floor(Math.random() * 4) + 2 // 2-5 équipes
        for (let i = 0; i < numTeams; i++) {
          const teamName = teamNames[Math.floor(Math.random() * teamNames.length)]
          if (!teams.find((t) => t.name === teamName)) {
            teams.push({
              name: teamName,
              slots: Math.floor(Math.random() * 8) + 3, // 3-10 places par équipe
            })
          }
        }

        await prisma.edition.update({
          where: { id: edition.id },
          data: {
            volunteersTeams: teams,
          },
        })
      }

      // Créer des candidatures de bénévoles
      const numApplications = Math.floor(Math.random() * 6) + 3 // 3-8 candidatures par édition
      const shuffledVolunteers = [...volunteerUsers, ...testUsers].sort(() => Math.random() - 0.5)

      for (let i = 0; i < Math.min(numApplications, shuffledVolunteers.length); i++) {
        const volunteer = createdUsers.find((u) => u.email === shuffledVolunteers[i].email)
        if (!volunteer) continue

        // Vérifier qu'il n'y a pas déjà une candidature
        const existingApplication = await prisma.editionVolunteerApplication.findFirst({
          where: {
            editionId: edition.id,
            userId: volunteer.id,
          },
        })

        if (existingApplication) continue

        // Dates d'arrivée et départ réalistes
        const arrivalOptions = ['morning', 'noon', 'afternoon', 'evening']
        const departureOptions = ['morning', 'noon', 'afternoon', 'evening']

        const arrivalDate = new Date(Math.random() > 0.3 ? edition.startDate : setupStartDate)
        const departureDate = new Date(Math.random() > 0.3 ? edition.endDate : teardownEndDate)

        const arrivalDateTime = `${arrivalDate.toISOString().split('T')[0]}_${arrivalOptions[Math.floor(Math.random() * arrivalOptions.length)]}`
        const departureDateTime = `${departureDate.toISOString().split('T')[0]}_${departureOptions[Math.floor(Math.random() * departureOptions.length)]}`

        // Préférences alimentaires réalistes
        const dietaryOptions = ['NONE', 'VEGETARIAN', 'VEGAN']
        const dietaryWeights = [0.7, 0.2, 0.1] // 70% aucun, 20% végétarien, 10% vegan
        let dietaryPreference = 'NONE'
        const rand = Math.random()
        if (rand < dietaryWeights[2]) dietaryPreference = 'VEGAN'
        else if (rand < dietaryWeights[1] + dietaryWeights[2]) dietaryPreference = 'VEGETARIAN'

        // Disponibilités setup/teardown
        const setupAvailability = Math.random() > 0.4 ? true : null
        const teardownAvailability = Math.random() > 0.5 ? true : null

        const hasExperience = Math.random() > 0.4

        // Générer des préférences horaires aléatoires
        const timeSlots = [
          'early_morning',
          'morning',
          'lunch',
          'early_afternoon',
          'late_afternoon',
          'evening',
          'late_evening',
          'night',
        ]

        let timePreferencesArray: string[] | undefined = undefined
        if (Math.random() > 0.4) {
          // 60% ont des préférences horaires
          const numPreferences = Math.floor(Math.random() * 4) + 1 // 1-4 créneaux
          const shuffledSlots = [...timeSlots].sort(() => Math.random() - 0.5)
          timePreferencesArray = shuffledSlots.slice(0, numPreferences)
        }

        const application = await prisma.editionVolunteerApplication.create({
          data: {
            editionId: edition.id,
            userId: volunteer.id,
            status:
              Math.random() > 0.15 ? 'ACCEPTED' : Math.random() > 0.5 ? 'PENDING' : 'REJECTED', // 85% acceptées
            arrivalDateTime,
            departureDateTime,
            dietaryPreference: dietaryPreference as any,
            allergies:
              Math.random() > 0.8
                ? ['Arachides', 'Gluten', 'Lactose', 'Fruits à coque'][
                    Math.floor(Math.random() * 4)
                  ]
                : null,
            timePreferences: timePreferencesArray || undefined,
            teamPreferences:
              teams.length > 0 && Math.random() > 0.6
                ? [
                    teams[Math.floor(Math.random() * teams.length)].name,
                    ...(Math.random() > 0.5 && teams.length > 1
                      ? [teams[Math.floor(Math.random() * teams.length)].name]
                      : []),
                  ].filter((value, index, self) => self.indexOf(value) === index) // Enlever les doublons
                : undefined,
            hasPets: Math.random() > 0.8 ? true : null,
            petsDetails: Math.random() > 0.8 && Math.random() > 0.5 ? 'Un chat très calme' : null,
            hasMinors: Math.random() > 0.9 ? true : null,
            minorsDetails: Math.random() > 0.9 && Math.random() > 0.5 ? 'Un enfant de 8 ans' : null,
            hasVehicle: Math.random() > 0.6 ? true : null,
            vehicleDetails: Math.random() > 0.6 && Math.random() > 0.5 ? 'Voiture 5 places' : null,
            companionName:
              Math.random() > 0.8
                ? ['Alex Martin', 'Sarah Durand', 'Tom Berger'][Math.floor(Math.random() * 3)]
                : null,
            avoidList: Math.random() > 0.9 ? 'Préfère éviter les tâches en hauteur' : null,
            skills: [
              'Expérience en événementiel',
              'Permis poids lourd',
              'Connaissance technique son/lumière',
              'Animation jeunesse',
              'Premiers secours',
              'Cuisine collective',
            ][Math.floor(Math.random() * 6)],
            hasExperience,
            experienceDetails: hasExperience ? 'Déjà bénévole sur plusieurs conventions' : null,
            setupAvailability,
            teardownAvailability,
            eventAvailability:
              !setupAvailability && !teardownAvailability
                ? true
                : Math.random() > 0.3
                  ? true
                  : null,
            motivation: [
              'Envie de contribuer à la réussite de cet événement !',
              'Passionné de jonglerie et désir de donner de mon temps',
              'Expérience enrichissante et rencontres garanties',
              "Plaisir de participer à l'organisation d'une belle convention",
            ][Math.floor(Math.random() * 4)],
          },
        })
        volunteerApplicationsCount++
      }
    }
  }

  console.log('Seed dev terminé avec succès !')
  if (doReset) console.log('(Reset préalable exécuté)')
  console.log(
    `- ${createdUsers.length} utilisateurs créés/vérifiés (dont 1 superadmin et ${volunteerUsers.length} bénévoles)`
  )
  console.log(`- ${conventions.length} conventions créées/vérifiées`)
  console.log(`- ${createdEditions.length} éditions créées avec dates variées`)
  console.log('- Posts et commentaires ajoutés sur les éditions')
  console.log('- Propositions de covoiturage et commentaires ajoutés')
  console.log(`- ${volunteerSettingsCount} éditions configurées avec appels à bénévoles`)
  console.log(`- ${volunteerApplicationsCount} candidatures de bénévolat créées (85% acceptées)`)
}

main()
  .catch((e) => {
    console.error('Erreur lors du seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
