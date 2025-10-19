// lib/lipSync.ts

/**
 * Maps English phonemes to VRM visemes (mouth shapes)
 * Based on common phoneme-to-viseme mapping standards
 */

export interface Viseme {
  aa: number;  // mouth open wide (ah, a)
  ih: number;  // mouth narrow (i, e)
  ou: number;  // mouth rounded (o, u)
  ee: number;  // mouth wide (ee)
}

// Phoneme to viseme mapping
const PHONEME_MAP: Record<string, Viseme> = {
  // Vowels
  'a': { aa: 0.8, ih: 0, ou: 0, ee: 0 },      // cat, hat
  'e': { aa: 0, ih: 0.7, ou: 0, ee: 0 },      // bed, red
  'i': { aa: 0, ih: 0.9, ou: 0, ee: 0 },      // sit, bit
  'o': { aa: 0, ih: 0, ou: 0.8, ee: 0 },      // hot, dog
  'u': { aa: 0, ih: 0, ou: 0.9, ee: 0 },      // put, book
  
  // Diphthongs and long vowels
  'ay': { aa: 0.6, ih: 0, ou: 0, ee: 0.4 },   // day, say
  'ee': { aa: 0, ih: 0, ou: 0, ee: 0.9 },     // see, tree
  'oo': { aa: 0, ih: 0, ou: 1.0, ee: 0 },     // food, moon
  'ow': { aa: 0.5, ih: 0, ou: 0.5, ee: 0 },   // now, cow
  
  // Consonants that affect mouth shape
  'b': { aa: 0, ih: 0, ou: 0, ee: 0 },        // lips closed
  'p': { aa: 0, ih: 0, ou: 0, ee: 0 },        // lips closed
  'm': { aa: 0, ih: 0, ou: 0, ee: 0 },        // lips closed
  'f': { aa: 0, ih: 0.3, ou: 0, ee: 0 },      // teeth on lip
  'v': { aa: 0, ih: 0.3, ou: 0, ee: 0 },      // teeth on lip
  'w': { aa: 0, ih: 0, ou: 0.7, ee: 0 },      // lips rounded
  'r': { aa: 0, ih: 0, ou: 0.5, ee: 0 },      // lips slightly rounded
  
  // Default for other consonants
  'default': { aa: 0.2, ih: 0, ou: 0, ee: 0 }
};

/**
 * Simple text-to-phoneme approximation
 * This is a simplified version - for better results, use a proper phoneme library
 */
function textToPhonemes(text: string): string[] {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const phonemes: string[] = [];
  
  words.forEach(word => {
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const next = word[i + 1];
      
      // Vowel combinations
      if (char === 'e' && next === 'e') {
        phonemes.push('ee');
        i++;
      } else if (char === 'o' && next === 'o') {
        phonemes.push('oo');
        i++;
      } else if (char === 'a' && next === 'y') {
        phonemes.push('ay');
        i++;
      } else if (char === 'o' && next === 'w') {
        phonemes.push('ow');
        i++;
      }
      // Single vowels
      else if ('aeiou'.includes(char)) {
        phonemes.push(char);
      }
      // Consonants
      else if ('bpmfvwr'.includes(char)) {
        phonemes.push(char);
      } else {
        phonemes.push('default');
      }
    }
    
    // Add pause between words
    phonemes.push('pause');
  });
  
  return phonemes;
}

/**
 * Generate timed visemes from text
 * @param text The text to convert
 * @param duration Total duration in seconds
 * @returns Array of visemes with timestamps
 */
export function generateLipSyncData(text: string, duration: number): Array<{
  time: number;
  viseme: Viseme;
}> {
  const phonemes = textToPhonemes(text);
  const timePerPhoneme = duration / phonemes.length;
  
  return phonemes.map((phoneme, index) => ({
    time: index * timePerPhoneme,
    viseme: phoneme === 'pause' 
      ? { aa: 0, ih: 0, ou: 0, ee: 0 }
      : PHONEME_MAP[phoneme] || PHONEME_MAP['default']
  }));
}

/**
 * Apply viseme to VRM model
 */
export function applyViseme(
  expressionManager: any,
  viseme: Viseme,
  intensity: number = 1.0
) {
  expressionManager.setValue('aa', viseme.aa * intensity);
  expressionManager.setValue('ih', viseme.ih * intensity);
  expressionManager.setValue('ou', viseme.ou * intensity);
  expressionManager.setValue('ee', viseme.ee * intensity);
}