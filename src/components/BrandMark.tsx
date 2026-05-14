interface BrandMarkProps {
  className?: string;
}

const logoSrc = '/webui/dacollector-logo.png';

export default function BrandMark({ className = 'h-8 w-8' }: BrandMarkProps) {
  return (
    <img
      src={logoSrc}
      alt="DaCollector"
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}
