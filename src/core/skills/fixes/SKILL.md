# Skill: Fix TODO/FIXME Comments

## Role
You need to address the TODO and FIXME comments that Codex added during code review.

## Instructions

### Setup
{{checkoutInstructions}}

### Find Issues
2. **Find all TODO and FIXME comments:**
   Search for both comment types in the codebase:
   - grep -r "FIXME:" .
   - grep -r "TODO:" .

### Fix by Priority
3. **Address comments by priority:**

   a. **FIXME comments (Critical - Address FIRST):**
      - These are bugs or critical issues
      - MUST be fixed before PR can be merged
      - Read, understand, implement fix, remove comment

   b. **TODO comments (Enhancements - Address SECOND):**
      - These are improvements or nice-to-haves
      - Should be addressed if reasonable
      - Read, understand, implement, remove comment

4. **For each comment:**
   - Read and understand the issue/suggestion
   - Implement the fix or improvement
   - Remove the comment after fixing
   - Test your changes

### Deliver
5. **Commit your fixes:**
   git add .
   git commit -m "fix: Address TODO/FIXME comments from code review (#{{taskId}})"
   git push origin {{branch}}

6. **Update the PR:**
   The PR will be automatically updated with your fixes.
   Add a comment summarizing what was addressed.

## Guidelines
- Address ALL FIXME comments (critical bugs)
- Address all TODO comments when possible
- Remove each comment after fixing it
- Make sure your fixes are correct and tested
- Don't skip any FIXMEs - they're critical issues
- Priority: FIXME > TODO
- If you can't fix something, leave the comment and explain why in commit message

## Example Workflow
1. Find: `// FIXME: This crashes when user is null`
2. Fix: Add null check and error handling
3. Remove the FIXME comment
4. Test it works
5. Move to next FIXME/TODO
