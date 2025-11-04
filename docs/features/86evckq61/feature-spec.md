Here is the feature specification for the "Build User Activity Log API" task.

```markdown
# Feature Spec: User Activity Log API
**Task ID:** 86evckq61

## 1. Feature Overview
This feature will introduce a robust User Activity Log API to track and retrieve key user actions within the application. It is needed to provide administrators with a clear audit trail for security, compliance, and analytics purposes. The expected outcome is a set of secure, performant, and filterable endpoints for managing user activity data.

## 2. Files to Modify

### New Files:
- **`src/models/activity.model.js`**: To define the database schema for an activity log entry (e.g., using Mongoose or Sequelize).
- **`src/services/activity.service.js`**: To encapsulate the business logic for creating and querying activity logs from the database.
- **`src/controllers/activity.controller.js`**: To handle request/response logic, validate inputs, and interact with `activity.service.js`.
- **`src/routes/activity.routes.js`**: To define the API routes (`POST /api/activity` and `GET /api/activity`) and link them to controller functions.
- **`src/validations/activity.validation.js`**: To define request validation schemas (e.g., using Joi) for query parameters and post bodies.
- **`tests/fixtures/activity.fixture.js`**: To provide reusable activity data for tests.
- **`tests/integration/activity.test.js`**: To contain integration tests for the new API endpoints.

### Existing Files to Modify:
- **`src/routes/v1/index.js`**: To import and mount the new `activity.routes.js` under the `/v1` API path.
- **Relevant Service Files (e.g., `src/services/auth.service.js`, `src/services/user.service.js`)**: To import `activity.service.js` and call the logging function at strategic points where user actions occur (e.g., after successful login, profile update, or password change).

## 3. Technical Approach
- **Architecture**: The implementation will follow the existing service-oriented architecture (Routes -> Controllers -> Services -> Models). This maintains consistency and separation of concerns.
- **Database**: A new collection/table named `activities` will be created. The model will include fields for `userId`, `actionType`, `description`, `timestamp`, and `ipAddress`.
- **API Endpoints**: Two new endpoints will be created: `POST /api/activity` for recording an event and `GET /api/activity` for retrieving events. The GET endpoint will use query parameters for filtering and pagination.
- **Dependencies**: The `joi` library will be used for robust request validation. A pagination library like `mongoose-paginate-v2` (if using Mongoose) will be leveraged for the GET endpoint.
- **Security**: The `GET /api/activity` endpoint will be protected and restricted to authorized users (e.g., administrators) using existing authentication middleware.
- **Challenge**: A key challenge will be ensuring the activity logging mechanism is performant and does not introduce significant latency to the actions being tracked. Asynchronous logging or a message queue could be considered if performance becomes an issue.

## 4. Implementation Steps
1.  **Create Model**: Define the `Activity` schema in `src/models/activity.model.js` with all required fields and appropriate data types and indexes (especially on `userId`, `actionType`, and `timestamp`).
2.  **Build Service Logic**: Implement two main functions in `src/services/activity.service.js`:
    - `logActivity(activityData)`: Creates and saves a new activity document.
    - `queryActivities(filters, options)`: Fetches logs based on filter criteria (`userId`, `actionType`, date range) and pagination options (`limit`, `page`).
3.  **Develop Validation**: Create the validation schemas in `src/validations/activity.validation.js` for the `GET` and `POST` endpoints.
4.  **Implement Controller**: In `src/controllers/activity.controller.js`, create handler functions that use the validation middleware, call the corresponding service methods, and send back the appropriate HTTP response or error.
5.  **Define Routes**: In `src/routes/activity.routes.js`, define the `POST /` and `GET /` routes, applying authentication middleware to the GET route and associating them with the controller functions.
6.  **Register Routes**: Import and use the new activity routes in the main router file, `src/routes/v1/index.js`.
7.  **Integrate Logging**: Modify existing services (e.g., `auth.service.js`, `user.service.js`) to call `activityService.logActivity()` after a relevant user action is successfully completed. The user's IP address should be extracted from the request object and passed to the service.

## 5. Testing Strategy
- **Unit/Integration Tests**: Create `tests/integration/activity.test.js` to test the API endpoints end-to-end.
- **Endpoint Tests**:
    - `POST /api/activity`: Verify that a valid request creates a log entry in the database and returns a `201 Created` status. Test with invalid data to ensure it returns a `400 Bad Request`.
    - `GET /api/activity`: Verify that logs can be retrieved successfully. Test all filtering options individually and in combination (`userId`, `type`, date range). Confirm that pagination works correctly and that results are sorted by `timestamp` in descending order.
- **Security Tests**: Ensure that unauthenticated or unauthorized requests to the `GET` endpoint are rejected with a `401 Unauthorized` or `403 Forbidden` status.
- **Edge Cases**: Test with non-existent `userId`s, date ranges that yield no results, and pagination parameters that are out of bounds.

## 6. Acceptance Criteria
- [ ] A new `activities` table/collection exists in the database with the correct schema.
- [ ] The `POST /api/activity` endpoint successfully creates new log entries.
- [ ] The `GET /api/activity` endpoint returns a paginated list of activity logs.
- [ ] The `GET` endpoint correctly filters by `userId`, `actionType`, and a date range (`from`, `to`).
- [ ] All returned logs are sorted with the most recent (`timestamp`) first.
- [ ] Invalid request bodies or query parameters result in a `400` error with a clear message.
- [ ] Access to the `GET /api/activity` endpoint is restricted to authorized users only.
- [ ] Key user actions (e.g., login, profile update, password change) are successfully logged.
- [ ] API response time for standard queries is under the 200ms target.
```

I will now save this specification to the appropriate file.My apologies, I forgot that `write_file` requires an absolute path. I will correct that now.I have created the feature specification and saved it to `docs/features/86evckq61/feature-spec.md`. Let me know what you'd like to do next.