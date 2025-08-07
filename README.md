# Reworq API Documentation

**Base URL**: `http://localhost:8000` (or your deployed URL)

- All endpoints are prefixed with the API version: `/v1` by default. You can change this via the `API_VERSION` environment variable.

## Authentication

The API uses JWT-based authentication with magic links. Most endpoints require authentication via the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Health Check

#### GET /

Returns a simple health check message.

Note: The actual path is versioned, e.g. `GET /v1/`.

**Response:**

```json
{
  "message": "Hello from Worqai API"
}
```

---

## Authentication Endpoints

### Request Magic Link

#### POST /auth/magic-link

Sends a magic link to the provided email address for passwordless authentication.

**Request Body:**

```json
{
  "email": "user@example.com",
  "name": "John Doe" // Optional, required for new users
}
```

**Response:**

- **200 OK**: Magic link sent successfully

```json
{
  "message": "Magic link sent if email exists."
}
```

- **400 Bad Request**: Invalid email or missing name for new users

```json
{
  "message": "Invalid email address"
}
```

- **500 Internal Server Error**: Email sending failed

```json
{
  "message": "Unable to send magic link"
}
```

### Verify Magic Link

#### POST /auth/magic-link/verify

Verifies a magic link token and returns authentication tokens.

**Request Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**

