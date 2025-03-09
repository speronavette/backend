const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('./logger');

// Cette fonction devrait être exécutée une seule fois pour générer le hash
// et le stocker dans vos variables d'environnement
const generatePasswordHash = async (password) => {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

const verifyAdminCredentials = async (email, password) => {
  try {
    // Vérifier l'email en premier
    if (email !== process.env.ADMIN_EMAIL) {
      return false;
    }
    
    // Ensuite vérifier le mot de passe hashé
    // ADMIN_PASSWORD_HASH devrait être un hash bcrypt stocké dans votre .env
    return await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
  } catch (error) {
    logger.error(`Erreur lors de la vérification des identifiants admin: ${error.message}`);
    return false;
  }
};

const generateAdminToken = () => {
  return jwt.sign(
    { id: 'admin', isAdmin: true },
    process.env.JWT_SECRET,
    { 
      expiresIn: '24h',
      algorithm: 'HS256'
    }
  );
};

module.exports = {
  generatePasswordHash,
  verifyAdminCredentials,
  generateAdminToken
};