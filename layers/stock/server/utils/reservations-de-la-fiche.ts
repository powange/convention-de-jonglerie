import type { Prisma } from '@prisma/client'

/**
 * Le nombre de réservations que la fiche d'un objet charge d'emblée — constat E3.
 *
 * ⚠️ La fiche les chargeait **TOUTES**, sans `take` ni `where`, alors que son propre commentaire
 * annonçait « ses réservations actives et futures ». Une édition qui réserve beaucoup de matériel
 * aurait vu la requête grossir sans limite, et la page avec elle.
 *
 * 📍 **Mesuré avant d'y toucher : 0 réservation en base de développement.** Ce n'est donc pas la
 * correction d'une panne, c'est une échéance — et c'est pourquoi l'historique n'est pas tronqué
 * mais PAGINÉ : l'écran affiche délibérément tout le passé, et le borner aurait changé ce qu'il
 * montre. La décision est celle de l'utilisateur, prise le 12/10 entre trois branches.
 */
export const RESERVATIONS_PAR_PAGE = 20

/**
 * Ce que la fiche lit d'une réservation — une seule définition pour les DEUX points d'API.
 *
 * ⚠️ Pas l'adresse e-mail : cette fiche est ouverte à qui peut consulter le stock, ce qui inclut
 * les responsables d'équipe bénévole — lesquels n'ont pas à connaître l'adresse des autres
 * participants. Le planning, qui affiche pourtant les mêmes réservations, ne prenait déjà que
 * l'empreinte ; c'est ce choix-là qui vaut. L'empreinte suffit à l'avatar, seul usage qu'en fait
 * l'écran.
 *
 * 📍 Partagé, et non recopié : deux définitions divergeraient, et la page paginée finirait par
 * afficher autre chose que la première page — ou, pire, par exposer un champ que la première
 * cachait.
 */
export const reservationDeLaFicheSelect = {
  zone: { select: { id: true, name: true, color: true } },
  marker: { select: { id: true, name: true } },
  user: {
    select: {
      id: true,
      pseudo: true,
      prenom: true,
      nom: true,
      emailHash: true,
      profilePicture: true,
    },
  },
} satisfies Prisma.StockReservationInclude
