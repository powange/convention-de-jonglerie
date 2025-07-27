import { PrismaClient } from '@prisma/client';
import { moveTempImageToConvention } from '../../utils/move-temp-image';

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
  const { 
    name, description, imageUrl, startDate, endDate, addressLine1, addressLine2, postalCode, city, region, country, 
    ticketingUrl, facebookUrl, instagramUrl, 
    hasFoodTrucks, hasKidsZone, acceptsPets, hasTentCamping, hasTruckCamping, hasFamilyCamping, hasGym,
    hasFireSpace, hasGala, hasOpenStage, hasConcert, hasCantine, hasAerialSpace, hasSlacklineSpace,
    hasToilets, hasShowers, hasAccessibility, hasWorkshops
  } = body;

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

    // Si l'image est temporaire, la déplacer dans le bon dossier
    let finalImageUrl = imageUrl;
    if (imageUrl && imageUrl.includes('/temp/')) {
      const newImageUrl = await moveTempImageToConvention(imageUrl, conventionId);
      if (newImageUrl) {
        finalImageUrl = newImageUrl;
        
        // Supprimer l'ancienne image si elle existe
        if (convention.imageUrl && convention.imageUrl.includes(`/conventions/${conventionId}/`)) {
          const { promises: fs } = await import('fs');
          const { join } = await import('path');
          const oldFilename = convention.imageUrl.split('/').pop();
          if (oldFilename && oldFilename.startsWith('convention-')) {
            const oldFilePath = join(process.cwd(), 'public', 'uploads', 'conventions', conventionId.toString(), oldFilename);
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

    const updatedData: Partial<Convention> = {
      name: name || convention.name,
      description: description || convention.description,
      imageUrl: finalImageUrl !== undefined ? finalImageUrl : convention.imageUrl,
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

    const updatedConvention = await prisma.convention.update({
      where: {
        id: conventionId,
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
    return updatedConvention;
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});
