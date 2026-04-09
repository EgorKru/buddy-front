/**
 * Speed control hook
 */

import { useState } from 'react';

export const useSpeedControl = (audioRef) => {
  const [playbackRate, setPlaybackRate] = useState(1);
  const speedOptions = [1, 1.25, 1.5, 1.75, 2];

  const toggleSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentIndex = speedOptions.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speedOptions.length;
    const newRate = speedOptions[nextIndex];

    audio.playbackRate = newRate;
    setPlaybackRate(newRate);
  };

  return {
    playbackRate,
    toggleSpeed,
  };
};
