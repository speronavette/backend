const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const connectDB = require('./config/database');
const logger = require('./utils/logger');

// Import des routes et middlewares
const auth = require('./middlewares/authMiddleware');
const driverRoutes = require('./src/routes/driverRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const adminAuth = require('./src/middlewares/adminAuth');

// ✅ NOUVEAU : Import des routes Stripe pré-autorisation

// ✅ AJOUT : Stripe direct pour les routes rapides
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
let server;
app.set('trust proxy', 1);

// Fonction de graceful shutdown
const gracefulShutdown = async () => {
  logger.info('\n🛑 Signal d\'arrêt reçu...');
  if (server) {
    logger.info('👋 Fermeture du serveur HTTP...');
    await new Promise(resolve => server.close(resolve));
  }
  if (mongoose.connection.readyState === 1) {
    logger.info('📤 Fermeture de la connexion MongoDB...');
    await mongoose.connection.close();
  }
  logger.info('✅ Arrêt propre effectué');
  process.exit(0);
};

// ====== MIDDLEWARES DE SÉCURITÉ ======
// Protection des en-têtes HTTP
app.use(helmet());

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  message: 'Trop de requêtes, veuillez réessayer plus tard',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting pour les routes de connexion
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 tentatives par heure
  message: 'Trop de tentatives de connexion, veuillez réessayer plus tard',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting pour les créations de compte/ressources
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 créations par heure
  message: 'Trop de tentatives de création, veuillez réessayer plus tard',
  standardHeaders: true,
  legacyHeaders: false
});

// ✅ NOUVEAU : Rate limiting spécifique pour Stripe
const stripeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20, // 20 tentatives de paiement par heure
  message: 'Trop de tentatives de paiement, veuillez réessayer plus tard',
  standardHeaders: true,
  legacyHeaders: false
});

// ⚠️ IMPORTANT : Middleware spécial pour les webhooks Stripe (avant express.json)
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Middlewares de base
app.use(express.json({ limit: '10kb' })); // Limiter la taille des requêtes
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// CORS configuration - développement + production
app.use(cors({
  origin: [
    'https://www.spero-navette.be', 
    'https://spero-navette.be', 
    'https://frontend-6zq4.onrender.com',
    'http://localhost:3000',  // React dev
    'http://localhost:5173',  // Vite dev  
    'http://localhost:5174'   // Vite dev alternatif
  ],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));

// Appliquer le rate limiter global aux API
app.use('/api', globalLimiter);
// Appliquer des rate limiters spécifiques
app.use('/api/drivers/login', loginLimiter);
app.use('/api/drivers/login/admin', loginLimiter);
app.use('/api/bookings', createLimiter);
app.use('/api/drivers', createLimiter);
// ✅ NOUVEAU : Rate limiting pour Stripe
app.use('/api/stripe', stripeLimiter);

// Protection contre les injections NoSQL
app.use(mongoSanitize());

// Protection contre les attaques XSS
app.use(xss());

// Middleware pour journaliser les accès
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// ====== ROUTES PUBLIQUES ======
// Redirection de la page d'accueil vers le frontend
app.get('/', (req, res) => {
  res.redirect('https://app.spero-navette.be');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'up',
    timestamp: new Date().toISOString(),
    stripe_configured: !!process.env.STRIPE_SECRET_KEY
  });
});

// ====== ROUTES STRIPE DIRECTES ======
// ✅ AJOUT : Route directe pour create-payment-intent-preauth (SOLUTION IMMÉDIATE)
app.post('/api/stripe/create-payment-intent-preauth', async (req, res) => {
  try {
    const { amount, currency = 'eur', bookingData, bookingReference } = req.body;

    console.log('📝 Création PaymentIntent pré-auth:', {
      amount,
      currency,
      bookingReference,
      customer: `${bookingData.firstName} ${bookingData.lastName}`
    });

    // ✅ CORRECTION PRINCIPALE : confirmation_method: 'automatic'
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe utilise les centimes
      currency: currency.toLowerCase(),
      capture_method: 'manual', // ✅ PRÉ-AUTORISATION (ne pas débiter immédiatement)
      confirmation_method: 'automatic', // ✅ CHANGEMENT CRITIQUE ICI
      confirm: false,
      metadata: {
        bookingReference,
        customerName: `${bookingData.firstName} ${bookingData.lastName}`,
        customerEmail: bookingData.email,
        customerPhone: `${bookingData.countryCode === 'other' ? bookingData.customCountryCode : bookingData.countryCode} ${bookingData.phoneNumber}`,
        route: bookingData.route1,
        returnRoute: bookingData.route2 || 'none',
        passengers: bookingData.passengers,
        bags: bookingData.bags,
        type: 'shuttle_booking_preauth',
        needsReturn: bookingData.needsReturn || 'no'
      },
      description: `Spero Shuttle Pre-auth - ${bookingReference} - ${bookingData.route1}`
    });

    console.log('✅ PaymentIntent pré-autorisation créé:', paymentIntent.id);
    console.log('🔧 Confirmation method:', paymentIntent.confirmation_method); // Devrait afficher 'automatic'

    res.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: amount,
      currency: currency.toUpperCase()
    });

  } catch (error) {
    console.error('❌ Erreur création PaymentIntent pré-auth:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create payment intent',
      details: error.message 
    });
  }
});

