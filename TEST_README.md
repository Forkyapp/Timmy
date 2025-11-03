# JARVIS Testing Guide

## Setup

Install dependencies:
```bash
npm install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (auto-rerun on file changes)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm test -- --coverage
```

## Test Coverage

The test suite covers:

### 1. Cache Management
- ✅ Loading processed tasks from cache
- ✅ Saving processed tasks to cache
- ✅ Converting old cache format to new format
- ✅ Error handling for file operations

### 2. ClickUp API Integration
- ✅ Fetching assigned tasks
- ✅ Filtering tasks by status
- ✅ Updating task status
- ✅ Adding comments to tasks
- ✅ API error handling

### 3. Task Queue Management
- ✅ Loading queue from file
- ✅ Saving queue to file
- ✅ Adding tasks to queue
- ✅ Detecting duplicate tasks
- ✅ Queue status tracking

### 4. PR Tracking System
- ✅ Loading PR tracking data
- ✅ Saving PR tracking data
- ✅ Checking for PR creation
- ✅ GitHub API integration
- ✅ Timeout handling

### 5. Claude Code Automation
- ✅ Creating .claude directory
- ✅ Writing settings.json
- ✅ Configuring permissions
- ✅ Background execution

### 6. Integration Tests
- ✅ Task polling and processing
- ✅ Duplicate task prevention
- ✅ Error handling across components

## Important Notes

- Tests use mocked dependencies (fs, axios, child_process)
- No real API calls are made during testing
- No files are actually created/modified during testing
- The startup code is disabled when running tests

## Before Refactoring

Always run the test suite before making changes:
```bash
npm test
```

If all tests pass ✅, you can safely refactor knowing that functionality is preserved.
