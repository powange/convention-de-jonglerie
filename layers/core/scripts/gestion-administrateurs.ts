/**
 * Gestion des super administrateurs en ligne de commande — commune à app1 et Flowvent (app2).
 *
 *   npm run admin:add <email>     promouvoir un compte
 *   npm run admin:remove <email>  rétrograder un compte
 *   npm run admin:list            lister les administrateurs
 *
 * Chaque app garde un court point d'entrée (`scripts/manage-admin.ts`) qui crée SON client Prisma
 * (chaque app a le sien, généré depuis son schéma) et dit ce qu'une promotion écrit en base : app1
 * date la promotion (`promotedAdminAt`), Flowvent n'a que le drapeau. Ce module ne charge aucun
 * paquet lui-même : il se lance tel quel depuis l'une ou l'autre app.
 *
 * Utile surtout pour nommer le PREMIER administrateur, que l'interface ne peut pas créer. Les
 * scripts ne sont pas dans les images de production (cf. le Dockerfile d'app1) : on le lance là où
 * le dépôt et la base sont joignables.
 */

/** Le strict nécessaire du client Prisma d'une app, pour les deux modèles `User`. */
interface ClientPrisma {
  user: {
    findUnique(args: unknown): Promise<CompteAdmin | null>
    findMany(args: unknown): Promise<CompteAdmin[]>
    update(args: unknown): Promise<unknown>
  }
  $disconnect(): Promise<void>
}

interface CompteAdmin {
  id: number
  email: string
  pseudo: string
  nom: string | null
  prenom: string | null
  isGlobalAdmin?: boolean
  createdAt?: Date
}

export interface OptionsGestionAdmin {
  prisma: ClientPrisma
  /** Ce qu'une promotion (`true`) ou une rétrogradation (`false`) écrit sur le compte. */
  donneesPromotion: (estAdmin: boolean) => Record<string, unknown>
  /** Les arguments de la ligne de commande, sans `node` ni le script (`process.argv.slice(2)`). */
  args: string[]
}

const SELECTION = {
  id: true,
  email: true,
  pseudo: true,
  nom: true,
  prenom: true,
  isGlobalAdmin: true,
} as const

const USAGE = `
🔧 Gestion des super administrateurs

Usage :
  npm run admin:add <email>     Promouvoir un utilisateur en super administrateur
  npm run admin:remove <email>  Rétrograder un super administrateur en utilisateur normal
  npm run admin:list            Lister les super administrateurs
`

const nomComplet = (c: CompteAdmin) => [c.prenom, c.nom].filter(Boolean).join(' ') || c.pseudo

async function changerStatut(o: OptionsGestionAdmin, email: string, promouvoir: boolean) {
  console.log(`🔍 Recherche de l'utilisateur ${email}`)
  const compte = await o.prisma.user.findUnique({ where: { email }, select: SELECTION })
  if (!compte) throw new Error(`Aucun utilisateur avec l'adresse ${email}`)

  if (!!compte.isGlobalAdmin === promouvoir) {
    console.log(
      `ℹ️  ${compte.pseudo} (${compte.email}) ${promouvoir ? 'est déjà' : "n'est pas"} super administrateur`
    )
    return
  }
  // Pas de garde sur le nombre d'administrateurs restants : ce script est précisément le recours
  // pour en nommer un quand il n'y en a plus.
  await o.prisma.user.update({ where: { email }, data: o.donneesPromotion(promouvoir) })
  console.log(
    promouvoir
      ? `✅ ${compte.pseudo} (${nomComplet(compte)}) est maintenant super administrateur`
      : `✅ ${compte.pseudo} (${nomComplet(compte)}) n'est plus super administrateur`
  )
}

async function lister(o: OptionsGestionAdmin) {
  const admins = await o.prisma.user.findMany({
    where: { isGlobalAdmin: true },
    select: { ...SELECTION, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  if (admins.length === 0) {
    console.log('❌ Aucun super administrateur')
    return
  }
  console.log(`\n📋 ${admins.length} super administrateur(s) :\n`)
  admins.forEach((a, i) => {
    console.log(`${i + 1}. ${a.pseudo} (${nomComplet(a)})`)
    console.log(`   📧 ${a.email}`)
    if (a.createdAt) console.log(`   📅 Inscrit le ${a.createdAt.toLocaleDateString('fr-FR')}`)
    console.log('')
  })
}

/** Exécute la commande et rend le code de sortie (0 = succès). */
export async function gererAdministrateurs(o: OptionsGestionAdmin): Promise<number> {
  const [action, email] = o.args
  try {
    if (action === 'list' && o.args.length === 1) {
      await lister(o)
    } else if ((action === 'add' || action === 'remove') && email && o.args.length === 2) {
      await changerStatut(o, email, action === 'add')
    } else {
      console.log(USAGE)
      return 1
    }
    return 0
  } catch (erreur) {
    console.error('❌ Erreur :', erreur instanceof Error ? erreur.message : erreur)
    return 1
  } finally {
    await o.prisma.$disconnect()
  }
}
