/**
 * Waveform data hook
 */

import { useState, useEffect } from 'react';
import { analyzeAudioFile } from '../utils/formatTime';

export const useWaveformData = (src, width, barSpacing) => {
  const [waveformData, setWaveformData] = useState([]);

  useEffect(() => {
    const loadWaveform = async () => {
      if (src) {
        try {
          // bar width calculator
          const effectiveBarWidth = 2 + barSpacing;
          const numSamples = Math.floor(width / effectiveBarWidth);
          const data = await analyzeAudioFile(src, Math.max(numSamples, 10));
          setWaveformData(data);
        } catch (error) {
          console.error('Failed to load waveform data:', error);

          const effectiveBarWidth = 2 + barSpacing;
          const numSamples = Math.floor(width / effectiveBarWidth);
          setWaveformData(Array(Math.max(numSamples, 10)).fill(0.1));
        }
      } else {
        // Если src пустой, показываем фиктивные данные для отображения
        const effectiveBarWidth = 2 + barSpacing;
        const numSamples = Math.floor(width / effectiveBarWidth);
        // Генерируем простую вейвформу с вариацией высоты
        const fakeData = Array(Math.max(numSamples, 10))
          .fill(0)
          .map((_, i) => {
            return Math.abs(Math.sin(i * 0.3)) * 0.6 + 0.3; // Вариация от 0.3 до 0.9
          });
        setWaveformData(fakeData);
      }
    };

    loadWaveform();
  }, [src, width, barSpacing]);

  return waveformData;
};
