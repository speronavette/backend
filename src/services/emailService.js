const nodemailer = require('nodemailer');
const { generateEmailTemplate, generateAdminNotificationTemplate } = require('./emailTemplate');

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

const sendConfirmationEmail = async ({ to, booking, template = 'confirmed' }) => {
  try {
    if (!to || !booking) {
      throw new Error('Paramètres manquants pour l\'envoi de l\'email');
    }
    
    // Générer le contenu HTML
    const htmlContent = generateEmailTemplate(booking, template);
    
    // Configuration de l'email
    const mailOptions = {
      from: {
        name: 'Spero Navette',
        address: process.env.SMTP_FROM || 'spero.navette@gmail.com'
      },
      to: to,
      subject: template === 'rejected' 
        ? 'Demande de réservation refusée - Spero Navette'
        : template === 'review'
          ? 'Votre avis nous intéresse - Spero Navette'
          : 'Confirmation de votre réservation - Spero Navette',
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
        ...outboundBooking.toObject(),
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