// pages/api/emotion.ts
import { GoogleGenAI } from '@google/genai';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!
    });

    const prompt = `Analyze the emotion in this text and return ONLY ONE emotion tag from this list: [happy], [excited], [sad], [angry], [nervous], [curious], [mischievously], [tired], [sorrowful], [regretful], [hesitant], [neutral].

Text: "${text}"

Return ONLY the tag, nothing else. Example: [happy]`;

    const response = await ai.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        maxOutputTokens: 50,
      }
    });

    const emotion = response.text.trim();

    return res.status(200).json({ 
      emotion,
      success: true
    });

  } catch (error: any) {
    console.error('Emotion API Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to classify emotion',
      success: false
    });
  }
}