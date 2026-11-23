function scaleLimits(layers, bounds, position, size, canvasSize) {
  const limit = canvasSize * 2;
  return {
    min: Math.max(...layers.map(layer => 1 / layer[size])),
    max: Math.min(...layers.map(layer => {
      const offset = layer[position] - bounds[position];
      return offset ? Math.min(limit / layer[size], (limit - bounds[position]) / offset) : limit / layer[size];
    })),
  };
}

export function resizeSelection(layers, bounds, dimensions, { offsetX, offsetY, proportional = false }) {
  const horizontal = scaleLimits(layers, bounds, 'x', 'width', dimensions.width);
  const vertical = scaleLimits(layers, bounds, 'y', 'height', dimensions.height);
  const clamp = (value, { min, max }) => Math.max(min, Math.min(max, value));
  let scaleX = clamp(1 + offsetX / bounds.width, horizontal);
  let scaleY = clamp(1 + offsetY / bounds.height, vertical);
  if (proportional) {
    // Project the drag onto the original diagonal to keep one scale on both axes.
    const change = (offsetX * bounds.width + offsetY * bounds.height) / (bounds.width ** 2 + bounds.height ** 2);
    scaleX = scaleY = clamp(1 + change, {
      min: Math.max(horizontal.min, vertical.min),
      max: Math.min(horizontal.max, vertical.max),
    });
  }

  const scaleText = proportional || layers.length > 1;
  return new Map(layers.map(layer => {
    const x = bounds.x + Math.round((layer.x - bounds.x) * scaleX);
    const y = bounds.y + Math.round((layer.y - bounds.y) * scaleY);
    const right = bounds.x + Math.round((layer.x + layer.width - bounds.x) * scaleX);
    const bottom = bounds.y + Math.round((layer.y + layer.height - bounds.y) * scaleY);
    const patch = { x, y, width: right - x, height: bottom - y };
    if (scaleText && layer.type === 'text' && scaleY !== 1) {
      patch.fontSize = clamp(layer.fontSize * scaleY, { min: 8, max: 384 });
    }
    return [layer.id, patch];
  }));
}
