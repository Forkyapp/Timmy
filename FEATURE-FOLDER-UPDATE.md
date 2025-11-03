# Feature Folder Update - Summary

## Changes Made ✅

### 1. Folder Structure Changed
**Before:** `analysis/` folder
**After:** `features/` folder

Each task now gets its own feature folder:
```
features/
└── {taskId}/
    ├── prompt.txt          (Gemini prompt)
    └── feature-spec.md     (Gemini analysis)
```

### 2. Updated Files

#### `lib/config.js`
- Changed: `analysisDir` → `featuresDir`
- Path: `features/` instead of `analysis/`

#### `lib/gemini.js`
Major improvements:
- ✅ Uses `features/` folder instead of `analysis/`
- ✅ Saves to `feature-spec.md` instead of `analysis.md`
- ✅ **Enhanced prompt with "Files to Modify" section**
- ✅ Updated function names for clarity
- ✅ Backwards compatibility maintained

**New Exports:**
```javascript
{
  analyzeTask,
  readFeatureSpec,     // New
  hasFeatureSpec,      // New
  readAnalysis,        // Alias for backwards compat
  hasAnalysis          // Alias for backwards compat
}
```

#### `lib/orchestrator.js`
- Updated to use `featureSpecFile` instead of `analysisFile`
- Pipeline metadata now tracks feature spec file correctly

---

## Enhanced Gemini Prompt

### New Section: "Files to Modify"

Gemini will now **specifically list which files need changes**:

```markdown
## Files to Modify
- `lib/cache.js` - Add new caching method for task data
- `lib/clickup.js` - Update API endpoint for new status
- `tests/cache.test.js` - Add tests for new caching method
```

### Updated Prompt Structure

1. **Feature Overview** (renamed from Task Summary)
2. **Files to Modify** ⭐ **NEW - Critical Section**
3. **Technical Approach**
4. **Implementation Steps** (now references specific files)
5. **Testing Strategy** (includes test files to create/modify)
6. **Acceptance Criteria** (enhanced with verification steps)

---

## Benefits

### 1. Better Organization
- Clear naming: `features/` vs `analysis/` (more descriptive)
- Each task is a "feature" with its spec

### 2. Actionable Specs
- Gemini now tells you **exactly which files to modify**
- No more guessing what needs to change
- Clear file paths from repository root

### 3. Better Integration with Codex
- Codex receives feature spec with file list
- Can directly navigate to files that need changes
- More context for implementation

### 4. Improved Testing
- Testing strategy includes specific test files
- Easier to verify implementation completeness

---

## Example Feature Spec Output

When Gemini analyzes a task, it will now produce:

```markdown
# Feature Specification - Add User Authentication

## Feature Overview
Implement JWT-based authentication for the API endpoints.
Users should be able to login and receive a token.

## Files to Modify
- `lib/auth.js` - Create new authentication module
- `lib/api/user.js` - Add login/logout endpoints
- `lib/middleware/jwt.js` - Create JWT verification middleware
- `routes/auth.js` - Define authentication routes
- `tests/auth.test.js` - Unit tests for auth module
- `tests/integration/login.test.js` - Integration tests

## Technical Approach
- Use jsonwebtoken library for JWT handling
- Store tokens in HTTP-only cookies
- Implement refresh token rotation
- Add rate limiting to prevent brute force

## Implementation Steps
1. Install dependencies (jsonwebtoken, bcrypt)
2. Create `lib/auth.js` with login/signup logic
3. Implement JWT middleware in `lib/middleware/jwt.js`
4. Add routes in `routes/auth.js`
5. Protect existing routes with JWT middleware
6. Write tests

## Testing Strategy
- Unit tests for authentication logic
- Integration tests for login flow
- Test token expiration and refresh
- Test invalid credentials handling

## Acceptance Criteria
- [ ] Users can register with email/password
- [ ] Users can login and receive JWT
- [ ] Protected routes verify JWT
- [ ] Tokens expire after 1 hour
- [ ] All tests pass
```

---

## Migration Guide

### For Existing Code

**Old way:**
```javascript
const gemini = require('./lib/gemini');
const analysis = await gemini.analyzeTask(task);
console.log(analysis.analysisFile);  // Still works!
```

**New way (recommended):**
```javascript
const gemini = require('./lib/gemini');
const spec = await gemini.analyzeTask(task);
console.log(spec.featureSpecFile);
```

**Backwards compatibility:** ✅ Both ways work!

---

## Next Steps

### 1. Update Codex Prompt (Optional)
You can enhance `lib/claude.js` to parse the "Files to Modify" section and present it more clearly to Codex.

### 2. Create `.gitignore` Entry
Add to `.gitignore`:
```
features/*/feature-spec.md  # Don't commit generated specs
features/*/prompt.txt       # Don't commit prompts
```

Or keep them for documentation purposes!

### 3. Test the New Flow
1. Run the system
2. Create a ClickUp task
3. Check `features/{taskId}/feature-spec.md`
4. Verify "Files to Modify" section is populated

---

## Files Changed

- ✅ `lib/config.js` - Updated paths
- ✅ `lib/gemini.js` - Enhanced prompt & new folder structure
- ✅ `lib/orchestrator.js` - Updated to use new field names

**No breaking changes** - Backwards compatibility maintained!

---

## Testing Checklist

- [ ] Create a test ClickUp task
- [ ] Verify `features/` folder is created
- [ ] Check that `feature-spec.md` contains "Files to Modify" section
- [ ] Verify Gemini lists specific file paths
- [ ] Test that Codex receives the feature spec
- [ ] Verify PR creation still works end-to-end

---

## Questions?

The system now:
1. ✅ Creates organized `features/` folder
2. ✅ Generates `feature-spec.md` with file modification list
3. ✅ Provides clearer guidance to Codex
4. ✅ Maintains backwards compatibility

**Ready to test!** 🚀
