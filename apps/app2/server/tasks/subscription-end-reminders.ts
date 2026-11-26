import { formule } from '../../shared/formules'
import { contenuRappel, doitRappeler, JOURS_AVANT_RAPPEL } from '../../shared/rappel-fin-abonnement'
import { getSiteUrl, sendEmail } from '../utils/emailService'
import prisma from '../utils/prisma'

/**
 * Tâche planifiée : prévient par courriel, 15 jours avant, la fin d'un abonnement Flowvent — et
 * celle de l'avantage d'un code promo qui s'achève avec lui (règle et texte :
 * shared/rappel-fin-abonnement.ts). Un seul rappel par période (`Subscription.endReminderFor`).
 *
 * Le paiement étant simulé, aucun abonnement ne se renouvelle seul : sans ce rappel, le compte
 * retomberait en formule gratuite sans que personne l'ait vu venir.
 */
export default defineTask({
  meta: {
    name: 'subscription-end-reminders',
    description: 'Email subscribers 15 days before their subscription period ends',
  },
  async run() {
    const maintenant = new Date()
    const limite = new Date(maintenant.getTime() + JOURS_AVANT_RAPPEL * 24 * 60 * 60 * 1000)
    const candidats = await prisma.subscription.findMany({
      where: { status: 'active', currentPeriodEnd: { gt: maintenant, lte: limite } },
      include: {
        promoCode: { select: { code: true, advantage: true, duration: true } },
        user: { select: { email: true, prenom: true, pseudo: true } },
      },
    })
    const lienTarifs = `${getSiteUrl()}/pricing`
    let envoyes = 0
    for (const abonnement of candidats) {
      if (!doitRappeler(abonnement, maintenant)) continue
      const { subject, html, text } = contenuRappel({
        // Le prénom est facultatif en base ; le pseudo, unique, ne manque jamais.
        nom: abonnement.user.prenom?.trim() || abonnement.user.pseudo,
        formule: `${formule(abonnement.formule)?.libelle ?? 'Flowvent'} ${abonnement.plan === 'annual' ? 'annuel' : 'mensuel'}`,
        fin: abonnement.currentPeriodEnd,
        code: abonnement.promoCode,
        advantageEndsAt: abonnement.advantageEndsAt,
        lienTarifs,
      })
      const parti = await sendEmail({ to: abonnement.user.email, subject, html, text })
      // Un envoi échoué n'est pas retenu : le passage du lendemain réessaiera.
      if (parti) {
        await prisma.subscription.update({
          where: { id: abonnement.id },
          data: { endReminderFor: abonnement.currentPeriodEnd },
        })
        envoyes++
      }
    }
    console.log(
      `[CRON subscription-end-reminders] ${envoyes} rappel(s) envoyé(s) sur ${candidats.length} abonnement(s) en fin de période`
    )
    return { success: true, envoyes, candidats: candidats.length }
  },
})
