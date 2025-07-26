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
    const user = await prisma.user.findUnique({
      where: { id: event.context.user.id },
      include: { favoriteConventions: true },
    });

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found',
      });
    }

    const isFavorited = user.favoriteConventions.some(conv => conv.id === conventionId);

    if (isFavorited) {
      // Remove from favorites
      await prisma.user.update({
        where: { id: event.context.user.id },
        data: {
          favoriteConventions: {
            disconnect: { id: conventionId },
          },
        },
      });
      return { message: 'Convention removed from favorites' };
    } else {
      // Add to favorites
      await prisma.user.update({
        where: { id: event.context.user.id },
        data: {
          favoriteConventions: {
            connect: { id: conventionId },
          },
        },
      });
      return { message: 'Convention added to favorites' };
    }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});
