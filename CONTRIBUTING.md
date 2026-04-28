# Contributing to Sudoclaw QMS

## Development Setup

1. Clone the repository
2. Install Bun: https://bun.sh
3. Run setup: `bash scripts/setup.sh`
4. Start development: `bun run dev`

## Code Style

- TypeScript strict mode
- ES modules (`.ts` files with `.js` imports)
- Async/await over callbacks
- Explicit types for all public APIs

## Project Structure

```
packages/
├── core/        # Backend API
│   ├── src/
│   │   ├── db/        # Database operations
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   ├── middleware/ # HTTP middleware
│   │   ├── tasks/     # Scheduled jobs
│   │   ├── utils/     # Helper functions
│   │   └── types/     # TypeScript types
│   │   └── config/    # Configuration
│   └── dist/    # Build output
├── admin/       # Frontend dashboard
└── shared/      # Shared utilities
```

## Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Run tests: `bun test`
4. Run type check: `bun run --cwd packages/core typecheck`
5. Submit PR with description

## Testing

- Use Bun's built-in test runner
- Write unit tests for services
- Write integration tests for routes

## Security

- Never commit secrets or credentials
- Use environment variables for sensitive data
- Run `bun lint` before committing
- Review all security implications

## Questions

Open an issue for questions or feature requests.