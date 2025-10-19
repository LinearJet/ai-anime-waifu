export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, emotion } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const voiceId = 'lhTvHflPVOqgSWyuWQry';
    
    // Map emotions to voice settings instead of tags
    const emotionSettings: Record<string, { stability: number; similarity_boost: number; style: number }> = {
      '[neutral]': { stability: 0.5, similarity_boost: 0.75, style: 0.0 },
      '[happy]': { stability: 0.4, similarity_boost: 0.8, style: 0.6 },
      '[excited]': { stability: 0.3, similarity_boost: 0.85, style: 0.8 },
      '[sad]': { stability: 0.6, similarity_boost: 0.7, style: 0.3 },
      '[angry]': { stability: 0.3, similarity_boost: 0.9, style: 0.7 },
      '[nervous]': { stability: 0.4, similarity_boost: 0.7, style: 0.5 },
      '[curious]': { stability: 0.45, similarity_boost: 0.75, style: 0.4 },
      '[mischievously]': { stability: 0.35, similarity_boost: 0.8, style: 0.7 },
      '[tired]': { stability: 0.7, similarity_boost: 0.6, style: 0.2 },
      '[sorrowful]': { stability: 0.65, similarity_boost: 0.7, style: 0.4 },
      '[regretful]': { stability: 0.6, similarity_boost: 0.7, style: 0.3 },
      '[hesitant]': { stability: 0.55, similarity_boost: 0.7, style: 0.3 },
    };

    const settings = emotionSettings[emotion || '[neutral]'] || emotionSettings['[neutral]'];

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text, // NO emotion tag in the text
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity_boost,
            style: settings.style,
            use_speaker_boost: true
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error response:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return res.status(200).json({
      audio: base64Audio,
      success: true,
    });

  } catch (error: any) {
    console.error('TTS API Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate speech',
      success: false,
    });
  }
}