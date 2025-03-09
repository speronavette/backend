const jwt = require('jsonwebtoken');

const adminAuth = async (req, res, next) => {
    try {
      console.log('JWT_SECRET:', process.env.JWT_SECRET);
      const token = req.headers.authorization?.replace('Bearer ', '');    
      if (!token) return res.status(401).json({ error: 'Token manquant' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.isAdmin) return res.status(403).json({ error: 'Non autorisé' });
      req.admin = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Token invalide' });
    }
  };

module.exports = adminAuth;