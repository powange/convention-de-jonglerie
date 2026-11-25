import type { Prisma } from '#server/types/prisma'

/** Client transactionnel, tel que le layer bénévoles le reçoit dans ses `$transaction`. */
export type PrismaTransaction = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export type VolunteerApplicationWhereInput = Prisma.EditionVolunteerApplicationWhereInput
