export function placeholderImageDataUri(seed: string): string {
  const safe = seed.replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'newscore'
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0a0a0a"/>
          <stop offset="55%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#cc0000"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)"/>
      <rect x="60" y="60" width="1080" height="680" rx="28" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)"/>
      <text x="96" y="170" fill="rgba(255,255,255,0.92)" font-family="ui-sans-serif,system-ui" font-size="42" font-weight="800" letter-spacing="4">
        NEWSCORE
      </text>
      <text x="96" y="230" fill="rgba(255,255,255,0.75)" font-family="ui-sans-serif,system-ui" font-size="20" font-weight="600" letter-spacing="2">
        ${safe.toUpperCase()}
      </text>
      <text x="96" y="710" fill="rgba(255,255,255,0.55)" font-family="ui-sans-serif,system-ui" font-size="16">
        Demo image placeholder
      </text>
    </svg>
  `)
  return `data:image/svg+xml;charset=utf-8,${svg}`
}

