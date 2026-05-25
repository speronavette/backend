const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// Route publique pour créer une réservation
router.post('/', bookingController.createBooking);

module.exports = router;