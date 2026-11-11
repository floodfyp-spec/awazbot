/**
 * @file db-shapes.js
 * JSDoc definitions describing Supabase database tables and record shapes for AwazBot KP.
 * Note: Pure JavaScript with JSDoc typing for IntelliSense without TypeScript files.
 */

/**
 * @typedef {'admin' | 'provider' | 'customer'} UserRole
 */

/**
 * @typedef {'pending' | 'approved' | 'rejected' | 'suspended'} ProviderStatus
 */

/**
 * @typedef {'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'} BookingStatus
 */

/**
 * @typedef {'ROUTINE' | 'URGENT' | 'EMERGENCY'} UrgencyLevel
 */

/**
 * @typedef {'started' | 'connected' | 'completed' | 'failed' | 'safety_halt'} CallOutcome
 */

/**
 * @typedef {'en' | 'ur' | 'ps'} SupportedLanguage
 */

/**
 * @typedef {Object} Profile
 * @property {string} id - UUID primary key referencing auth.users.id
 * @property {UserRole} role - Role of user ('admin', 'provider', 'customer')
 * @property {string|null} full_name - Full name of the user
 * @property {string|null} phone - Contact phone number
 * @property {string} created_at - Timestamp with time zone
 * @property {string} updated_at - Timestamp with time zone
 */

/**
 * @typedef {Object} ProviderService
 * @property {string} name - Service name (e.g. "Short Circuit Detection")
 * @property {number} price_min - Minimum price in PKR
 * @property {number} price_max - Maximum price in PKR
 * @property {string} unit - Pricing unit (e.g. "per visit", "per unit")
 */

/**
 * @typedef {Object} ProviderWorkingHours
 * @property {string[]} days - Array of open days (e.g. ["Mon", "Tue", ...])
 * @property {string} open - Opening time in HH:mm (e.g. "08:00")
 * @property {string} close - Closing time in HH:mm (e.g. "20:00")
 */

/**
 * @typedef {Object} Provider
 * @property {string} id - UUID primary key
 * @property {string|null} owner_user_id - UUID referencing auth.users (null for demo seed providers)
 * @property {string} name - Business name
 * @property {string} slug - Unique URL slug (e.g. "khan-electric")
 * @property {string} provider_code - 7-char uppercase code (e.g. "KHAN-01")
 * @property {string[]} trades - Array of trade IDs ('electrician', 'ups_solar', etc.)
 * @property {string} primary_phone - Primary phone (03XXXXXXXXX format)
 * @property {string|null} secondary_phone - Secondary phone
 * @property {string} notify_email - Email address for real-time booking notifications
 * @property {string[]} areas - Peshawar localities served (e.g. ['Hayatabad', 'Saddar'])
 * @property {ProviderWorkingHours} working_hours - JSONB working hours
 * @property {ProviderService[]} services - JSONB list of offered services & prices
 * @property {ProviderStatus} status - Approval status
 * @property {string} created_at - ISO timestamp
 * @property {string} updated_at - ISO timestamp
 */

/**
 * @typedef {Object} Category
 * @property {string} id - Category key ('electrician', 'ups_solar', 'ac_fridge', 'plumber_gas')
 * @property {string} name_en - English title
 * @property {string} name_ur - Urdu title
 * @property {string} name_ps - Pashto title
 * @property {string|null} icon - Lucide icon identifier
 * @property {number} display_order - Sorting index
 */

/**
 * @typedef {Object} IssueSynonyms
 * @property {string[]} en - English synonyms
 * @property {string[]} ur - Urdu synonyms
 * @property {string[]} ur_roman - Roman Urdu synonyms
 * @property {string[]} ps - Pashto synonyms
 */

/**
 * @typedef {Object} Issue
 * @property {string} id - Issue key (e.g. 'short_circuit_sparks')
 * @property {string} category_id - References categories.id
 * @property {string} name_en - English label
 * @property {string} name_ur - Urdu label
 * @property {string} name_ps - Pashto label
 * @property {UrgencyLevel} default_urgency - Default urgency level
 * @property {IssueSynonyms} synonyms - JSONB dictionary of multi-language keywords
 */

