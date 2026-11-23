import React from 'react';

export type TextEffects = {
  outlineEnabled?: boolean;
  outlineColor?: string;
  outlineWidth?: number;
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
};

export function posterTextPaint(
  layer: TextEffects & { outline?: boolean },
  fill: string,
  fallback?: { color: string; width: number; opacity?: number },
): React.SVGProps<SVGTextElement> {
  const legacyOutline = layer.outlineEnabled === undefined && layer.outline;
  const stroke = layer.outlineEnabled
    ? { color: layer.outlineColor || '#111827', width: layer.outlineWidth ?? 3 }
    : legacyOutline ? { color: fill, width: 2 } : fallback;
  return {
    fill: legacyOutline ? 'none' : fill,
    stroke: stroke?.color,
    strokeWidth: stroke?.width,
    strokeOpacity: stroke?.opacity ?? 1,
    strokeLinejoin: 'round',
    paintOrder: 'stroke fill',
  };
}

export function PosterTextShadow({ id, layer }: { id: string; layer: TextEffects }) {
  if (!layer.shadowEnabled) return null;
  const blur = (layer.shadowBlur ?? 12) / 2;
  const x = layer.shadowOffsetX ?? 0;
  const y = layer.shadowOffsetY ?? 8;
  return <defs>
    <filter id={id} filterUnits="userSpaceOnUse" x={-300 + Math.min(0, x)} y={-350 + Math.min(0, y)}
      width={1600 + Math.abs(x)} height={2600 + Math.abs(y)} colorInterpolationFilters="sRGB">
      <feDropShadow dx={x} dy={y} stdDeviation={blur}
        floodColor={layer.shadowColor || '#000000'} floodOpacity={layer.shadowOpacity ?? .65}/>
    </filter>
  </defs>;
}
