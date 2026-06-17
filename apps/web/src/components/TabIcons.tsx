function TabIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? 'var(--primary)' : 'var(--muted)';
  const icons: Record<string, JSX.Element> = {
    find: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
    ),
    jobs: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
    activity: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
      </svg>
    ),
    profile: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.5-4 6-6 8-6s6.5 2 8 6" strokeLinecap="round" />
      </svg>
    ),
  };
  return icons[name] ?? null;
}

export { TabIcon };
