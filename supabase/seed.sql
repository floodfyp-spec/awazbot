-- =============================================================================
-- AwazBot KP — Seed Data
-- =============================================================================
-- NOTE:
-- Replace 'demo.notify@example.com' with your team's real notification email
-- before running if you wish to receive actual booking notification test emails.
--
-- Demo providers have owner_user_id = NULL because they are catalog showcase
-- providers not tied to a real auth.users account at seed time. When real
-- providers sign up via /signup, owner_user_id is set to their auth.uid().
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Categories
-- -----------------------------------------------------------------------------
INSERT INTO categories (id, name_en, name_ur, name_ps, icon, display_order)
VALUES
    ('electrician', 'Electrician', 'الیکٹریشن', 'TODO_PS', 'Zap', 1),
    ('ups_solar', 'UPS & Solar', 'یو پی ایس اور سولر', 'TODO_PS', 'Sun', 2),
    ('ac_fridge', 'AC & Refrigeration', 'اے سی اور فریج', 'TODO_PS', 'Snowflake', 3),
    ('plumber_gas', 'Plumber & Gas Fitting', 'پلمبر اور گیس فٹنگ', 'TODO_PS', 'Wrench', 4)
ON CONFLICT (id) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ur = EXCLUDED.name_ur,
    name_ps = EXCLUDED.name_ps,
    icon = EXCLUDED.icon,
    display_order = EXCLUDED.display_order;

