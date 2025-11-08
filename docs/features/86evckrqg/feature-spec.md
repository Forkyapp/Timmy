Of course. Here is the detailed feature specification for the "Create Admin Panel User Management API" task.

---

### Feature Specification: Admin Panel User Management API
**Task ID:** 86evckrqg

### 1. Feature Overview

This feature involves creating a set of secure, backend API endpoints to enable administrators to manage user accounts. It is needed to power the user management section of a new admin panel, providing essential administrative capabilities like viewing, searching, updating, and deactivating users. The expected outcome is a robust, admin-only API that provides standardized, predictable responses for all user management operations.

### 2. Files to Modify

> **Note:** The following file paths assume a standard Node.js/Express project structure (`src/routes`, `src/controllers`, `src/services`, etc.). Paths may need adjustment based on the actual project architecture.

*   **`src/routes/admin/userRoutes.js` (New File)**
    *   **Purpose:** To define the API endpoints for admin user management.
    *   **Changes:** Create routes for `GET /api/admin/users`, `PATCH /api/admin/users/:id`, and `DELETE /api/admin/users/:id`. All routes will be protected by authentication and admin authorization middleware.

*   **`src/controllers/admin/userController.js` (New File)**
    *   **Purpose:** To handle the request/response logic for the user management endpoints.
    *   **Changes:** Implement controller functions (`listUsers`, `updateUser`, `deleteUser`) to parse requests, call the appropriate service-layer functions, and format the JSON responses.

*   **`src/services/userService.js` (Modify)**
    *   **Purpose:** To contain the core business logic for user operations.
    *   **Changes:** Add new methods to support admin actions: a method to query users with complex filters, pagination, and sorting; a method to update user details by ID; and a method to handle user deactivation (soft delete).

*   **`src/middlewares/authMiddleware.js` (Modify)**
    *   **Purpose:** To handle authentication and authorization.
    *   **Changes:** Add a new `isAdmin` middleware function that checks if the authenticated user has an 'admin' role. This will be used to protect the admin routes.

*   **`src/models/userModel.js` (Modify)**
    *   **Purpose:** To define the user data schema and database interactions.
    *   **Changes:** Add a `status` field (e.g., 'active', 'inactive', 'deactivated') or an `isActive` boolean to support soft deletes. This ensures user data is preserved while revoking access.

*   **`src/app.js` or `src/server.js` (Modify)**
    *   **Purpose:** The main application entry point.
    *   **Changes:** Register the new `userRoutes` under the `/api/admin` path prefix.

### 3. Technical Approach

*   **Architecture:** The implementation will follow a standard layered architecture (Routes -> Controllers -> Services -> Models). This separation of concerns ensures the codebase remains modular, testable, and maintainable.
*   **Authorization:** Route-level authorization will be implemented using dedicated middleware (`isAdmin`). This middleware will execute after the primary authentication check and verify the user's role before allowing access to the controller.
*   **Data Handling:** The `GET /users` endpoint will require building a dynamic database query based on query parameters. The service layer will be responsible for safely constructing this query to prevent injection vulnerabilities and handle pagination logic.
*   **Deletion Strategy:** User deletion will be implemented as a "soft delete." Instead of permanently removing the user record from the database, their `status` will be changed to 'deactivated', effectively revoking their access while preserving their data for auditing or potential reactivation.
*   **Dependencies:** This feature relies on the existing authentication system (e.g., JWT) to identify the current user and a database/ORM (e.g., Mongoose, Sequelize) for data manipulation.

### 4. Implementation Steps

1.  **Update User Model:** Modify `src/models/userModel.js` to include a `status` field with a default value of 'active'.
2.  **Create Admin Middleware:** In `src/middlewares/authMiddleware.js`, create the `isAdmin` function to check for an admin role on the request's user object.
3.  **Define Routes:** Create `src/routes/admin/userRoutes.js` and define the `GET`, `PATCH`, and `DELETE` endpoints, applying the authentication and `isAdmin` middleware to the router.
4.  **Implement Controllers:** Create `src/controllers/admin/userController.js` with placeholder functions for `listUsers`, `updateUser`, and `deleteUser`.
5.  **Implement Service Logic (List Users):** In `src/services/userService.js`, implement the logic to query users with pagination, sorting, and filtering (by role, status, registration date). Connect this to the `listUsers` controller.
6.  **Implement Service Logic (Update User):** In `src/services/userService.js`, implement the logic to find a user by ID and update their information (e.g., role, status). Connect this to the `updateUser` controller.
7.  **Implement Service Logic (Deactivate User):** In `src/services/userService.js`, implement the soft-delete logic. Connect this to the `deleteUser` controller.
8.  **Register Routes:** In `src/app.js`, import and use the new `userRoutes`.
9.  **Add Tests:** Create corresponding unit and integration tests as outlined in the Testing Strategy.

### 5. Testing Strategy

*   **Integration Tests (`tests/integration/admin/userApi.test.js`):**
    *   Test the full request/response cycle for each endpoint.
    *   Verify that a non-admin user receives a `403 Forbidden` error.
    *   Verify that an unauthenticated user receives a `401 Unauthorized` error.
    *   Test the `GET` endpoint with various combinations of filters, pagination, and sorting parameters.
*   **Unit Tests (`tests/unit/services/userService.test.js`):**
    *   Test the query-building logic in the `userService` to ensure filters are applied correctly.
    *   Mock database calls to test the update and soft-delete logic in isolation.
*   **Edge Cases:**
    *   Attempting to update or delete a user with a non-existent ID should return a `404 Not Found` error.
    *   Sending invalid data in the `PATCH` request body (e.g., an invalid role) should result in a `400 Bad Request` error.
    *   Querying with invalid filter values should be handled gracefully.

### 6. Acceptance Criteria

- [ ] All new endpoints (`GET`, `PATCH`, `DELETE /api/admin/users`) are protected and only accessible by users with an 'admin' role.
- [ ] `GET /api/admin/users` successfully returns a paginated list of users.
- [ ] `GET /api/admin/users` can be filtered by `role`, `status`, and `registrationDate`.
- [ ] `GET /api/admin/users` supports searching by name or email.
- [ ] `GET /api/admin/users` supports sorting by fields like `createdAt` or `lastName`.
- [ ] `PATCH /api/admin/users/:id` successfully updates a user's role or other specified information.
- [ ] `DELETE /api/admin/users/:id` successfully deactivates a user (sets their status to 'deactivated').
- [ ] A deactivated user is unable to log in or access protected resources.
- [ ] All endpoints return consistent, standardized JSON structures for both success and error responses.
- [ ] All new code is covered by unit and/or integration tests, meeting the project's required coverage threshold.