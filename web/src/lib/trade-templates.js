/**
 * Default templates and configurations per trade category for new provider onboarding.
 */

export const TRADE_TEMPLATES = {
  electrician: {
    name_en: 'Electrician',
    name_ur: 'الیکٹریشن',
    greeting_ur: 'خوش آمدید! میں آپ کا خودکار الیکٹریکل اسسٹنٹ ہوں۔ آج آپ کے گھر یا دکان میں وائرنگ، شارٹ سرکٹ یا بجلی کے کس کام میں مدد درکار ہے؟',
    greeting_ps: 'TODO_PS',
    greeting_en: 'Welcome! I am your automated electrical assistant. How can we help with your wiring, short circuit, or electrical needs today?',
    services: [
      { name: 'Short Circuit / Sparks Repair', price_from: 1000, price_to: 2500, unit: 'per visit' },
      { name: 'Main Distribution Box Tuning', price_from: 1500, price_to: 3500, unit: 'per visit' },
      { name: 'Switchboard & Socket Replacement', price_from: 500, price_to: 1200, unit: 'per board' },
      { name: 'Complete Home Wiring Inspection', price_from: 2000, price_to: 5000, unit: 'per inspection' },
    ],
    faqs: [
      { q_ur: 'وزٹ چارجز کتنے ہیں؟', a_ur: 'عام معائنے کی فیس 500 روپے ہے، جو کام کروانے کی صورت میں کل بل سے منہا کی جاتی ہے۔' },
      { q_ur: 'کیا آپ ایمرجنسی میں آتے ہیں؟', a_ur: 'جی ہاں، شارٹ سرکٹ یا بجلی کے ہنگامی مسئلے کے لیے پشاور میں 45 سے 60 منٹ کے اندر وزٹ کی سہولت دستیاب ہے۔' },
      { q_ur: 'کیا کام کی گارنٹی ہوتی ہے؟', a_ur: 'ہماری تمام وائرنگ سروسز پر 7 دن کی ریپیئر وارنٹی فراہم کی جاتی ہے۔' },
    ],
  },
  ups_solar: {
    name_en: 'UPS & Solar',
    name_ur: 'یو پی ایس اور سولر',
    greeting_ur: 'خوش آمدید! میں آپ کا سولر اور یو پی ایس اسسٹنٹ ہوں۔ آج آپ کے انورٹر، بیٹری یا سولر پینلز میں کیا مسئلہ آ رہا ہے؟',
    greeting_ps: 'TODO_PS',
    greeting_en: 'Welcome! I am your solar and UPS assistant. What issue are you experiencing with your inverter, battery, or solar panels?',
    services: [
      { name: 'UPS Inverter Tuning & Desulfation', price_from: 1500, price_to: 3500, unit: 'per unit' },
      { name: 'Solar Inverter Error Code Diagnostics', price_from: 2000, price_to: 4500, unit: 'per visit' },
      { name: 'Battery Gravity & Terminal Replacement', price_from: 800, price_to: 1800, unit: 'per bank' },
      { name: 'Solar Panel Efficiency Cleaning & Check', price_from: 2500, price_to: 6000, unit: 'per array' },
    ],
    faqs: [
      { q_ur: 'وزٹ چارجز کیا ہیں؟', a_ur: 'سولر یا یو پی ایس کی چیکنگ فیس 500 روپے ہے۔' },
      { q_ur: 'بیٹری چارج نہیں ہو رہی، کیا وجہ ہو سکتی ہے؟', a_ur: 'یہ انورٹر کی چارجنگ کٹ یا بیٹری کی گریوٹی گرنے کا مسئلہ ہو سکتا ہے، ٹیکنیشن موقع پر چیک کر لے گا۔' },
    ],
  },
  ac_fridge: {
    name_en: 'AC & Refrigeration',
    name_ur: 'اے سی اور فریج',
    greeting_ur: 'خوش آمدید! میں آپ کا اے سی اور ریفریجریشن اسسٹنٹ ہوں۔ آج آپ کے ایئر کنڈیشنر، فریج یا ڈیپ فریزر میں کیا مسئلہ ہے؟',
    greeting_ps: 'TODO_PS',
    greeting_en: 'Welcome! I am your AC and refrigeration assistant. How can we help with your AC, fridge, or deep freezer today?',
    services: [
      { name: 'Inverter AC Chemical Jet Service', price_from: 2000, price_to: 3500, unit: 'per AC' },
      { name: 'Gas Leakage Test & Refrigerant Refill', price_from: 4000, price_to: 8500, unit: 'per unit' },
      { name: 'Compressor Trip / Capacitor Replacement', price_from: 1800, price_to: 3500, unit: 'per visit' },
      { name: 'Refrigerator Cooling & Thermostat Tuning', price_from: 1500, price_to: 4000, unit: 'per visit' },
    ],
    faqs: [
      { q_ur: 'کیا گیس چارجنگ پر وارنٹی دیتے ہیں؟', a_ur: 'جی ہاں، گیس لیکیج ٹیسٹ اور ری فل کے بعد 30 دن کی وارنٹی دی جاتی ہے۔' },
    ],
  },
  plumber_gas: {
    name_en: 'Plumber & Gas Fitting',
    name_ur: 'پلمبر اور گیس فٹنگ',
    greeting_ur: 'خوش آمدید! میں آپ کا پلمبنگ اور گیس فٹنگ اسسٹنٹ ہوں۔ آج آپ کے گیزر، پائپ لیکیج یا سینیٹری میں کیا مسئلہ ہے؟',
    greeting_ps: 'TODO_PS',
    greeting_en: 'Welcome! I am your plumbing and gas fitting assistant. How can we help with your geyser, pipe leakage, or sanitary work today?',
    services: [
      { name: 'Burst Pipe & Urgent Water Leakage', price_from: 1200, price_to: 3000, unit: 'per repair' },
      { name: 'Instant Geyser Ignition & Gas Tuning', price_from: 1500, price_to: 3500, unit: 'per unit' },
      { name: 'Motor Pump Installation / Repair', price_from: 2000, price_to: 4500, unit: 'per pump' },
      { name: 'Drainage & Pipe Blockage Clearing', price_from: 1000, price_to: 2500, unit: 'per line' },
    ],
    faqs: [
      { q_ur: 'گیس کی بو آ رہی ہو تو کیا کریں؟', a_ur: 'فوراً مین گیس والو بند کر دیں، کھڑکیاں کھولیں اور ماچس نہ جلائیں۔ ہمارا ٹیکنیشن فوری وزٹ کر سکتا ہے۔' },
    ],
  },
};

export const PESHAWAR_AREAS = [
  'Hayatabad',
  'University Town',
  'Board Bazaar',
  'Dabgari Garden',
  'Gulbahar',
  'Saddar',
  'Warsak Road',
  'Ring Road',
  'Kohat Road',
  'Dalazak Road',
  'Charsadda Road',
];
