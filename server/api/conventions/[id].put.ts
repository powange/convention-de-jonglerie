import { PrismaClient } from '@prisma/client';
import { moveTempImageToEdition } from '../../utils/move-temp-image';

import type { Edition } from '~/types';

const prisma = new PrismaClient();

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

  const body: Edition = await readBody(event);
  const { 
    name, description, imageUrl, startDate, endDate, addressLine1, addressLine2, postalCode, city, region, country, 
    ticketingUrl, facebookUrl, instagramUrl, 
    hasFoodTrucks, hasKidsZone, acceptsPets, hasTentCamping, hasTruckCamping, hasFamilyCamping, hasGym,
    hasFireSpace, hasGala, hasOpenStage, hasConcert, hasCantine, hasAerialSpace, hasSlacklineSpace,
    hasToilets, hasShowers, hasAccessibility, hasWorkshops
  } = body;

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

    // Si l'image est temporaire, la déplacer dans le bon dossier
    let finalImageUrl = imageUrl;
    if (imageUrl && imageUrl.includes('/temp/')) {
      const newImageUrl = await moveTempImageToEdition(imageUrl, editionId);
      if (newImageUrl) {
        finalImageUrl = newImageUrl;
        
        // Supprimer l'ancienne image si elle existe
        if (edition.imageUrl && edition.imageUrl.includes(`/conventions/${editionId}/`)) {
          const { promises: fs } = await import('fs');
          const { join } = await import('path');
          const oldFilename = edition.imageUrl.split('/').pop();
          if (oldFilename && oldFilename.startsWith('convention-')) {
            const oldFilePath = join(process.cwd(), 'public', 'uploads', 'conventions', editionId.toString(), oldFilename);
            try {
              await fs.unlink(oldFilePath);
              console.log('Ancienne image supprimée:', oldFilePath);
            } catch (error) {
              console.error('Erreur lors de la suppression de l\'ancienne image:', error);
            }
          }
        }
      }
    }

    const updatedData: Partial<Edition> = {
      name: name || edition.name,
      description: description || edition.description,
      imageUrl: finalImageUrl !== undefined ? finalImageUrl : edition.imageUrl,
      startDate: startDate ? new Date(startDate).toISOString() : edition.startDate.toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : edition.endDate.toISOString(),
      addressLine1: addressLine1 || edition.addressLine1,
      addressLine2: addressLine2 || edition.addressLine2,
      postalCode: postalCode || edition.postalCode,
      city: city || edition.city,
      region: region || edition.region,
      country: country || edition.country,
    };

    if (ticketingUrl !== undefined) updatedData.ticketingUrl = ticketingUrl;
    if (facebookUrl !== undefined) updatedData.facebookUrl = facebookUrl;
    if (instagramUrl !== undefined) updatedData.instagramUrl = instagramUrl;
    if (hasFoodTrucks !== undefined) updatedData.hasFoodTrucks = hasFoodTrucks;
    if (hasKidsZone !== undefined) updatedData.hasKidsZone = hasKidsZone;
    if (acceptsPets !== undefined) updatedData.acceptsPets = acceptsPets;
    if (hasTentCamping !== undefined) updatedData.hasTentCamping = hasTentCamping;
    if (hasTruckCamping !== undefined) updatedData.hasTruckCamping = hasTruckCamping;
    if (hasFamilyCamping !== undefined) updatedData.hasFamilyCamping = hasFamilyCamping;
    if (hasGym !== undefined) updatedData.hasGym = hasGym;
    if (hasFireSpace !== undefined) updatedData.hasFireSpace = hasFireSpace;
    if (hasGala !== undefined) updatedData.hasGala = hasGala;
    if (hasOpenStage !== undefined) updatedData.hasOpenStage = hasOpenStage;
    if (hasConcert !== undefined) updatedData.hasConcert = hasConcert;
    if (hasCantine !== undefined) updatedData.hasCantine = hasCantine;
    if (hasAerialSpace !== undefined) updatedData.hasAerialSpace = hasAerialSpace;
    if (hasSlacklineSpace !== undefined) updatedData.hasSlacklineSpace = hasSlacklineSpace;
    if (hasToilets !== undefined) updatedData.hasToilets = hasToilets;
    if (hasShowers !== undefined) updatedData.hasShowers = hasShowers;
    if (hasAccessibility !== undefined) updatedData.hasAccessibility = hasAccessibility;
    if (hasWorkshops !== undefined) updatedData.hasWorkshops = hasWorkshops;

    const updatedEdition = await prisma.edition.update({
      where: {
        id: editionId,
      },
      data: updatedData,
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
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});
