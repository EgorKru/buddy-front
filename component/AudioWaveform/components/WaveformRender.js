/**
 * Waveform render component
 */

export const renderWaveform = (
  waveformData,
  width,
  height,
  barSpacing,
  progress,
  style,
  themeStyles
) => {
  if (waveformData.length === 0) {
    return null;
  }

  const barCount = waveformData.length;

  // bars width
  let barWidth;
  switch (style) {
    case "aurevia":
      barWidth = Math.max(
        ((width - barSpacing * (barCount - 1)) / barCount) * 2,
        6
      );
      break;
    case "solmara":
      barWidth = Math.max(
        ((width - barSpacing * (barCount - 1)) / barCount) * 1.2,
        3
      );
      break;
    case "viridara":
      barWidth = Math.max((width - barSpacing * (barCount - 1)) / barCount, 2);
      break;
    case "minimal":
      barWidth = Math.max(
        ((width - barSpacing * (barCount - 1)) / barCount) * 1,
        1
      );
      break;
    default:
      barWidth = Math.max((width - barSpacing * (barCount - 1)) / barCount, 2);
  }

  const actualSpacing = style === "aurevia" ? barSpacing * 1.5 : barSpacing;
  const actualBarWidth = style === "aurevia" ? Math.min(barWidth, 8) : barWidth;

  const bars = waveformData.map((value, index) => {
    let barHeight = value * height;
    let barY = 0;

    // Увеличиваем коэффициенты высоты для более полных баров
    switch (style) {
      case "viridara":
        barHeight = Math.max(barHeight * 1.0, 3); // Было 0.8, стало 1.0
        barY = (height - barHeight) / 2;
        break;

      case "solmara":
        barHeight = Math.max(barHeight * 1.0, 3); // Было 0.9, стало 1.0
        barY = height - barHeight;
        break;

      case "aurevia":
        barHeight = Math.max(barHeight * 1.0, 5); // Было 0.95, стало 1.0
        barY = (height - barHeight) / 2;
        break;

      case "minimal":
        barHeight = Math.max(barHeight * 0.85, 2); // Было 0.6, стало 0.85
        barY = (height - barHeight) / 2;
        break;
    }

    const xPosition = index * (actualBarWidth + actualSpacing);

    const barCenterPosition = xPosition + actualBarWidth / 2;
    const barCenterRatio = barCenterPosition / width;

    const barStartRatio = xPosition / width;
    const barEndRatio = (xPosition + actualBarWidth) / width;
    
    // Более плавное определение состояния бара
    const isPlayed = progress > barEndRatio;
    const isCurrentProgressBar = progress >= barStartRatio && progress <= barEndRatio;

    let barColor = themeStyles.primary;
    let opacity = style === "minimal" ? 0.5 : 0.7; // Увеличили базовую opacity

    if (isPlayed) {
      barColor = themeStyles.progress;
      opacity = 1;
    } else if (isCurrentProgressBar) {
      // Более плавный переход внутри текущего бара
      const barProgress =
        (progress - barStartRatio) / (barEndRatio - barStartRatio);
      const smoothProgress = Math.max(0, Math.min(1, barProgress));
      
      // Плавный переход цвета и opacity
      barColor = themeStyles.progress;
      opacity = 0.7 + 0.3 * smoothProgress; // Плавный переход от 0.7 до 1.0
    }

    let borderRadius = 0;
    switch (style) {
      case "viridara":
        borderRadius = actualBarWidth / 2;
        break;
      case "aurevia":
        borderRadius = 2;
        break;
      case "solmara":
        borderRadius = 1;
        break;
      case "minimal":
        borderRadius = 0;
        break;
    }

    return (
      <rect
        key={index}
        x={xPosition}
        y={barY}
        width={actualBarWidth}
        height={barHeight}
        fill={barColor}
        rx={borderRadius}
        opacity={opacity}
        style={{
          transition: "fill 0.2s ease, opacity 0.2s ease",
          transformOrigin: "center",
          willChange: "fill, opacity",
        }}
      />
    );
  });

  return bars;
};
