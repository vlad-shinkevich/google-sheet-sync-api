# Google Sheet Sync API

A Next.js API server that provides OAuth authentication for Google Sheets/Drive and proxy functionality for downloading files, with support for Google Drive service account integration.

## Features

### OAuth Authentication

- Google OAuth 2.0 with PKCE
- Support for Google Sheets and Drive access
- Session management with Vercel KV
- User info retrieval

### File Proxy

- Proxy files from whitelisted domains
- Google Drive link rewriting
- Size limits and streaming
- CORS support

### Google Drive Service Account Integration (NEW)

- Download private files via service account
- File metadata retrieval
- Rate limiting and security
- Comprehensive logging

## API Endpoints

### OAuth Endpoints

- `GET /api/oauth/start` - Start OAuth flow
- `GET /api/oauth/callback` - OAuth callback
- `GET /api/oauth/poll` - Poll for OAuth result
- `GET /api/oauth/final` - Get final OAuth result

### Proxy Endpoints

- `GET /api/proxy?url=<url>` - Proxy files from whitelisted domains

### Google Drive Service Account Endpoints (NEW)

- `GET /api/download/[fileId]` - Download file via service account
- `GET /api/info/[fileId]` - Get file metadata

### Utility Endpoints

- `GET /api/health` - Health check
- `GET /api/google/refresh` - Refresh Google tokens
- `GET /api/cron/sweep` - Cleanup expired sessions

## Getting Started

### Prerequisites

- Node.js 18+
- Google Cloud Project with Drive API enabled
- Vercel account (for deployment)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/vlad-shinkevich/google-sheet-sync-api.git
cd google-sheet-sync-api
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables (see [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md))

4. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## Configuration

### Environment Variables

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for detailed configuration instructions.

Key variables:

- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email (NEW)
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Service account private key (NEW)
- `KV_REST_API_URL` - Vercel KV URL
- `KV_REST_API_TOKEN` - Vercel KV token

### Google Drive Service Account Setup

1. Create a service account in Google Cloud Console
2. Enable Google Drive API
3. Download the JSON key file
4. Add the service account email and private key to environment variables
5. Share files/folders with the service account email

## Usage Examples

### Download a file via service account

```bash
curl "https://your-domain.vercel.app/api/download/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
```

### Get file metadata

```bash
curl "https://your-domain.vercel.app/api/info/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
```

### JavaScript/TypeScript

```typescript
// Get file info
const response = await fetch(
  "/api/info/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
);
const fileInfo = await response.json();

// Download file
const downloadResponse = await fetch(
  "/api/download/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
);
const blob = await downloadResponse.blob();
```

## Security Features

- Rate limiting (10 downloads, 30 info requests per minute per IP)
- File size limits (20MB maximum)
- Input validation and sanitization
- Comprehensive logging
- CORS protection
- Service account with read-only access

## Documentation

- [Google Drive API Integration](./GOOGLE_DRIVE_API.md) - Detailed documentation for the new service account functionality
- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Configuration guide

## Deploy on Vercel

The easiest way to deploy is using the [Vercel Platform](https://vercel.com/new):

1. Connect your GitHub repository
2. Set environment variables in Vercel Dashboard
3. Deploy automatically on push to main branch

## License

This project is open source and available under the [MIT License](LICENSE).
