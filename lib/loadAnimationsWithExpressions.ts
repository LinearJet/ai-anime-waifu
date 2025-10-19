// lib/loadAnimationWithExpressions.ts

import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';

/**
 * Create an animation clip that combines body animation with expression animation
 * This allows you to animate both pose and facial expressions simultaneously
 * 
 * @param bodyClip The animation clip for body/bone movements
 * @param vrm The VRM model
 * @param expressionKeyframes Optional expression keyframes to add
 * @returns A combined animation clip
 */
export function loadAnimationWithExpressions(
  bodyClip: THREE.AnimationClip,
  vrm: VRM,
  expressionKeyframes?: {
    name: string;
    times: number[];
    values: number[];
  }[]
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [...bodyClip.tracks];

  // Add expression tracks if provided
  if (expressionKeyframes) {
    expressionKeyframes.forEach(({ name, times, values }) => {
      const trackName = vrm.expressionManager.getExpressionTrackName(name);
      if (trackName) {
        const expressionTrack = new THREE.NumberKeyframeTrack(
          trackName,
          times,
          values
        );
        tracks.push(expressionTrack);
      }
    });
  }

  return new THREE.AnimationClip(
    bodyClip.name + '_withExpressions',
    bodyClip.duration,
    tracks
  );
}

/**
 * Create a simple expression-only animation
 * Useful for testing or creating facial animation clips
 * 
 * @param vrm The VRM model
 * @param duration Duration of the animation in seconds
 * @param expressionKeyframes Expression keyframes
 * @returns An animation clip with only expression tracks
 */
export function createExpressionAnimation(
  vrm: VRM,
  duration: number,
  expressionKeyframes: {
    name: string;
    times: number[];
    values: number[];
  }[]
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  expressionKeyframes.forEach(({ name, times, values }) => {
    const trackName = vrm.expressionManager.getExpressionTrackName(name);
    if (trackName) {
      const expressionTrack = new THREE.NumberKeyframeTrack(
        trackName,
        times,
        values
      );
      tracks.push(expressionTrack);
    }
  });

  return new THREE.AnimationClip('expressionAnimation', duration, tracks);
}

/**
 * Example: Create a blinking animation
 * You can use this as a reference for creating other expression animations
 */
export function createBlinkAnimation(vrm: VRM): THREE.AnimationClip {
  return createExpressionAnimation(vrm, 3.0, [
    {
      name: 'blink',
      times: [0.0, 0.1, 0.2, 2.8, 2.9, 3.0],
      values: [0.0, 1.0, 0.0, 0.0, 1.0, 0.0]
    }
  ]);
}

/**
 * Example: Create a talking animation (mouth movements)
 */
export function createTalkingAnimation(vrm: VRM): THREE.AnimationClip {
  return createExpressionAnimation(vrm, 2.0, [
    {
      name: 'aa',
      times: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0],
      values: [0.0, 0.8, 0.2, 0.0, 0.7, 0.3, 0.0, 0.6, 0.2, 0.0, 0.0]
    },
    {
      name: 'ih',
      times: [0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.0],
      values: [0.0, 0.0, 0.5, 0.0, 0.0, 0.4, 0.0, 0.0]
    }
  ]);
}

/**
 * Example: Create an emotional transition animation
 */
export function createEmotionTransition(
  vrm: VRM,
  fromEmotion: { happy?: number; angry?: number; sad?: number },
  toEmotion: { happy?: number; angry?: number; sad?: number },
  duration: number = 1.0
): THREE.AnimationClip {
  const keyframes: {
    name: string;
    times: number[];
    values: number[];
  }[] = [];

  const emotions = ['happy', 'angry', 'sad'] as const;
  emotions.forEach(emotion => {
    const from = fromEmotion[emotion] || 0;
    const to = toEmotion[emotion] || 0;
    
    keyframes.push({
      name: emotion,
      times: [0, duration],
      values: [from, to]
    });
  });

  return createExpressionAnimation(vrm, duration, keyframes);
}