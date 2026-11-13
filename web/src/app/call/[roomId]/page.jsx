'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useConnectionState,
} from '@livekit/components-react';
import { ConnectionState, RoomEvent } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getDictionary } from '@/lib/i18n';
import { DEMO_PROVIDERS } from '@/lib/demo-data';
import { toast } from 'sonner';

/**
 * Helper to get trade label in Urdu and English
 */
function getTradeDetails(provider) {
  const customServices = provider?.services;
  let defaultProblem = 'بجلی کی وائرنگ و شارٹ سرکٹ فالٹ';
  let fee = '1,000';

  if (customServices && customServices.length > 0) {
    defaultProblem = customServices[0].name || defaultProblem;
    const price = customServices[0].price_from || customServices[0].price_min || 1000;
    fee = price.toLocaleString();
  }

  const trades = provider?.trades || ['electrician'];
  if (trades.includes('plumber_gas')) {
    return {
      urTrade: 'پلمبنگ، گیس پائپ اور گیزر',
      defaultProblem: customServices?.[0]?.name || 'پائپ لیکیج اور سینیٹری کا مسئلہ',
      fee: customServices?.[0]?.price_from ? customServices[0].price_from.toLocaleString() : '1,200',
    };
  }
  if (trades.includes('ac_fridge')) {
    return {
      urTrade: 'انورٹر اے سی سروس اور گیس ری فل',
      defaultProblem: customServices?.[0]?.name || 'اے سی کولنگ فالٹ و ماسٹر سروس',
      fee: customServices?.[0]?.price_from ? customServices[0].price_from.toLocaleString() : '1,800',
    };
  }
  if (trades.includes('ups_solar')) {
    return {
      urTrade: 'سولر پینل، ہائبرڈ انورٹر اور یو پی ایس',
      defaultProblem: customServices?.[0]?.name || 'یو پی ایس و سولر انورٹر وائرنگ',
      fee: customServices?.[0]?.price_from ? customServices[0].price_from.toLocaleString() : '2,000',
    };
  }
  return {
    urTrade: 'الیکٹریکل وائرنگ اور شارٹ سرکٹ',
    defaultProblem,
    fee,
  };
}

/**
 * Inner call component rendered inside LiveKitRoom context
 */
