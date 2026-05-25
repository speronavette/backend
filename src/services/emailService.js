const nodemailer = require('nodemailer');
const { generateEmailTemplate, generateEnglishEmailTemplate, generateAdminNotificationTemplate } = require('./emailTemplate');

// Configuration du transporteur d'emails sans logs détaillés
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'spero.navette@gmail.com',
    pass: process.env.SMTP_PASS || 'blol xlpz qpxi qmua'
  },
  logger: false, // Désactivation des logs détaillés
  debug: false   // Désactivation du mode debug
});

// Vérification de la configuration SMTP au démarrage
transporter.verify()
  .then(() => {
    console.log('✅ Configuration SMTP vérifiée avec succès');
  })
  .catch(error => {
    console.error('❌ Erreur de configuration SMTP:', error.message);
  });

// ✅ NOUVEAU : Fonction spéciale pour emails de pré-autorisation
const buildPreAuthEmailContent = (booking) => {
  // ✅ FIX : Détection correcte du type de trajet
  const isFromAirport = (segment) => {
    return segment?.airport === 'CRL' && (segment?.flightNumber || segment?.time);
  };
  
  let journeyDetails = '';
  
  if (booking.journey.type === 'roundTrip') {
    // Aller-retour : analyser chaque segment correctement
    const outbound = booking.journey.outbound;
    const inbound = booking.journey.inbound;
    
    // ✅ FIX : Déterminer quel segment est ALLER et RETOUR selon la logique
    if (outbound && inbound) {
      const outboundIsFromAirport = isFromAirport(outbound);
      const inboundIsFromAirport = isFromAirport(inbound);
      
      // Premier segment
      journeyDetails += `
📍 **${outboundIsFromAirport ? 'RETOUR (de l\'aéroport)' : 'ALLER (vers l\'aéroport)'}:**
📅 Date: ${outbound.date}
🕒 Heure: ${outbound.time || outbound.pickupTime || 'À confirmer'}`;

      if (outboundIsFromAirport) {
        journeyDetails += `
✈️ Vol: ${outbound.flightNumber || 'Non spécifié'}
🌍 Provenance: ${outbound.flightOrigin || 'Non spécifié'}
🛬 Arrivée aéroport: ${outbound.time}`;
      } else {
        journeyDetails += `
🛫 Départ vers aéroport: ${outbound.time || outbound.pickupTime}`;
      }
      
      // Deuxième segment  
      journeyDetails += `\n\n📍 **${inboundIsFromAirport ? 'RETOUR (de l\'aéroport)' : 'ALLER (vers l\'aéroport)'}:**
📅 Date: ${inbound.date}
🕒 Heure: ${inbound.time || inbound.pickupTime || 'À confirmer'}`;

      if (inboundIsFromAirport) {
        journeyDetails += `
✈️ Vol: ${inbound.flightNumber || 'Non spécifié'}
🌍 Provenance: ${inbound.flightOrigin || 'Non spécifié'}
🛬 Arrivée aéroport: ${inbound.time}`;
      } else {
        journeyDetails += `
🛫 Départ vers aéroport: ${inbound.time || inbound.pickupTime}`;
      }
    }
  } else {
    // Trajet simple
    const segment = booking.journey.outbound || booking.journey.inbound;
    const isFromAirportSingle = isFromAirport(segment);
    
    journeyDetails += `
📍 **${isFromAirportSingle ? 'RETOUR (de l\'aéroport)' : 'ALLER (vers l\'aéroport)'}:**
📅 Date: ${segment?.date || 'Non spécifiée'}
🕒 Heure: ${segment?.time || segment?.pickupTime || 'À confirmer'}`;

    if (isFromAirportSingle) {
      journeyDetails += `
✈️ Vol: ${segment?.flightNumber || 'Non spécifié'}
🌍 Provenance: ${segment?.flightOrigin || 'Non spécifié'}
🛬 Arrivée aéroport: ${segment?.time}`;
    } else {
      journeyDetails += `
🛫 Départ vers aéroport: ${segment?.time || segment?.pickupTime}`;
    }
  }

  // ✅ NOUVEAU : Extraire special requests des options
  const specialRequests = booking.options?.other ? 
    booking.options.other.includes('Special Requests: ') ? 
      booking.options.other.split('Special Requests: ')[1].split(' |')[0] : 
      'Aucune demande spéciale' 
    : 'Aucune demande spéciale';

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Réservation Pré-autorisée - Spero Navette</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">🚐 SPERO NAVETTE</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Réservation Pré-autorisée</p>
    </div>
    
    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #495057; margin-top: 0;">👤 INFORMATIONS CLIENT</h2>
        <p><strong>${booking.client.firstName} ${booking.client.lastName}</strong><br>
        📧 ${booking.client.email}<br>
        📱 ${booking.client.phone}<br>
        👥 <strong>Passagers:</strong> ${booking.passengers}<br>
        🧳 <strong>Bagages:</strong> ${booking.options?.luggageCount || 0}</p>

        <h2 style="color: #495057; margin-top: 30px;">🚌 DÉTAILS DU TRAJET</h2>
        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
            ${journeyDetails.replace(/\n/g, '<br>')}
        </div>

        <h2 style="color: #495057; margin-top: 30px;">📋 INFORMATIONS SUPPLÉMENTAIRES</h2>
        <p>💰 <strong>Prix:</strong> ${booking.price?.sharedPrice || booking.price?.privatePrice || 'Non spécifié'}€</p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3 style="color: #495057; margin-top: 0;">📍 ADRESSE</h3>
            <p>${booking.client.address?.street || 'Non spécifié'}<br>
            ${booking.client.address?.postalCode || ''} ${booking.client.address?.city || ''}</p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3 style="color: #495057; margin-top: 0;">📝 DEMANDES SPÉCIALES</h3>
            <p>${specialRequests}</p>
        </div>

        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #856404;"><strong>⚠️ PRÉ-AUTORISATION:</strong> Client non encore débité, voir email technique pour action Stripe.</p>
        </div>
    </div>
</body>
</html>
`;
};

const sendConfirmationEmail = async ({ to, booking, template = 'confirmed' }) => {
  try {
    if (!to || !booking) {
      throw new Error('Paramètres manquants pour l\'envoi de l\'email');
    }
    
    let htmlContent;
    let subject;
    
    // ✅ NOUVEAU : Gestion du template 'preauth'
    if (template === 'preauth') {
      htmlContent = buildPreAuthEmailContent(booking);
      subject = `🚐 Réservation Pré-autorisée - ${booking.client.firstName} ${booking.client.lastName}`;
    } else {
      // Templates existants (belges) - AUCUN CHANGEMENT
      const isEnglishBooking = booking.other && booking.other.includes('English Website');
htmlContent = isEnglishBooking 
  ? generateEnglishEmailTemplate(booking, template)  // ✅ Nouveau template anglais
  : generateEmailTemplate(booking, template);        // ✅ Template français inchangé
      subject = template === 'rejected' 
        ? 'Demande de réservation refusée - Spero Navette'
        : template === 'review'
          ? 'Votre avis nous intéresse - Spero Navette'
          : 'Confirmation de votre réservation - Spero Navette';
    }
    
    // Configuration de l'email
    const mailOptions = {
      from: {
        name: 'Spero Navette',
        address: process.env.SMTP_FROM || 'spero.navette@gmail.com'
      },
      to: to, // ✅ Utilise le 'to' passé en paramètre (spero.navette@gmail.com pour preauth)
      subject: subject,
      html: htmlContent
    };
    
    // Envoi de l'email
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé à:', to);
   
    return info;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error.message);
    throw error;
  }
};

// Fonction pour envoyer un email à l'administrateur
const sendAdminNotificationEmail = async (booking, linkedBooking = null) => {
  try {
    if (!booking) {
      throw new Error('Données de réservation manquantes pour l\'envoi de l\'email admin');
    }
    
    let completeBooking;
    
    // Si nous avons une réservation liée (aller-retour), créez un objet de réservation combiné
    if (linkedBooking) {
      // Vérifiez quelle réservation est l'aller et laquelle est le retour
      let outboundBooking, inboundBooking;
      
      if (booking.journey.outbound && linkedBooking.journey.inbound) {
        outboundBooking = booking;
        inboundBooking = linkedBooking;
      } else if (booking.journey.inbound && linkedBooking.journey.outbound) {
        outboundBooking = linkedBooking;
        inboundBooking = booking;
      } else {
        // Si l'identification n'est pas claire, utilisez la première réservation
        outboundBooking = booking;
        inboundBooking = linkedBooking;
      }
      
      // Créez un objet de réservation combiné pour le template
      completeBooking = {
        ...outboundBooking,
        journey: {
          type: 'roundTrip',
          outbound: {
            ...outboundBooking.journey.outbound,
            // Utilisez les prix réels de chaque trajet
            price: outboundBooking.journey.outbound.price || {
              sharedPrice: outboundBooking.journey.outbound.price?.sharedPrice || outboundBooking.price.sharedPrice,
              privatePrice: outboundBooking.journey.outbound.price?.privatePrice || outboundBooking.price.privatePrice
            }
          },
          inbound: {
            ...inboundBooking.journey.inbound,
            // Utilisez les prix réels de chaque trajet
            price: inboundBooking.journey.inbound.price || {
              sharedPrice: inboundBooking.journey.inbound.price?.sharedPrice || inboundBooking.price.sharedPrice,
              privatePrice: inboundBooking.journey.inbound.price?.privatePrice || inboundBooking.price.privatePrice
            }
          }
        },
        price: {
          // Prix total combiné
          sharedPrice: (outboundBooking.price.sharedPrice || 0) + (inboundBooking.price.sharedPrice || 0),
          privatePrice: (outboundBooking.price.privatePrice || 0) + (inboundBooking.price.privatePrice || 0)
        }
      };
    } else {
      // Pour un trajet simple, utilisez la réservation directement
      completeBooking = booking;
    }
    
    // Générer le contenu HTML
    const htmlContent = generateAdminNotificationTemplate(completeBooking);
    
    // Adresse de destination (toujours envoyer à spero.navette@gmail.com)
    const adminEmail = 'spero.navette@gmail.com';
    
    // Configuration de l'email
    const mailOptions = {
      from: {
        name: 'Système de Réservation Spero',
        address: process.env.SMTP_FROM || 'spero.navette@gmail.com'
      },
      to: adminEmail,
      subject: `Nouvelle réservation - ${booking.client.lastName} ${booking.client.firstName}`,
      html: htmlContent
    };
    
    // Envoi de l'email
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email de notification admin envoyé');
    
    return info;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email admin:', error.message);
    // Ne pas propager l'erreur pour ne pas bloquer le processus de réservation
  }
};

// Exporter les fonctions
module.exports = {
  sendConfirmationEmail,
  sendAdminNotificationEmail,
  transporter // Exporté pour les tests
};