// ✅ AJOUT : Route pour confirmer le paiement (si nécessaire)
app.post('/api/stripe/confirm-payment-intent', async (req, res) => {
  try {
    const { payment_intent_id, payment_method_id } = req.body;

    console.log('🔄 Confirmation PaymentIntent:', { payment_intent_id, payment_method_id });

    // Confirmer le PaymentIntent avec la méthode de paiement
    const paymentIntent = await stripe.paymentIntents.confirm(payment_intent_id, {
      payment_method: payment_method_id,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking-preauth-confirmation`
    });

    console.log('✅ PaymentIntent confirmé (pré-autorisé):', paymentIntent.id);
    console.log('💰 Statut:', paymentIntent.status);

    if (paymentIntent.status === 'requires_capture') {
      res.json({
        success: true,
        payment_intent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency
        },
        message: 'Payment pre-authorized successfully'
      });
    } else if (paymentIntent.status === 'requires_action') {
      res.json({
        success: false,
        requires_action: true,
        client_secret: paymentIntent.client_secret,
        message: 'Additional authentication required'
      });
    } else {
      throw new Error(`Unexpected payment status: ${paymentIntent.status}`);
    }

  } catch (error) {
    console.error('❌ Erreur confirmation PaymentIntent:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to confirm payment intent',
      details: error.message 
    });
  }
});

// Route publique pour les chauffeurs (GET)
app.get('/api/drivers', async (req, res) => {
  try {
    const Driver = require('./src/models/Driver');
    const drivers = await Driver.find({ status: 'active' })
      .select('firstName lastName email vehicleInfo rating')
      .sort({ firstName: 1, lastName: 1 });

    res.json({
      success: true,
      count: drivers.length,
      data: drivers
    });
  } catch (error) {
    logger.error(`Erreur récupération chauffeurs: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des chauffeurs'
    });
  }
});

// Route publique pour les réservations (GET) - Doit être protégée
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const Booking = require('./src/models/Booking');
    const { status } = req.query;
    
    let filter = {};
    if (status) {
      filter.status = status;
    }

    // Si c'est un chauffeur, afficher uniquement ses réservations
    if (req.user && !req.isAdmin) {
      filter.driver = req.user.id;
    }

    const bookings = await Booking.find(filter)
      .populate('driver', 'firstName lastName email')
      .sort({
        'journey.outbound.date': 1,
        'journey.outbound.pickupTime': 1
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
      error: 'Erreur lors de la récupération des réservations'
    });
  }
});

// ====== ROUTES PROTÉGÉES ======
// Routes des chauffeurs et réservations
app.use('/api/drivers', driverRoutes);
app.use('/api/bookings', bookingRoutes);


// ====== GESTION DES ERREURS ======
app.use((err, req, res, next) => {
  logger.error(`${req.method} ${req.path} - ${err.message}`);
  
  // Ne pas exposer les détails d'erreur en production
  res.status(err.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erreur interne du serveur' 
      : err.message
  });
});

// Route 404
app.use('*', (req, res) => {
  logger.warn(`Route non trouvée: ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} non trouvée`
  });
});

app.options('*', cors());

// ====== GESTION DES ERREURS PROCESSUS ======
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('unhandledRejection', (err) => {
  logger.error(`Promesse rejetée non gérée: ${err.message}`);
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown();
  }
});
process.on('uncaughtException', (err) => {
  logger.error(`Exception non capturée: ${err.message}`);
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown();
  }
});

// ====== DÉMARRAGE DU SERVEUR ======
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // ✅ NOUVEAU : Vérification des variables Stripe
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.warn('⚠️  STRIPE_SECRET_KEY non configurée - paiements désactivés');
    } else {
      logger.info('✅ Stripe configuré pour les paiements');
    }

    try {
      await connectDB();
      logger.info('✅ MongoDB connecté avec succès');
    } catch (dbError) {
      logger.warn(`⚠️  MongoDB non disponible: ${dbError.message} - Serveur démarre sans DB`);
    }

    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`
🚀 Serveur démarré avec succès
📡 URL: http://localhost:${PORT}
🌐 Frontend autorisé: ${process.env.FRONTEND_URL || 'http://localhost:5173'}
💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configuré' : 'Non configuré'}
💳 Stripe routes: Directes + Module séparé
⚙️  Environnement: ${process.env.NODE_ENV || 'development'}
📦 Node.js: ${process.version}
🧮 Process ID: ${process.pid}
      `);
    });
  } catch (error) {
    logger.error(`Erreur lors du démarrage du serveur: ${error.message}`);
    process.exit(1);
  }
};

startServer();