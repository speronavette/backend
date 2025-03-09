const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const { getDriverStats } = require('../controllers/driverStatsController');
const { verifyAdminCredentials, generateAdminToken } = require('../../utils/adminAuth');
const logger = require('../../utils/logger');

// Routes Admin
router.post('/login/admin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (await verifyAdminCredentials(email, password)) {
      const token = generateAdminToken();
      logger.info(`Admin login successful: ${email}`);
      res.json({ success: true, token });
    } else {
      logger.warn(`Failed admin login attempt: ${email}`);
      res.status(401).json({ error: 'Identifiants invalides' });
    }
  } catch (error) {
    logger.error(`Erreur connexion admin: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// Routes protégées par authentification admin
router.get('/', adminAuth, async (req, res) => {
  try {
    const drivers = await Driver.find()
      .select('firstName lastName email phone status -_id')
      .sort({ firstName: 1, lastName: 1 });

    res.json({
      success: true,
      count: drivers.length,
      data: drivers
    });
  } catch (error) {
    logger.error(`Erreur récupération drivers: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des chauffeurs'
    });
  }
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    
    const existingDriver = await Driver.findOne({ email });
    if (existingDriver) {
      return res.status(400).json({ error: 'Un chauffeur avec cet email existe déjà' });
    }

    const driver = new Driver({
      firstName,
      lastName,
      email,
      phone,
      password,
      status: 'active'
    });

    await driver.save();
    
    // Ne pas renvoyer le mot de passe dans la réponse
    const driverResponse = driver.toObject();
    delete driverResponse.password;
    
    res.status(201).json({ success: true, data: driverResponse });
  } catch (error) {
    logger.error(`Erreur création chauffeur: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Chauffeur non trouvé'
      });
    }
    logger.info(`Chauffeur supprimé: ${driver._id}`);
    res.json({
      success: true,
      message: 'Chauffeur supprimé avec succès'
    });
  } catch (error) {
    logger.error(`Erreur suppression chauffeur: ${error.message}`);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/admin/drivers/:id', adminAuth, async (req, res) => {
  try {
    // Exclure le mot de passe des mises à jour depuis cet endpoint
    const { password, ...updateData } = req.body;
    
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

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
    logger.error(`Erreur mise à jour chauffeur: ${error.message}`);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Route publique
router.get('/active', async (req, res) => {
  try {
    const drivers = await Driver.find({ status: 'active' })
      .select('firstName lastName email vehicleInfo rating')
      .sort({ firstName: 1 });

    res.json({
      success: true,
      count: drivers.length,
      data: drivers
    });
  } catch (error) {
    logger.error(`Erreur récupération chauffeurs actifs: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des chauffeurs'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    logger.info(`Tentative de connexion: ${email}`);
    
    // Trouver le chauffeur par email
    const driver = await Driver.findOne({ email });

    if (!driver) {
      logger.warn(`Échec de connexion - email inexistant: ${email}`);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const isValid = await driver.comparePassword(password);

    if (!isValid) {
      logger.warn(`Échec de connexion - mot de passe invalide: ${email}`);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Générer le token avec algorithme spécifié
    const token = jwt.sign(
      { id: driver._id },
      process.env.JWT_SECRET,
      { 
        expiresIn: '24h',
        algorithm: 'HS256'
      }
    );

    logger.info(`Connexion réussie: ${email}`);
    res.json({
      success: true,
      token,
      driver: {
        id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        email: driver.email
      }
    });
  } catch (error) {
    logger.error(`Erreur de connexion: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// Middleware d'authentification pour toutes les routes suivantes
router.use(auth);

// Routes nécessitant une authentification
router.get('/stats', getDriverStats);

// Route pour obtenir le profil
router.get('/profile', async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id)
      .select('-password');

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
    logger.error(`Erreur profil: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du profil'
    });
  }
});

