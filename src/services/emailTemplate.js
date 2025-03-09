const formatDate = (dateString) => {
  try {
    if (!dateString) return 'Date non spécifiée';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date invalide';
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Erreur de formatage de date:', error);
    return 'Date non spécifiée';
  }
};

const formatPrice = (price, serviceType) => {
  if (!price) return '0 €';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(serviceType === 'private' ? (price.privatePrice || 0) : (price.sharedPrice || 0));
};

const generateJourneySection = (journey, isOutbound, price, serviceType) => {
  if (!journey || (!journey.date && !journey.time && !journey.airport)) {
    return `
      <div class="journey-info">
        <p class="journey-title" style="font-style: italic; color: #888;">
          ${isOutbound ? 'Pas de trajet aller' : 'Pas de trajet retour'}
        </p>
      </div>
    `;
  }

  const journeyPrice = journey.price || price;
  const sectionPrice = {
    sharedPrice: journeyPrice?.sharedPrice || 0,
    privatePrice: journeyPrice?.privatePrice || 0
  };

  const displayPrice = serviceType === 'private' 
    ? sectionPrice.privatePrice 
    : sectionPrice.sharedPrice;

  return `
    <div class="journey-info">
      <div class="info-row">
        <div class="info-label">Date:</div>
        <div class="info-value">${formatDate(journey.date)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Type de trajet:</div>
        <div class="info-value">${isOutbound ? 'Aller' : 'Retour'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Heure de vol:</div>
        <div class="info-value">${journey.time || 'Non spécifié'}</div>
      </div>
      ${isOutbound ? `
        <div class="info-row">
          <div class="info-label">Heure de prise en charge:</div>
          <div class="info-value">${journey.pickupTime || 'À confirmer'}</div>
        </div>
      ` : `
        <div class="info-row">
          <div class="info-label">Numéro de vol:</div>
          <div class="info-value">${journey.flightNumber || 'Non spécifié'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Origine du vol:</div>
          <div class="info-value">${journey.flightOrigin || 'Non spécifié'}</div>
        </div>
      `}
      <div class="info-row">
        <div class="info-label">Aéroport:</div>
        <div class="info-value">${journey.airport || 'Non spécifié'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Prix:</div>
        <div class="info-value">${formatPrice({ sharedPrice: displayPrice }, serviceType)}</div>
      </div>
    </div>
  `;
};

const generateEmailTemplate = (booking, template = 'confirmed') => {
  const speroColor = 'rgb(232, 138, 120)';
  const styles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .content-section {
      background-color: #fff5f5 !important;
      border: 2px solid ${speroColor};
      border-radius: 12px !important;
      margin: 0 0 15px 0;
      padding: 0;
      text-align: center;
      overflow: hidden;
      width: 100%;
      position: relative;
    }

    .section-title {
      background-color: rgba(232, 138, 120, 0.1);
      color: ${speroColor};
      padding: 8px;
      text-align: center;
      border-bottom: 1px solid ${speroColor};
    }

    .section-content {
      padding: 10px;
      background-color: transparent;
      position: relative;
    }

    .info-label {
      color: ${speroColor};
      margin-top: 8px;
    }

    .journey-title {
      color: ${speroColor};
      font-weight: bold;
      padding: 15px;
      margin: 15px 0;
      text-align: center;
      background-color: rgba(232, 138, 120, 0.1);
    }

    .header {
      background-color: ${speroColor};
      color: white;
      padding: 15px;
      text-align: center;
      border-radius: 12px 12px 0 0 !important;
    }

    .footer {
      background-color: rgba(232, 138, 120, 0.1);
      padding: 15px;
      text-align: center;
      border-radius: 0 0 12px 12px !important;
      border: 1px solid ${speroColor};
    }

    .review-button {
      display: inline-block;
      background-color: ${speroColor};
      color: white;
      padding: 12px 25px;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      margin: 20px 0;
    }

    .review-button:hover {
      opacity: 0.9;
    }
  `;

  // Template pour la demande d'avis
  if (template === 'review') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>${styles}</style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin:0;font-size:20px;">Votre avis nous intéresse !</h1>
          <p style="margin:5px 0;font-size:16px;">Spero Navette</p>
        </div>

        <div class="content-section">
          <div class="section-content">
            <p>Cher(e) ${booking.client.firstName} ${booking.client.lastName},</p>
            <p style="margin: 20px 0;">Nous espérons que votre transfert du ${formatDate(booking.journey.outbound?.date || booking.journey.inbound?.date)} s'est bien passé.</p>
            <p style="margin: 20px 0;">Votre satisfaction est notre priorité ! Nous serions ravis d'avoir votre retour sur nos services.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://g.page/r/CQTXwFtumGyuEBM/review" 
                 class="review-button"
                 target="_blank">
                Donner mon avis
              </a>
            </div>

            <p style="margin: 20px 0; color: #666;">
              Votre avis nous aidera à améliorer nos services et à mieux répondre à vos besoins lors de vos prochains voyages.
            </p>
          </div>
        </div>

        <div class="footer">
          <p style="margin:5px 0;">Merci de votre confiance !</p>
          <p style="margin:10px 0;">
            <strong>Pour toute question, contactez-nous :</strong>
          </p>
          <p style="margin:5px 0;">Tél: +32 490 39 69 67</p>
          <p style="margin:5px 0;">Email: spero.navette@gmail.com</p>
          <p style="margin:5px 0;"><strong>Spero Navette - Les vacances à votre porte !</strong></p>
        </div>
      </body>
      </html>
    `;
  }

  // Template pour le rejet
  if (template === 'rejected') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>${styles}</style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin:0;font-size:20px;">Demande de réservation non confirmée</h1>
          <p style="margin:5px 0;font-size:16px;">Spero Navette</p>
        </div>

        <div class="content-section">
          <div class="section-content">
            <p>Cher(e) ${booking.client.firstName} ${booking.client.lastName},</p>
            <p style="margin: 20px 0;">Nous sommes désolés de vous informer que votre demande de réservation pour le ${formatDate(booking.journey.outbound?.date || booking.journey.inbound?.date)} n'a pas pu être confirmée.</p>
            <p style="margin: 20px 0;">N'hésitez pas à nous contacter pour plus d'informations ou pour effectuer une nouvelle réservation.</p>
          </div>
        </div>

        <div class="footer">
          <strong>Pour toute question, contactez-nous :</strong>
          <p style="margin:5px 0;">Tél: +32 490 39 69 67</p>
          <p style="margin:5px 0;">Email: spero.navette@gmail.com</p>
          <p style="margin:5px 0;">Spero Navette - Les vacances à votre porte !</p>
        </div>
      </body>
      </html>
    `;
  }

  // Template pour la confirmation (par défaut)
  try {
    const hasOutbound = !!booking.journey?.outbound;
    const hasInbound = !!booking.journey?.inbound;
    const client = {
      firstName: booking.client?.firstName || 'Non spécifié',
      lastName: booking.client?.lastName || 'Non spécifié',
      phone: booking.client?.phone || 'Non spécifié',
      address: {
        street: booking.client?.address?.street || 'Non spécifié',
        number: booking.client?.address?.number || '',
        postalCode: booking.client?.address?.postalCode || 'Non spécifié',
        city: booking.client?.address?.city || 'Non spécifié'
      }
    };

    // Traduire la méthode de paiement en français
    const paymentMethodTranslation = {
      'cash': 'Espèces',
      'transfer': 'Virement',
      'invoice': 'Facture'
    };
    const paymentMethod = paymentMethodTranslation[booking.paymentMethod] || booking.paymentMethod || 'Non spécifiée';
    
    // Traduire la source de recommandation
    const recommendedByTranslation = {
      'google': 'Google',
      'facebook': 'Facebook',
      'agency': 'Agence de voyage',
      'recommendation': 'Recommandation d\'un proche',
      'advertisement': 'Publicité',
      'other': 'Autre'
    };
    const recommendedBy = booking.recommendedBy ? (recommendedByTranslation[booking.recommendedBy] || booking.recommendedBy) : '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>${styles}</style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin:0;font-size:20px;">Confirmation de Réservation</h1>
          <p style="margin:5px 0;font-size:16px;">Spero Navette</p>
        </div>

        <div class="content-section">
          <h2 class="section-title">Informations personnelles</h2>
          <div class="section-content">
            <div class="info-row">
              <div class="info-label">Nom:</div>
              <div class="info-value">${client.lastName}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Prénom:</div>
              <div class="info-value">${client.firstName}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Téléphone:</div>
              <div class="info-value">${client.phone}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Adresse:</div>
              <div class="info-value">
                ${client.address.street} ${client.address.number}<br>
                ${client.address.postalCode} ${client.address.city}
              </div>
            </div>
          </div>
        </div>

        <div class="content-section">
          <h2 class="section-title">Détails du trajet</h2>
          <div class="section-content">
            ${hasOutbound ? `
              <div class="journey-title">Aller</div>
              ${generateJourneySection(booking.journey.outbound, true, booking.price, booking.serviceType)}
            ` : generateJourneySection(null, true, booking.price, booking.serviceType)}
            
            ${hasInbound ? `
              <div class="journey-title">Retour</div>
              ${generateJourneySection(booking.journey.inbound, false, booking.price, booking.serviceType)}
            ` : generateJourneySection(null, false, booking.price, booking.serviceType)}
          </div>
        </div>

        <div class="content-section">
          <h2 class="section-title">Détails de la réservation & Options gratuites</h2>
          <div class="section-content">
            <div class="info-row">
              <div class="info-label">Nombre de passagers:</div>
              <div class="info-value">${booking.passengers}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Type de service:</div>
              <div class="info-value">${booking.serviceType === 'private' ? 'Navette privée' : 'Navette partagée'}</div>
            </div>
            ${booking.recommendedBy ? `
            <div class="info-row">
              <div class="info-label">Recommandé par:</div>
              <div class="info-value">${recommendedBy}${booking.agencyName ? ': ' + booking.agencyName : ''}</div>
            </div>` : ''}
            <div class="info-row">
              <div class="info-label">Options gratuites:</div>
              <ul class="options-list" style="font-size: 14px;">
                ${booking.options?.luggageCount ? `<li>Bagages en soute: ${booking.options.luggageCount}</li>` : ''}
                ${booking.options?.handLuggageCount ? `<li>Bagages à main: ${booking.options.handLuggageCount}</li>` : ''}
                ${booking.options?.childSeatsCount ? `<li>Sièges enfant: ${booking.options.childSeatsCount}</li>` : ''}
                ${booking.options?.boosterSeatsCount ? `<li>Rehausseurs: ${booking.options.boosterSeatsCount}</li>` : ''}
                ${booking.options?.other ? `<li>Autres: ${booking.options.other}</li>` : ''}
                ${!booking.options?.luggageCount && 
                  !booking.options?.handLuggageCount && 
                  !booking.options?.childSeatsCount && 
                  !booking.options?.boosterSeatsCount && 
                  !booking.options?.other ? 
                  `<li style="color:${speroColor};font-style:italic;font-size:14px;">Aucune option sélectionnée</li>` : ''}
              </ul>
            </div>
            <div class="info-row" style="margin-bottom: 0;">
              <div class="info-label">Prix total${booking.journey.type === 'roundTrip' ? ' (aller-retour)' : ''}:</div>
              <div class="info-value" style="margin-bottom: 0;">${formatPrice(booking.price, booking.serviceType)}</div>
              ${booking.journey.type === 'roundTrip' ? `
                <div style="font-size: 12px; color: #666;">
                  (Aller: ${formatPrice(booking.journey.outbound.price, booking.serviceType)} + 
                   Retour: ${formatPrice(booking.journey.inbound.price, booking.serviceType)})
                </div>
              ` : ''}
              <div class="payment-info" style="margin-top: 0; padding-top: 0;">
                <p style="font-size: 13px; color: #666; margin-top: 0;">
                  En espèces au chauffeur le jour de la navette<br>
                  ou<br>
                  Par virement bancaire au plus tard 5 jours ouvrables avant le transfert sur le compte suivant :<br>
                  Nom: Spero Navette SRL<br>
                  Numéro de compte: BE64 3630 0968 1852<br>
                  Communication: "${client.lastName} ${client.firstName} ${client.address.postalCode} ${client.address.city}"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="content-section">
          <h2 class="section-title">Informations importantes</h2>
          <div class="section-content">
            <ul class="options-list">
              <li>Merci d'être prêt 5 minutes avant l'heure de prise en charge indiquée</li>
              <li>En cas de retard ou d'imprévu, veuillez nous contacter immédiatement</li>
              <li>Pour toute modification de votre réservation, contactez-nous 24h à l'avance</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <strong>Pour toute question ou modification, contactez-nous :</strong>
          <p style="margin:5px 0;">Tél: +32 490 39 69 67</p>
          <p style="margin:5px 0;">Email: spero.navette@gmail.com</p>
          <p style="margin:5px 0;">Spero Navette - Les vacances à votre porte !</p>
        </div>
      </body>
      </html>
    `;
  } catch (error) {
    console.error('Erreur dans la génération du template:', error);
    throw error;
  }
};

