const { body, validationResult } = require('express-validator');

// Validation pour la création d'une réservation
exports.validateBookingCreate = [
  body('client.firstName').notEmpty().withMessage('Le prénom est requis'),
  body('client.lastName').notEmpty().withMessage('Le nom est requis'),
  body('client.email').isEmail().withMessage('Email invalide'),
  body('client.phone').notEmpty().withMessage('Téléphone requis'),
  body('journey').notEmpty().withMessage('Informations de voyage requises'),
  // Validez d'autres champs selon votre modèle
];

// Middleware de vérification des erreurs
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
};