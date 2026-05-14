interface SectionHeaderProps {
  title: string;
  description: string;
}

export default function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <header className="border-b border-gray-700/50 pb-5">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-gray-400">{description}</p>
    </header>
  );
}
