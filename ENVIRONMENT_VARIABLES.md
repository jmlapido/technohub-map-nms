# Environment Variables

This document describes the environment variables used in the Map-Ping application.

## Docker Deployment

When deploying with Docker Compose, you can set environment variables in a `.env` file or pass them directly.

### Required Variables (Optional - has defaults)

- `NEXT_PUBLIC_API_URL` - The base URL for the backend API when accessing via a domain
  - **Default**: Empty (auto-detected from browser location)
  - **Example**: `https://map.jmlapido.com` or `https://your-domain.com`
  - **Note**: Leave empty to use automatic detection based on the domain accessing the frontend

### Docker Environment Variables

These are automatically set in `docker-compose.yml`:

- `NODE_ENV=production` - Node.js environment
- `BACKEND_PORT=5000` - Backend API port
- `FRONTEND_PORT=4000` - Frontend web server port
- `PORT=4000` - Next.js port

## Local Development

For local development, no environment variables are required. The application will:
- Auto-detect localhost usage
- Use default ports (4000 for frontend, 5000 for backend)
- Connect to `http://localhost:5000` for API calls

## Setting Environment Variables

### Docker Compose

Create a `.env` file in the project root:

```bash
NEXT_PUBLIC_API_URL=https://your-domain.com
```

Then run:
```bash
docker compose up -d
```

### Manual Setup

Export variables before starting:

```bash
export NEXT_PUBLIC_API_URL=https://your-domain.com
npm run dev
```

## Security Notes

⚠️ **Never commit sensitive data:**
- Passwords (stored in `backend/data/auth.json`)
- Session data (stored in `backend/data/sessions.json`)
- Production configuration (stored in `backend/data/config.json`)
- Database files (`backend/data/database.sqlite`)

These files are automatically excluded from Git via `.gitignore`.