/**
 * @typedef {Object} AgentConfig
 * @property {string} id - UUID primary key
 * @property {string} provider_id - References providers.id
 * @property {number} version - Integer version number
 * @property {boolean} is_active - Whether this configuration is the active version
 * @property {string} greeting_en - English greeting line
 * @property {string} greeting_ur - Urdu greeting line
 * @property {string} greeting_ps - Pashto greeting line
 * @property {string} voice_en - Azure / ElevenLabs voice identifier for English
 * @property {string} voice_ur - Voice identifier for Urdu
 * @property {string} voice_ps - Voice identifier for Pashto
 * @property {string|null} custom_instructions - Provider-specific instructions
 * @property {number} slot_duration_mins - Time slot duration in minutes (default 60)
 * @property {number} max_advance_days - Maximum days ahead customers can book
 * @property {number} buffer_mins - Travel/buffer time between slots
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} Booking
 * @property {string} id - UUID primary key
 * @property {string} provider_id - References providers.id
 * @property {string|null} call_id - References calls.id
 * @property {string} customer_name - Customer name
 * @property {string} customer_phone - Customer phone (03XXXXXXXXX)
 * @property {string} category_id - References categories.id
 * @property {string|null} issue_id - References issues.id
 * @property {string} problem_description - Description of the issue
 * @property {string} area - Customer locality in Peshawar
 * @property {string|null} street_address - Street address or landmark
 * @property {string|null} preferred_slot_start - ISO timestamp of slot start
 * @property {string|null} preferred_slot_end - ISO timestamp of slot end
 * @property {UrgencyLevel} urgency - Urgency classification
 * @property {BookingStatus} status - Current booking status
 * @property {string|null} provider_notes - Private notes by provider
 * @property {string} created_at - ISO timestamp
 * @property {string} updated_at - ISO timestamp
 */

/**
 * @typedef {Object} Call
 * @property {string} id - UUID primary key
 * @property {string} livekit_room_name - LiveKit room identifier
 * @property {'provider' | 'directory'} mode - Call handling mode
 * @property {string|null} provider_id - Target provider (if mode = 'provider')
 * @property {'web' | 'whatsapp'} channel - Inbound channel
 * @property {SupportedLanguage|null} language_detected - Detected language
 * @property {CallOutcome|null} outcome - Final call status
 * @property {number|null} duration_s - Total duration in seconds
 * @property {number|null} avg_latency_ms - End-of-turn to speech latency
 * @property {boolean} test - Flag indicating test / simulation call
 * @property {string} started_at - ISO timestamp
 * @property {string|null} ended_at - ISO timestamp
 */

/**
 * @typedef {Object} CallTurn
 * @property {string} id - UUID primary key
 * @property {string} call_id - References calls.id
 * @property {number} turn_index - Sequence index of turn
 * @property {'user' | 'agent'} speaker - Who spoke
 * @property {SupportedLanguage} lang - Language of turn
 * @property {string} text - Transcribed / synthesized speech text
 * @property {string|null} stt_engine - Speech-to-text engine used
 * @property {number|null} latency_ms - Turn latency in milliseconds
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} SafetyRule
 * @property {string} id - Unique rule identifier
 * @property {Object} trigger_keywords - JSONB keyword list by language
 * @property {string} safety_message_en - English warning instruction
 * @property {string} safety_message_ur - Urdu warning instruction
 * @property {string} safety_message_ps - Pashto warning instruction
 * @property {boolean} should_terminate - Whether call must immediately terminate
 * @property {string|null} category_id - Related trade category
 */

/**
 * @typedef {Object} NotificationLog
 * @property {string} id - UUID primary key
 * @property {string} provider_id - Target provider
 * @property {string|null} booking_id - Related booking
 * @property {string} channel - Channel ('email', 'sms', 'whatsapp')
 * @property {string} recipient - Target email or phone number
 * @property {string} subject - Email subject line
 * @property {'sent' | 'failed' | 'queued'} status - Delivery status
 * @property {string|null} error_message - Error details if failed
 * @property {string} created_at - ISO timestamp
 */

export {};
