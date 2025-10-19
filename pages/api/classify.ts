// pages/api/classify.ts
import { GoogleGenAI } from '@google/genai';
import type { NextApiRequest, NextApiResponse } from 'next';

export interface ClassificationResult {
  expression: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'relaxed';
  animation: string; // filename without .fbx
  emotionTag: string; // for TTS: [happy], [sad], etc.
  intensity: number; // 0-1 for expression strength
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, conversationContext } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!
    });

    const prompt = `Analyze this AI character's response and select the MOST FITTING emotion and animation.

Character personality: Sarcastic, witty, confident software engineer with Ada Wong vibes.

Response text: "${text}"
User said: "${conversationContext || 'N/A'}"

STRICT RULES:
1. Match the ACTUAL emotion in the text, not just default to happy
2. Use varied animations - avoid repeating the same ones
3. Consider the CONTEXT of what user said

EMOTION MAPPING:
- Greeting/friendly → happy, standing_greeting or excited_gesture
- Explaining/teaching → neutral, thinking or talking
- Sarcastic/smug → relaxed, sassy_arm_cross or hand_on_hip  
- Dismissive/unimpressed → angry, dismissive_hand_wave or dismissive
- Showing off knowledge → happy, excited_gesture or laughing
- Confused/questioning → surprised, looking_around or shrug
- Arguing/defending → angry, arguing or angry_gesture
- Tired/bored → sad, idle or defeated
- Encouraging → happy, talking or hand_on_hip
- Joking → relaxed, dismissive_hand_wave or sassy_arm_cross

Available expressions: neutral, happy, sad, angry, surprised, relaxed
Available animations: idle, talking, happy_idle, excited_gesture, laughing, sad_idle, defeated, angry_gesture, arguing, dismissive, thinking, looking_around, shrug, hand_on_hip, sassy_arm_cross, dismissive_hand_wave, standing_greeting

TTS emotions: [neutral], [happy], [excited], [sad], [angry], [nervous], [curious], [mischievously], [tired], [sorrowful], [regretful], [hesitant]

ANALYZE THE TEXT CAREFULLY:
- If it contains "?" or "why" or "hmm" → use thinking/curious animations
- If it's short and dismissive → use dismissive animations  
- If it's enthusiastic → use excited animations
- If it's explanatory → use talking/gesturing animations
- If it's sarcastic → use sassy animations
- If she's joking → use mischievously tag

Return ONLY this JSON format:
{
  "expression": "angry",
  "animation": "dismissive_hand_wave",
  "emotionTag": "[mischievously]",
  "intensity": 0.7
}

DO NOT default to happy/hand_on_hip. Be creative and varied!`;

    const response = await ai.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7, // Increased for more variety
        maxOutputTokens: 200,
        topP: 0.9,
        topK: 40
      }
    });

    let responseText = response.text.trim();
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result: ClassificationResult = JSON.parse(responseText);

    // Validate result has required fields
    if (!result.expression || !result.animation || !result.emotionTag) {
      throw new Error('Invalid classification result');
    }

    console.log('Classification:', result); // Debug log

    return res.status(200).json({ 
      ...result,
      success: true
    });

  } catch (error: any) {
    console.error('Classification API Error:', error);
    
    // Better fallback with variety
    const fallbacks = [
      { expression: 'neutral', animation: 'talking', emotionTag: '[neutral]' },
      { expression: 'relaxed', animation: 'thinking', emotionTag: '[curious]' },
      { expression: 'happy', animation: 'excited_gesture', emotionTag: '[happy]' },
      { expression: 'neutral', animation: 'shrug', emotionTag: '[neutral]' },
    ];
    
    const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    
    return res.status(200).json({ 
      ...randomFallback,
      intensity: 0.6,
      success: true,
      fallback: true
    });
  }
}