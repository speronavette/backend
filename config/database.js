const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', false);
   
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
      },
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: true, // Pour diagnostiquer le problème SSL
      retryWrites: true,
      retryReads: true
    });
   
    console.log('✅ MongoDB connecté:', conn.connection.host);
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;