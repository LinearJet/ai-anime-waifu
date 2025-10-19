// lib/animationClassifier.ts

export interface AnimationRule {
  expression: string;
  animation: string;
  emotionTag: string;
  intensity: number;
}

/**
 * Rule-based classification as fallback or supplement to AI
 * Detects keywords and patterns to ensure variety
 */
export function classifyByRules(text: string, userInput: string): AnimationRule | null {
  const lowerText = text.toLowerCase();
  const lowerInput = userInput.toLowerCase();

  // Greeting patterns
  if (lowerInput.match(/^(hi|hello|hey|greetings|sup|yo)/)) {
    return {
      expression: 'happy',
      animation: 'standing_greeting',
      emotionTag: '[happy]',
      intensity: 0.8
    };
  }

  // Questions/confusion
  if (lowerText.match(/\?/) || lowerText.match(/\b(why|how|what|hmm|interesting)\b/)) {
    return {
      expression: 'surprised',
      animation: Math.random() > 0.5 ? 'thinking' : 'looking_around',
      emotionTag: '[curious]',
      intensity: 0.7
    };
  }

  // Sarcasm indicators
  if (lowerText.match(/\b(oh please|sure|right|obviously|wow|shocking)\b/)) {
    return {
      expression: 'relaxed',
      animation: Math.random() > 0.5 ? 'dismissive_hand_wave' : 'sassy_arm_cross',
      emotionTag: '[mischievously]',
      intensity: 0.8
    };
  }

  // Dismissive/bored
  if (lowerText.match(/\b(whatever|boring|yawn|meh|anyway)\b/)) {
    return {
      expression: 'angry',
      animation: 'dismissive',
      emotionTag: '[tired]',
      intensity: 0.6
    };
  }

  // Enthusiastic/excited
  if (lowerText.match(/\b(amazing|awesome|incredible|wow|yes|exactly)\b/) || lowerText.match(/!/)) {
    return {
      expression: 'happy',
      animation: Math.random() > 0.5 ? 'excited_gesture' : 'laughing',
      emotionTag: '[excited]',
      intensity: 0.9
    };
  }

  // Explaining/teaching (longer responses)
  if (text.length > 100 && lowerText.match(/\b(is|are|means|basically|essentially)\b/)) {
    return {
      expression: 'neutral',
      animation: Math.random() > 0.5 ? 'talking' : 'thinking',
      emotionTag: '[neutral]',
      intensity: 0.6
    };
  }

  // Arguing/defensive
  if (lowerText.match(/\b(actually|wrong|disagree|but|however)\b/)) {
    return {
      expression: 'angry',
      animation: Math.random() > 0.5 ? 'arguing' : 'angry_gesture',
      emotionTag: '[angry]',
      intensity: 0.7
    };
  }

  // Sad/sympathetic
  if (lowerText.match(/\b(sorry|unfortunately|sad|too bad)\b/)) {
    return {
      expression: 'sad',
      animation: Math.random() > 0.5 ? 'sad_idle' : 'defeated',
      emotionTag: '[sorrowful]',
      intensity: 0.6
    };
  }

  // Shrugging/uncertain
  if (lowerText.match(/\b(maybe|perhaps|dunno|not sure|shrug)\b/)) {
    return {
      expression: 'neutral',
      animation: 'shrug',
      emotionTag: '[hesitant]',
      intensity: 0.5
    };
  }

  // Confident/showing off
  if (lowerText.match(/\b(obviously|of course|clearly|naturally|simply)\b/)) {
    return {
      expression: 'happy',
      animation: 'hand_on_hip',
      emotionTag: '[mischievously]',
      intensity: 0.8
    };
  }

  return null; // No match, let AI handle it
}