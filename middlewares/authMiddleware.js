const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
  // Pour les routes GET vers /api/drivers, on passe directement
  if (req.method === 'GET' && req.path === '/') {
    logger.info('✅ Accès public à /api/drivers autorisé');
    return next();
  }

  // Pour toutes les autres routes, on vérifie l'authentification
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      logger.warn('❌ Tentative d\'accès sans token');
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256']
      });
      
      if (decoded.isAdmin) {
        logger.info(`✅ Authentification admin réussie: ${decoded.email}`);
        req.user = decoded;
        req.isAdmin = true;
        req.token = token;
        return next();
      }
      
      // Si on arrive ici, ce n'est pas un admin
      logger.warn(`❌ Tentative d'accès non-admin: ${decoded.email}`);
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
      
    } catch (jwtError) {
      logger.error(`🔐 Erreur de décodage JWT: ${jwtError.message}`);
      return res.status(401).json({
        success: false,
        message: 'Session expirée ou invalide'
      });
    }
  } catch (error) {
    logger.error(`❌ Erreur d'authentification: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur d\'authentification'
    });
  }
};

module.exports = auth;