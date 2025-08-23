import { prisma } from '../../../utils/prisma';
import { checkUserConventionPermission } from '../../../utils/collaborator-management';

export default defineEventHandler(async (event) => {
  const conventionId = parseInt(getRouterParam(event, 'id') || '0');
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' });
  }
  if (!conventionId) {
    throw createError({ statusCode: 400, statusMessage: 'ID invalide' });
  }
  const perm = await checkUserConventionPermission(conventionId, event.context.user.id);
  if (!perm.hasPermission) {
    throw createError({ statusCode: 403, statusMessage: 'Accès refusé' });
  }
  const editions = await prisma.edition.findMany({
    where: { conventionId },
    select: { id:true, name:true, startDate:true, endDate:true }
  });
  return editions;
});
