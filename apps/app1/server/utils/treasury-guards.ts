import { nomAvanceAEnregistrer } from '~~/shared/utils/avance-nom-libre'

/**
 * Vérifie qu'un code d'imputation appartient bien à la convention de l'édition.
 *
 * Les codes sont portés par la convention, les lignes par l'édition : rien dans le schéma
 * n'empêche donc de rattacher le code d'une autre convention. Sans ce contrôle, un organisateur
 * pourrait imputer ses dépenses sur le plan comptable de quelqu'un d'autre — et le découvrirait
 * en voyant apparaître ses propres codes chez lui.
 *
 * `null` et `undefined` sont acceptés : une ligne sans imputation est légitime.
 */
export async function assertCodeBelongsToEdition(
  editionId: number,
  codeId: number | null | undefined
): Promise<void> {
  if (codeId === null || codeId === undefined) return

  const code = await prisma.treasuryCode.findFirst({
    where: { id: codeId, convention: { editions: { some: { id: editionId } } } },
    select: { id: true },
  })

  if (!code) {
    throw createError({
      status: 400,
      message: "Ce code d'imputation n'appartient pas à la convention de cette édition",
    })
  }
}

/**
 * Les trois appartenances qui font qu'on peut désigner quelqu'un comme ayant sorti l'argent de sa
 * poche : organisateur de la convention, bénévole ACCEPTÉ, artiste programmé.
 *
 * ## ⚠️ POURQUOI CETTE FONCTION EXISTE PLUTÔT QU'UNE LISTE RECOPIÉE
 *
 * La règle vivait dans `advance-candidates.get.ts`, le point d'API qui PROPOSE la liste — et
 * nulle part ailleurs. Les quatre points qui ENREGISTRENT ne validaient l'identifiant que comme
 * entier positif. Le contrat d'API laissait donc rattacher une avance, ou un apport au fonds de
 * caisse, à **n'importe quel compte du site**.
 *
 * Le périmètre n'est pas une commodité d'affichage : il est là pour la confidentialité. La
 * recherche d'utilisateurs ouverte aux non-administrateurs n'accepte qu'un email EXACT,
 * délibérément ; proposer les personnes de l'édition n'ouvre rien, puisque le trésorier les voit
 * déjà ailleurs dans la gestion. Enregistrer hors de ce périmètre, en revanche, inscrit dans la
 * trésorerie d'une édition le nom de quelqu'un qui n'a rien à y voir.
 *
 * Les clauses sont RENDUES plutôt qu'appliquées, pour que la liste et la garde consomment
 * littéralement la même définition. Faire porter la vérification par une seconde requête écrite à
 * la main les aurait laissées vieillir séparément — c'est exactement ainsi que le défaut est né.
 */
export function clausesDesPersonnesRattachees(editionId: number, conventionId: number) {
  return {
    organisateurs: { conventionId },
    benevoles: { eventId: editionId, status: 'ACCEPTED' as const },
    artistes: { editionId },
  }
}

/**
 * Refuse en 400 une personne qui n'est pas rattachée à l'édition.
 *
 * `null` et `undefined` sont acceptés : une dépense que personne n'a avancée est le cas courant,
 * et un apport peut être porté par un nom libre plutôt que par un compte.
 *
 * ⚠️ SANS CETTE GARDE, UN IDENTIFIANT INEXISTANT RENDAIT 500 : Prisma rejetait l'écriture sur une
 * violation de clé étrangère (P2003), c'est-à-dire une erreur de serveur là où une saisie fautive
 * du client mérite un 400 qui dise quoi. Et un identifiant EXISTANT mais étranger à l'édition
 * passait sans rien dire du tout — c'était la moitié silencieuse du défaut.
 *
 * 📍 La convention est relue ici plutôt que reçue en paramètre : deux des quatre appelants ne la
 * connaissent pas à cet endroit, et leur faire chercher une donnée dont ils n'ont pas besoin
 * aurait donné quatre variantes d'appel pour une seule règle.
 */
