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
  logger: false,
  debug: false
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
  console.log('📧 DEBUG - Données reçues pour email:', JSON.stringify(booking, null, 2));
  
  // ✅ EXTRACTION DES DONNÉES selon la structure souhaitée
  let routeInfo = '';
  let specialRequests = 'Aucune demande spéciale';
  
  // Extraire depuis options.other
  if (booking.options?.other) {
    const otherData = booking.options.other;
    console.log('🔍 DEBUG - Other data:', otherData);
    
    if (otherData.includes('Route: ')) {
      const routeMatch = otherData.match(/Route: ([^|]+)/);
      routeInfo = routeMatch ? routeMatch[1].trim() : '';
    }
    
    if (otherData.includes('Special Requests: ')) {
      const requestsMatch = otherData.match(/Special Requests: ([^|]+)/);
      specialRequests = requestsMatch ? requestsMatch[1].trim() : 'Aucune demande spéciale';
    }
  }

  // Calculer les prix individuels avec promo si disponibles
  const outboundPriceDisplay = booking.price.outboundPrice 
    ? (booking.serviceType === 'private' ? booking.price.outboundPrice.privatePrice : booking.price.outboundPrice.sharedPrice)
    : '';
    
  const inboundPriceDisplay = booking.price.inboundPrice 
    ? (booking.serviceType === 'private' ? booking.price.inboundPrice.privatePrice : booking.price.inboundPrice.sharedPrice)
    : '';

  // ✅ STRUCTURE EXACTE comme l'interface admin
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
        
        <!-- 👤 INFORMATIONS CLIENT -->
        <div style="background: white; border: 2px solid rgb(232, 138, 120); border-radius: 12px; margin-bottom: 15px; overflow: hidden;">
            <h2 style="background: rgba(232, 138, 120, 0.1); color: rgb(232, 138, 120); margin: 0; padding: 10px; text-align: center; border-bottom: 1px solid rgb(232, 138, 120);">👤 INFORMATIONS CLIENT</h2>
            <div style="padding: 15px;">
                <p style="margin: 5px 0;"><strong>Nom:</strong> ${booking.client.lastName}</p>
                <p style="margin: 5px 0;"><strong>Prénom:</strong> ${booking.client.firstName}</p>
                <p style="margin: 5px 0;"><strong>Téléphone:</strong> ${booking.client.phone}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${booking.client.email}</p>
                <p style="margin: 5px 0;"><strong>Passagers:</strong> ${booking.passengers}</p>
                <p style="margin: 5px 0;"><strong>Bagages:</strong> ${booking.options?.luggageCount || 0}</p>
            </div>
        </div>

        <!-- 🚌 DÉTAILS TRAJET -->
        <div style="background: white; border: 2px solid rgb(232, 138, 120); border-radius: 12px; margin-bottom: 15px; overflow: hidden;">
            <h2 style="background: rgba(232, 138, 120, 0.1); color: rgb(232, 138, 120); margin: 0; padding: 10px; text-align: center; border-bottom: 1px solid rgb(232, 138, 120);">🚌 DÉTAILS DU TRAJET</h2>
            <div style="padding: 15px;">
                ${booking.journey.outbound ? `
                <div style="background: rgba(232, 138, 120, 0.1); padding: 10px; margin: 10px 0; border-radius: 8px;">
                    <h3 style="color: rgb(232, 138, 120); margin: 0 0 10px 0;">**ALLER (vers l'aéroport):**</h3>
                    <p style="margin: 3px 0;"><strong>Date:</strong> ${booking.journey.outbound.date || 'Non spécifiée'}</p>
                    <p style="margin: 3px 0;"><strong>Heure de décollage:</strong> ${booking.journey.outbound.time || 'À confirmer'}</p>
                    <p style="margin: 3px 0;"><strong>Numéro de vol:</strong> ${booking.journey.outbound.flightNumber || 'Non spécifié'}</p>
                    <p style="margin: 3px 0;"><strong>Provenance de l'avion:</strong> ${booking.journey.outbound.flightOrigin || 'Non spécifié'}</p>
                    <p style="margin: 3px 0;"><strong>Lieu de départ:</strong> ${routeInfo.split(' to ')[0] || 'Non spécifié'}</p>
                    ${outboundPriceDisplay ? `<p style="margin: 3px 0;"><strong>Prix aller:</strong> ${outboundPriceDisplay} €</p>` : ''}
                </div>
                ` : ''}
                
                ${booking.journey.inbound ? `
                <div style="background: rgba(232, 138, 120, 0.1); padding: 10px; margin: 10px 0; border-radius: 8px;">
                    <h3 style="color: rgb(232, 138, 120); margin: 0 0 10px 0;">**RETOUR (de l'aéroport):**</h3>
                    <p style="margin: 3px 0;"><strong>Date:</strong> ${booking.journey.inbound.date || 'Non spécifiée'}</p>
                    <p style="margin: 3px 0;"><strong>Heure de décollage:</strong> ${booking.journey.inbound.time || 'À confirmer'}</p>
                    <p style="margin: 3px 0;"><strong>Numéro de vol:</strong> ${booking.journey.inbound.flightNumber || 'Non spécifié'}</p>
                    <p style="margin: 3px 0;"><strong>Provenance de l'avion:</strong> ${booking.journey.inbound.flightOrigin || 'Non spécifié'}</p>
                    <p style="margin: 3px 0;"><strong>Lieu de pickup:</strong> ${routeInfo.split(' to ')[1] || 'Non spécifié'}</p>
                    ${inboundPriceDisplay ? `<p style="margin: 3px 0;"><strong>Prix retour:</strong> ${inboundPriceDisplay} €</p>` : ''}
                </div>
                ` : ''}
            </div>
        </div>

        <!-- 💰 PRIX TOTAL -->
        <div style="background: white; border: 2px solid rgb(232, 138, 120); border-radius: 12px; margin-bottom: 15px; overflow: hidden;">
            <h2 style="background: rgba(232, 138, 120, 0.1); color: rgb(232, 138, 120); margin: 0; padding: 10px; text-align: center; border-bottom: 1px solid rgb(232, 138, 120);">💰 PRIX TOTAL</h2>
            <div style="padding: 15px;">
                <p style="margin: 5px 0; font-size: 18px; font-weight: bold; color: rgb(232, 138, 120);">
                    ${booking.serviceType === 'private' ? (booking.price?.privatePrice || 'Non spécifié') : (booking.price?.sharedPrice || 'Non spécifié')} €
                </p>
                <p style="margin: 5px 0;"><strong>Service:</strong> ${booking.serviceType === 'private' ? 'Navette privée' : 'Navette partagée'}</p>
                ${booking.price.outboundPrice && booking.price.inboundPrice ? `
                <p style="margin: 5px 0; font-size: 12px; color: #28a745;">✅ Prix avec promotion -7% appliquée</p>
                ` : ''}
            </div>
        </div>

        <!-- 📝 DEMANDES SPÉCIALES -->
        <div style="background: white; border: 2px solid rgb(232, 138, 120); border-radius: 12px; margin-bottom: 15px; overflow: hidden;">
            <h2 style="background: rgba(232, 138, 120, 0.1); color: rgb(232, 138, 120); margin: 0; padding: 10px; text-align: center; border-bottom: 1px solid rgb(232, 138, 120);">📝 DEMANDES SPÉCIALES</h2>
            <div style="padding: 15px;">
                <p style="margin: 5px 0;">${specialRequests}</p>
            </div>
        </div>

        <!-- 📍 ADRESSE -->
        <div style="background: white; border: 2px solid rgb(232, 138, 120); border-radius: 12px; margin-bottom: 15px; overflow: hidden;">
            <h2 style="background: rgba(232, 138, 120, 0.1); color: rgb(232, 138, 120); margin: 0; padding: 10px; text-align: center; border-bottom: 1px solid rgb(232, 138, 120);">📍 ADRESSE</h2>
            <div style="padding: 15px;">
                <p style="margin: 5px 0;">${booking.client.address?.street || 'Non spécifié'} ${booking.client.address?.number || ''}</p>
                <p style="margin: 5px 0;">${booking.client.address?.postalCode || ''} ${booking.client.address?.city || ''}</p>
            </div>
        </div>

        <!-- ⚠️ PRÉ-AUTORISATION -->
        <div style="background: #fff3cd; border: 2px solid #ffeaa7; border-radius: 12px; padding: 15px; margin-top: 20px;">
            <p style="margin: 0; color: #856404; font-weight: bold;">⚠️ PRÉ-AUTORISATION: Client non encore débité, voir email technique pour action Stripe.</p>
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
        ? generateEnglishEmailTemplate(booking, template)
        : generateEmailTemplate(booking, template);
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
      to: to,
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
        outboundBooking = booking;
        inboundBooking = linkedBooking;
      }
      
      // Créez un objet de réservation combiné pour le template
      completeBooking = {
        ...outboundBooking.toObject(),
        journey: {
          type: 'roundTrip',
          outbound: {
            ...outboundBooking.journey.outbound,
            // Utiliser les prix avec promo si disponibles
            price: outboundBooking.price.outboundPrice || {
              sharedPrice: outboundBooking.price.sharedPrice,
              privatePrice: outboundBooking.price.privatePrice
            }
          },
          inbound: {
            ...inboundBooking.journey.inbound,
            // Utiliser les prix avec promo si disponibles
            price: inboundBooking.price.inboundPrice || {
              sharedPrice: inboundBooking.price.sharedPrice,
              privatePrice: inboundBooking.price.privatePrice
            }
          }
        },
        price: {
          // Prix total (déjà calculé avec promo dans le frontend)
          sharedPrice: outboundBooking.price.sharedPrice || 0,
          privatePrice: outboundBooking.price.privatePrice || 0,
          // Garder les prix individuels pour l'email
          outboundPrice: outboundBooking.price.outboundPrice,
          inboundPrice: inboundBooking.price.inboundPrice
        }
      };
    } else {
      // Pour un trajet simple, utilisez la réservation directement
      completeBooking = booking;
    }
    
    // Générer le contenu HTML
    const htmlContent = generateAdminNotificationTemplate(completeBooking);
    
    // Adresse de destination
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
  }
};

// Exporter les fonctions
module.exports = {
  sendConfirmationEmail,
  sendAdminNotificationEmail,
  transporter
};