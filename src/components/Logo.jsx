// ShowBrain logo — brain silhouette with a play triangle inside
export default function Logo({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Brain shape — two lobes */}
      <path
        d="M16 4C13.2 4 11 5.8 10.2 8.2C9.6 8.1 9 8 8.5 8C6 8 4 10 4 12.5C4 13.6 4.4 14.6 5 15.4C4.4 16.1 4 17.1 4 18.2C4 20.5 5.8 22.4 8 22.8C8.5 24.6 10.1 26 12 26C13 26 13.8 25.6 14.5 25C14.9 25.3 15.4 25.5 16 25.5C16.6 25.5 17.1 25.3 17.5 25C18.2 25.6 19 26 20 26C21.9 26 23.5 24.6 24 22.8C26.2 22.4 28 20.5 28 18.2C28 17.1 27.6 16.1 27 15.4C27.6 14.6 28 13.6 28 12.5C28 10 26 8 23.5 8C23 8 22.4 8.1 21.8 8.2C21 5.8 18.8 4 16 4Z"
        fill="url(#brainGrad)"
        opacity="0.95"
      />
      {/* Play triangle */}
      <path
        d="M13.5 12L13.5 20L21 16L13.5 12Z"
        fill="white"
        opacity="0.95"
      />
      <defs>
        <linearGradient id="brainGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-accent, #6366f1)" />
          <stop offset="100%" stopColor="var(--color-accentH, #4f46e5)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
