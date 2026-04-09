/**
 * Speed control component
 */

import React from 'react';

export const SpeedControl = ({ playbackRate, themeStyles, toggleSpeed }) => {
  return (
    <span
      style={{
        ...themeStyles.speedControl,
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={toggleSpeed}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#d1d5db';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#e5e7eb';
      }}
    >
      {playbackRate}x
    </span>
  );
};
