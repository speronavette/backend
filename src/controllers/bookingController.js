const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const { sendConfirmationEmail, sendAdminNotificationEmail } = require('../services/emailService');

// Fonctions du controller
const bookingController = {
   // Confirmation de réservation
   handleBookingConfirmation: async (req, res) => {
       try {
           const bookingId = req.params.id;
           const { pickupTime } = req.body;
          
           const booking = await Booking.findById(bookingId);
          
           if (!booking) {
               return res.status(404).json({
                   success: false,
                   message: "Réservation non trouvée"
               });
           }
           
           // Si c'est une réservation groupée
           if (booking.bookingGroupId) {
               return res.status(200).json({
                   success: true,
                   isGrouped: true,
                   groupId: booking.bookingGroupId
               });
           }
           
           // Pour une réservation simple
           const updateData = {
               status: 'confirmed'
           };
          
           if (booking.journey.outbound) {
               updateData['journey.outbound.pickupTime'] = pickupTime;
           }
           
           const updatedBooking = await Booking.findByIdAndUpdate(
               bookingId,
               { $set: updateData },
               { new: true }
           );
           
           await sendConfirmationEmail({
               to: booking.client.email,
               booking: updatedBooking
           });
           
           console.log(`✅ Réservation ${bookingId} confirmée`);
           
           return res.status(200).json({
               success: true,
               message: "Réservation confirmée",
               data: updatedBooking
           });
       } catch (error) {
           console.error("❌ Erreur lors de la confirmation:", error.message);
           return res.status(500).json({
               success: false,
               message: "Erreur lors de la confirmation de la réservation",
               error: error.message
           });
       }
   },
   
   // Mise à jour des gains du chauffeur
   updateDriverEarnings: async (req, res) => {
       try {
           const { id } = req.params;
           const { driverEarnings } = req.body;
           
           if (driverEarnings === undefined || driverEarnings < 0) {
               return res.status(400).json({
                   success: false,
                   message: "Les gains du chauffeur doivent être un nombre positif"
               });
           }
           
           const booking = await Booking.findById(id);
           if (!booking) {
               return res.status(404).json({
                   success: false,
                   message: "Réservation non trouvée"
               });
           }
           
           booking.driverEarnings = Number(driverEarnings);
           await booking.save();
           
           return res.status(200).json({
               success: true,
               message: "Gains du chauffeur mis à jour",
               data: booking
           });
       } catch (error) {
           console.error("❌ Erreur lors de la mise à jour des gains:", error.message);
           return res.status(500).json({
               success: false,
               message: "Erreur lors de la mise à jour des gains",
               error: error.message
           });
       }
   },
   
   // Obtention des statistiques des gains par chauffeur
   getDriverEarningsStats: async (req, res) => {
       try {
           const { driverId } = req.params;
           const { startDate, endDate } = req.query;
           
           let matchQuery = {
               driver: driverId,
               status: { $in: ['completed', 'confirmed'] }
           };
           
           if (startDate && endDate) {
               matchQuery['journey.outbound.date'] = {
                   $gte: new Date(startDate),
                   $lte: new Date(endDate)
               };
           }
           
           const bookings = await Booking.find(matchQuery)
               .sort({ 'journey.outbound.date': -1 });
           
           const stats = {
               totalEarnings: 0,
               weekCashPayments: 0,
               numberOfBookings: bookings.length,
               bookings: []
           };
           
           const now = new Date();
           const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
           const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
           
           bookings.forEach(booking => {
               stats.totalEarnings += booking.driverEarnings || 0;
               
               const bookingDate = new Date(booking.journey.outbound?.date || booking.journey.inbound?.date);
               if (bookingDate >= startOfWeek && bookingDate <= endOfWeek && booking.paymentMethod === 'cash') {
                   stats.weekCashPayments += booking.driverEarnings || 0;
               }
               
               stats.bookings.push({
                   id: booking._id,
                   date: bookingDate,
                   earnings: booking.driverEarnings,
                   client: `${booking.client.firstName} ${booking.client.lastName}`,
                   from: booking.client.address.city,
                   to: booking.journey.outbound?.airport || booking.journey.inbound?.airport,
                   paymentMethod: booking.paymentMethod
               });
           });
           
           return res.status(200).json({
               success: true,
               data: stats
           });
       } catch (error) {
           console.error("❌ Erreur récupération des statistiques:", error.message);
           return res.status(500).json({
               success: false,
               message: "Erreur lors de la récupération des statistiques",
               error: error.message
           });
       }
   },
   
   // Création d'une réservation (route POST)
   createBooking: async (req, res) => {
       try {
           console.log('📨 Nouvelle demande de réservation reçue');
           
           if (req.body.journey.type === 'roundTrip') {
               // Pour un aller-retour, créez une seule réservation
               const bookingData = {
                   client: req.body.client,
                   journey: req.body.journey, // Conserve le journey complet avec type:'roundTrip'
                   options: req.body.options,
                   passengers: req.body.passengers,
                   serviceType: req.body.serviceType,
                   price: req.body.price,
                   paymentMethod: req.body.paymentMethod,
                   status: 'pending',
                   recommendedBy: req.body.recommendedBy,
                   agencyName: req.body.recommendedBy === 'agency' ? req.body.agencyName : '',
                   vatNumber: req.body.vatNumber
               };
               
               const booking = new Booking(bookingData);
               const savedBooking = await booking.save();
               
               console.log('✅ Réservation aller-retour créée');
               
               // Envoi d'un seul email avec les informations complètes
               try {
                   await sendAdminNotificationEmail(savedBooking);
                   console.log('✅ Email de notification pour aller-retour envoyé');
               } catch (emailError) {
                   console.error('❌ Erreur d\'envoi d\'email:', emailError.message);
               }
               
               // Réponse au client
               res.status(201).json({
                   success: true,
                   message: 'Réservation aller-retour créée avec succès',
                   data: savedBooking
               });
           } else {
               // Pour un trajet simple (aller ou retour)
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
                   vatNumber: req.body.vatNumber
               };
               
               const booking = new Booking(bookingData);
               const savedBooking = await booking.save();
               
               console.log('✅ Réservation simple créée');
               
               // Envoi de notification à l'admin
               try {
                   await sendAdminNotificationEmail(savedBooking);
                   console.log('✅ Email de notification pour trajet simple envoyé');
               } catch (emailError) {
                   console.error('❌ Erreur d\'envoi d\'email:', emailError.message);
               }
               
               // Réponse au client
               res.status(201).json({
                   success: true,
                   message: 'Réservation créée avec succès',
                   data: savedBooking
               });
           }
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

const handleStatusChange = async (req, res) => {
   try {
       const { id } = req.params;
       const { status } = req.body;
      
       const booking = await Booking.findById(id);
       if (!booking) {
           return res.status(404).json({ 
               success: false, 
               message: 'Réservation non trouvée' 
           });
       }
       
       booking.status = status;
       await booking.save();
       
       console.log(`✅ Statut de la réservation ${id} mis à jour: ${status}`);
       
       if (status === 'confirmed' || status === 'rejected') {
           try {
               await sendConfirmationEmail({
                   to: booking.client.email,
                   booking,
                   template: status
               });
           } catch (emailError) {
               console.error('❌ Erreur d\'envoi d\'email:', emailError.message);
           }
       }
       
       res.json({ success: true, data: booking });
   } catch (error) {
       console.error('❌ Erreur changement de statut:', error.message);
       res.status(500).json({ 
           success: false, 
           error: error.message 
       });
   }
};

// Fonction pour envoyer un email de demande d'avis
const sendReviewRequest = async (req, res) => {
   try {
       const { id } = req.params;
      
       const booking = await Booking.findById(id);
       if (!booking) {
           return res.status(404).json({
               success: false,
               message: 'Réservation non trouvée'
           });
       }
       
       // Envoyer l'email de demande d'avis
       try {
           await sendConfirmationEmail({
               to: booking.client.email,
               booking,
               template: 'review'
           });
           console.log(`✅ Email de demande d'avis envoyé à: ${booking.client.email}`);
       } catch (emailError) {
           console.error('❌ Erreur d\'envoi d\'email d\'avis:', emailError.message);
           throw emailError;
       }
       
       res.json({
           success: true,
           message: 'Email de demande d\'avis envoyé avec succès'
       });
   } catch (error) {
       console.error('❌ Erreur envoi demande d\'avis:', error.message);
       res.status(500).json({
           success: false,
           error: error.message
       });
   }
};

module.exports = {
   ...bookingController,
   handleStatusChange,
   sendReviewRequest
};