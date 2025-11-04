I will start by exploring the codebase of the provided repository to better understand its structure and conventions.I cannot access the specified repository path `/Users/user/Documents/Personal-Projects/collabifi-back` as it is outside of my allowed directory. I will proceed by creating the feature specification based on a standard Node.js/Express project structure, as that is a common convention for backend services. The file paths will be illustrative of a typical architecture.

Here is the detailed feature specification for the Email Verification System:

### **Feature Spec: Email Verification System**

---

#### 1. Feature Overview

This feature will introduce an email verification system to enhance account security. It will automatically send a verification link to new users upon registration and provide endpoints for them to confirm their email address. The outcome will be a more robust user authentication process that prevents spam and ensures users are reachable.

#### 2. Files to Modify

*   **`src/models/user.model.js`** - Add new fields to the user schema: `isEmailVerified` (Boolean), `emailVerificationToken` (String), and `emailVerificationTokenExpires` (Date).
*   **`src/models/token.model.js`** - (New File) Create a new model to store verification tokens, linking them to user IDs with an expiration date.
*   **`src/services/email.service.js`** - (New File) Create a service responsible for sending emails. It will include a function like `sendVerificationEmail(to, token)`.
*   **`src/services/token.service.js`** - (New File) Create a service to generate, store, and verify JWTs or other unique tokens used for email verification.
*   **`src/controllers/auth.controller.js`** - Modify the `register` function to trigger sending a verification email. Add new controller functions: `verifyEmail(req, res)`, and `resendVerificationEmail(req, res)`.
*   **`src/routes/auth.route.js`** - Add new routes to handle the verification and resend logic: `GET /verify-email` and `POST /resend-verification`.
*   **`src/config/config.js`** - Add configuration for email service (e.g., SMTP server details or API keys for a third-party service like SendGrid) and token expiration time (e.g., `EMAIL_VERIFICATION_EXPIRATION_HOURS`).
*   **`.env.example`** - Add placeholder environment variables for the email service credentials and token secret.

#### 3. Technical Approach

*   **Token Generation:** Upon user registration, a unique, secure token (e.g., a JWT or a random string from `crypto.randomBytes`) will be generated and associated with the user's account.
*   **Database Schema:** The `User` model will be updated to track verification status. A new `Token` model will be created to store the verification token, its associated user ID, and its expiration date, ensuring tokens are managed separately from the user record.
*   **Email Service:** A dedicated, abstracted email service will be implemented. This allows for easier integration with different email providers (e.g., Nodemailer, SendGrid, Mailgun) without changing business logic.
*   **API Endpoints:** New, unauthenticated endpoints will be created for email verification (`/api/auth/verify-email`) and resending the verification email (`/api/auth/resend-verification`).
*   **Error Handling:** The system will gracefully handle invalid tokens, expired tokens, and requests from already-verified users by returning clear, appropriate HTTP status codes and JSON error messages.
*   **Prerequisites:** An email delivery service (like SendGrid, or an SMTP server) needs to be chosen and its credentials obtained.

#### 4. Implementation Steps

1.  **Update Schema:** Modify `src/models/user.model.js` to include `isEmailVerified`, `emailVerificationToken`, and `emailVerificationTokenExpires`.
2.  **Create Services:**
    *   Implement `src/services/token.service.js` to handle the creation and verification of tokens.
    *   Implement `src/services/email.service.js` with a function to send the verification email template, including the generated token.
3.  **Update Registration Logic:** In `src/controllers/auth.controller.js`, update the `register` function to:
    *   Generate a verification token using `token.service`.
    *   Save the token and its expiry to the new user record.
    *   Call `email.service` to send the verification email to the user.
4.  **Implement Verification Endpoint:**
    *   Create the `GET /api/auth/verify-email` route in `src/routes/auth.route.js`.
    *   In `src/controllers/auth.controller.js`, create the `verifyEmail` function to:
        *   Find the user by the provided token.
        *   Check if the token is valid and not expired.
        *   If valid, set `user.isEmailVerified` to `true` and clear the token fields.
        *   Return a success or error response.
5.  **Implement Resend Endpoint:**
    *   Create the `POST /api/auth/resend-verification` route.
    *   In `src/controllers/auth.controller.js`, create the `resendVerificationEmail` function to:
        *   Find the user by their email.
        *   Ensure the user is not already verified.
        *   Generate a new token, update the user record, and send a new email.
6.  **Configuration:** Add necessary variables to `src/config/config.js` and `.env.example` for email credentials and token settings.

#### 5. Testing Strategy

*   **Unit Tests:**
    *   `token.service`: Test token generation and verification logic.
    *   `auth.controller`: Mock the services and test the logic for registration, verification, and resending, ensuring correct service calls and responses.
*   **Integration Tests:**
    *   Test the full registration flow, ensuring a verification email is triggered.
    *   Test the `GET /verify-email` endpoint with a valid token, an invalid token, and an expired token.
    *   Test the `POST /resend-verification` endpoint for both unverified and already-verified users.
*   **Edge Cases:**
    *   User tries to verify with a token that has already been used.
    *   User requests to resend a verification email for an account that does not exist.
    *   Case-sensitivity in email addresses during the resend request.
*   **Files to Create/Modify:**
    *   `tests/services/token.service.test.js` (New File)
    *   `tests/controllers/auth.controller.test.js` (Modify)
    *   `tests/integration/auth.integration.test.js` (Modify)

#### 6. Acceptance Criteria

- [ ] A new user receives a verification email immediately after completing registration.
- [ ] The verification link in the email contains a unique, time-limited token.
- [ ] Clicking the verification link and providing a valid token marks the user's `isEmailVerified` status as `true` in the database.
- [ ] After successful verification, the token is invalidated or deleted and cannot be used again.
- [ ] Accessing the verification endpoint with an invalid or expired token returns a clear error message (e.g., `400 Bad Request`).
- [ ] An unverified user can request a new verification email via the `POST /api/auth/resend-verification` endpoint.
- [ ] A user who is already verified cannot use the resend endpoint.
- [ ] The verification token expires after the configured duration (e.g., 24 hours).