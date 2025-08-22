import { moveTempImageToEdition } from '../../utils/move-temp-image';
import { prisma } from '../../utils/prisma';
import { editionSchema, validateAndSanitize, handleValidationError } from '../../utils/validation-schemas';
import { geocodeEdition } from '../../utils/geocoding';
import { z } from 'zod';


export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  const body = await readBody(event);

  // Validation et sanitisation des données avec Zod
  let validatedData;
  try {
    validatedData = validateAndSanitize(editionSchema, body);
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

  // Vérifier que la convention existe et que l'utilisateur en est l'auteur
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
      statusMessage: 'Vous ne pouvez créer des éditions que pour vos propres conventions',
    });
  }

  try {
    // Géocoder l'adresse pour obtenir les coordonnées
    const geoCoords = await geocodeEdition({
      addressLine1,
      addressLine2,
      city,
      postalCode,
      country
    });

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
        latitude: geoCoords.latitude,
        longitude: geoCoords.longitude,
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
        hasCreditCardPayment: hasCreditCardPayment || false,
        hasAfjTokenPayment: hasAfjTokenPayment || false,
        creatorId: event.context.user.id,
        isOnline: false, // Nouvelle édition créée hors ligne par défaut
      },
      include: {
        creator: {
          select: { id: true, pseudo: true },
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
              select: { id: true, pseudo: true },
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
  } catch (error) {
    console.error('Erreur lors de la création de l\'édition:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la création de l\'édition',
    });
  }
});