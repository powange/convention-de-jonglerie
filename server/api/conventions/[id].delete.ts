import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const conventionId = parseInt(event.context.params?.id as string);

  if (isNaN(conventionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Convention ID',
    });
  }

  try {
    const convention = await prisma.convention.findUnique({
      where: {
        id: conventionId,
      },
    });

    if (!convention) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Convention not found',
      });
    }

    if (convention.creatorId !== event.context.user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: You are not the creator of this convention',
      });
    }

    await prisma.convention.delete({
      where: {
        id: conventionId,
      },
    });
    return { message: 'Convention deleted successfully' };
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});
