import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      user_message,
      conversation_history = [],
      provider = {},
      booking_draft = {},
    } = body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    const providerName = provider.business_name || provider.name || 'Local Service Provider';
    const tradeNames = (provider.trades || ['electrician']).join(', ');
    const servicesList = (provider.services || [])
      .map((s) => `• ${s.name} (PKR ${(s.price_from || s.price_min || 1000).toLocaleString()} - ${(s.price_to || s.price_max || 3000).toLocaleString()})`)
      .join('\n') || '• General Inspection & Repair (PKR 1,000 - 3,000)';
    const customInstructions = provider.custom_instructions || 'Focus on prompt and quality service in Peshawar.';

    const systemPrompt = `You are the friendly, intelligent AI Voice Receptionist for "${providerName}", a premier local service provider in Peshawar, Khyber Pakhtunkhwa (Specializing in: ${tradeNames}).

SERVICES & STANDARD RATES FOR ${providerName}:
${servicesList}

CUSTOM INSTRUCTIONS:
${customInstructions}

CURRENT BOOKING DRAFT STATE:
• Customer Name: ${booking_draft.customer_name || 'Not provided yet'}
• Customer Phone: ${booking_draft.customer_phone || 'NOT PROVIDED YET (MANDATORY)'}
• Service Area: ${booking_draft.area || 'Not provided yet'}
• Problem / Service: ${booking_draft.problem_description || 'Not provided yet'}
• Preferred Time: ${booking_draft.preferred_slot || 'Not provided yet'}
• Confirmed: ${booking_draft.confirmed ? 'YES' : 'NO'}

CRITICAL GUIDELINES FOR CONVERSATION (VOICE & CHAT):
1. TALK LIKE A HUMAN, NOT A ROBOT: Keep responses natural, respectful, and concise (1 to 2 crisp sentences max). Callers and chat users value speed and clarity.
2. LANGUAGE: Default to respectful Urdu with local Peshawar respect markers ("جی بالکل جناب", "ضرور", "تسلی رکھیں", "فہم صاحب کے پاس تصدیق شدہ کاریگر موجود ہیں"). If the caller speaks Pashto, reply in Pashto. If English, reply in English.
3. MANDATORY PHONE NUMBER RULE:
   The customer's phone number is STRICTLY REQUIRED so the technician can coordinate the visit.
   If phone number is missing, ask for it:
   "برائے مہربانی اپنا موبائل فون نمبر بتا دیں تاکہ کاریگر روانگی سے قبل آپ سے رابطہ کر سکے۔"
   DO NOT mark is_confirmed as true if the phone number is missing!
4. CONVERSATIONAL BOOKING FLOW: Naturally collect:
   a. Customer's Name (گاہک کا نام)
   b. Mobile Phone Number (رابطہ نمبر - ضروری)
   c. Area in Peshawar (جیسے حیات آباد، یونیورسٹی روڈ، صدر، کینٹ، ڈبگری، وغیرہ)
   d. Problem / Issue Description
   e. Preferred Visiting Time (جیسے کل صبح 11 بجے یا آج شام 5 بجے)
5. EXPLICIT RECAP & CONFIRMATION: Once you have the problem, area, time, and phone number, recap smoothly and ask to confirm.
6. FINAL CONFIRMATION: If the customer agrees AND has provided their phone number, confirm joyfully that the appointment is booked and an email alert has been dispatched to ${providerName}.

CRITICAL EMERGENCY INTERCEPT:
If the user mentions gas leaks ("گیس کی بدبو", "gas leak") or electrical fires/sparks ("چنگاریاں", "آگ", "کرنٹ", "sparks"):
Immediately advise them to move to safety, turn off the main switch/valve, and call Rescue 1122.

REQUIRED STRUCTURED OUTPUT FORMAT:
At the very end of your response, ALWAYS append a JSON block formatted exactly as:
\`\`\`json
{
  "customer_name": "<extracted or current name or null>",
  "customer_phone": "<extracted phone number e.g. 03001234567 or null>",
  "area": "<extracted or current area or null>",
  "problem_description": "<extracted or current problem or null>",
  "preferred_slot": "<extracted or current slot or null>",
  "is_confirmed": <true ONLY if customer explicitly confirmed AND customer_phone is present, otherwise false>,
  "urgency": "<ROUTINE or EMERGENCY>"
}
\`\`\``;

    // Build OpenAI messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.slice(-8).map((msg) => ({
        role: msg.speaker === 'user' || msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text || msg.content || '',
      })),
    ];

    if (user_message) {
      messages.push({ role: 'user', content: user_message });
    }

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.5,
        max_tokens: 250,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('OpenAI chat error:', errText);
      return NextResponse.json(
        { error: 'OpenAI API error', details: errText },
        { status: 502 }
      );
    }

    const aiData = await aiRes.json();
    const rawReply = aiData.choices?.[0]?.message?.content || '';

    // Separate spoken text from structured JSON block
    let spokenReply = rawReply;
    let extractedData = {};

    const jsonMatch = rawReply.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        extractedData = JSON.parse(jsonMatch[1]);
        spokenReply = rawReply.replace(/```json[\s\S]*?```/, '').trim();
      } catch (e) {
        console.warn('Could not parse JSON block from LLM output', e);
      }
    }

    // Server-Side Strict Phone Number Extraction Fallback
    if (user_message) {
      const phoneRegex = /(?:\+92|0)?3[0-9]{2}[-\s]?[0-9]{7}/;
      const match = user_message.match(phoneRegex);
      if (match && !extractedData.customer_phone) {
        extractedData.customer_phone = match[0].replace(/[-\s]/g, '');
      }
    }

    // Enforce Phone Number Requirement: cannot confirm without customer_phone
    const finalPhone = extractedData.customer_phone || booking_draft.customer_phone;
    if (!finalPhone && extractedData.is_confirmed) {
      extractedData.is_confirmed = false;
      spokenReply = `${spokenReply} برائے مہربانی اپنا فون نمبر بھی بتائیں تاکہ بکنگ مکمل کی جا سکے۔`;
    }

    return NextResponse.json({
      success: true,
      spoken_reply: spokenReply,
      booking_update: extractedData,
      provider_name: providerName,
    });
  } catch (err) {
    console.error('Error in /api/calls/chat:', err);
    return NextResponse.json(
      { error: 'Internal server error in chat route', details: err.message },
      { status: 500 }
    );
  }
}