- **200 OK**: Authentication successful

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "email": "user@example.com",
    "name": "John Doe",
    "id": "507f1f77bcf86cd799439011"
  }
}
```

- **400 Bad Request**: Missing token

```json
{
  "message": "Missing token"
}
```

- **401 Unauthorized**: Invalid or expired token

```json
{
  "message": "Invalid or expired magic link"
}
```

### Refresh Token

#### POST /auth/refresh-token

Refreshes an access token using a valid refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**

- **200 OK**: New access token generated

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

- **400 Bad Request**: Missing refresh token

```json
{
  "message": "Missing refresh token"
}
```

- **401 Unauthorized**: Invalid refresh token

```json
{
  "message": "Invalid or expired refresh token"
}
```

### Get Current User

#### GET /auth/me

Returns information about the currently authenticated user.

**Headers:**

```
Authorization: Bearer <your-jwt-token>
```

**Response:**

- **200 OK**: User information

```json
{
  "user": {
    "email": "user@example.com",
    "name": "John Doe",
    "id": "507f1f77bcf86cd799439011"
  }
}
```

- **401 Unauthorized**: Invalid or missing token

---

## Integration Endpoints

### Get Integrations

#### GET /integrations

Retrieves all integrations for the authenticated user.

**Headers:**

```
Authorization: Bearer <your-jwt-token>
```

**Query Parameters:**

- `name` (optional): Filter by integration name

**Response:**

- **200 OK**: All integrations

```json
{
  "google": {
    "name": "google",
    "user_id": "507f1f77bcf86cd799439011",
    "access_token": "ya29.a0AfH6SMC...",
    "refresh_token": "1//04dX...",
    "expires_at": "2024-01-01T12:00:00.000Z",
    "created_at": "2024-01-01T10:00:00.000Z",
    "updated_at": "2024-01-01T11:00:00.000Z"
  },
  "slack": {
    "name": "slack",
    "user_id": "507f1f77bcf86cd799439011",
    "access_token": "xoxb-1234567890...",
    "created_at": "2024-01-01T10:00:00.000Z",
    "updated_at": "2024-01-01T11:00:00.000Z"
  }
}
```

- **200 OK**: Single integration (when name parameter is provided)

```json
{
  "integration": {
    "name": "google",
    "user_id": "507f1f77bcf86cd799439011",
    "access_token": "ya29.a0AfH6SMC...",
    "refresh_token": "1//04dX...",
    "expires_at": "2024-01-01T12:00:00.000Z",
    "created_at": "2024-01-01T10:00:00.000Z",
    "updated_at": "2024-01-01T11:00:00.000Z"
  }
}
```

- **404 Not Found**: Integration not found

```json
{
  "message": "Integration not found"
}
```

- **500 Internal Server Error**: Server error

```json
{
  "message": "Failed to fetch integrations"
}
```

### Update Integration

#### PUT /integrations/:name

Updates the tokens for a specific integration.

**Headers:**

```
Authorization: Bearer <your-jwt-token>
```

**Path Parameters:**

- `name`: Integration name (e.g., "google", "slack")

**Request Body:**

```json
{
  "access_token": "new-access-token",
  "refresh_token": "new-refresh-token", // Optional
  "expires_at": "2024-01-01T12:00:00.000Z" // Optional
}
```

**Response:**

- **200 OK**: Integration updated successfully

```json
{
  "name": "google",
  "user_id": "507f1f77bcf86cd799439011",
  "access_token": "new-access-token",
  "refresh_token": "new-refresh-token",
  "expires_at": "2024-01-01T12:00:00.000Z",
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-01T11:00:00.000Z"
}
```

- **404 Not Found**: Integration not found

```json
{
  "message": "Integration not found"
}
```

- **500 Internal Server Error**: Server error

```json
{
  "message": "Failed to update integration token"
}
```

---

## Calendar Endpoints

All calendar endpoints require authentication.

**Headers:**

```
Authorization: Bearer <your-jwt-token>
```

### Check Conflict

#### POST /calendar/check-conflict

Checks if there are conflicting events between a start and end time.

**Request Body:**

```json
{
  "start": "2024-01-01T09:00:00.000Z",
  "end": "2024-01-01T10:00:00.000Z"
}
```

**Response:**

```json
{
  "conflict": true,
  "conflicting_events": [/* provider-specific event objects */]
}
```

### Create Event

#### POST /calendar/create-event

Creates a calendar event.

**Request Body:**

```json
{
  "start_time": "2024-01-01T09:00:00.000Z",
  "end_time": "2024-01-01T10:00:00.000Z",
  "title": "Standup",
  "description": "Daily standup",
  "participants": ["a@example.com", "b@example.com"],
  "location": "Google Meet",
  "reminders": [
    { "method": "email", "minutes": 30 },
    { "method": "popup", "minutes": 10 }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "event_id": "abcd1234",
  "meet_link": "https://meet.google.com/...",
  "start_time": "2024-01-01T09:00:00.000Z",
  "end_time": "2024-01-01T10:00:00.000Z"
}
```

### Edit Event

#### POST /calendar/edit-event

Edits properties of an existing event.

**Request Body:**

```json
{
  "event_id": "abcd1234",
  "changes": {
    "title": "New Title",
    "description": "Updated description",
    "add_participants": ["c@example.com"],
    "remove_participants": ["b@example.com"],
    "add_meet_link": true
  }
}
```

**Response:**

```json
{
  "success": true,
  "event_id": "abcd1234",
  "updated_fields": ["title", "participants", "meeting_link"],
  "meet_link": "https://meet.google.com/..."
}
```

### Delete Event

#### DELETE /calendar/delete-event

Deletes an event.

**Request Body:**

```json
{
  "event_id": "abcd1234"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Event deleted"
}
```

### Fetch Events

#### POST /calendar/fetch-events

Fetches events in a date range (dates are interpreted in server-configured timezone).

**Request Body:**

```json
{
  "start_date": "2024-01-01", // required (YYYY-MM-DD)
  "end_date": "2024-01-07"    // optional (YYYY-MM-DD)
}
```

**Response:**

```json
{
  "events": [
    {
      "event_id": "abcd1234",
      "title": "Standup",
      "description": "Daily standup",
      "start_time": "2024-01-01T09:00:00.000Z",
      "end_time": "2024-01-01T09:15:00.000Z",
      "attendees": ["a@example.com", "b@example.com"]
    }
  ]
}
```

- **400 Bad Request**: Missing `start_date`

```json
{
  "success": false,
  "message": "start_date is required"
}
```

### Reschedule Event

#### POST /calendar/reschedule-event

Reschedules an existing event.

**Request Body:**

```json
{
  "event_id": "abcd1234",
  "new_start_time": "2024-01-01T10:00:00.000Z",
  "new_end_time": "2024-01-01T11:00:00.000Z"
}
```

**Response:**

```json
{
  "success": true,
  "event_id": "abcd1234"
}
```

---

## OAuth Endpoints

### Google OAuth

#### GET /oauth/google

Initiates Google OAuth flow by returning the authorization URL.

**Headers:**

```
Authorization: Bearer <your-jwt-token>
```

**Response:**

- **200 OK**: OAuth URL returned

```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
}
```

- **409 Conflict**: Google already connected

```json
{
  "message": "Google already connected"
}
```

#### GET /oauth/google/callback

Handles the OAuth callback from Google and creates the integration.

**Headers:**

```
Authorization: Bearer <your-jwt-token>
```

**Query Parameters:**

- `code`: Authorization code from Google

**Response:**

- **200 OK**: Google account connected successfully

```json
{
  "message": "Google Account connected successfully"
}
```

- **400 Bad Request**: Missing authorization code

```json
{
  "message": "Missing code"
}
```

- **409 Conflict**: Google account already connected

```json
{
  "message": "Google Account already connected"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

```json
{
  "message": "Error description"
}
```

### 401 Unauthorized

```json
{
  "message": "Missing or invalid token"
}
```

or

```json
{
  "message": "Invalid or expired token"
}
```

### 404 Not Found

```json
{
  "message": "Resource not found"
}
```

### 409 Conflict

```json
{
  "message": "Resource already exists"
}
```

### 500 Internal Server Error

```json
{
  "message": "Internal server error"
}
```

---

## Google OAuth Scopes

When connecting Google, the following scopes are requested:

- `https://www.googleapis.com/auth/calendar` - Calendar access
- `https://www.googleapis.com/auth/gmail.readonly` - Read Gmail
- `https://www.googleapis.com/auth/gmail.send` - Send Gmail
- `https://www.googleapis.com/auth/gmail.labels` - Gmail labels
- `https://www.googleapis.com/auth/gmail.modify` - Modify Gmail
- `https://www.googleapis.com/auth/drive.readonly` - Read Google Drive
- `https://www.googleapis.com/auth/drive.file` - Google Drive file access
- `https://www.googleapis.com/auth/documents.readonly` - Read Google Docs
- `https://www.googleapis.com/auth/spreadsheets.readonly` - Read Google Sheets
- `https://www.googleapis.com/auth/userinfo.email` - User email
- `https://www.googleapis.com/auth/userinfo.profile` - User profile

---

## Rate Limiting

The API implements rate limiting to prevent abuse. Please respect the rate limits and implement appropriate retry logic with exponential backoff.

---

## Environment Variables

The following environment variables are required:

- `JWT_SECRET`: Secret key for JWT token signing
- `RESEND_API_KEY`: API key for Resend email service
- `RESEND_FROM_EMAIL`: Email address to send magic links from
- `FRONTEND_URL`: Frontend URL for magic link redirects
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `MONGODB_URI`: MongoDB connection string
- `API_VERSION` (optional): API version path prefix (default: `v1`)

---

## Getting Started

1. **Request a magic link**: Send a POST request to `/auth/magic-link` with your email
2. **Verify the magic link**: Click the link in your email or use the token with `/auth/magic-link/verify`
3. **Use the access token**: Include the returned token in the `Authorization` header for subsequent requests
4. **Connect integrations**: Use the OAuth endpoints to connect third-party services
5. **Calendar operations**: Use the calendar endpoints to manage events
6. **Refresh tokens**: Use the refresh token endpoint to get new access tokens when they expire
