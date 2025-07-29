import { moveTempImageToEdition } from '../../utils/move-temp-image';
import { prisma } from '../../utils/prisma';
import { updateEditionSchema, validateAndSanitize, handleValidationError } from '../../utils/validation-schemas';
import { geocodeEdition } from '../../utils/geocoding';
import { z } from 'zod';

import type { Edition } from '~/types';


export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  const editionId = parseInt(event.context.params?.id as string);

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID d\'édition invalide',
    });
  }

  const body = await readBody(event);

  // Validation et sanitisation des données avec Zod
  let validatedData;
  try {
    validatedData = validateAndSanitize(updateEditionSchema, body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      handleValidationError(error);
    }
    throw error;
  }

  const { 
    conventionId, name, description, imageUrl, startDate, endDate, addressLine1, addressLine2, postalCode, city, region, country, 
    ticketingUrl, facebookUrl, instagramUrl, 
    hasFoodTrucks, hasKidsZone, acceptsPets, hasTentCamping, hasTruckCamping, hasFamilyCamping, hasGym,
    hasFireSpace, hasGala, hasOpenStage, hasConcert, hasCantine, hasAerialSpace, hasSlacklineSpace,
    hasToilets, hasShowers, hasAccessibility, hasWorkshops, hasCreditCardPayment, hasAfjTokenPayment
  } = validatedData;

  try {
    const edition = await prisma.edition.findUnique({
      where: {
        id: editionId,
      },
    });

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Édition introuvable',
      });
    }

    if (edition.creatorId !== event.context.user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Vous n\'êtes pas le créateur de cette édition',
      });
    }

    // Si une convention est spécifiée, vérifier qu'elle existe et que l'utilisateur en est l'auteur
    if (conventionId && conventionId !== edition.conventionId) {
      const convention = await prisma.convention.findUnique({
        where: { id: conventionId },
      });

      if (!convention) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Convention introuvable',
        });
      }

      if (convention.authorId !== event.context.user.id) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Vous ne pouvez assigner des éditions qu\'à vos propres conventions',
        });
      }
    }

    // Si l'image est temporaire, la déplacer dans le bon dossier
    let finalImageUrl = imageUrl;
    if (imageUrl && imageUrl.includes('/temp/')) {
      const newImageUrl = await moveTempImageToEdition(imageUrl, editionId);
      if (newImageUrl) {
        finalImageUrl = newImageUrl;
        
        // Supprimer l'ancienne image si elle existe
        if (edition.imageUrl && (edition.imageUrl.includes(`/editions/${editionId}/`) || edition.imageUrl.includes(`/conventions/${editionId}/`))) {
          const { promises: fs } = await import('fs');
          const { join } = await import('path');
          const oldFilename = edition.imageUrl.split('/').pop();
          if (oldFilename && (oldFilename.startsWith('edition-') || oldFilename.startsWith('convention-'))) {
            // Gérer les deux chemins possibles (ancien et nouveau)
            const isOldPath = edition.imageUrl.includes('/conventions/');
            const dirName = isOldPath ? 'conventions' : 'editions';
            const oldFilePath = join(process.cwd(), 'public', 'uploads', dirName, editionId.toString(), oldFilename);
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
      conventionId: conventionId !== undefined ? conventionId : edition.conventionId,
      name: name !== undefined ? (name?.trim() || null) : edition.name,
      description: description || edition.description,
      imageUrl: finalImageUrl !== undefined ? finalImageUrl : edition.imageUrl,
      startDate: startDate ? new Date(startDate) : edition.startDate,
      endDate: endDate ? new Date(endDate) : edition.endDate,
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
    if (hasCreditCardPayment !== undefined) updatedData.hasCreditCardPayment = hasCreditCardPayment;
    if (hasAfjTokenPayment !== undefined) updatedData.hasAfjTokenPayment = hasAfjTokenPayment;

    // Si l'adresse a été modifiée, recalculer les coordonnées
    const addressChanged = addressLine1 !== undefined || addressLine2 !== undefined || 
                          city !== undefined || postalCode !== undefined || country !== undefined;
    
    if (addressChanged) {
      const geoCoords = await geocodeEdition({
        addressLine1: addressLine1 || edition.addressLine1,
        addressLine2: addressLine2 !== undefined ? addressLine2 : edition.addressLine2,
        city: city || edition.city,
        postalCode: postalCode || edition.postalCode,
        country: country || edition.country
      });
      
      updatedData.latitude = geoCoords.latitude;
      updatedData.longitude = geoCoords.longitude;
    }

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
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'édition:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la mise à jour de l\'édition',
    });
  }
});
