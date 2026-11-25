interface Props {
  name: string;
  size?: "sm" | "md";
  self?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hueFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

export function Avatar({ name, size = "md", self = false }: Props) {
  const hue = hueFor(name || "?");
  const style = self
    ? undefined
    : {
        background: `hsl(${hue} 65% 92%)`,
        color: `hsl(${hue} 55% 32%)`,
      };
  return (
    <span className={`avatar avatar-${size}${self ? " avatar-self" : ""}`} style={style} aria-hidden>
      {initials(name)}
    </span>
  );
}
