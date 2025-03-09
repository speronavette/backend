const Booking = require('../models/Booking');
const Driver = require('../models/Driver');

exports.completeRideWithRating = async (req, res) => {
  try {
    const { id: bookingId } = req.params;
    const { rating, comment } = req.body;
    const driverId = req.driver._id;

    // Trouver et mettre à jour la réservation
    const booking = await Booking.findOne({
      _id: bookingId,
      driver: driverId,
      status: { $ne: 'completed' }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Réservation non trouvée ou déjà complétée'
      });
    }

    // Mettre à jour la réservation
    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.rating = rating;
    booking.comment = comment;
    await booking.save();

    // Calculer la nouvelle moyenne des notes du chauffeur
    const completedBookings = await Booking.find({
      driver: driverId,
      status: 'completed',
      rating: { $exists: true }
    });

    const totalRating = completedBookings.reduce((sum, b) => sum + (b.rating || 0), 0);
    const averageRating = completedBookings.length > 0 
      ? (totalRating / completedBookings.length).toFixed(1)
      : 0;

    // Mettre à jour les statistiques du chauffeur
    await Driver.findByIdAndUpdate(driverId, {
      rating: averageRating,
      completedRides: completedBookings.length
    });

    res.json({
      success: true,
      data: {
        booking,
        averageRating,
        completedRides: completedBookings.length
      }
    });

  } catch (error) {
    console.error('Erreur lors de la completion de la course:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la completion de la course'
    });
  }
};