export async function assertPersonneRattacheeALEdition(
  editionId: number,
  userId: number | null | undefined
): Promise<void> {
  if (userId === null || userId === undefined) return

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { conventionId: true },
  })
  if (!edition) {
    throw createError({ status: 404, message: 'Édition introuvable' })
  }

  const clauses = clausesDesPersonnesRattachees(editionId, edition.conventionId)
  const [organisateur, benevole, artiste] = await Promise.all([
    prisma.conventionOrganizer.findFirst({
      where: { ...clauses.organisateurs, userId },
      select: { userId: true },
    }),
    prisma.editionVolunteerApplication.findFirst({
      where: { ...clauses.benevoles, userId },
      select: { userId: true },
    }),
    prisma.editionArtist.findFirst({
      where: { ...clauses.artistes, userId },
      select: { userId: true },
    }),
  ])

  if (!organisateur && !benevole && !artiste) {
    throw createError({
      status: 400,
      message: "Cette personne n'est pas rattachée à cette édition",
    })
  }
}

/**
 * L'avance et son remboursement n'ont de sens que sur une DÉPENSE avancée par quelqu'un.
 *
 * Normalisé plutôt que refusé : un formulaire qui bascule de dépense à recette laisse traîner les
 * champs qu'il affichait, et rejeter la saisie pour cela serait incompréhensible. Ce qui n'a pas
 * de sens est effacé, pas signalé.
 */
export function avanceNormalisee(saisie: {
  kind: 'EXPENSE' | 'INCOME'
  advancedById?: number | null
  advancedByName?: string | null
  reimbursed?: boolean
}) {
  const advancedById = saisie.kind === 'EXPENSE' ? (saisie.advancedById ?? null) : null

  /*
   * Un compte OU un nom libre, jamais les deux.
   *
   * Le compte l'emporte : il désigne une personne sans ambiguïté, là où un nom se regroupe par
   * ressemblance. Le formulaire est déjà exclusif, mais un client qui enverrait les deux doit
   * obtenir un état cohérent plutôt qu'une ligne comptant deux fois dans le panneau des avances.
   */
  const advancedByName = advancedById
    ? null
    : saisie.kind === 'EXPENSE'
      ? nomAvanceAEnregistrer(saisie.advancedByName)
      : null

  const avancePortee = !!advancedById || !!advancedByName
  return {
    advancedById,
    advancedByName,
    reimbursed: avancePortee ? (saisie.reimbursed ?? false) : false,
  }
}

/**
 * Le prêteur d'un apport au fonds de caisse : un compte OU un nom libre, jamais les deux.
 *
 * Le compte l'emporte — il désigne une personne sans ambiguïté, là où un nom se regroupe par
 * ressemblance. Même règle que `avanceNormalisee` juste au-dessus, dont elle se distingue sur un
 * seul point : une avance n'a de prêteur que sur une CHARGE, alors qu'un apport en a toujours un.
 *
 * Le nom passe par `nomAvanceAEnregistrer`, la fonction partagée — espaces réduits, casse et
 * accents préservés : on regroupe sans la casse mais on affiche ce qui a été tapé.
 */
export function preteurNormalise(saisie: {
  lentById?: number | null
  lentByName?: string | null
}): { lentById: number | null; lentByName: string | null } {
  const lentById = saisie.lentById ?? null
  return {
    lentById,
    lentByName: lentById ? null : nomAvanceAEnregistrer(saisie.lentByName),
  }
}

