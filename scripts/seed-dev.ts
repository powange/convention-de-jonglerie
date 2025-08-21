#!/usr/bin/env tsx
import bcrypt from 'bcryptjs'
import { prisma } from '../server/utils/prisma'

async function main() {
  console.log('Démarrage du seed dev...')

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

  // Définitions de conventions à insérer
  const conventions = [
    { name: 'Convention Nationale de Jonglerie', description: 'Rassemblement national des jongleurs.' },
    { name: 'Festival Jongle & Cirque', description: 'Festival convivial avec scènes et ateliers.' },
    { name: 'Convention Régionale de Jonglerie', description: 'Edition régionale, ambiance locale.' },
  ]

  for (const convDef of conventions) {
    let conv = await prisma.convention.findFirst({ where: { name: convDef.name } })
    if (!conv) {
      conv = await prisma.convention.create({
        data: {
          name: convDef.name,
          description: convDef.description,
          authorId: user.id,
        },
      })
      console.log(`Convention créée: ${conv.name} (id=${conv.id})`)
    } else {
      console.log(`Convention existante: ${conv.name} (id=${conv.id})`)
    }

    // Créer 2 éditions par convention si elles n'existent pas
    for (let i = 1; i <= 2; i++) {
      const editionName = `${conv.name} — Édition ${i}`
      let edition = await prisma.edition.findFirst({ where: { name: editionName, conventionId: conv.id } })
      if (!edition) {
        const startDate = new Date()
        startDate.setMonth(startDate.getMonth() + (i * 2))
        const endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 3)

        edition = await prisma.edition.create({
          data: {
            name: editionName,
            description: `${conv.name} — édition ${i}`,
            creatorId: user.id,
            conventionId: conv.id,
            startDate,
            endDate,
            addressLine1: '1 Place du Chapiteau',
            city: 'Ville',
            country: 'France',
            postalCode: '00000',
          },
        })
        console.log(`Edition créée: ${edition.name} (id=${edition.id})`)
      } else {
        console.log(`Edition existante: ${edition.name} (id=${edition.id})`)
      }
    }
  }

  console.log('Seed dev terminé.')
}

main()
  .catch((e) => {
    console.error('Erreur lors du seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