function CallInterface({ roomId, lang, callData, providerParam }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const t = getDictionary(lang);

  // Active Provider Info - Never force Khan Electric if another provider was requested
  const targetProvider =
    callData?.provider ||
    DEMO_PROVIDERS.find(
      (p) =>
        (providerParam && (p.id === providerParam || p.slug === providerParam)) ||
        (callData?.provider_id && (p.id === callData.provider_id || p.slug === callData.provider_id))
    ) || (providerParam ? {
      id: providerParam,
      name: providerParam.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      business_name: providerParam.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      trades: ['electrician'],
      notify_email: 'mubasiranwar70@gmail.com',
      greeting_ur: `السلام علیکم! ${providerParam.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} میں خوش آمدید۔ میں آپ کا اے آئی وائس اسسٹنٹ ہوں۔`,
    } : DEMO_PROVIDERS[0]);

  const providerName = targetProvider?.business_name || targetProvider?.name || 'Local Service Provider';
  const providerEmail = targetProvider?.notify_email || 'mubasiranwar70@gmail.com';
  const tradeInfo = getTradeDetails(targetProvider);
  const customGreeting =
    targetProvider?.greeting_ur ||
    targetProvider?.agent_config?.greeting_ur ||
    `السلام علیکم! ${providerName} پشاور میں خوش آمدید۔ میں آپ کا اے آئی وائس اسسٹنٹ ہوں۔ میں آپ کی کیا مدد کر سکتا ہوں؟ کیا آپ کو ${tradeInfo.urTrade} کی سروس چاہیے؟`;

  // Agent & call states
  const [agentState, setAgentState] = useState('connecting'); // connecting, listening, thinking, speaking
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [interimUserText, setInterimUserText] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [micAllowed, setMicAllowed] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0);
  const [speechLang, setSpeechLang] = useState('ur-PK');
  const [isRecordingWhisper, setIsRecordingWhisper] = useState(false);
  const [bookingDraft, setBookingDraft] = useState({
    customer_name: null,
    customer_phone: null,
    area: null,
    problem_description: null,
    preferred_slot: null,
    confirmed: false,
  });
  const [confirmedBookingId, setConfirmedBookingId] = useState(null);
  const [emergencyAlert, setEmergencyAlert] = useState(null);
  const [connectedProvider, setConnectedProvider] = useState(targetProvider);

  // Dev simulation input
  const [devInput, setDevInput] = useState('');
  const transcriptEndRef = useRef(null);
  const hasGreetedRef = useRef(false);
  const recognitionRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // Stop any active audio immediately (Instant Barge-in / Interrupt)
  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (e) {}
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    isSpeakingRef.current = false;
    setAgentState('listening');
  }, []);

  // Studio-Quality Neural Voice Synthesizer (Powered by OpenAI TTS + Fallback)
  const speakAudio = useCallback(async (text) => {
    if (!text || typeof window === 'undefined') return;

    stopSpeaking();
    isSpeakingRef.current = true;
    setAgentState('speaking');

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    try {
      // 1. Fetch OpenAI Neural Studio Audio
      const res = await fetch('/api/calls/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: targetProvider?.voice_ur?.includes('Uzma') ? 'nova' : 'alloy',
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.onended = () => {
          isSpeakingRef.current = false;
          setAgentState('listening');
          URL.revokeObjectURL(audioUrl);
          if (!isMuted && recognitionRef.current && hasStarted) {
            try { recognitionRef.current.start(); } catch (e) {}
          }
        };

        audio.onerror = () => {
          isSpeakingRef.current = false;
          setAgentState('listening');
          URL.revokeObjectURL(audioUrl);
          if (!isMuted && recognitionRef.current && hasStarted) {
            try { recognitionRef.current.start(); } catch (e) {}
          }
        };

        try {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
        } catch (playErr) {
          console.warn('Audio playback note (requires user gesture):', playErr.message);
          isSpeakingRef.current = false;
          setAgentState('listening');
          if (!isMuted && recognitionRef.current && hasStarted) {
            try { recognitionRef.current.start(); } catch (e) {}
          }
        }
        return;
      }
    } catch (err) {
      console.warn('OpenAI TTS network note, falling back to local synthesizer:', err);
    }

    // 2. Seamless Fallback to Browser SpeechSynthesis if Network Unavailable
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ur-PK';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const bestVoice =
        voices.find((v) => v.lang.startsWith('ur') || v.lang.startsWith('hi')) ||
        voices[0];
      if (bestVoice) utterance.voice = bestVoice;

      utterance.onend = () => {
        isSpeakingRef.current = false;
        setAgentState('listening');
        if (!isMuted && recognitionRef.current && hasStarted) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
        setAgentState('listening');
        if (!isMuted && recognitionRef.current && hasStarted) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      isSpeakingRef.current = false;
      setAgentState('listening');
    }
  }, [isMuted, stopSpeaking, targetProvider, hasStarted]);

  // Scroll transcript to bottom on new items
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimUserText]);

  // Duration timer
  useEffect(() => {
    let timer;
    if (connectionState === ConnectionState.Connected) {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [connectionState]);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Ultra-Fast Conversational Turn Processor
  const sendUserTurn = useCallback(
    async (textToSend) => {
      const content = (textToSend || devInput).trim();
      if (!content) return;

      setTranscript((prev) => [
        ...prev,
        { speaker: 'user', text: content, time: new Date().toLocaleTimeString() },
      ]);
      setInterimUserText('');
      setDevInput('');
      setAgentState('thinking');

      if (room?.localParticipant) {
        try {
          const payload = new TextEncoder().encode(content);
          await room.localParticipant.publishData(payload, {
            topic: 'awaz.user_turn',
            reliable: true,
          });
        } catch (err) {
          console.warn('publishData error:', err);
        }
      }

      const lower = content.toLowerCase();

      // Hazard / Safety Intercept
      if (
        content.includes('چنگاریاں') ||
        content.includes('شارٹ سرکٹ') ||
        lower.includes('sparks') ||
        content.includes('گیس کی بدبو') ||
        lower.includes('gas leak') ||
        content.includes('کرنٹ')
      ) {
        const rule = (content.includes('گیس') || lower.includes('gas')) ? 'gas_leak' : 'electric_spark';
        const msg = rule === 'gas_leak'
          ? 'خطرہ: فوری طور پر محفوظ جگہ پر جائیں! کوئی برقی سوئچ، ماچس یا لائٹر ہرگز نہ جلائیں۔ باہر سے مین گیس والو بند کر دیں اور ریسکیو 1122 پر رابطہ کریں۔'
          : 'خطرہ: بجلی کی آگ پر پانی ہرگز نہ پھینکیں! اگر ممکن ہو تو فوری طور پر مین سرکٹ بریکر بند کر دیں اور ریسکیو 1122 کو کال کریں۔';
        setEmergencyAlert({
          rule,
          matched_text: content,
          message: msg,
        });
        setTimeout(() => {
          setTranscript((prev) => [
            ...prev,
            { speaker: 'agent', text: msg, time: new Date().toLocaleTimeString() },
          ]);
          speakAudio(msg);
        }, 120);
        return;
      }

      // Call OpenAI Chat API for Intelligent, Natural Human Conversation
      try {
        const res = await fetch('/api/calls/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_message: content,
            conversation_history: transcript,
            provider: targetProvider,
            booking_draft: bookingDraft,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const spokenReply = data.spoken_reply || `جی بالکل، ${providerName} آپ کی خدمت کے لیے حاضر ہے۔`;
          const update = data.booking_update || {};

          // Update booking draft dynamically from AI extraction
          setBookingDraft((prev) => {
            const next = { ...prev };
            if (update.customer_name) next.customer_name = update.customer_name;
            if (update.customer_phone) next.customer_phone = update.customer_phone;
            if (update.area) next.area = update.area;
            if (update.problem_description) next.problem_description = update.problem_description;
            if (update.preferred_slot) next.preferred_slot = update.preferred_slot;
            if (update.is_confirmed) next.confirmed = true;
            return next;
          });

          // Check if AI confirmed booking
          if (update.is_confirmed && !confirmedBookingId) {
            const newBookingId = `BK-PK-${Math.floor(1000 + Math.random() * 9000)}`;
            setConfirmedBookingId(newBookingId);
            try {
              fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customer_name: update.customer_name || bookingDraft.customer_name || 'Valued Customer',
                  customer_phone: update.customer_phone || bookingDraft.customer_phone || '03001234567',
                  area: update.area || bookingDraft.area || 'حیات آباد، پشاور',
                  problem_description: update.problem_description || bookingDraft.problem_description || tradeInfo.defaultProblem,
                  preferred_slot: update.preferred_slot || bookingDraft.preferred_slot || 'کل صبح 11:00 بجے',
                  provider_id: targetProvider.id,
                  notify_email: providerEmail,
                  call_id: callData?.callId || roomId,
                }),
              });
            } catch (e) {
              console.warn('Booking dispatch err:', e);
            }
            toast.success(`Booking Confirmed! Email dispatched to ${providerEmail}`);
          }

          // Append to live transcript
          setTranscript((prev) => [
            ...prev,
            { speaker: 'agent', text: spokenReply, time: new Date().toLocaleTimeString() },
          ]);

          // Speak reply using OpenAI Studio Neural Audio
          await speakAudio(spokenReply);
          return;
        }
      } catch (err) {
        console.warn('OpenAI chat API network error, using fallback:', err);
      }

      // Fast Local Fallback if network is disconnected
      setTimeout(() => {
        let reply = `جی فرمائیے! ${providerName} آپ کی خدمت کے لیے حاضر ہے۔ آپ کو پشاور میں کون سا کام درکار ہے؟`;
        if (content.includes('کل') || content.includes('صبح') || content.includes('وقت')) {
          reply = `بہترین! میں نے آپ کا وقت نوٹ کر لیا ہے۔ کیا میں یہ بکنگ کنفرم کر دوں؟`;
        }
        setTranscript((prev) => [
          ...prev,
          { speaker: 'agent', text: reply, time: new Date().toLocaleTimeString() },
        ]);
        speakAudio(reply);
      }, 150);
    },
    [devInput, room, speakAudio, bookingDraft, callData, roomId, providerName, providerEmail, targetProvider, tradeInfo, transcript, confirmedBookingId]
  );

  // Initialize Microphone Permission, Live VAD Visualizer & Audio Engine
  const startCallSession = async () => {
    try {
      // 1. Explicitly prompt and acquire real microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      setMicAllowed(true);
      setHasStarted(true);
      toast.success('Microphone connected! Speak freely.');

      // 2. Real-Time VAD (Voice Activity Detection) & Volume Analyser
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!analyser || isMuted) {
              setLiveVolume(0);
              requestAnimationFrame(updateVolume);
              return;
            }
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setLiveVolume(avg);

            // True ChatGPT Instant Barge-In: if user speaks loudly while agent is speaking, stop immediately!
            if (avg > 24 && isSpeakingRef.current) {
              stopSpeaking();
            }

            requestAnimationFrame(updateVolume);
          };
          requestAnimationFrame(updateVolume);
        }
      } catch (audioErr) {
        console.warn('Audio analyser setup note:', audioErr);
      }

      // 3. Start Browser Speech Recognition
      startContinuousSTT(speechLang);

      // 4. Speak initial custom greeting
      if (!hasGreetedRef.current) {
        hasGreetedRef.current = true;
        setTranscript((prev) => {
          if (prev.length === 0) {
            return [
              {
                speaker: 'agent',
                text: customGreeting,
                time: new Date().toLocaleTimeString(),
              },
            ];
          }
          return prev;
        });
        await speakAudio(customGreeting);
      }
    } catch (err) {
      console.warn('Microphone permission error:', err);
      toast.error('Microphone blocked: Please allow microphone permission in your browser URL bar.');
    }
  };

  // Continuous Browser Speech Recognition Engine
  const startContinuousSTT = useCallback(
    (langCode) => {
      if (typeof window === 'undefined') return;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langCode || speechLang || 'ur-PK';

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          if (isSpeakingRef.current) {
            stopSpeaking();
          }
          setInterimUserText(interim);
        }

        if (final.trim()) {
          setInterimUserText('');
          sendUserTurn(final.trim());
        }
      };

      recognition.onerror = (e) => {
        if (e.error === 'not-allowed') {
          toast.error('Microphone access blocked. Click the microphone icon to grant permission.');
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('SpeechRecognition error:', e.error);
        }
      };

      recognition.onend = () => {
        if (!isMuted && !isSpeakingRef.current && hasStarted) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setAgentState('listening');
      } catch (err) {
        console.warn('Recognition start note:', err.message);
      }
    },
    [isMuted, stopSpeaking, sendUserTurn, speechLang, hasStarted]
  );

  // Toggle Microphone
  const toggleMic = async () => {
    if (!hasStarted) {
      await startCallSession();
      return;
    }

    try {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);

      if (room?.localParticipant) {
        await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      }

      if (nextMuted) {
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (e) {}
        }
        toast.info('Microphone muted');
      } else {
        if (recognitionRef.current && !isSpeakingRef.current) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
        setAgentState('listening');
        toast.info('Microphone unmuted (Listening...)');
      }
    } catch (err) {
      toast.error('Could not toggle microphone: ' + err.message);
    }
  };

  // Push-to-Talk / Whisper Voice Backup (For Firefox or Mobile Browsers)
  const startWhisperRecording = async () => {
    try {
      stopSpeaking();
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicAllowed(true);
        setHasStarted(true);
      }
      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType: 'audio/webm' });
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        setAgentState('thinking');
        try {
          const res = await fetch('/api/calls/transcribe', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (data.text && data.text.trim()) {
            sendUserTurn(data.text.trim());
          } else {
            setAgentState('listening');
          }
        } catch (whisperErr) {
          console.warn('Whisper fallback error:', whisperErr);
          setAgentState('listening');
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingWhisper(true);
      setAgentState('listening');
    } catch (err) {
      toast.error('Could not start voice recording: ' + err.message);
    }
  };

  const stopWhisperRecording = () => {
    if (mediaRecorderRef.current && isRecordingWhisper) {
      mediaRecorderRef.current.stop();
      setIsRecordingWhisper(false);
    }
  };

  // Listen to LiveKit data packets
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload, participant, kind, topic) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (topic === 'awaz.booking') {
          if (data.type === 'draft_update') {
            setBookingDraft((prev) => ({
              ...prev,
              ...(data.draft || {}),
            }));
          } else if (data.type === 'booking_confirmed') {
            setConfirmedBookingId(data.booking_id);
            if (data.draft) {
              setBookingDraft(data.draft);
            }
            toast.success(`Booking confirmed! ID: ${data.booking_id}`);
          }
        } else if (topic === 'awaz.agent_state') {
          if (data.state) {
            setAgentState(data.state);
          }
        } else if (topic === 'awaz.transcript') {
          setTranscript((prev) => [
            ...prev,
            { speaker: data.speaker, text: data.text, time: new Date().toLocaleTimeString() },
          ]);
        } else if (topic === 'awaz.events') {
          if (data.emergency) {
            setEmergencyAlert(data);
            setAgentState('speaking');
            toast.error(`EMERGENCY: ${data.rule || 'Hazard detected'}!`);
          }
        } else if (topic === 'awaz.handoff') {
          setConnectedProvider({
            id: data.provider_id,
            name: data.provider_name,
            code: data.provider_code,
          });
          toast.success(`Connected to ${data.provider_name}!`);
        }
      } catch (err) {
        console.error('Error decoding room data packet:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // Dynamic Visual State for ChatGPT Orb
  const getOrbVisuals = () => {
    switch (agentState) {
      case 'speaking':
        return {
          glow: 'from-emerald-400 via-teal-500 to-cyan-500 shadow-[0_0_60px_rgba(20,184,166,0.65)]',
          pulseScale: 'scale-105 animate-pulse ring-8 ring-emerald-400/30',
          title: `${providerName} Speaking`,
          sub: 'آواز بوٹ بول رہا ہے...',
          badge: 'bg-emerald-500 text-white',
          orbRings: true,
        };
      case 'thinking':
        return {
          glow: 'from-purple-500 via-indigo-500 to-amber-400 shadow-[0_0_55px_rgba(168,85,247,0.55)]',
          pulseScale: 'scale-100 ring-4 ring-purple-400/40 animate-spin',
          title: 'AwazBot Thinking',
          sub: 'سوچ رہا ہے اور جواب تیار کر رہا ہے...',
          badge: 'bg-purple-500 text-white',
          orbRings: false,
        };
      case 'listening':
        return {
          glow: 'from-teal-600 via-emerald-500 to-green-400 shadow-[0_0_45px_rgba(16,185,129,0.45)]',
          pulseScale: 'scale-100 animate-pulse ring-4 ring-emerald-500/25',
          title: 'AwazBot Listening',
          sub: 'آپ کی آواز سن رہا ہے... بولئے',
          badge: 'bg-teal-600 text-white',
          orbRings: true,
        };
      default:
        return {
          glow: 'from-zinc-500 via-slate-600 to-zinc-400 shadow-[0_0_30px_rgba(148,163,184,0.3)]',
          pulseScale: 'scale-95 animate-pulse',
          title: 'Connecting Voice...',
          sub: 'آڈیو سیشن منسلک ہو رہا ہے...',
          badge: 'bg-zinc-500 text-white',
          orbRings: false,
        };
    }
  };

  const orb = getOrbVisuals();

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
      {/* Critical Safety Hazard Banner */}
      {emergencyAlert && (
        <div className="rounded-xl border-2 border-red-600 bg-red-500/15 p-4 text-red-950 dark:text-red-200 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-3xl animate-bounce">🚨</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-wide text-red-700 dark:text-red-400 uppercase">
                    EMERGENCY HAZARD DETECTED ({emergencyAlert.rule})
                  </span>
                  <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                    Immediate Action
                  </Badge>
                </div>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-red-900 dark:text-red-100">
                  {emergencyAlert.message}
                </p>
                <div className="mt-1 text-[11px] font-mono text-red-800 dark:text-red-300">
                  <span>Matched statement: &ldquo;{emergencyAlert.matched_text}&rdquo;</span>
                </div>
              </div>
            </div>
            <a
              href="tel:1122"
              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700 transition-colors shrink-0"
            >
              📞 Call Rescue 1122
            </a>
          </div>
        </div>
      )}

      {/* Top Bar with Specific Provider Name & End Call */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-3.5 px-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
          <div>
            <h1 className="text-base font-bold text-foreground">
              {providerName} — AI Receptionist
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Live Session • {formatTime(duration)} • {targetProvider?.areas?.[0] || 'Peshawar'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href={`/chat/${targetProvider.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold text-xs h-8 border-primary/40 text-primary hover:bg-primary/10"
            >
              <span>💬</span>
              <span>Switch to Chat Agent</span>
            </Button>
          </Link>
          <Badge className={`text-xs px-3 py-1 font-semibold ${orb.badge}`}>
            {orb.title}
          </Badge>
          <Link href="/services">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                stopSpeaking();
                room?.disconnect();
              }}
              className="font-semibold shadow-sm text-xs h-8"
            >
              End Call
            </Button>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CHATGPT-STYLE VOICE AGENT VISUALIZER HERO                                  */}
      {/* ========================================================================= */}
      <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-b from-card via-card/90 to-background shadow-lg">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />

        <CardContent className="flex flex-col items-center justify-center py-10 px-6 text-center space-y-6 relative z-10">
          {/* Main Glowing Fluid Voice Orb */}
          <div className="relative flex items-center justify-center">
            {orb.orbRings && (
              <>
                <div className="absolute h-48 w-48 rounded-full border border-emerald-400/20 animate-ping pointer-events-none" />
                <div className="absolute h-56 w-56 rounded-full border border-teal-400/15 animate-pulse pointer-events-none" />
              </>
            )}

            <div
              className={`h-36 w-36 sm:h-44 sm:w-44 rounded-full bg-gradient-to-tr ${orb.glow} ${orb.pulseScale} transition-all duration-700 flex items-center justify-center cursor-pointer select-none`}
              onClick={toggleMic}
              title={hasStarted ? 'Click to mute/unmute mic' : 'Click to start voice call'}
            >
              <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-full bg-black/20 backdrop-blur-md flex flex-col items-center justify-center text-white border border-white/25 shadow-inner">
                {!hasStarted ? (
                  <>
                    <span className="text-3xl animate-bounce">🎙️</span>
                    <span className="text-[10px] font-bold tracking-wider mt-1 uppercase text-white/90">
                      Tap to Talk
                    </span>
                  </>
                ) : agentState === 'speaking' ? (
                  <>
                    <span className="text-3xl animate-bounce">🎙️</span>
                    <span className="text-[10px] font-bold tracking-wider mt-1 uppercase text-white/90">
                      Speaking
                    </span>
                  </>
                ) : agentState === 'thinking' ? (
                  <>
                    <span className="text-3xl animate-spin">✨</span>
                    <span className="text-[10px] font-bold tracking-wider mt-1 uppercase text-white/90">
                      Thinking
                    </span>
                  </>
                ) : isMuted ? (
                  <>
                    <span className="text-3xl opacity-75">🔇</span>
                    <span className="text-[10px] font-bold tracking-wider mt-1 uppercase text-white/90">
                      Muted
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl animate-pulse">🟢</span>
                    <span className="text-[10px] font-bold tracking-wider mt-1 uppercase text-white/90">
                      Listening
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Frequency Waveform Bars - Live Reactive to Microphone Volume */}
          <div className="flex items-center gap-1.5 h-10">
            {[4, 8, 14, 22, 16, 28, 20, 12, 24, 18, 10, 6].map((baseHeight, idx) => {
              const active = agentState === 'speaking' || (agentState === 'listening' && !isMuted);
              const reactiveHeight = active
                ? Math.min(38, Math.max(8, baseHeight + (liveVolume * (idx % 2 === 0 ? 0.7 : 0.4))))
                : 6;
              return (
                <div
                  key={idx}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    active
                      ? liveVolume > 15
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : 'bg-emerald-500'
                      : 'bg-muted-foreground/30'
                  }`}
                  style={{
                    height: `${reactiveHeight}px`,
                  }}
                />
              );
            })}
          </div>

          {/* Subtitle / Real-Time Transcription Stream */}
          <div className="space-y-1.5 max-w-lg">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {orb.title}
            </h2>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 font-urdu dir-rtl">
              {orb.sub}
            </p>
            {interimUserText && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-pulse">
                <span>🎤 آپ بول رہے ہیں: &ldquo;{interimUserText}&rdquo;</span>
              </div>
            )}
            {isRecordingWhisper && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-xs font-semibold text-red-600 dark:text-red-400 animate-pulse">
                <span>🔴 آواز ریکارڈ ہو رہی ہے... بولنے کے بعد چھوڑ دیں</span>
              </div>
            )}
          </div>

          {/* Audio Controls Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {!hasStarted ? (
              <Button
                size="lg"
                onClick={startCallSession}
                className="gap-2.5 px-8 font-bold shadow-lg text-sm rounded-full bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce"
              >
                🎙️ بات شروع کریں (Click to Connect Microphone & Talk)
              </Button>
            ) : (
              <>
                <Button
                  variant={isMuted ? 'destructive' : 'default'}
                  size="default"
                  onClick={toggleMic}
                  className="gap-2 px-5 font-semibold shadow-sm text-xs rounded-full"
                >
                  {isMuted ? '🔇 Unmute Microphone' : '🎙️ Mic Live (Auto-Listening)'}
                </Button>

                {/* Push-to-Talk Whisper Backup */}
                <Button
                  variant={isRecordingWhisper ? 'destructive' : 'outline'}
                  size="default"
                  onMouseDown={startWhisperRecording}
                  onMouseUp={stopWhisperRecording}
                  onTouchStart={startWhisperRecording}
                  onTouchEnd={stopWhisperRecording}
                  className={`gap-2 px-4 text-xs rounded-full font-semibold ${
                    isRecordingWhisper ? 'animate-pulse bg-red-600 text-white' : ''
                  }`}
                  title="Hold to speak with Whisper Neural AI"
                >
                  {isRecordingWhisper ? '🔴 Recording (Release to Send)' : '🎙️ Hold to Speak (Whisper AI)'}
                </Button>

                {/* Language Switcher */}
                <div className="flex items-center gap-1 rounded-full border bg-muted/40 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSpeechLang('ur-PK');
                      startContinuousSTT('ur-PK');
                      toast.info('Voice language set to Urdu (اردو)');
                    }}
                    className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                      speechLang === 'ur-PK'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    اردو
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSpeechLang('en-US');
                      startContinuousSTT('en-US');
                      toast.info('Voice language set to English');
                    }}
                    className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                      speechLang === 'en-US'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    English
                  </button>
                </div>

                <Button
                  variant="ghost"
                  size="default"
                  onClick={() => {
                    const sampleText = `السلام علیکم! ${providerName} میں خوش آمدید۔ آپ کو کیا کام کروانا ہے؟`;
                    speakAudio(sampleText);
                    toast.info(`Playing ${providerName} voice...`);
                  }}
                  className="gap-1.5 px-3 text-xs rounded-full text-muted-foreground hover:text-foreground"
                >
                  🔊 Test Voice
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grid: Left Column (Live Booking Card) & Right Column (Live Transcript) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Live Booking Card */}
        <Card className="shadow-sm border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  Live Booking Card
                </CardTitle>
                <CardDescription className="text-xs text-emerald-600 font-medium">
                  Assigned Provider: {providerName}
                </CardDescription>
              </div>
              {confirmedBookingId ? (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                  Confirmed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/40">
                  Drafting
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 text-sm">
            {confirmedBookingId && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 p-3.5 text-emerald-900 dark:text-emerald-200 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    ✅ Booking Confirmed!
                  </span>
                  <Badge variant="outline" className="bg-white dark:bg-zinc-900 font-mono text-xs">
                    {confirmedBookingId}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Email alert dispatched to provider: <span className="font-semibold text-foreground">{providerEmail}</span>
                </p>
                <Link
                  href={`/booking/${confirmedBookingId}`}
                  className="inline-block text-xs font-semibold text-emerald-700 dark:text-emerald-400 underline pt-1"
                >
                  View Booking Tracker &rarr;
                </Link>
              </div>
            )}

            <div className="space-y-3 rounded-lg border bg-muted/40 p-3.5">
              <div className="flex justify-between items-center text-xs border-b pb-2">
                <span className="text-muted-foreground">Service Provider:</span>
                <span className="font-bold text-primary">{providerName}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b pb-2">
                <span className="text-muted-foreground">Customer Name:</span>
                <span className="font-medium text-foreground">
                  {bookingDraft.customer_name || <em className="text-muted-foreground/60">Listening...</em>}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-b pb-2">
                <span className="text-muted-foreground font-semibold flex items-center gap-1">
                  Customer Phone:
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-red-600 border-red-300">
                    Mandatory
                  </Badge>
                </span>
                <span className="font-mono font-medium text-foreground">
                  {bookingDraft.customer_phone ? (
                    <span className="text-emerald-600 font-bold">{bookingDraft.customer_phone}</span>
                  ) : (
                    <span className="text-red-500 italic">03XX-XXXXXXX (Required)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-b pb-2">
                <span className="text-muted-foreground">Service Area:</span>
                <span className="font-medium text-foreground">
                  {bookingDraft.area || <em className="text-muted-foreground/60">e.g. Hayatabad, University Town</em>}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-b pb-2">
                <span className="text-muted-foreground">Problem / Issue:</span>
                <span className="font-medium text-foreground text-right max-w-[200px] truncate">
                  {bookingDraft.problem_description || <em className="text-muted-foreground/60">{tradeInfo.defaultProblem}</em>}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-b pb-2">
                <span className="text-muted-foreground">Preferred Time:</span>
                <span className="font-medium text-foreground">
                  {bookingDraft.preferred_slot || <em className="text-muted-foreground/60">Tomorrow 11 AM</em>}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-muted-foreground">Confirmed by Caller:</span>
                <span className="font-medium">
                  {bookingDraft.confirmed ? (
                    <span className="text-emerald-600 font-bold">YES (Verified)</span>
                  ) : (
                    <span className="text-amber-600">Pending explicit recap</span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                Provider Gmail: <span className="text-foreground font-mono">{providerEmail}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Status: <span className="text-emerald-600 font-semibold capitalize">{connectionState}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Live Conversation Transcript */}
        <Card className="shadow-sm flex flex-col h-[400px]">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold">
              Live Transcript
            </CardTitle>
            <CardDescription className="text-xs">
              Live transcription with {providerName} AI Receptionist
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 font-sans text-sm">
            {transcript.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground p-6">
                Connected to {providerName}. Say &ldquo;Salam&rdquo; or click any prompt below.
              </div>
            ) : (
              transcript.map((turn, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    turn.speaker === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground px-1 pb-0.5">
                    {turn.speaker === 'user' ? 'Customer' : providerName} • {turn.time}
                  </span>
                  <div
                    className={`rounded-2xl px-3.5 py-2 max-w-[85%] text-xs leading-relaxed ${
                      turn.speaker === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none border font-urdu text-sm'
                    }`}
                  >
                    {turn.text}
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </CardContent>
        </Card>
      </div>

      {/* Interactive Conversation Quick Actions & Manual Input */}
      <Card className="border-dashed border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
            <span>Instant Conversation Flow for {providerName}</span>
            <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-800">
              Low-Latency Mode
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-white dark:bg-background"
              onClick={() => sendUserTurn(`السلام علیکم، مجھے ${tradeInfo.urTrade} کی سروس چاہیے`)}
            >
              1. سلام (Greeting)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-white dark:bg-background"
              onClick={() => sendUserTurn('میرا نام فہم انور ہے')}
            >
              2. نام (Customer Name)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-medium"
              onClick={() => sendUserTurn('میرا موبائل نمبر 03001234567 ہے')}
            >
              📱 فون نمبر (0300-1234567)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-white dark:bg-background"
              onClick={() => sendUserTurn('حیات آباد فیز 4، پشاور')}
            >
              3. علاقہ (Hayatabad)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-white dark:bg-background"
              onClick={() => sendUserTurn(tradeInfo.defaultProblem)}
            >
              4. مسئلہ ({tradeInfo.defaultProblem.slice(0, 18)}...)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-white dark:bg-background"
              onClick={() => sendUserTurn('کل صبح 11 بجے')}
            >
              5. وقت (Tomorrow 11 AM)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
              onClick={() => sendUserTurn('جی ہاں، بالکل ٹھیک ہے، بکنگ کنفرم کر دیں')}
            >
              6. ✅ کنفرم بکنگ (Confirm & Send Email)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 font-semibold"
              onClick={() => sendUserTurn('کچن میں گیس کی بدبو آ رہی ہے')}
            >
              ⚠️ 7. ایمرجنسی (Gas Leak)
            </Button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendUserTurn();
            }}
            className="flex gap-2"
          >
            <Input
              value={devInput}
              onChange={(e) => setDevInput(e.target.value)}
              placeholder={`Speak or type to ${providerName}...`}
              className="text-xs h-9 bg-white dark:bg-background"
            />
            <Button type="submit" size="sm" className="h-9 px-4 text-xs font-semibold">
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Main Call Page with LiveKit Room Provider wrapper
 */
export default function CallScreenPage({ params }) {
  const { roomId } = use(params);
  const searchParams = useSearchParams();
  const providerParam = searchParams.get('provider') || searchParams.get('provider_id');

  const [lang, setLang] = useState('en');
  const [callSession, setCallSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const match = document.cookie.match(/awaz_lang=([^;]+)/);
    if (match) {
      setLang(match[1]);
    }
  }, []);

  // Fetch or retrieve token from sessionStorage or API
  useEffect(() => {
    async function initSession() {
      if (typeof window === 'undefined') return;

      // 1. Check sessionStorage first (only use if matches requested provider)
      const stored = sessionStorage.getItem(`call_${roomId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const currentProvId = parsed.provider?.id || parsed.provider_id;
          if (parsed.token && (!providerParam || currentProvId === providerParam)) {
            setCallSession(parsed);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Could not parse stored call session', e);
        }
      }

      // 2. Fetch fresh token from /api/calls/web for the specific provider
      try {
        const targetId = providerParam || undefined;
        const res = await fetch('/api/calls/web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: targetId ? 'provider' : 'directory',
            provider_id: targetId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to initialize call session.');
        } else {
          setCallSession(data);
          sessionStorage.setItem(`call_${roomId}`, JSON.stringify(data));
        }
      } catch (err) {
        setError('Network error fetching call token: ' + err.message);
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [roomId, providerParam]);

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Connecting to AwazBot KP...</p>
        </div>
      </div>
    );
  }

  if (error || !callSession?.token) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center p-6">
        <Card className="text-center border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Connection Error</CardTitle>
            <CardDescription className="text-xs">
              {error || 'Unable to obtain a valid LiveKit session token.'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center gap-3">
            <Link href="/services">
              <Button variant="outline" size="sm">Back to Services</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const livekitUrl =
    callSession.livekitUrl ||
    process.env.NEXT_PUBLIC_LIVEKIT_URL ||
    'wss://awazbot-kp-x7t8d6im.livekit.cloud';

  return (
    <LiveKitRoom
      token={callSession.token}
      serverUrl={livekitUrl}
      connect={true}
      audio={true}
      video={false}
      data-lk-theme="default"
      onError={(err) => console.error('LiveKit Room Error:', err)}
    >
      <RoomAudioRenderer />
      <CallInterface roomId={roomId} lang={lang} callData={callSession} providerParam={providerParam} />
    </LiveKitRoom>
  );
}
