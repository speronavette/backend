const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');

const auth = async (req, res, next) => {
  try {
    const fullToken = req.header('Authorization');
    console.log('🔍 Token complet reçu:', fullToken);
    
    const token = fullToken?.replace('Bearer ', '');
    console.log('🎫 Token après nettoyage:', token);

    if (!token) {
      console.log('❌ Pas de token trouvé dans les headers');
      return res.status(401).json({ error: 'Token non fourni' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔓 Token décodé:', decoded);

      const driver = await Driver.findById(decoded.id);
      console.log('👤 Chauffeur trouvé:', driver ? 'oui' : 'non', 'ID:', decoded.id);

      if (!driver) {
        console.log('❌ Chauffeur non trouvé en base de données');
        return res.status(404).json({ error: 'Chauffeur non trouvé' });
      }

      req.driver = driver;
      req.token = token;
      console.log('✅ Authentification réussie pour chauffeur:', driver.email);
      next();
    } catch (jwtError) {
      console.error('❌ Erreur lors de la vérification du token:', jwtError);
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
  } catch (error) {
    console.error('❌ Erreur générale d\'authentification:', error);
    res.status(401).json({ error: 'Authentification échouée' });
  }
};

module.exports = auth;