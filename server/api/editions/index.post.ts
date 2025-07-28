import { PrismaClient } from '@prisma/client';
import { moveTempImageToEdition } from '../../utils/move-temp-image';

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
    conventionId, name, description, imageUrl, startDate, endDate, addressLine1, addressLine2, postalCode, city, region, country, 
    ticketingUrl, facebookUrl, instagramUrl, 
    hasFoodTrucks, hasKidsZone, acceptsPets, hasTentCamping, hasTruckCamping, hasFamilyCamping, hasGym,
    hasFireSpace, hasGala, hasOpenStage, hasConcert, hasCantine, hasAerialSpace, hasSlacklineSpace,
    hasToilets, hasShowers, hasAccessibility, hasWorkshops
  } = body;

  if (!conventionId || !startDate || !endDate || !addressLine1 || !postalCode || !city || !country) {
    throw createError({
      statusCode: 400,
      message: 'Convention, start date, end date, address line 1, postal code, city, and country are required',
    });
  }

  // Vérifier que la convention existe et que l'utilisateur en est l'auteur
  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
  });

  if (!convention) {
    throw createError({
      statusCode: 404,
      message: 'Convention not found',
    });
  }

  if (convention.authorId !== event.context.user.id) {
    throw createError({
      statusCode: 403,
      message: 'You can only create editions for your own conventions',
    });
  }

  try {
    // Créer l'édition sans l'image d'abord
    const edition = await prisma.edition.create({
      data: {
        conventionId,
        name: name?.trim() || null,
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
      const newImageUrl = await moveTempImageToEdition(imageUrl, edition.id);
      if (newImageUrl) {
        // Mettre à jour l'édition avec la nouvelle URL
        const updatedEdition = await prisma.edition.update({
          where: { id: edition.id },
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
        return updatedEdition;
      }
    }
    
    return edition;
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});