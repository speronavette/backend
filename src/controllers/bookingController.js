const { sendAdminNotificationEmail } = require('../services/emailService');
const logger = require('../../utils/logger');

const bookingController = {
   createBooking: async (req, res) => {
       try {
           console.log('📨 Nouvelle demande de réservation reçue');

           const bookingData = {
               client: req.body.client,
               journey: req.body.journey,
               options: req.body.options,
               passengers: req.body.passengers,
               serviceType: req.body.serviceType,
               price: req.body.price,
               paymentMethod: req.body.paymentMethod,
               status: 'pending',
               recommendedBy: req.body.recommendedBy,
               agencyName: req.body.recommendedBy === 'agency' ? req.body.agencyName : '',
               vatNumber: req.body.vatNumber,
           };

           // Générer une référence unique
           const bookingReference = 'SN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
           bookingData.bookingReference = bookingReference;

           try {
               await sendAdminNotificationEmail(bookingData);
               console.log('✅ Email de notification envoyé pour:', bookingReference);
           } catch (emailError) {
               console.error('❌ Erreur envoi email:', emailError.message);
               // On continue quand même pour répondre au client
           }

           res.status(201).json({
               success: true,
               message: 'Réservation créée avec succès',
               data: { bookingReference, ...bookingData }
           });

       } catch (error) {
           console.error('❌ Erreur création de réservation:', error.message);
           res.status(500).json({
               success: false,
               message: 'Problème de réservation ?\n\nSi vous rencontrez une erreur lors de votre réservation, essayez ces solutions :\n• Utilisez un autre navigateur (Firefox, Chrome, Safari)\n• Désactivez vos extensions de navigateur et antivirus\n• Essayez depuis un autre appareil ou réseau internet\n• Désactivez votre VPN si vous en utilisez un\n\nVous pouvez aussi nous contacter directement :\n📞 0490/19.79.14\n✉️ info@spero-navette.be',
               error: error.message
           });
       }
   }
};

module.exports = {
   ...bookingController,
};