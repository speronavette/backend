// controllers/driverEarningsController.js
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');

const driverEarningsController = {
  // Récupérer les gains d'un chauffeur sur une période
  async getEarnings(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const driverId = req.driver._id;

      const query = {
        driver: driverId,
        status: 'completed'
      };

      if (startDate && endDate) {
        query.completedAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const bookings = await Booking.find(query)
        .sort({ completedAt: -1 });

      // Calculer les statistiques
      const stats = {
        totalEarnings: bookings.reduce((sum, booking) => sum + booking.driverEarnings, 0),
        numberOfRides: bookings.length,
        averagePerRide: bookings.length > 0 
          ? bookings.reduce((sum, booking) => sum + booking.driverEarnings, 0) / bookings.length 
          : 0,
        dailyEarnings: {}
      };

      // Agréger les gains par jour
      bookings.forEach(booking => {
        const date = booking.completedAt.toISOString().split('T')[0];
        if (!stats.dailyEarnings[date]) {
          stats.dailyEarnings[date] = 0;
        }
        stats.dailyEarnings[date] += booking.driverEarnings;
      });

      res.json({
        success: true,
        data: {
          stats,
          bookings: bookings.map(booking => ({
            id: booking._id,
            date: booking.completedAt,
            client: `${booking.client.firstName} ${booking.client.lastName}`,
            pickup: booking.client.address.city,
            destination: booking.journey.outbound.airport,
            earnings: booking.driverEarnings,
            serviceType: booking.serviceType
          }))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Mettre à jour les gains d'une course
  async updateBookingEarnings(req, res) {
    try {
      const { bookingId } = req.params;
      const { amount } = req.body;

      if (!amount || amount < 0) {
        return res.status(400).json({
          success: false,
          error: 'Montant invalide'
        });
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Réservation non trouvée'
        });
      }

      booking.driverEarnings = amount;
      await booking.save();

      // Mettre à jour les statistiques du chauffeur
      await Driver.findByIdAndUpdate(booking.driver, {
        $inc: { totalEarnings: amount }
      });

      res.json({
        success: true,
        data: booking
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = driverEarningsController;