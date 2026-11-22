import { BRAND } from '@fpm/shared';

/**
 * Logo FPM: versione oro derivata dal PNG originale «Logo neon FpM con volto barbuto.png»
 * (stessa sagoma, solo ricolorazione; vedi scripts/derive_gold_logo.py).
 */
export function Logo({ size = 128, className }: { size?: 128 | 256 | 512; className?: string }) {
  return (
    <img
      src={`/brand/logo-fpm-gold-${size}.png`}
      alt="Logo FPM"
      className={className}
      width={size}
      height={Math.round(size * 1.27)}
      decoding="async"
    />
  );
}

export function Footer() {
  return (
    <footer className="app-footer">
      <img src="/brand/logo-fpm-gold-128.png" alt="" aria-hidden="true" width={18} height={23} />
      <span>{BRAND.copyright}</span>
    </footer>
  );
}
