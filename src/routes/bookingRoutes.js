const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const bookingController = require('../controllers/bookingController');
const { sendConfirmationEmail } = require('../services/emailService');
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const logger = require('../../utils/logger');

// Route publique pour créer une réservation
router.post('/', bookingController.createBooking);

// Routes protégées par authentification admin
router.get('/', adminAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    const bookings = await Booking.find(filter)
      .populate('driver')
      .sort({
        'journey.outbound.date': 1,
        'journey.outbound.pickupTime': 1,
        'journey.inbound.date': 1
      });
    
    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    logger.error(`Erreur récupération réservations: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Route pour les statistiques des gains d'un chauffeur
router.get('/driver/:driverId/earnings', auth, bookingController.getDriverEarningsStats);

// GET linked booking (route protégée)
router.get('/linked/:id', auth, async (req, res) => {
  try {
    const currentBooking = await Booking.findById(req.params.id);
    
    if (!currentBooking) {
      return res.status(404).json({
        success: false,
        error: 'Réservation non trouvée'
      });
    }

    // Vérification que l'utilisateur a le droit d'accéder à cette réservation
    // Si c'est un chauffeur qui n'est pas assigné à cette réservation
    if (req.user && !req.isAdmin && currentBooking.driver && 
        currentBooking.driver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé à cette réservation'
      });
    }

    if (!currentBooking.bookingGroupId) {
      return res.json({
        success: true,
        data: null
      });
    }

    const linkedBooking = await Booking.findOne({
      bookingGroupId: currentBooking.bookingGroupId,
      _id: { $ne: currentBooking._id }
    });

    return res.json({
      success: true,
      data: linkedBooking
    });
  } catch (error) {
    logger.error(`Erreur linked booking: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// GET driver earnings history
router.get('/driver/:driverId/earnings-history', auth, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;

    // Vérification que l'utilisateur a le droit d'accéder aux données du chauffeur
    if (!req.isAdmin && driverId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé à ces données'
      });
    }

    const query = {
      driver: driverId,
      status: { $in: ['completed', 'confirmed'] },
      driverEarnings: { $exists: true, $gt: 0 }
    };

    if (startDate && endDate) {
      query['journey.outbound.date'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const bookings = await Booking.find(query)
      .sort({ 'journey.outbound.date': -1 })
      .select('journey.outbound.date driverEarnings paymentMethod client.firstName client.lastName journey.outbound.airport journey.inbound.airport');

    const earnings = bookings.map(booking => ({
      id: booking._id,
      date: booking.journey.outbound?.date,
      amount: booking.driverEarnings,
      paymentMethod: booking.paymentMethod,
      client: `${booking.client.firstName} ${booking.client.lastName}`,
      destination: booking.journey.outbound?.airport || booking.journey.inbound?.airport
    }));

    res.json({
      success: true,
      data: earnings
    });
  } catch (error) {
    logger.error(`Erreur earnings history: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'historique des gains'
    });
  }
});

router.post('/:id/send-review-request', adminAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'La réservation doit être terminée pour envoyer une demande d\'avis'
      });
    }

    await bookingController.sendReviewRequest(req, res);
  } catch (error) {
    logger.error(`Erreur demande d'avis: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'envoi de l\'email'
    });
  }
});

// PATCH routes (protégées)
router.patch('/:id/status', adminAuth, bookingController.handleStatusChange);

router.patch('/:id/pickup', adminAuth, async (req, res) => {
  try {
    const { pickupTime } = req.body;

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { 'journey.outbound.pickupTime': pickupTime }},
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(404).json({
        success: false,
        error: 'Réservation non trouvée'
      });
    }

    res.json({
      success: true,
      data: updatedBooking
    });
  } catch (error) {
    logger.error(`Erreur mise à jour pickup: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

router.patch('/:id/assign-driver', adminAuth, async (req, res) => {
  try {
    const { driverId } = req.body;
    const bookingId = req.params.id;

    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { driver: driverId, status: 'inProgress' },
      { new: true }
    ).populate('driver');

    if (!updatedBooking) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    res.json({
      success: true,
      data: updatedBooking
    });
  } catch (error) {
    logger.error(`Erreur assignation chauffeur: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

router.patch('/:id/confirm', adminAuth, bookingController.handleBookingConfirmation);
router.patch('/:id/driver-earnings', adminAuth, bookingController.updateDriverEarnings);

module.exports = router;