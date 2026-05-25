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
  });
});

// ====== ROUTES STRIPE DIRECTES ======
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