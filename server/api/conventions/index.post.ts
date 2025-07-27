import { PrismaClient } from '@prisma/client';
import { moveTempImageToConvention } from '../../utils/move-temp-image';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const body = await readBody(event);
  const { 
    name, description, imageUrl, startDate, endDate, addressLine1, addressLine2, postalCode, city, region, country, 
    ticketingUrl, facebookUrl, instagramUrl, 
    hasFoodTrucks, hasKidsZone, acceptsPets, hasTentCamping, hasTruckCamping, hasFamilyCamping, hasGym,
    hasFireSpace, hasGala, hasOpenStage, hasConcert, hasCantine, hasAerialSpace, hasSlacklineSpace,
    hasToilets, hasShowers, hasAccessibility, hasWorkshops
  } = body;

  if (!name || !startDate || !endDate || !addressLine1 || !postalCode || !city || !country) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name, start date, end date, address line 1, postal code, city, and country are required',
    });
  }

  try {
    // Créer la convention sans l'image d'abord
    const convention = await prisma.convention.create({
      data: {
        name,
        description,
        imageUrl: null, // On met null d'abord
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
        hasFoodTrucks: hasFoodTrucks || false,
        hasKidsZone: hasKidsZone || false,
        acceptsPets: acceptsPets || false,
        hasTentCamping: hasTentCamping || false,
        hasTruckCamping: hasTruckCamping || false,
        hasFamilyCamping: hasFamilyCamping || false,
        hasGym: hasGym || false,
        hasFireSpace: hasFireSpace || false,
        hasGala: hasGala || false,
        hasOpenStage: hasOpenStage || false,
        hasConcert: hasConcert || false,
        hasCantine: hasCantine || false,
        hasAerialSpace: hasAerialSpace || false,
        hasSlacklineSpace: hasSlacklineSpace || false,
        hasToilets: hasToilets || false,
        hasShowers: hasShowers || false,
        hasAccessibility: hasAccessibility || false,
        hasWorkshops: hasWorkshops || false,
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
    
    // Si une image temporaire a été fournie, la déplacer dans le bon dossier
    if (imageUrl && imageUrl.includes('/temp/')) {
      const newImageUrl = await moveTempImageToConvention(imageUrl, convention.id);
      if (newImageUrl) {
        // Mettre à jour la convention avec la nouvelle URL
        const updatedConvention = await prisma.convention.update({
          where: { id: convention.id },
          data: { imageUrl: newImageUrl },
          include: {
            creator: {
              select: { id: true, email: true, pseudo: true },
            },
            favoritedBy: {
              select: { id: true },
            },
          },
        });
        return updatedConvention;
      }
    }
    
    return convention;
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});