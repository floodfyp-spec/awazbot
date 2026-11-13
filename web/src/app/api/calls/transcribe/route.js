import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    const openAiFormData = new FormData();
    openAiFormData.append('file', file, 'audio.webm');
    openAiFormData.append('model', 'whisper-1');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAiFormData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.warn('Whisper transcription warning:', errText);
      return NextResponse.json(
        { error: 'Whisper transcription failed', details: errText },
        { status: 502 }
      );
    }

    const data = await whisperRes.json();
    return NextResponse.json({ text: data.text || '' });
  } catch (err) {
    console.error('Error in /api/calls/transcribe:', err);
    return NextResponse.json(
      { error: 'Internal server error during transcription', details: err.message },
      { status: 500 }
    );
  }
}
