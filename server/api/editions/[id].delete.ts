import { prisma } from '../../utils/prisma';


export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const editionId = parseInt(event.context.params?.id as string);

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Edition ID',
    });
  }

  try {
    const edition = await prisma.edition.findUnique({
      where: {
        id: editionId,
      },
    });

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Edition not found',
      });
    }

    if (edition.creatorId !== event.context.user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: You are not the creator of this edition',
      });
    }

    await prisma.edition.delete({
      where: {
        id: editionId,
      },
    });
    return { message: 'Edition deleted successfully' };
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});
