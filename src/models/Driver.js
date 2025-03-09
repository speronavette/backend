const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const driverSchema = new Schema({
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis'], 
    trim: true
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Email invalide']
  },
  phone: {
    type: String,
    required: [true, 'Le numéro de téléphone est requis'],
    trim: true,
    match: [/^\+?[0-9\s]{10,15}$/, 'Format de téléphone invalide']
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères']
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    required: true
  },
  // Optionnels
  vehicleInfo: {
    brand: { type: String, default: '' },
    model: { type: String, default: '' },
    year: { type: String, default: '' },
    seats: {
      type: Number,
      min: 1,
      max: 9,
      default: 4
    },
    licensePlate: { type: String, default: '' }
  },
  professionalInfo: {
    licenseNumber: { type: String, default: '' },
    licenseExpiry: Date,
    startDate: { type: Date, default: Date.now },
    insuranceNumber: { type: String, default: '' },
    insuranceExpiry: Date
  },
  rating: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  totalRides: {
    type: Number,
    default: 0
  },
  completedRides: {
    type: Number,
    default: 0
  },
  // Sécurité supplémentaire
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexation pour des recherches efficaces
driverSchema.index({ email: 1 });
driverSchema.index({ phone: 1 });
driverSchema.index({ status: 1 });

// Hash le mot de passe avant sauvegarde
driverSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12); // Augmenter la complexité du salage
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Méthode pour vérifier le mot de passe
driverSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour nettoyer les données sensibles
driverSchema.methods.toPublicJSON = function() {
  const driverObject = this.toObject();
  delete driverObject.password;
  delete driverObject.failedLoginAttempts;
  delete driverObject.lockedUntil;
  
  // Enlever les infos professionnelles sensibles
  if (driverObject.professionalInfo) {
    delete driverObject.professionalInfo.licenseNumber;
    delete driverObject.professionalInfo.insuranceNumber;
  }
  
  return driverObject;
};

// Méthode pour incrémenter les tentatives de connexion échouées
driverSchema.methods.incrementLoginAttempts = async function() {
  this.failedLoginAttempts += 1;
  
  // Verrouiller le compte après 5 tentatives échouées
  if (this.failedLoginAttempts >= 5) {
    // Verrouiller pour 30 minutes
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
  }
  
  return this.save();
};

// Méthode pour réinitialiser les tentatives de connexion
driverSchema.methods.resetLoginAttempts = async function() {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  this.lastLogin = new Date();
  
  return this.save();
};

module.exports = mongoose.model('Driver', driverSchema);