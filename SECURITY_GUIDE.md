# Security Guide: Authorization Best Practices

## Overview

This document outlines the security vulnerabilities identified in the codebase and the solutions implemented to prevent unauthorized access to user resources.

## Identified Vulnerabilities

### 1. **Parameter Tampering Risk**

**Problem**: Functions accepting `userId` as a parameter could be exploited if an authenticated user could pass another user's ID.

**Example of vulnerable code**:

```typescript
// VULNERABLE: User could potentially pass another user's ID
export async function getGoogleService(userId: string) {
  const integration = await IntegrationModel.findOne({
    user_id: userId, // Could be any user's ID!
    name: "google",
  });
}
```

**Attack Vector**:

- If any endpoint accepts `userId` in request body/query params
- If user IDs are predictable or enumerable
- If there's any way to inject a different user ID

### 2. **Missing Authorization Checks**

**Problem**: Code only verified that an integration exists for the given `userId`, but didn't verify that the requesting user had permission to access that specific user's data.

### 3. **Inconsistent Function Signatures**

**Problem**: Mismatch between function definition and usage, leading to potential runtime errors and security issues.

## Implemented Solutions

### 1. **Request-Based Authentication**

**Solution**: Functions now accept the authenticated request object instead of just a user ID.

```typescript
// SECURE: Uses authenticated request object
export async function getGoogleService(req: AuthRequest) {
  if (!req.user || !req.user._id) {
    throw new Error("User not authenticated");
  }

  const userId = req.user._id; // Always the authenticated user's ID
  // ... rest of function
}
```

### 2. **Authorization Utility Functions**

**Solution**: Created reusable authorization utilities to ensure consistent security checks.

```typescript
export function authorizeUserAccess(
  req: AuthRequest,
  resourceUserId: string
): boolean {
  if (!req.user || !req.user._id) {
    throw new Error("User not authenticated");
  }

  if (req.user._id.toString() !== resourceUserId.toString()) {
    throw new Error("Unauthorized: Cannot access another user's resources");
  }

  return true;
}
```

### 3. **Internal Use Functions**

**Solution**: Created separate functions for internal use with explicit authorization checks.

```typescript
export async function getGoogleServiceByUserId(
  userId: string,
  requestingUserId: string
) {
  // Explicit authorization check
  if (userId !== requestingUserId) {
    throw new Error("Unauthorized: Cannot access another user's integrations");
  }
  // ... rest of function
}
```

## Security Best Practices

### 1. **Always Use Authenticated Request Objects**

- ✅ `function secureFunction(req: AuthRequest)`
- ❌ `function vulnerableFunction(userId: string)`

### 2. **Implement Authorization Checks**

- Always verify the requesting user has permission to access the resource
- Use utility functions for consistent authorization logic
- Check both authentication and authorization

### 3. **Validate Input Parameters**

- Never trust user input
- Validate and sanitize all parameters
- Use TypeScript for type safety

### 4. **Error Handling**

- Don't expose sensitive information in error messages
- Log security events for monitoring
- Return appropriate HTTP status codes

### 5. **Database Queries**

- Always include user context in queries
- Use parameterized queries to prevent injection
- Implement row-level security where possible

## Example Secure Implementation

```typescript
export async function getUserIntegration(
  req: AuthRequest,
  integrationName: string
) {
  try {
    // 1. Authentication check (handled by middleware)
    if (!req.user || !req.user._id) {
      throw new Error("User not authenticated");
    }

    // 2. Input validation
    if (!integrationName || typeof integrationName !== "string") {
      throw new Error("Invalid integration name");
    }

    // 3. Authorization check
    const integration = await IntegrationModel.findOne({
      user_id: req.user._id, // Always use authenticated user's ID
      name: integrationName,
    });

    if (!integration) {
      throw new Error("Integration not found");
    }

    // 4. Additional authorization check
    authorizeUserAccess(req, integration.user_id.toString());

    return integration;
  } catch (error) {
    // 5. Secure error handling
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      throw new Error("Access denied");
    }
    throw error;
  }
}
```

## Testing Security

### 1. **Unit Tests**

```typescript
describe("Authorization Tests", () => {
  it("should prevent access to other user resources", async () => {
    const mockReq = {
      user: { _id: "user1" },
    } as AuthRequest;

    const otherUserId = "user2";

    expect(() => authorizeUserAccess(mockReq, otherUserId)).toThrow(
      "Unauthorized: Cannot access another user's resources"
    );
  });
});
```

### 2. **Integration Tests**

- Test with different user accounts
- Verify cross-user access is blocked
- Test edge cases and error conditions

### 3. **Security Scanning**

- Use tools like OWASP ZAP for vulnerability scanning
- Implement automated security testing in CI/CD
- Regular security audits

## Monitoring and Logging

### 1. **Security Events**

```typescript
// Log authorization failures
if (req.user._id.toString() !== resourceUserId.toString()) {
  logger.warn("Authorization failure", {
    requestingUser: req.user._id,
    targetUser: resourceUserId,
    endpoint: req.path,
    ip: req.ip,
  });
  throw new Error("Unauthorized: Cannot access another user's resources");
}
```

### 2. **Audit Trail**

- Log all access attempts
- Monitor for suspicious patterns
- Implement rate limiting

## Additional Recommendations

1. **Implement Role-Based Access Control (RBAC)** for admin functions
2. **Use JWT with short expiration times** and refresh tokens
3. **Implement API rate limiting** to prevent brute force attacks
4. **Use HTTPS everywhere** in production
5. **Regular security updates** for dependencies
6. **Consider implementing API keys** for additional security layers

## Conclusion

The implemented solutions provide multiple layers of security:

- **Authentication**: Ensures users are who they claim to be
- **Authorization**: Ensures users can only access their own resources
- **Input Validation**: Prevents malicious input
- **Error Handling**: Prevents information leakage

These measures significantly reduce the risk of unauthorized access while maintaining clean, maintainable code.
