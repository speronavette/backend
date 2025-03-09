const Booking = require('../models/Booking');
const { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } = require('date-fns');

const getDriverStats = async (req, res) => {
   try {
       const driverId = req.driver._id;
       const now = new Date();

       // Définir les périodes
       const weekStart = startOfWeek(now, { weekStartsOn: 1 });
       const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
       const monthStart = startOfMonth(now);
       const monthEnd = endOfMonth(now);
       const lastMonthStart = startOfMonth(subMonths(now, 1));
       const lastMonthEnd = endOfMonth(subMonths(now, 1));

       // Récupérer toutes les courses du chauffeur
       const allBookings = await Booking.find({
           driver: driverId,
           status: { $in: ['completed', 'confirmed'] }
       }).sort({ 'journey.outbound.date': -1 });

       // Calculer les stats de la semaine
       const weeklyBookings = allBookings.filter(booking => {
           const bookingDate = new Date(booking.journey.outbound.date);
           return bookingDate >= weekStart && bookingDate <= weekEnd;
       });

       // Calculer les stats du mois en cours
       const monthlyBookings = allBookings.filter(booking => {
           const bookingDate = new Date(booking.journey.outbound.date);
           return bookingDate >= monthStart && bookingDate <= monthEnd;
       });

       // Calculer les stats du mois précédent
       const lastMonthBookings = allBookings.filter(booking => {
           const bookingDate = new Date(booking.journey.outbound.date);
           return bookingDate >= lastMonthStart && bookingDate <= lastMonthEnd;
       });

       // Calculer le cash de la semaine
       const weekCash = weeklyBookings
           .filter(booking => booking.paymentMethod === 'cash')
           .reduce((sum, booking) => {
               const price = booking.serviceType === 'private' 
                   ? booking.price.privatePrice 
                   : booking.price.sharedPrice;
               return sum + (price || 0);
           }, 0);

       // Calculer le chiffre d'affaires du mois
       const monthRevenue = monthlyBookings.reduce((sum, booking) => {
           const price = booking.serviceType === 'private' 
               ? booking.price.privatePrice 
               : booking.price.sharedPrice;
           return sum + (price || 0);
       }, 0);

       // Préparer la réponse
       res.json({
           success: true,
           data: {
               weekCash,
               weekRides: weeklyBookings.length,
               monthRevenue,
               monthEarnings: monthlyBookings
                   .reduce((sum, booking) => sum + (booking.driverEarnings || 0), 0),
               lastMonthEarnings: lastMonthBookings
                   .reduce((sum, booking) => sum + (booking.driverEarnings || 0), 0),
               rides: allBookings.map(booking => ({
                   id: booking._id,
                   date: booking.journey.outbound.date,
                   price: booking.serviceType === 'private' 
                       ? booking.price.privatePrice 
                       : booking.price.sharedPrice,
                   driverEarnings: booking.driverEarnings,
                   paymentMethod: booking.paymentMethod,
                   status: booking.status,
                   client: {
                       firstName: booking.client.firstName,
                       lastName: booking.client.lastName
                   },
                   journey: {
                       from: booking.client.address.city,
                       to: booking.journey.outbound.airport,
                       date: booking.journey.outbound.date,
                       time: booking.journey.outbound.pickupTime
                   }
               }))
           }
       });
   } catch (error) {
       console.error('Erreur lors de la récupération des statistiques:', error);
       res.status(500).json({
           success: false,
           error: 'Erreur lors de la récupération des statistiques'
       });
   }
};

module.exports = {
   getDriverStats
};