// Route pour mettre à jour le profil
router.put('/profile', async (req, res) => {
  try {
    const { password, ...updateData } = req.body; // Exclure le mot de passe des mises à jour
    
    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      updateData,
      { 
        new: true,
        runValidators: true
      }
    ).select('-password');

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
    logger.error(`Erreur mise à jour profil: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du profil'
    });
  }
});

// Récupération des courses
router.get('/rides', async (req, res) => {
  try {
    const driverId = req.user.id;
    const now = new Date();

    // Récupérer toutes les courses assignées au chauffeur
    const allBookings = await Booking.find({
      driver: driverId
    }).select('-__v'); // Exclure les données non nécessaires

    // Séparer les courses en "upcoming" et "past"
    const upcoming = [];
    const past = [];

    allBookings.forEach(booking => {
      const bookingDate = new Date(booking.journey.outbound?.date || booking.journey.inbound?.date);
      
      if (
        booking.status === 'inProgress' ||
        booking.status === 'confirmed' ||
        bookingDate > now
      ) {
        upcoming.push(booking);
      } else {
        past.push(booking);
      }
    });

    // Tri des courses
    upcoming.sort((a, b) => {
      const dateA = new Date(a.journey.outbound?.date || a.journey.inbound?.date);
      const dateB = new Date(b.journey.outbound?.date || b.journey.inbound?.date);
      return dateA - dateB;
    });

    past.sort((a, b) => {
      const dateA = new Date(a.journey.outbound?.date || a.journey.inbound?.date);
      const dateB = new Date(b.journey.outbound?.date || b.journey.inbound?.date);
      return dateB - dateA;
    });

    logger.info(`Récupéré ${upcoming.length} courses à venir et ${past.length} passées pour ${driverId}`);
    
    res.json({
      success: true,
      data: {
        upcoming,
        past
      }
    });

  } catch (error) {
    logger.error(`Erreur récupération courses: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des courses'
    });
  }
});

// Gestion des courses
router.post('/rides/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { driverEarnings } = req.body;
    
    // Vérifier que le chauffeur a le droit de modifier cette réservation
    const bookingToUpdate = await Booking.findById(id);
    if (!bookingToUpdate) {
      return res.status(404).json({
        success: false,
        error: 'Réservation non trouvée'
      });
    }
    
    // Vérifier que la réservation appartient bien au chauffeur authentifié
    if (bookingToUpdate.driver.toString() !== req.user.id) {
      logger.warn(`Tentative d'accès non autorisé: ${req.user.id} essaie de compléter la réservation ${id}`);
      return res.status(403).json({
        success: false,
        error: 'Vous n\'êtes pas autorisé à modifier cette réservation'
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      id,
      {
        status: 'completed',
        driverEarnings,
        completedAt: new Date()
      },
      { new: true }
    );

    // Mise à jour des statistiques chauffeur
    await Driver.findByIdAndUpdate(
      booking.driver,
      {
        $inc: {
          completedRides: 1,
          totalEarnings: driverEarnings
        }
      }
    );

    logger.info(`Course ${id} marquée comme complétée par ${req.user.id}`);
    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    logger.error(`Erreur completion course: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/rides/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que le chauffeur a le droit d'annuler cette réservation
    const bookingToCancel = await Booking.findById(id);
    if (!bookingToCancel) {
      return res.status(404).json({
        success: false,
        error: 'Réservation non trouvée'
      });
    }
    
    // Vérifier que la réservation appartient bien au chauffeur authentifié
    if (bookingToCancel.driver.toString() !== req.user.id) {
      logger.warn(`Tentative d'accès non autorisé: ${req.user.id} essaie d'annuler la réservation ${id}`);
      return res.status(403).json({
        success: false,
        error: 'Vous n\'êtes pas autorisé à annuler cette réservation'
      });
    }
    
    const booking = await Booking.findByIdAndUpdate(
      id,
      { status: 'cancelled' },
      { new: true }
    );

    logger.info(`Course ${id} annulée par ${req.user.id}`);
    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    logger.error(`Erreur annulation course: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'annulation'
    });
  }
});

router.get('/:driverId/bookings', adminAuth, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status } = req.query;

    const query = {
      driver: driverId
    };

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .sort({ 
        'journey.outbound.date': 1,
        'journey.outbound.pickupTime': 1
      });

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    logger.error(`Erreur récupération bookings de ${req.params.driverId}: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;