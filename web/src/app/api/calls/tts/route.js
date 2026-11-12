import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { text, voice = 'alloy' } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text parameter is required.' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
    }

    // Clean text to remove markdown, asterisks, or extra symbols before speech
    const cleanText = text
      .replace(/[*_#`~[\]]/g, '')
      .replace(/•/g, '')
      .trim();

    // Call OpenAI Audio Speech endpoint
    const openAiRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: voice || 'alloy',
        input: cleanText,
        speed: 1.05,
      }),
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error('OpenAI TTS error:', errText);
      return NextResponse.json(
        { error: 'OpenAI TTS service failed', details: errText },
        { status: 502 }
      );
    }

    const audioArrayBuffer = await openAiRes.arrayBuffer();

    return new NextResponse(audioArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'Content-Length': audioArrayBuffer.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error('Error in /api/calls/tts:', err);
    return NextResponse.json(
      { error: 'Internal server error in TTS route', details: err.message },
      { status: 500 }
    );
  }
}
