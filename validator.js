const validator = {
  isEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  isCodiceFiscale: (cf) => {
    // Formato: 6 lettere + 2 numeri (anno) + 1 lettera (mese) + 2 numeri (giorno) + 4 caratteri (comune) + 1 carattere controllo
    return /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{3}[A-Z0-9]$/i.test(cf);
  },
  
  isCAP: (cap) => {
    return /^[0-9]{5}$/.test(cap);
  },
  
  isProvincia: (prov) => {
    return /^[A-Z]{2}$/i.test(prov);
  },
  
  isLatitude: (lat) => {
    const num = parseFloat(lat);
    return !isNaN(num) && num >= -90 && num <= 90;
  },
  
  isLongitude: (lng) => {
    const num = parseFloat(lng);
    return !isNaN(num) && num >= -180 && num <= 180;
  },
  
  validateCheckinPayload: (body) => {
    const errors = [];
    
    if (!body.timestamp) {
      errors.push('Campo mancante: timestamp');
    }
    
    if (!body.esito || !['verificato', 'fallito'].includes(body.esito)) {
      errors.push('Esito non valido (verificato | fallito)');
    }
    
    if (body.esito === 'fallito' && !body.motivo) {
      errors.push('Campo mancante: motivo');
    }
    
    if (body.esito === 'verificato') {
      const required = [
        'codiceFiscale', 'indirizzo', 'latitudine', 'longitudine',
        'latitudineResidenza', 'longitudineResidenza', 'distanzaMetri',
      ];
      for (const key of required) {
        if (body[key] === undefined || body[key] === null || body[key] === '') {
          errors.push(`Campo mancante: ${key}`);
        }
      }
      
      if (body.codiceFiscale && !validator.isCodiceFiscale(body.codiceFiscale)) {
        errors.push('Codice Fiscale non valido');
      }
      
      if (body.latitudine && !validator.isLatitude(body.latitudine)) {
        errors.push('Latitudine non valida');
      }
      
      if (body.longitudine && !validator.isLongitude(body.longitudine)) {
        errors.push('Longitudine non valida');
      }
    }
    
    return errors;
  },
  
  validateRichiestaPayload: (body) => {
    const errors = [];
    
    const cf = String(body.codiceFiscale || '').toUpperCase();
    if (!validator.isCodiceFiscale(cf)) {
      errors.push('Codice Fiscale non valido');
    }
    
    const via = String(body.via || '').trim();
    const civico = String(body.civico || '').trim();
    const cap = String(body.cap || '').trim();
    const comune = String(body.comune || '').trim();
    const provincia = String(body.provincia || '').trim().toUpperCase();
    
    if (!via) errors.push('Campo mancante: via');
    if (!civico) errors.push('Campo mancante: civico');
    if (!cap) errors.push('Campo mancante: CAP');
    if (!comune) errors.push('Campo mancante: comune');
    if (!provincia) errors.push('Campo mancante: provincia');
    
    if (cap && !validator.isCAP(cap)) {
      errors.push('CAP non valido (5 cifre)');
    }
    
    if (provincia && !validator.isProvincia(provincia)) {
      errors.push('Provincia non valida (2 lettere)');
    }
    
    return errors;
  }
};

module.exports = validator;