-- -----------------------------------------------------------------------------
-- 2. Issues (14 realistic issues with synonyms and urgencies)
-- -----------------------------------------------------------------------------
INSERT INTO issues (id, category_id, name_en, name_ur, name_ps, default_urgency, synonyms)
VALUES
    -- Electrician
    (
        'short_circuit_sparks', 'electrician',
        'Short Circuit / Sparks', 'شارٹ سرکٹ / چنگاریاں', 'TODO_PS',
        'EMERGENCY',
        '{
            "en": ["sparking", "short circuit", "spark", "breaker tripping", "switch burning"],
            "ur": ["شارٹ سرکٹ", "چنگاریاں", "دھواں", "سوئچ جل گیا", "بریکر گر گیا"],
            "ur_roman": ["short circuit", "chingari", "dhuan", "switch jal gaya", "breaker gir gaya"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),
    (
        'complete_power_outage', 'electrician',
        'Complete Home Power Outage', 'گھر کی مکمل بجلی بند', 'TODO_PS',
        'URGENT',
        '{
            "en": ["no light", "power outage", "main switch tripped", "blackout", "phase down"],
            "ur": ["بجلی چلی گئی", "مین بریکر بند", "لائٹ نہیں ہے", "فیز چلا گیا"],
            "ur_roman": ["light nahi hai", "bijli band", "phase chala gaya", "main switch band"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),
    (
        'switchboard_wiring_repair', 'electrician',
        'Switchboard / Socket Repair', 'سوئچ بورڈ یا ساکٹ کی خرابی', 'TODO_PS',
        'ROUTINE',
        '{
            "en": ["broken switch", "socket not working", "board repair", "dimmer change"],
            "ur": ["سوئچ بورڈ خراب ہے", "پلگ کام نہیں کر رہا", "ڈمر بدلنا ہے"],
            "ur_roman": ["switchboard kharab", "plug kaam nahi kar raha", "dimmer change"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),
    (
        'ceiling_fan_installation', 'electrician',
        'Ceiling Fan / Light Fixture Fitting', 'پنکھا یا لائٹ کی فٹنگ', 'TODO_PS',
        'ROUTINE',
        '{
            "en": ["fan fitting", "light fixture", "ceiling fan install", "chandelier"],
            "ur": ["پنکھا لگانا ہے", "لائٹ لگانی ہے", "فین فٹنگ"],
            "ur_roman": ["pankha lagana hai", "fan installation", "light fitting"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),

    -- UPS & Solar
    (
        'ups_battery_dead_backup_down', 'ups_solar',
        'UPS Dead / No Backup', 'یو پی ایس بند / بیک اپ ختم', 'TODO_PS',
        'URGENT',
        '{
            "en": ["ups dead", "ups not charging", "no backup", "ups beeping", "battery dead"],
            "ur": ["یو پی ایس کام نہیں کر رہا", "چارجنگ نہیں ہو رہی", "بیک اپ نہیں دے رہا", "بیٹری ختم"],
            "ur_roman": ["ups band hai", "ups backup nahi de raha", "battery dead", "charging nahi ho rahi"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),
    (
        'solar_inverter_fault', 'ups_solar',
        'Solar Inverter Fault / Error Code', 'سولر انورٹر کی خرابی / ایرر', 'TODO_PS',
        'URGENT',
        '{
            "en": ["solar inverter error", "inverter fault code", "solar not generating", "hybrid inverter down"],
            "ur": ["سولر انورٹر پر ایرر ہے", "سولر بجلی نہیں بنا رہا", "انورٹر ٹرپ"],
            "ur_roman": ["solar inverter error", "inverter trip ho gaya", "bijli nahi ban rahi"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),
    (
        'solar_panel_cleaning_wiring', 'ups_solar',
        'Solar Panel Cleaning & Maintenance', 'سولر پلیٹوں کی صفائی و سروس', 'TODO_PS',
        'ROUTINE',
        '{
            "en": ["solar panel wash", "solar cleaning", "solar maintenance", "wire connection check"],
            "ur": ["سولر پلیٹیں دھونا", "سولر پینل سروس", "تاریں چیک کرانا"],
            "ur_roman": ["solar panel safai", "panel dhona", "solar maintenance"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),

    -- AC & Fridge
    (
        'ac_not_cooling', 'ac_fridge',
        'AC Not Cooling / Gas Refill', 'اے سی کولنگ نہیں کر رہا / گیس چارجنگ', 'TODO_PS',
        'URGENT',
        '{
            "en": ["ac not cooling", "ac gas leak", "warm air from ac", "compressor tripping"],
            "ur": ["اے سی ٹھنڈا نہیں کر رہا", "اے سی گیس ختم", "کمپریسر بند ہو رہا ہے"],
            "ur_roman": ["ac cooling nahi kar raha", "ac gas charging", "compressor trip ho raha hai"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),
    (
        'ac_water_leakage', 'ac_fridge',
        'AC Water Dripping / Overflow', 'اے سی کے اندر سے پانی ٹپکنا', 'TODO_PS',
        'ROUTINE',
        '{
            "en": ["water dripping indoor", "ac pipe blocked", "ac leaking water"],
            "ur": ["اے سی سے پانی ٹپک رہا ہے", "پائپ بلاک ہے"],
            "ur_roman": ["ac se pani tapak raha hai", "ac water leakage"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),
    (
        'refrigerator_freezer_not_working', 'ac_fridge',
        'Refrigerator / Deep Freezer Down', 'فریج یا ڈیپ فریزر کا کام نہ کرنا', 'TODO_PS',
        'URGENT',
        '{
            "en": ["fridge not cooling", "freezer melting", "compressor sound", "fridge dead"],
            "ur": ["فریج ٹھنڈا نہیں کر رہا", "برف پگھل رہی ہے", "فریزر بند ہے"],
            "ur_roman": ["fridge thanda nahi kar raha", "freezer band hai", "fridge kharab"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),

    -- Plumber & Gas Fitting
    (
        'gas_leak_emergency', 'plumber_gas',
        'Gas Leak / Stove Pipe Smell', 'گیس لیکیج / بدبو کا آنا', 'TODO_PS',
        'EMERGENCY',
        '{
            "en": ["gas leakage", "gas smell", "sui gas leak", "gas pipe whistling", "cylinder leak"],
            "ur": ["گیس کی بدبو", "گیس لیک ہو رہی ہے", "سلنڈر لیک ہے", "چولہے سے گیس آ رہی ہے"],
            "ur_roman": ["gas leakage", "gas ki smell", "sui gas leak", "cylinder leak", "gas smell aa rahi hai"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),
    (
        'water_pipe_burst', 'plumber_gas',
        'Burst Water Pipe / Heavy Leakage', 'پانی کا پائپ پھٹ جانا / شدید لیکیج', 'TODO_PS',
        'EMERGENCY',
        '{
            "en": ["pipe burst", "burst pipe", "flooding", "water gushing out", "main line broken"],
            "ur": ["پائپ پھٹ گیا", "پانی ابل رہا ہے", "سیلاب آ گیا", "مین لائن ٹوٹ گئی"],
            "ur_roman": ["pipe phat gaya", "pani beh raha hai", "main line break", "pani flood ho gaya"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),
    (
        'water_motor_pump_fault', 'plumber_gas',
        'Water Motor / Submersible Pump Fault', 'پانی کی موٹر یا پمپ کی خرابی', 'TODO_PS',
        'URGENT',
        '{
            "en": ["water motor not working", "donkey pump broken", "tank not filling", "submersible motor fault"],
            "ur": ["پانی کی موٹر نہیں چل رہی", "ٹینک نہیں بھر رہا", "ڈنکی پمپ خراب ہے"],
            "ur_roman": ["pani ki motor band", "donkey pump kharab", "tanki nahi bhar rahi", "submersible pump"],
            "ps": ["TODO_PS"]
        }'::jsonb
    ),
    (
        'drain_toilet_blockage', 'plumber_gas',
        'Drain / Washroom Blockage', 'ڈرین یا واش روم کا بلاک ہونا', 'TODO_PS',
        'ROUTINE',
        '{
            "en": ["drain blocked", "clogged toilet", "sink choked", "sewer line blocked"],
            "ur": ["گٹر بند ہے", "واش روم بند ہے", "نالی بند ہو گئی", "سنک بلاک"],
            "ur_roman": ["gutter band hai", "sink block", "drain choked", "toilet blockage"],
            "ps": ["TODO_PS"]
        }'::jsonb
    )
ON CONFLICT (id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name_en = EXCLUDED.name_en,
    name_ur = EXCLUDED.name_ur,
    name_ps = EXCLUDED.name_ps,
    default_urgency = EXCLUDED.default_urgency,
    synonyms = EXCLUDED.synonyms;

-- -----------------------------------------------------------------------------
-- 3. Safety Rules (4 critical safety rules)
-- -----------------------------------------------------------------------------
INSERT INTO safety_rules (id, trigger_keywords, safety_message_en, safety_message_ur, safety_message_ps, should_terminate, category_id)
VALUES
    (
        'gas_leak',
        '{
            "en": ["gas leak", "gas smell", "cylinder leak", "gas leaking"],
            "ur": ["گیس لیکیج", "گیس کی بدبو", "سلنڈر لیک", "گیس آ رہی ہے"],
            "ur_roman": ["gas leak", "gas ki smell", "cylinder leak", "gas smell"]
        }'::jsonb,
        'DANGER: Evacuate immediately! Do not operate any electrical switches, matches, or lighters. Turn off the main gas valve from outside if safe and open doors and windows.',
        'خطرہ: فوری طور پر محفوظ جگہ پر جائیں! کوئی برقی سوئچ، ماچس یا لائٹر ہرگز نہ جلائیں۔ اگر ممکن ہو تو باہر سے مین گیس والو بند کر دیں اور کھڑکیاں کھول دیں۔',
        'TODO_PS',
        true,
        'plumber_gas'
    ),
    (
        'electric_fire_sparks',
        '{
            "en": ["electric fire", "burning wires", "sparks and smoke", "breaker flaming", "switchboard fire"],
            "ur": ["بجلی کی آگ", "تاریں جل رہی ہیں", "سوئچ بورڈ میں آگ", "دھواں اور چنگاریاں"],
            "ur_roman": ["bijli ki aag", "taar jal rahi hai", "switchboard fire", "sparks and smoke"]
        }'::jsonb,
        'DANGER: Do not throw water on electrical fires! Immediately switch off the main circuit breaker if safe. Evacuate everyone and call Rescue 1122.',
        'خطرہ: بجلی کی آگ پر پانی ہرگز نہ پھینکیں! اگر ممکن ہو تو فوری طور پر مین سرکٹ بریکر بند کر دیں۔ تمام افراد باہر نکلیں اور ریسکیو 1122 کو کال کریں۔',
        'TODO_PS',
        true,
        'electrician'
    ),
    (
        'flooding_burst_pipe',
        '{
            "en": ["pipe burst flooding", "burst pipe near electric", "water near switchboard", "submerged wiring"],
            "ur": ["پائپ پھٹنے سے سیلاب", "بجلی کے قریب پانی", "سوئچ بورڈ میں پانی"],
            "ur_roman": ["water near switchboard", "pani bijli ke paas", "pipe burst flood"]
        }'::jsonb,
        'CAUTION: Keep away from wet electrical areas! Shut off the main water supply and main electric breaker immediately to prevent electrocution.',
        'احتیاط: گیلے برقی آلات اور تاروں سے دور رہیں! کرنٹ کے خطرے سے بچنے کے لیے فوراً مین واٹر والو اور بجلی کا مین بریکر بند کریں۔',
        'TODO_PS',
        false,
        'plumber_gas'
    ),
    (
        'electric_shock_injury',
        '{
            "en": ["electric shock", "electrocuted", "person shocked", "current lag gaya"],
            "ur": ["کرنٹ لگ گیا", "برقی جھٹکا", "شخص بے ہوش"],
            "ur_roman": ["current lag gaya", "electric shock", "current laga"]
        }'::jsonb,
        'EMERGENCY: Do not touch the victim with bare hands! Disconnect power immediately or use a dry wooden stick to separate them. Call Rescue 1122 now.',
        'ایمرجنسی: کرنٹ لگے شخص کو ننگے ہاتھوں سے نہ چھوئیں! فوراً بجلی کا سوئچ بند کریں یا خشک لکڑی کا استعمال کریں۔ فوری طور پر 1122 پر کال کریں۔',
        'TODO_PS',
        true,
        'electrician'
    )
ON CONFLICT (id) DO UPDATE SET
    trigger_keywords = EXCLUDED.trigger_keywords,
    safety_message_en = EXCLUDED.safety_message_en,
    safety_message_ur = EXCLUDED.safety_message_ur,
    safety_message_ps = EXCLUDED.safety_message_ps,
    should_terminate = EXCLUDED.should_terminate,
    category_id = EXCLUDED.category_id;

-- -----------------------------------------------------------------------------
-- 4. Demo Providers (10 providers across Peshawar)
-- -----------------------------------------------------------------------------
-- 1. Khan Electric (Flagship)
INSERT INTO providers (
    id, name, slug, provider_code, trades, primary_phone, secondary_phone, notify_email,
    areas, working_hours, services, status, owner_user_id
) VALUES (
    'd1111111-1111-1111-1111-111111111101',
    'Khan Electric',
    'khan-electric',
    'KHAN-01',
    ARRAY['electrician', 'ups_solar'],
    '03001234567',
    '03129876543',
    'demo.notify@example.com',
    ARRAY['Hayatabad', 'University Town', 'Board Bazaar'],
    '{"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "open": "08:00", "close": "20:00"}'::jsonb,
    '[
        {"name": "Complete Home Wiring Inspection", "price_min": 1500, "price_max": 4000, "unit": "per visit"},
        {"name": "Short Circuit Detection & Repair", "price_min": 1000, "price_max": 2500, "unit": "per issue"},
        {"name": "UPS Setup & Inverter Tuning", "price_min": 2000, "price_max": 5000, "unit": "per setup"},
        {"name": "Solar Panel Maintenance & Cleaning", "price_min": 2500, "price_max": 6000, "unit": "per array"}
    ]'::jsonb,
    'approved',
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    provider_code = EXCLUDED.provider_code,
    trades = EXCLUDED.trades,
    primary_phone = EXCLUDED.primary_phone,
    secondary_phone = EXCLUDED.secondary_phone,
    notify_email = EXCLUDED.notify_email,
    areas = EXCLUDED.areas,
    working_hours = EXCLUDED.working_hours,
    services = EXCLUDED.services,
    status = EXCLUDED.status;

-- 2. Khyber Solar & UPS Hub
INSERT INTO providers (
    id, name, slug, provider_code, trades, primary_phone, secondary_phone, notify_email,
    areas, working_hours, services, status, owner_user_id
) VALUES (
    'd1111111-1111-1111-1111-111111111102',
    'Khyber Solar & UPS Hub',
    'khyber-solar-ups',
    'KHYB-02',
    ARRAY['ups_solar'],
    '03339123456',
    NULL,
    'demo.notify@example.com',
    ARRAY['University Town', 'Hayatabad', 'Tehkal'],
    '{"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "open": "09:00", "close": "19:00"}'::jsonb,
    '[
        {"name": "Hybrid Solar Inverter Installation", "price_min": 5000, "price_max": 12000, "unit": "system"},
        {"name": "UPS Battery Desulfation & Check", "price_min": 800, "price_max": 2000, "unit": "visit"},
        {"name": "Net Metering Consultancy & Earthing", "price_min": 3500, "price_max": 8000, "unit": "job"}
    ]'::jsonb,
    'approved',
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    provider_code = EXCLUDED.provider_code,
    trades = EXCLUDED.trades,
    primary_phone = EXCLUDED.primary_phone,
    notify_email = EXCLUDED.notify_email,
    areas = EXCLUDED.areas,
    working_hours = EXCLUDED.working_hours,
    services = EXCLUDED.services,
    status = EXCLUDED.status;

-- 3. Peshawar Chillers & AC Center
INSERT INTO providers (
    id, name, slug, provider_code, trades, primary_phone, secondary_phone, notify_email,
    areas, working_hours, services, status, owner_user_id
) VALUES (
    'd1111111-1111-1111-1111-111111111103',
    'Peshawar Chillers & AC Center',
    'peshawar-chillers-ac',
    'CHIL-03',
    ARRAY['ac_fridge'],
    '03459012345',
    '03139012345',
    'demo.notify@example.com',
    ARRAY['Saddar', 'Peshawar Cantt', 'Gulbahar'],
    '{"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "open": "09:00", "close": "21:00"}'::jsonb,
    '[
        {"name": "Inverter AC Master Jet Wash Service", "price_min": 1800, "price_max": 3500, "unit": "per unit"},
        {"name": "AC Freon Gas Refill (R410/R32)", "price_min": 3500, "price_max": 6500, "unit": "per unit"},
        {"name": "Deep Freezer Gas Charging & Thermostat", "price_min": 2500, "price_max": 5000, "unit": "per unit"}
    ]'::jsonb,
    'approved',
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    provider_code = EXCLUDED.provider_code,
    trades = EXCLUDED.trades,
    primary_phone = EXCLUDED.primary_phone,
    notify_email = EXCLUDED.notify_email,
    areas = EXCLUDED.areas,
    working_hours = EXCLUDED.working_hours,
    services = EXCLUDED.services,
    status = EXCLUDED.status;

-- 4. Rehman Plumbing & Sanitary Works
INSERT INTO providers (
    id, name, slug, provider_code, trades, primary_phone, secondary_phone, notify_email,
    areas, working_hours, services, status, owner_user_id
) VALUES (
    'd1111111-1111-1111-1111-111111111104',
    'Rehman Plumbing & Sanitary',
    'rehman-plumbing',
    'REHM-04',
    ARRAY['plumber_gas'],
    '03125678901',
    NULL,
    'demo.notify@example.com',
    ARRAY['Board Bazaar', 'Tehkal', 'University Town'],
    '{"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "open": "08:00", "close": "19:00"}'::jsonb,
    '[
        {"name": "Underground Leak Detection & Fix", "price_min": 2000, "price_max": 6000, "unit": "per job"},
        {"name": "PPRC Pipe Fitting & Sanitary Line", "price_min": 1500, "price_max": 4500, "unit": "per washroom"},
        {"name": "Submersible Water Motor Installation", "price_min": 2500, "price_max": 5000, "unit": "per motor"}
    ]'::jsonb,
    'approved',
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    provider_code = EXCLUDED.provider_code,
    trades = EXCLUDED.trades,
    primary_phone = EXCLUDED.primary_phone,
    notify_email = EXCLUDED.notify_email,
    areas = EXCLUDED.areas,
    working_hours = EXCLUDED.working_hours,
    services = EXCLUDED.services,
    status = EXCLUDED.status;

-- 5. Saddar Gas & Geyser Specialists
INSERT INTO providers (
    id, name, slug, provider_code, trades, primary_phone, secondary_phone, notify_email,
    areas, working_hours, services, status, owner_user_id
) VALUES (
    'd1111111-1111-1111-1111-111111111105',
    'Saddar Gas & Geyser Specialists',
    'saddar-gas-geyser',
    'SADD-05',
    ARRAY['plumber_gas'],
    '03019876543',
    '03321122334',
    'demo.notify@example.com',
    ARRAY['Saddar', 'Peshawar Cantt', 'Gulbahar'],
    '{"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "open": "08:30", "close": "20:30"}'::jsonb,
    '[
        {"name": "Instant Gas Geyser Repair & Descaling", "price_min": 1500, "price_max": 3500, "unit": "per geyser"},
        {"name": "Sui Gas Pipeline Fitting & Leak Test", "price_min": 2000, "price_max": 5000, "unit": "per point"},
        {"name": "Kitchen Gas Burner & Valve Overhaul", "price_min": 800, "price_max": 2000, "unit": "per stove"}
    ]'::jsonb,
    'approved',
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    provider_code = EXCLUDED.provider_code,
    trades = EXCLUDED.trades,
    primary_phone = EXCLUDED.primary_phone,
    notify_email = EXCLUDED.notify_email,
    areas = EXCLUDED.areas,
    working_hours = EXCLUDED.working_hours,
    services = EXCLUDED.services,
    status = EXCLUDED.status;

-- 6. Gulbahar Power Care
INSERT INTO providers (
    id, name, slug, provider_code, trades, primary_phone, secondary_phone, notify_email,
    areas, working_hours, services, status, owner_user_id
) VALUES (
    'd1111111-1111-1111-1111-111111111106',
    'Gulbahar Power Care',
    'gulbahar-power-care',
    'GULB-06',
    ARRAY['electrician'],
    '03024567890',
    NULL,
    'demo.notify@example.com',
    ARRAY['Gulbahar', 'Ring Road', 'Charsadda Road'],
    '{"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "open": "08:00", "close": "20:00"}'::jsonb,
    '[
        {"name": "Breaker Distribution Box Setup", "price_min": 2000, "price_max": 5000, "unit": "per DB"},
        {"name": "Emergency Night Callout Fault Repair", "price_min": 1500, "price_max": 3500, "unit": "visit"},
        {"name": "Light & Fan Wiring Replacement", "price_min": 1000, "price_max": 3000, "unit": "room"}
    ]'::jsonb,
    'approved',
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    provider_code = EXCLUDED.provider_code,
    trades = EXCLUDED.trades,
    primary_phone = EXCLUDED.primary_phone,
    notify_email = EXCLUDED.notify_email,
    areas = EXCLUDED.areas,
    working_hours = EXCLUDED.working_hours,
    services = EXCLUDED.services,
    status = EXCLUDED.status;

-- 7. Warsak Rapid Cooling
INSERT INTO providers (
    id, name, slug, provider_code, trades, primary_phone, secondary_phone, notify_email,
    areas, working_hours, services, status, owner_user_id
) VALUES (
    'd1111111-1111-1111-1111-111111111107',
    'Warsak Rapid Cooling',
    'warsak-rapid-cooling',
    'WARS-07',
    ARRAY['ac_fridge'],
    '03158901234',
    NULL,
    'demo.notify@example.com',
    ARRAY['Warsak Road', 'Peshawar Cantt'],
    '{"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "open": "09:00", "close": "20:00"}'::jsonb,
    '[
        {"name": "Split AC Uninstallation & Reinstallation", "price_min": 2500, "price_max": 4500, "unit": "unit"},
        {"name": "Commercial Chiller & Walk-in Fridge Repair", "price_min": 5000, "price_max": 15000, "unit": "visit"},
        {"name": "PCB Circuit Board Diagnostic & Repair", "price_min": 3000, "price_max": 7000, "unit": "board"}
    ]'::jsonb,
    'approved',
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    provider_code = EXCLUDED.provider_code,
    trades = EXCLUDED.trades,
    primary_phone = EXCLUDED.primary_phone,
    notify_email = EXCLUDED.notify_email,
    areas = EXCLUDED.areas,
    working_hours = EXCLUDED.working_hours,
    services = EXCLUDED.services,
    status = EXCLUDED.status;

-- 8. Ring Road Solar Solutions
INSERT INTO providers (
    id, name, slug, provider_code, trades, primary_phone, secondary_phone, notify_email,
    areas, working_hours, services, status, owner_user_id
) VALUES (
    'd1111111-1111-1111-1111-111111111108',
    'Ring Road Solar Solutions',
    'ring-road-solar',
    'RING-08',
    ARRAY['ups_solar', 'electrician'],
    '03347890123',
    '03009988776',
    'demo.notify@example.com',
    ARRAY['Ring Road', 'Gulbahar', 'Charsadda Road'],
    '{"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "open": "08:30", "close": "19:00"}'::jsonb,
    '[
        {"name": "Solar Structure Framing & Elevation", "price_min": 6000, "price_max": 18000, "unit": "structure"},
        {"name": "Lithium Battery Protocol Configuration", "price_min": 2500, "price_max": 6000, "unit": "battery"},
        {"name": "Earthing Bore & Lightning Arrestor Setup", "price_min": 8000, "price_max": 22000, "unit": "bore"}
    ]'::jsonb,
    'approved',
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    provider_code = EXCLUDED.provider_code,
    trades = EXCLUDED.trades,
    primary_phone = EXCLUDED.primary_phone,
    notify_email = EXCLUDED.notify_email,
    areas = EXCLUDED.areas,
    working_hours = EXCLUDED.working_hours,
    services = EXCLUDED.services,
    status = EXCLUDED.status;

-- 9. Charsadda Road Sanitary & Pipe Service
INSERT INTO providers (
    id, name, slug, provider_code, trades, primary_phone, secondary_phone, notify_email,
    areas, working_hours, services, status, owner_user_id
) VALUES (
    'd1111111-1111-1111-1111-111111111109',
    'Charsadda Sanitary & Pipe Service',
    'charsadda-sanitary-pipe',
    'CHAR-09',
    ARRAY['plumber_gas'],
    '03461239876',
    NULL,
    'demo.notify@example.com',
    ARRAY['Charsadda Road', 'Ring Road'],
    '{"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "open": "08:00", "close": "18:30"}'::jsonb,
    '[
        {"name": "Main Sewer Choke Unblocking Machine", "price_min": 2000, "price_max": 4500, "unit": "drain"},
        {"name": "Overhead Water Tank Float Valve Replacement", "price_min": 1000, "price_max": 2500, "unit": "valve"},
        {"name": "Bathroom Commode & Vanity Installation", "price_min": 2500, "price_max": 6000, "unit": "set"}
    ]'::jsonb,
    'approved',
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    provider_code = EXCLUDED.provider_code,
    trades = EXCLUDED.trades,
    primary_phone = EXCLUDED.primary_phone,
    notify_email = EXCLUDED.notify_email,
    areas = EXCLUDED.areas,
    working_hours = EXCLUDED.working_hours,
    services = EXCLUDED.services,
    status = EXCLUDED.status;

-- 10. Tehkal Electric Works
INSERT INTO providers (
    id, name, slug, provider_code, trades, primary_phone, secondary_phone, notify_email,
    areas, working_hours, services, status, owner_user_id
) VALUES (
    'd1111111-1111-1111-1111-111111111110',
    'Tehkal Electric Works',
    'tehkal-electric-works',
    'TEHK-10',
    ARRAY['electrician'],
    '03219087654',
    NULL,
    'demo.notify@example.com',
    ARRAY['Tehkal', 'University Town', 'Board Bazaar'],
    '{"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "open": "08:30", "close": "20:00"}'::jsonb,
    '[
        {"name": "Phase Changeover Switch Installation", "price_min": 1200, "price_max": 3000, "unit": "unit"},
        {"name": "Generator ATS Auto-Switch Tuning", "price_min": 2500, "price_max": 6000, "unit": "system"},
        {"name": "Short Circuit Fault Isolation", "price_min": 1000, "price_max": 2500, "unit": "job"}
    ]'::jsonb,
    'approved',
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    provider_code = EXCLUDED.provider_code,
    trades = EXCLUDED.trades,
    primary_phone = EXCLUDED.primary_phone,
    notify_email = EXCLUDED.notify_email,
    areas = EXCLUDED.areas,
    working_hours = EXCLUDED.working_hours,
    services = EXCLUDED.services,
    status = EXCLUDED.status;

-- -----------------------------------------------------------------------------
-- 5. Active Agent Configs (Spec §5.5) for each Demo Provider
-- -----------------------------------------------------------------------------
INSERT INTO agent_configs (
    id, provider_id, version, is_active,
    greeting_en, greeting_ur, greeting_ps,
    voice_en, voice_ur, voice_ps,
    custom_instructions, slot_duration_mins, max_advance_days, buffer_mins
) VALUES
    -- 1. Khan Electric (Flagship)
    (
        'c1111111-1111-1111-1111-111111111101',
        'd1111111-1111-1111-1111-111111111101',
        1,
        true,
        'Welcome to Khan Electric. I am your automated assistant. How can we help with your electrical or solar system today?',
        'خان الیکٹرک میں خوش آمدید۔ میں آپ کا خودکار اسسٹنٹ ہوں۔ آج ہم آپ کی بجلی یا سولر سسٹم میں کیا مدد کر سکتے ہیں؟',
        'TODO_PS',
        'en-US-GuyNeural', 'ur-PK-AsadNeural', 'ur-PK-AsadNeural',
        'Khan Electric has been serving Hayatabad and Peshawar for over 12 years. Always confirm if the customer has an active power cut before dispatching.',
        60, 7, 30
    ),
    -- 2. Khyber Solar & UPS Hub
    (
        'c1111111-1111-1111-1111-111111111102',
        'd1111111-1111-1111-1111-111111111102',
        1,
        true,
        'Assalam-o-alaikum! You have reached Khyber Solar & UPS Hub. How can we assist with your backup power?',
        'السلام علیکم! خیبر سولر اور یو پی ایس ہب میں خوش آمدید۔ ہم آپ کے بیک اپ سسٹم کے سلسلے میں کیا خدمت کر سکتے ہیں؟',
        'TODO_PS',
        'en-US-GuyNeural', 'ur-PK-AsadNeural', 'ur-PK-AsadNeural',
        'Specialize in hybrid solar inverters and battery diagnosis. Ask about the inverter capacity and battery count.',
        90, 7, 30
    ),
    -- 3. Peshawar Chillers & AC Center
    (
        'c1111111-1111-1111-1111-111111111103',
        'd1111111-1111-1111-1111-111111111103',
        1,
        true,
        'Welcome to Peshawar Chillers & AC Center. What appliance can we service for you today?',
        'پشاور چلرز اور اے سی سینٹر میں خوش آمدید۔ ہم آپ کے اے سی یا فریج کے لیے کیا سروس فراہم کریں؟',
        'TODO_PS',
        'en-US-GuyNeural', 'ur-PK-UzmaNeural', 'ur-PK-UzmaNeural',
        'Emergency cooling dispatch available during summer heatwaves. Always verify AC tonnage and refrigerant type if known.',
        60, 5, 30
    ),
    -- 4. Rehman Plumbing & Sanitary
    (
        'c1111111-1111-1111-1111-111111111104',
        'd1111111-1111-1111-1111-111111111104',
        1,
        true,
        'Assalam-o-alaikum, Rehman Plumbing here. How may we assist with your water, sanitary, or motor issue?',
        'السلام علیکم، رحمان پلمبنگ سروس۔ بتائیے پانی، پائپ یا موٹر کا کیا مسئلہ درپیش ہے؟',
        'TODO_PS',
        'en-US-GuyNeural', 'ur-PK-AsadNeural', 'ur-PK-AsadNeural',
        'Inquire whether water is currently leaking actively or if water supply is cut off.',
        60, 7, 30
    ),
    -- 5. Saddar Gas & Geyser Specialists
    (
        'c1111111-1111-1111-1111-111111111105',
        'd1111111-1111-1111-1111-111111111105',
        1,
        true,
        'Welcome to Saddar Gas & Geyser Specialists. How can we help with your geyser or gas fitting today?',
        'صدر گیس اور گیزر اسپیشلسٹس میں خوش آمدید۔ بتائیے گیزر یا گیس فٹنگ میں کیا کام ہے؟',
        'TODO_PS',
        'en-US-GuyNeural', 'ur-PK-AsadNeural', 'ur-PK-AsadNeural',
        'For winter geyser service and safety, ask whether it is instant gas geyser or electric water heater.',
        60, 7, 30
    ),
    -- 6. Gulbahar Power Care
    (
        'c1111111-1111-1111-1111-111111111106',
        'd1111111-1111-1111-1111-111111111106',
        1,
        true,
        'Gulbahar Power Care assistant here. How can our electricians assist you today?',
        'گلبہار پاور کیئر میں خوش آمدید۔ ہمارے الیکٹریشن آپ کی کیا مدد کر سکتے ہیں؟',
        'TODO_PS',
        'en-US-GuyNeural', 'ur-PK-AsadNeural', 'ur-PK-AsadNeural',
        'Available for residential and small commercial wiring inspections in Ring Road and Gulbahar areas.',
        60, 7, 30
    ),
    -- 7. Warsak Rapid Cooling
    (
        'c1111111-1111-1111-1111-111111111107',
        'd1111111-1111-1111-1111-111111111107',
        1,
        true,
        'Welcome to Warsak Rapid Cooling. How can we help with your refrigeration or air conditioning?',
        'وارسک ریپڈ کولنگ میں خوش آمدید۔ آپ کے اے سی یا کولنگ سسٹم میں کیا مسئلہ ہے؟',
        'TODO_PS',
        'en-US-GuyNeural', 'ur-PK-UzmaNeural', 'ur-PK-UzmaNeural',
        'Focus on quick response cooling and commercial freezer diagnostic in Warsak Road area.',
        60, 7, 30
    ),
    -- 8. Ring Road Solar Solutions
    (
        'c1111111-1111-1111-1111-111111111108',
        'd1111111-1111-1111-1111-111111111108',
        1,
        true,
        'Assalam-o-alaikum! Ring Road Solar Solutions at your service. What can we do for your solar energy system?',
        'السلام علیکم! رنگ روڈ سولر سلوشنز میں خوش آمدید۔ سولر سسٹم کے سلسلے میں ہم کیا خدمت کر سکتے ہیں؟',
        'TODO_PS',
        'en-US-GuyNeural', 'ur-PK-AsadNeural', 'ur-PK-AsadNeural',
        'Ask about system size (kilowatts) and whether earthing protection is installed.',
        90, 7, 30
    ),
    -- 9. Charsadda Sanitary & Pipe Service
    (
        'c1111111-1111-1111-1111-111111111109',
        'd1111111-1111-1111-1111-111111111109',
        1,
        true,
        'Charsadda Sanitary & Pipe Service assistant. How can we resolve your plumbing or drainage issue?',
        'چارسدہ سینیٹری اور پائپ سروس۔ بتائیے پلمبنگ یا گٹر کے نکاس کا کیا مسئلہ حل کرنا ہے؟',
        'TODO_PS',
        'en-US-GuyNeural', 'ur-PK-AsadNeural', 'ur-PK-AsadNeural',
        'Always check if drainage blockage is in indoor sink/toilet or main street drain line.',
        60, 7, 30
    ),
    -- 10. Tehkal Electric Works
    (
        'c1111111-1111-1111-1111-111111111110',
        'd1111111-1111-1111-1111-111111111110',
        1,
        true,
        'Tehkal Electric Works assistant here. What electrical service do you require today?',
        'تہکال الیکٹرک ورکس میں خوش آمدید۔ بتائیے آج کیا برقی کام کروانا چاہتے ہیں؟',
        'TODO_PS',
        'en-US-GuyNeural', 'ur-PK-AsadNeural', 'ur-PK-AsadNeural',
        'Confirm whether the property has single-phase or three-phase WAPDA supply.',
        60, 7, 30
    )
ON CONFLICT (id) DO UPDATE SET
    provider_id = EXCLUDED.provider_id,
    version = EXCLUDED.version,
    is_active = EXCLUDED.is_active,
    greeting_en = EXCLUDED.greeting_en,
    greeting_ur = EXCLUDED.greeting_ur,
    greeting_ps = EXCLUDED.greeting_ps,
    voice_en = EXCLUDED.voice_en,
    voice_ur = EXCLUDED.voice_ur,
    voice_ps = EXCLUDED.voice_ps,
    custom_instructions = EXCLUDED.custom_instructions,
    slot_duration_mins = EXCLUDED.slot_duration_mins,
    max_advance_days = EXCLUDED.max_advance_days,
    buffer_mins = EXCLUDED.buffer_mins;

COMMIT;
