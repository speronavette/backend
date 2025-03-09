const Driver = require('../models/Driver');
const Booking = require('../models/Booking');

// Obtenir tous les chauffeurs
exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: drivers.length,
      data: drivers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des chauffeurs'
    });
  }
};

// Obtenir un chauffeur avec ses statistiques et courses
exports.getDriverWithRides = async (req, res) => {
  try {
    const { id } = req.params;
    
    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Chauffeur non trouvé'
      });
    }

    // Récupérer toutes les réservations du chauffeur
    const bookings = await Booking.find({ driver: id });

    // Préparer les statistiques
    const completedBookings = bookings.filter(booking => booking.status === 'completed');
    const stats = {
      totalRides: bookings.length,
      completedRides: completedBookings.length,
      averageRating: driver.rating || 0,
      completionRate: bookings.length ? (completedBookings.length / bookings.length) * 100 : 0,
      totalEarnings: completedBookings.reduce((acc, booking) => 
        acc + (booking.serviceType === 'private' ? booking.price.privatePrice : booking.price.sharedPrice), 0)
    };

    // Répartition des notes
    const ratings = completedBookings.reduce((acc, booking) => {
      if (booking.driverRating) {
        const rating = Math.floor(booking.driverRating);
        acc[rating] = (acc[rating] || 0) + 1;
      }
      return acc;
    }, {});

    // Formatter les courses
    const rides = bookings.map(booking => ({
      _id: booking._id,
      date: booking.journey.outbound?.date || booking.journey.inbound?.date,
      time: booking.journey.outbound?.time || booking.journey.inbound?.time,
      pickup: booking.client.address.city,
      destination: booking.journey.outbound?.airport || booking.journey.inbound?.airport,
      passengerName: `${booking.client.firstName} ${booking.client.lastName}`,
      price: booking.serviceType === 'private' ? booking.price.privatePrice : booking.price.sharedPrice,
      completed: booking.status === 'completed',
      rating: booking.driverRating
    }));

    res.json({
      success: true,
      data: {
        driver,
        stats,
        ratings,
        rides
      }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des données du chauffeur'
    });
  }
};

// Créer un nouveau chauffeur
exports.createDriver = async (req, res) => {
  try {
    const driver = new Driver(req.body);
    await driver.save();
    res.status(201).json({
      success: true,
      data: driver
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Mettre à jour un chauffeur
exports.updateDriver = async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Chauffeur non trouvé'
      });
    }

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Supprimer un chauffeur
exports.deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Chauffeur non trouvé'
      });
    }

    // Vérifier s'il y a des courses en attente
    const pendingBookings = await Booking.find({ 
      driver: req.params.id,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (pendingBookings.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Impossible de supprimer un chauffeur ayant des courses en attente'
      });
    }

    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};