import { PrismaClient } from '@prisma/client';

import type { Convention } from '~/types';

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

  const body: Convention = await readBody(event);
  const { name, description, imageUrl, startDate, endDate, addressLine1, addressLine2, postalCode, city, region, country, ticketingUrl, facebookUrl, instagramUrl, hasFastfood, hasKidsZone, acceptsPets, hasTentCamping, hasTruckCamping, hasGym } = body;

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

    const updatedData: Partial<Convention> = {
      name: name || convention.name,
      description: description || convention.description,
      imageUrl: imageUrl !== undefined ? imageUrl : convention.imageUrl,
      startDate: startDate ? new Date(startDate).toISOString() : convention.startDate.toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : convention.endDate.toISOString(),
      addressLine1: addressLine1 || convention.addressLine1,
      addressLine2: addressLine2 || convention.addressLine2,
      postalCode: postalCode || convention.postalCode,
      city: city || convention.city,
      region: region || convention.region,
      country: country || convention.country,
    };

    if (ticketingUrl !== undefined) updatedData.ticketingUrl = ticketingUrl;
    if (facebookUrl !== undefined) updatedData.facebookUrl = facebookUrl;
    if (instagramUrl !== undefined) updatedData.instagramUrl = instagramUrl;
    if (hasFastfood !== undefined) updatedData.hasFastfood = hasFastfood;
    if (hasKidsZone !== undefined) updatedData.hasKidsZone = hasKidsZone;
    if (acceptsPets !== undefined) updatedData.acceptsPets = acceptsPets;
    if (hasTentCamping !== undefined) updatedData.hasTentCamping = hasTentCamping;
    if (hasTruckCamping !== undefined) updatedData.hasTruckCamping = hasTruckCamping;
    if (hasGym !== undefined) updatedData.hasGym = hasGym;

    const updatedConvention = await prisma.convention.update({
      where: {
        id: conventionId,
      },
      data: updatedData,
    });
    return updatedConvention;
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});