const generateAdminNotificationTemplate = (booking) => {
  const speroColor = 'rgb(232, 138, 120)';
  
  // Traduction des termes en anglais
  const paymentMethodTranslation = {
    'cash': 'Espèces',
    'transfer': 'Virement',
    'invoice': 'Facture'
  };
  
  const recommendedByTranslation = {
    'google': 'Google',
    'facebook': 'Facebook',
    'agency': 'Agence de voyage',
    'recommendation': 'Recommandation d\'un proche',
    'advertisement': 'Publicité',
    'other': 'Autre'
  };
  
  const paymentMethod = paymentMethodTranslation[booking.paymentMethod] || booking.paymentMethod || 'Non spécifiée';
  const recommendedBy = booking.recommendedBy ? (recommendedByTranslation[booking.recommendedBy] || booking.recommendedBy) : '';
  
  // Déterminer le type de trajet et préparer les détails
  let journeyType = '';
  let journeyDetails = '';
  
  if (booking.journey.type === 'roundTrip') {
    // Pour les aller-retour, vérifiez que les deux trajets sont présents
    journeyType = 'Aller-retour';
    
    const outboundDate = booking.journey.outbound?.date ? formatDate(booking.journey.outbound.date) : 'Date non spécifiée';
    const outboundTime = booking.journey.outbound?.time || 'Heure non spécifiée';
    const outboundAirport = booking.journey.outbound?.airport || 'Aéroport non spécifié';
    
    const inboundDate = booking.journey.inbound?.date ? formatDate(booking.journey.inbound.date) : 'Date non spécifiée';
    const inboundTime = booking.journey.inbound?.time || 'Heure non spécifiée';
    const inboundAirport = booking.journey.inbound?.airport || 'Aéroport non spécifié';
    
    journeyDetails = `
      <p><strong>Aller:</strong> ${outboundDate} à ${outboundTime}</p>
      <p><strong>Vers:</strong> ${outboundAirport}</p>
      <p><strong>Retour:</strong> ${inboundDate} à ${inboundTime}</p>
      <p><strong>De:</strong> ${inboundAirport}</p>
    `;
  } else if (booking.journey.outbound && booking.journey.outbound.date) {
    journeyType = 'Aller simple';
    journeyDetails = `
      <p><strong>Date:</strong> ${formatDate(booking.journey.outbound.date)} à ${booking.journey.outbound.time || 'Heure non spécifiée'}</p>
      <p><strong>Vers:</strong> ${booking.journey.outbound.airport || 'Non spécifié'}</p>
      <p><em style="color:#888;">Pas de trajet retour</em></p>
    `;
  } else if (booking.journey.inbound && booking.journey.inbound.date) {
    journeyType = 'Retour simple';
    journeyDetails = `
      <p><em style="color:#888;">Pas de trajet aller</em></p>
      <p><strong>Date:</strong> ${formatDate(booking.journey.inbound.date)} à ${booking.journey.inbound.time || 'Heure non spécifiée'}</p>
      <p><strong>De:</strong> ${booking.journey.inbound.airport || 'Non spécifié'}</p>
    `;
  } else {
    journeyType = 'Type de trajet non spécifié';
    journeyDetails = `<p><em>Informations de trajet incomplètes</em></p>`;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background-color: ${speroColor}; color: white; padding: 15px; text-align: center; border-radius: 12px 12px 0 0; }
        .content-section { background-color: #fff5f5; border: 2px solid ${speroColor}; border-radius: 12px; margin: 0 0 15px 0; padding: 0; overflow: hidden; }
        .section-title { background-color: rgba(232, 138, 120, 0.1); color: ${speroColor}; padding: 8px; text-align: center; border-bottom: 1px solid ${speroColor}; }
        .section-content { padding: 15px; }
        .footer { background-color: rgba(232, 138, 120, 0.1); padding: 15px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid ${speroColor}; }
        .price { font-size: 18px; font-weight: bold; color: ${speroColor}; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:20px;">Nouvelle demande de réservation</h1>
          <p style="margin:5px 0;font-size:16px;">Spero Navette</p>
        </div>
        
        <div class="content-section">
          <h2 class="section-title">Informations client</h2>
          <div class="section-content">
            <p><strong>Nom:</strong> ${booking.client.lastName} ${booking.client.firstName}</p>
            <p><strong>Email:</strong> ${booking.client.email}</p>
            <p><strong>Téléphone:</strong> ${booking.client.phone}</p>
            <p><strong>Adresse:</strong> ${booking.client.address.street} ${booking.client.address.number}, ${booking.client.address.postalCode} ${booking.client.address.city}</p>
          </div>
        </div>
        
        <div class="content-section">
          <h2 class="section-title">Détails du trajet</h2>
          <div class="section-content">
            <h3 style="color:${speroColor};margin-bottom:10px;">${journeyType}</h3>
            ${journeyDetails}
            <p><strong>Passagers:</strong> ${booking.passengers}</p>
            <p><strong>Type de service:</strong> ${booking.serviceType === 'private' ? 'Navette privée' : 'Navette partagée'}</p>
            <p class="price">Prix: ${booking.serviceType === 'private' ? booking.price.privatePrice : booking.price.sharedPrice} €</p>
            </div>
        </div>
        
        <div class="content-section">
          <h2 class="section-title">Options</h2>
          <div class="section-content">
            <p><strong>Bagages en soute:</strong> ${booking.options?.luggageCount || 0}</p>
            <p><strong>Bagages à main:</strong> ${booking.options?.handLuggageCount || 0}</p>
            <p><strong>Sièges enfant:</strong> ${booking.options?.childSeatsCount || 0}</p>
            <p><strong>Réhausseurs:</strong> ${booking.options?.boosterSeatsCount || 0}</p>
            ${booking.options?.other ? `<p><strong>Autres:</strong> ${booking.options.other}</p>` : ''}
          </div>
        </div>
        
        <div class="content-section">
          <h2 class="section-title">Informations de paiement</h2>
          <div class="section-content">
            <p><strong>Méthode:</strong> ${paymentMethod}</p>
            ${booking.vatNumber ? `<p><strong>N° TVA:</strong> ${booking.vatNumber}</p>` : ''}
            ${recommendedBy ? `<p><strong>Source:</strong> ${recommendedBy}</p>` : ''}
            ${booking.agencyName ? `<p><strong>Nom de l'agence:</strong> ${booking.agencyName}</p>` : ''}
          </div>
        </div>
        
        <div class="content-section">
          <h2 class="section-title">Actions requises</h2>
          <div class="section-content">
            <p>Cette réservation est en attente de confirmation.</p>
            <p>Veuillez vous connecter au tableau de bord administrateur pour la confirmer.</p>
          </div>
        </div>
        
        <div class="footer">
          <p>Cet email a été généré automatiquement par le système de réservation Spero Navette.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  generateEmailTemplate,
  generateAdminNotificationTemplate
};