/**
 * La date à écrire sur `reimbursedAt`, d'après la BASCULE du booléen.
 *
 * Trois cas, et le troisième est celui qui compte :
 *
 * - on vient de rembourser (`false` → `true`) : la date est maintenant ;
 * - on annule le remboursement (`→ false`) : la date s'efface, sans quoi elle resterait à
 *   contredire l'état ;
 * - **c'était déjà remboursé et ça l'est toujours : on ne touche à rien.** Réenregistrer une ligne
 *   pour en corriger le libellé ne doit pas déplacer la date du versement. C'est pour ce seul cas
 *   que la fonction a besoin de l'état d'AVANT, et c'est pour cela qu'elle rend parfois un objet
 *   vide plutôt qu'une valeur.
 *
 * ⚠️ NE PAS DÉDUIRE CETTE DATE DE `updatedAt`, qui bouge au moindre changement de libellé : le
 * chiffre serait faux et parfaitement plausible.
 *
 * 📍 Les avances soldées AVANT l'arrivée de cette colonne n'ont pas de date — 45 lignes à la
 * migration. C'est `reimbursed` qui dit l'état ; `reimbursedAt` ne dit que la date quand on la
 * connaît, et l'écran n'affiche le survol que s'il en a une.
 *
 * @param avant l'état en base, ou `undefined` à la création — il n'y a alors rien à préserver.
 */
export function dateDuRemboursement(
  avant: boolean | undefined,
  apres: boolean
): { reimbursedAt?: Date | null } {
  const date = dateDeSolde(avant, apres)
  return date === undefined ? {} : { reimbursedAt: date }
}

/**
 * La règle ci-dessus, détachée de son champ — parce qu'elle sert aussi ailleurs.
 *
 * Le fonds de caisse en a besoin pour `restitutedAt`, et la recopier l'aurait fait diverger : une
 * restitution réenregistrée verrait sa date glisser là où un remboursement garde la sienne, pour
 * la seule raison que deux fonctions presque identiques auraient vieilli séparément.
 *
 * @returns la date à écrire, `null` pour l'effacer, ou **`undefined` pour ne pas y toucher**.
 */
export function dateDeSolde(avant: boolean | undefined, apres: boolean): Date | null | undefined {
  if (!apres) return null
  if (avant) return undefined
  return new Date()
}

/**
 * Les tarifs qu'une ligne de trésorerie peut rattacher pour en tirer son montant.
 *
 * Trois refus, et chacun protège d'un compte faux plutôt que d'une saisie malpropre :
 *
 * **1. Un tarif d'une autre édition.** Son produit n'a rien à voir avec cette trésorerie, et le
 * réacheminement irait chercher des ventes d'ailleurs.
 *
 * **2. Un tarif déjà rattaché à une AUTRE ligne.** Son montant serait compté deux fois. La base
 * porte un index unique sur `tierId` qui l'interdit de toute façon — mais un refus explicite dit
 * *pourquoi*, là où la contrainte ne rendrait qu'une erreur de clé dupliquée.
 *
 * **3. Un rattachement sur une CHARGE.** Le produit de la billetterie est un produit : en tirer
 * une charge inverserait le signe d'un montant encaissé.
 *
 * `entryId` est l'exception attendue en modification : une ligne garde ses propres tarifs.
 */
export async function assertTarifsRattachables(
  editionId: number,
  kind: 'EXPENSE' | 'INCOME',
  tierIds: number[] | null | undefined,
  entryId?: number
): Promise<void> {
  if (!tierIds?.length) return

  if (kind !== 'INCOME') {
    throw createError({
      status: 400,
      message: 'Seul un produit peut tirer son montant de tarifs de billetterie',
    })
  }

  const tarifs = await prisma.ticketingTier.findMany({
    where: { id: { in: tierIds }, editionId },
    select: { id: true, treasuryEntries: { select: { entryId: true } } },
  })

  if (tarifs.length !== new Set(tierIds).size) {
    throw createError({
      status: 400,
      message: "Un des tarifs choisis n'appartient pas à cette édition",
    })
  }

  const pris = tarifs.filter((tarif) =>
    tarif.treasuryEntries.some((lien) => lien.entryId !== entryId)
  )
  if (pris.length) {
    throw createError({
      status: 400,
      message: 'Un des tarifs choisis est déjà rattaché à une autre ligne de trésorerie',
    })
  }
}
