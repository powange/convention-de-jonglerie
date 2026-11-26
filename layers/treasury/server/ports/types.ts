// Ports du module trésorerie (layers/treasury). La trésorerie ne lit pas directement ce qui
// appartient à l'app hôte : l'édition (app1) ou l'événement (Flowvent), et ses organisateurs.
// Chaque app fournit `#server/treasury/ports/registry` → `useTreasuryPorts()`.

/**
 * Ce que la trésorerie lit de l'édition.
 *
 * `conventionId` désigne le PORTEUR DU PLAN COMPTABLE (`TreasuryCode.conventionId`) : la convention
 * dans app1, où un plan se réutilise d'une édition à l'autre ; l'événement lui-même dans Flowvent.
 * C'est aussi lui qui range les justificatifs (`treasury-receipt-files`).
 */
export interface TreasuryEditionInfo {
  id: number
  conventionId: number
  /** Devise de l'édition ; `null` = euro par défaut. */
  currency: string | null
  /** Dernier comptage du fonds de caisse, en centimes. */
  cashFloatCount: number | null
  cashFloatCountedAt: Date | null
}

export interface TreasuryEditionPort {
  lire(editionId: number): Promise<TreasuryEditionInfo | null>
  enregistrerComptageDuFonds(
    editionId: number,
    comptage: { cashFloatCount: number | null; cashFloatCountedAt: Date | null }
  ): Promise<void>
}

/**
 * Les organisateurs, l'une des trois appartenances qui permettent de désigner quelqu'un comme
 * ayant avancé de l'argent (cf. `clausesDesPersonnesRattachees`). App1 : organisateurs de la
 * convention. Flowvent : propriétaire de l'événement et organisateurs déclarés.
 */
export interface TreasuryOrganisateursPort {
  estOrganisateur(edition: TreasuryEditionInfo, userId: number): Promise<boolean>
  comptesDesOrganisateurs(edition: TreasuryEditionInfo): Promise<number[]>
}

export interface TreasuryPorts {
  edition: TreasuryEditionPort
  organisateurs: TreasuryOrganisateursPort
}
