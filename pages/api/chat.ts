// pages/api/chat.ts
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
    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!
    });

    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const contents = systemPrompt 
      ? [{ role: 'user', parts: [{ text: systemPrompt }] }, ...formattedMessages]
      : formattedMessages;

    const response = await ai.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: contents,
      config: {
        temperature: 0.9,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 40
      }
    });

    return res.status(200).json({ 
      text: response.text,
      success: true
    });

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to generate response',
      success: false
    });
  }
}