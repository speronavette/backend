require('dotenv').config();
const { sendConfirmationEmail } = require('./services/emailService');

const testDirectEmail = async () => {
    try {
        await sendConfirmationEmail({
            to: 'spero.navette@gmail.com',
            booking: {
                client: {
                    firstName: 'Test',
                    lastName: 'User',
                    email: 'spero.navette@gmail.com',
                    address: {
                        street: 'Rue Test',
                        number: '123',
                        postalCode: '1000',
                        city: 'Bruxelles'
                    }
                },
                journey: {
                    outbound: {
                        date: new Date(),
                        time: '14:00',
                        airport: 'BRU'
                    }
                },
                options: {
                    luggageCount: 1,
                    handLuggageCount: 1,
                    childSeatsCount: 0,
                    boosterSeatsCount: 0
                },
                serviceType: 'shared',
                price: {
                    sharedPrice: 50,
                    privatePrice: 100
                }
            }
        });
        console.log("✅ Test email envoyé avec succès");
    } catch (error) {
        console.error("❌ Erreur lors du test d'envoi d'email:", error);
    }
};

testDirectEmail();