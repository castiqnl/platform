import React from 'react';
import {CASTIQ_PARTNER_LAYER_ID, CASTIQ_PARTNER_LOGO_URL, CASTIQ_PARTNER_PLAQUE, FORMATS, getCastiqPartnerLayer} from './template-studio/studio-model.mjs';
import type {PosterFormat} from './Poster';

const ratios = {portrait: '4:5', story: '9:16', square: '1:1', wide: '16:9'} as const;

export function CastiqPartnerMark({format}: {format: PosterFormat}) {
  const ratio = ratios[format];
  const mark = getCastiqPartnerLayer(ratio);
  const scale = 1000 / FORMATS[ratio].width;
  const {x, y, width, height} = mark;
  const {background, border, padding, radius} = CASTIQ_PARTNER_PLAQUE;
  return <g data-layer-id={CASTIQ_PARTNER_LAYER_ID} data-castiq-partner="true" role="img" aria-label="Castiq-partner">
    <g transform={`scale(${scale})`}>
      <rect x={x} y={y} width={width} height={height} rx={radius}
        fill={background} stroke={border} strokeWidth="1.5"/>
      <image href={CASTIQ_PARTNER_LOGO_URL} x={x + padding} y={y + padding}
        width={width - padding * 2} height={height - padding * 2} preserveAspectRatio="xMidYMid meet"/>
    </g>
  </g>;
}
