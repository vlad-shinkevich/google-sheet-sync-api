# Environment Variables Configuration

## Required Environment Variables

### Existing OAuth Configuration (keep these)

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/callback
GOOGLE_SCOPE=https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly openid email profile
```

### Existing Proxy Configuration (keep these)

```env
PROXY_WHITELIST_DOMAINS=drive.google.com,example.com
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Existing KV Configuration (keep these)

```env
KV_REST_API_URL=your-kv-url
KV_REST_API_TOKEN=your-kv-token
```

### New Google Drive Service Account Configuration

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

## Setup Instructions

### 1. Vercel Dashboard

1. Go to your project in Vercel Dashboard
2. Navigate to Settings > Environment Variables
3. Add all the variables listed above

### 2. Local Development

1. Copy the variables to your local `.env.local` file
2. Make sure to use the correct format for the private key

### 3. Private Key Format

The private key must be formatted with `\n` instead of actual line breaks:

**Correct:**

```
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**Incorrect:**

```
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----"
```

### 4. Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create a service account in IAM & Admin > Service Accounts
5. Download the JSON key file
6. Extract the `client_email` and `private_key` values
7. Add them to your environment variables

### 5. File Access Setup

To access files in Google Drive:

1. Open the file in Google Drive
2. Click "Share"
3. Add the service account email with "Reader" permissions
4. Or share the entire folder containing the files

## Security Notes

- Never commit the actual private key to version control
- Use Vercel's environment variables for production
- The service account should only have read-only access
- Regularly rotate service account keys
- Monitor access logs for suspicious activity

## Testing

After setting up the environment variables:

1. Deploy to Vercel or run locally
2. Test the health endpoint: `GET /api/health`
3. Test file info: `GET /api/info/[fileId]`
4. Test file download: `GET /api/download/[fileId]`

Make sure to use a file ID from a file that the service account has access to.
