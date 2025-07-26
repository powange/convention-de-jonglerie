import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const body = await readBody(event);
  const { name, description, imageUrl, startDate, endDate, addressLine1, addressLine2, postalCode, city, region, country, ticketingUrl, facebookUrl, instagramUrl, hasFastfood, hasKidsZone, acceptsPets, hasTentCamping, hasTruckCamping, hasGym } = body;

  if (!name || !startDate || !endDate || !addressLine1 || !postalCode || !city || !country) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name, start date, end date, address line 1, postal code, city, and country are required',
    });
  }

  try {
    const convention = await prisma.convention.create({
      data: {
        name,
        description,
        imageUrl,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        addressLine1,
        addressLine2,
        postalCode,
        city,
        region,
        country,
        ticketingUrl,
        facebookUrl,
        instagramUrl,
        hasFastfood: hasFastfood || false,
        hasKidsZone: hasKidsZone || false,
        acceptsPets: acceptsPets || false,
        hasTentCamping: hasTentCamping || false,
        hasTruckCamping: hasTruckCamping || false,
        hasGym: hasGym || false,
        creatorId: event.context.user.id,
      },
      include: {
        creator: {
          select: { id: true, email: true, pseudo: true },
        },
        favoritedBy: {
          select: { id: true },
        },
      },
    });
    return convention;
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});