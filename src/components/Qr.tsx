import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function Qr({ text, size = 280 }: { text: string; size?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(text, { width: size * 2, margin: 1, color: { dark: '#141413', light: '#FAF9F5' } }).then(setSrc)
  }, [text, size])
  return src ? <img src={src} width={size} height={size} alt={`QR code for ${text}`} style={{ borderRadius: 12 }} /> : null
}
