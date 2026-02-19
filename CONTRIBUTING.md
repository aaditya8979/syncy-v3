# Contributing to Syncy

Thank you for your interest in contributing to Syncy! 🎵

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/syncy.git`
3. Install dependencies: `npm install` (frontend) and `cd server && npm install` (backend)
4. Copy `.env.example` to `.env` and fill in your keys
5. Run the dev server: `npm run dev`

## Development Workflow

- Create a feature branch: `git checkout -b feature/your-feature-name`
- Make your changes with descriptive commits
- Run `npm run lint` before committing
- Open a Pull Request against `main`

## Project Structure

```
syncy/
├── src/                    # Frontend (Vite + React + TypeScript)
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Route pages
│   ├── services/           # API clients (Supabase, Socket.io, Music APIs)
│   └── types/              # TypeScript types
├── server/                 # Socket.io server (Node.js)
└── supabase/               # Supabase Edge Functions + Migrations
```

## Code Style

- TypeScript strict mode — no `any` types unless absolutely necessary
- Follow existing patterns for component structure
- Use Tailwind utility classes with the `cn()` helper for conditional classes
- Keep components focused and under 200 lines

## Adding Music Sources

To add a new music source:
1. Add the source type to `src/types/index.ts`
2. Implement search in `src/services/musicApi.ts`
3. Add a tab in `src/components/SongSearch.tsx`
4. Handle playback in `src/components/PlayerEmbed.tsx`

## Issues & Feature Requests

Please use GitHub Issues. Include:
- Clear description of the bug/feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior

## License

By contributing, you agree your contributions are MIT licensed.
