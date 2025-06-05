const mongoose = require('mongoose');
const crypto = require('crypto');
const logger = require('../../utils/logger');

const bookingSchema = new mongoose.Schema({
  bookingReference: {
    type: String,
    unique: true,
    sparse: true
  },
  client: {
    firstName: { 
      type: String, 
      required: true,
      trim: true 
    },
    lastName: { 
      type: String, 
      required: true,
      trim: true 
    },
email: {
  type: String,
  required: true,
  trim: true,
  lowercase: true,
  match: [
    /^.+@.+\..+$/,
    'Email doit contenir @ et un domaine'
  ]
},
    phone: { 
      type: String, 
      required: true 
    },
    address: {
      street: { type: String, required: true, trim: true },
      number: { type: String, required: true, trim: true },
      postalCode: { 
        type: String, 
        required: true, 
        trim: true,
        match: [/^[0-9]{4,5}$/, 'Code postal invalide'] 
      },
      city: { type: String, required: true, trim: true },
      locality: { type: String, trim: true } // Nouveau champ pour la localité
    }
  },
  journey: {
    type: {
      type: String,
      enum: ['outbound', 'inbound', 'roundTrip'],
      required: true
    },
    outbound: {
      date: { type: Date },
      time: { type: String, match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format d\'heure invalide'] },
      airport: { type: String },
      pickupTime: { type: String, match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format d\'heure de prise en charge invalide'] },
      flightNumber: { 
        type: String,
        trim: true,
        maxlength: [10, 'Numéro de vol trop long'] 
      },
      price: {
        sharedPrice: { type: Number, default: 0, min: 0 },
        privatePrice: { type: Number, default: 0, min: 0 }
      }
    },
    inbound: {
      date: { type: Date },
      time: { type: String, match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format d\'heure invalide'] },
      airport: { type: String },
      flightNumber: { 
        type: String,
        trim: true,
        maxlength: [10, 'Numéro de vol trop long']
      },
      flightOrigin: { type: String },
      price: {
        sharedPrice: { type: Number, default: 0, min: 0 },
        privatePrice: { type: Number, default: 0, min: 0 }
      }
    }
  },
  passengers: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  serviceType: {
    type: String,
    enum: ['shared', 'private'],
    required: true
  },
  price: {
    sharedPrice: { type: Number, required: true, default: 0, min: 0 },
    privatePrice: { type: Number, required: true, default: 0, min: 0 }
  },
  options: {
    luggageCount: { type: Number, default: 0, max: 12, min: 0 },
    handLuggageCount: { type: Number, default: 0, max: 12, min: 0 },
    childSeatsCount: { type: Number, default: 0, max: 2, min: 0 },
    boosterSeatsCount: { type: Number, default: 0, max: 2, min: 0 },
    other: { type: String, maxlength: 500 }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  vatNumber: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'invoice', 'paid', 'transfer'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'cancelled'],
    default: 'pending'
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  driverEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  driverEarningsStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  },
  rating: {
    type: Number,
    min: 1,
    max: 10
  },
  comment: { 
    type: String,
    maxlength: 1000 
  },
  recommendedBy: String,
  agencyName: String,
  comments: { 
    type: String,
    maxlength: 1000 
  },
  completedAt: Date,
  completionNotes: { 
    type: String,
    maxlength: 500 
  },
  bookingGroupId: {
    type: String,
    sparse: true,
    index: true
  }
}, {
  timestamps: true
});

// Middleware de pré-sauvegarde
bookingSchema.pre('save', function(next) {
  // Générer une référence de réservation si elle n'existe pas déjà
  if (!this.bookingReference) {
    const timestamp = new Date().getTime().toString().slice(-6);
    const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    this.bookingReference = `SPE-${timestamp}-${randomStr}`;
  }

  const journeyType = this.journey.type;
  
  if ((journeyType === 'outbound' || journeyType === 'roundTrip') &&
      (!this.journey.outbound || !this.journey.outbound.date || !this.journey.outbound.time || !this.journey.outbound.airport)) {
    logger.error(`Validation pré-sauvegarde échouée: champs obligatoires du trajet aller manquants`);
    return next(new Error('Les champs obligatoires du trajet aller sont manquants'));
  }
  
  if ((journeyType === 'inbound' || journeyType === 'roundTrip') &&
      (!this.journey.inbound || !this.journey.inbound.date || !this.journey.inbound.time || !this.journey.inbound.airport)) {
    logger.error(`Validation pré-sauvegarde échouée: champs obligatoires du trajet retour manquants`);
    return next(new Error('Les champs obligatoires du trajet retour sont manquants'));
  }

  // Calcul automatique du prix total en fonction du type de service
  const totalPrice = this.serviceType === 'private' ? 
    this.price.privatePrice : 
    this.price.sharedPrice;

  // Si le prix total est défini et qu'il n'y a pas encore de driverEarnings
  if (totalPrice && !this.driverEarnings) {
    // Par défaut, le chauffeur reçoit 70% du prix total
    this.driverEarnings = totalPrice * 0.7;
  }
  
  next();
});

// Méthode pour accéder aux données client masquées pour des raisons de confidentialité
bookingSchema.methods.getClientSafeData = function() {
  const booking = this.toObject();
  
  // Masquer partiellement les informations sensibles
  if (booking.client) {
    // Masquer le nom de famille sauf les 2 premières lettres
    booking.client.lastName = booking.client.lastName.substring(0, 2) + '***';
    
    // Masquer l'email sauf le début et le domaine
    const emailParts = booking.client.email.split('@');
    if (emailParts.length === 2) {
      const username = emailParts[0];
      const domain = emailParts[1];
      booking.client.email = username.substring(0, 2) + '***@' + domain;
    }
    
    // Masquer le numéro de téléphone sauf les 4 derniers chiffres
    booking.client.phone = '******' + booking.client.phone.slice(-4);
    
    // Masquer l'adresse complète
    booking.client.address = {
      city: booking.client.address.city
    };
  }
  
  return booking;
};

// Index pour des recherches efficaces
bookingSchema.index({ 'client.email': 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ 'journey.outbound.date': 1 });
bookingSchema.index({ 'journey.inbound.date': 1 });
bookingSchema.index({ paymentMethod: 1 });
bookingSchema.index({ driver: 1 });
bookingSchema.index({ driverEarningsStatus: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ bookingReference: 1 });

// Méthodes statiques
bookingSchema.statics.getTotalDriverEarnings = async function(driverId) {
  const result = await this.aggregate([
    { $match: { 
      driver: mongoose.Types.ObjectId(driverId),
      status: 'completed'
    }},
    { $group: {
      _id: null,
      total: { $sum: '$driverEarnings' }
    }}
  ]);
  return result.length > 0 ? result[0].total : 0;
};

bookingSchema.statics.getWeeklyCashBookings = async function(driverId, startDate, endDate) {
  return this.find({
    driver: driverId,
    'journey.outbound.date': { $gte: startDate, $lte: endDate },
    paymentMethod: 'cash',
    status: 'completed'
  });
};

module.exports = mongoose.model('Booking', bookingSchema);