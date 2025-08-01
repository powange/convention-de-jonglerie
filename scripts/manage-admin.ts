import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function manageAdmin() {
  const args = process.argv.slice(2)
  
  if (args.length !== 2) {
    console.log(`
🔧 Script de gestion des super administrateurs

Usage:
  npm run admin:add <email>     - Promouvoir un utilisateur en super admin
  npm run admin:remove <email>  - Rétrograder un super admin en utilisateur normal
  npm run admin:list           - Lister tous les super administrateurs

Exemples:
  npm run admin:add admin@example.com
  npm run admin:remove old-admin@example.com
  npm run admin:list
`)
    process.exit(1)
  }

  const [action, email] = args

  try {
    switch (action) {
      case 'add':
        await addAdmin(email)
        break
      case 'remove':
        await removeAdmin(email)
        break
      case 'list':
        await listAdmins()
        break
      default:
        console.error('❌ Action non reconnue. Utilisez "add", "remove" ou "list"')
        process.exit(1)
    }
  } catch (error) {
    console.error('❌ Erreur:', error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function addAdmin(email: string) {
  console.log(`🔍 Recherche de l'utilisateur avec l'email: ${email}`)
  
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      pseudo: true,
      nom: true,
      prenom: true,
      isGlobalAdmin: true
    }
  })

  if (!user) {
    console.error(`❌ Aucun utilisateur trouvé avec l'email: ${email}`)
    process.exit(1)
  }

  if (user.isGlobalAdmin) {
    console.log(`ℹ️  L'utilisateur ${user.pseudo} (${user.email}) est déjà super administrateur`)
    return
  }

  await prisma.user.update({
    where: { email },
    data: { isGlobalAdmin: true }
  })

  console.log(`✅ L'utilisateur ${user.pseudo} (${user.nom} ${user.prenom}) a été promu super administrateur`)
}

async function removeAdmin(email: string) {
  console.log(`🔍 Recherche de l'utilisateur avec l'email: ${email}`)
  
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      pseudo: true,
      nom: true,
      prenom: true,
      isGlobalAdmin: true
    }
  })

  if (!user) {
    console.error(`❌ Aucun utilisateur trouvé avec l'email: ${email}`)
    process.exit(1)
  }

  if (!user.isGlobalAdmin) {
    console.log(`ℹ️  L'utilisateur ${user.pseudo} (${user.email}) n'est pas super administrateur`)
    return
  }

  // Note: Pas de vérification du nombre d'admins restants car le script 
  // peut toujours être utilisé pour en rajouter même s'il n'y en a plus

  await prisma.user.update({
    where: { email },
    data: { isGlobalAdmin: false }
  })

  console.log(`✅ L'utilisateur ${user.pseudo} (${user.nom} ${user.prenom}) a été rétrogradé en utilisateur normal`)
}

async function listAdmins() {
  console.log('🔍 Liste des super administrateurs:')
  
  const admins = await prisma.user.findMany({
    where: { isGlobalAdmin: true },
    select: {
      id: true,
      email: true,
      pseudo: true,
      nom: true,
      prenom: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  })

  if (admins.length === 0) {
    console.log('❌ Aucun super administrateur trouvé')
    return
  }

  console.log(`\n📋 ${admins.length} super administrateur(s) trouvé(s):\n`)
  
  admins.forEach((admin, index) => {
    console.log(`${index + 1}. ${admin.pseudo} (${admin.nom} ${admin.prenom})`)
    console.log(`   📧 Email: ${admin.email}`)
    console.log(`   📅 Inscrit le: ${admin.createdAt.toLocaleDateString('fr-FR')}`)
    console.log('')
  })
}

// Gestion spéciale pour la commande list sans email
if (process.argv.includes('list')) {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === 'list') {
    listAdmins()
      .catch(error => {
        console.error('❌ Erreur:', error instanceof Error ? error.message : error)
        process.exit(1)
      })
      .finally(() => prisma.$disconnect())
  }
} else {
  manageAdmin()
}