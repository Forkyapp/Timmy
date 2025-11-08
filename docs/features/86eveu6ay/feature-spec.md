Here is the feature specification for the "commit copilot" task.

### 1. Feature Overview

This feature, "Git Whisperer," will be a VS Code extension that provides intelligent, inline autocomplete suggestions for Git commit messages. It aims to improve developer workflow by automatically generating concise commit messages based on staged code changes, directly within the native commit input field. The expected outcome is a seamless, Copilot-like experience where developers get contextual help to write better commits faster, without leaving their editor.

### 2. Files to Modify

*   **`package.json`** (Modify)
    *   **Changes:** Add an activation event `onLanguage:git-commit` to ensure the extension loads when the user focuses the Source Control commit message box. Define contribution points for user-configurable settings under `contributes.configuration`, including `commitCopilot.enable`, `commitCopilot.commitStyle`, and `commitCopilot.maxLength`.
*   **`src/extension.ts`** (Modify)
    *   **Changes:** In the `activate` function, register the `InlineCompletionItemProvider`. This registration will be conditional based on the `commitCopilot.enable` setting. Implement a listener for configuration changes to dynamically enable or disable the feature without requiring a reload.
*   **`src/completionProvider.ts`** (Create)
    *   **Changes:** This new file will contain the core logic by implementing the `vscode.InlineCompletionItemProvider` interface. Its primary method, `provideInlineCompletionItems`, will orchestrate fetching the diff, generating the summary, and returning the suggestion.
*   **`src/git.ts`** (Create)
    *   **Changes:** This new module will abstract all Git-related operations. It will export a function, `getStagedDiff`, which executes `git diff --cached` using `child_process` and returns the diff content as a string. It will also handle errors, such as when Git is not present or there are no staged changes.
*   **`src/summarizer.ts`** (Create)
    *   **Changes:** This new module will be responsible for transforming a raw diff string into a concise commit message. It will contain the logic for parsing changes, identifying the commit type (e.g., `feat`, `fix`), and formatting the final message according to the selected style.
*   **`src/test/suite/completion.test.ts`** (Create)
    *   **Changes:** Add unit tests for the `CompletionProvider`. These tests will mock the `git` and `summarizer` modules to verify that completion items are generated correctly under various conditions (e.g., with a diff, without a diff).
*   **`src/test/suite/summarizer.test.ts`** (Create)
    *   **Changes:** Add unit tests for the `summarizeDiff` function. Test its output against a variety of sample diff inputs to ensure it produces accurate and well-formatted commit messages.

### 3. Technical Approach

*   **Architecture:** The extension will leverage VS Code's native `InlineCompletionItemProvider` API to deliver a non-intrusive "ghost text" user experience. The architecture will be modular, separating Git interaction (`git.ts`), summarization logic (`summarizer.ts`), and the VS Code integration point (`completionProvider.ts`).
*   **Codebase Impact:** The primary changes involve creating new modules for the core functionality and modifying the main `extension.ts` file to register these components with VS Code's lifecycle.
*   **Dependencies:** The implementation will rely on the built-in Node.js `child_process` module to execute Git commands. No external npm packages are required for the initial local summarization feature.
*   **Challenges:** The main challenge will be ensuring low latency between focusing the input and displaying a suggestion. This will require efficient execution of `git diff --cached` and quick summarization. Handling very large diffs gracefully (e.g., by truncating or summarizing) is another key consideration. Terminal integration (`git commit -m "..."`) is significantly more complex and will be considered out of scope for the initial implementation, which will focus on the SCM input box.

### 4. Implementation Steps

1.  **Project Setup:** Modify `package.json` to define the `onLanguage:git-commit` activation event and the necessary user settings under `contributes.configuration`.
2.  **Git Interaction Layer:** Create `src/git.ts` and implement the `getStagedDiff` function to capture the output of `git diff --cached`.
3.  **Summarization Engine:** Create `src/summarizer.ts`. Implement an initial version of the `summarizeDiff` function that performs basic analysis of the diff to generate a simple message.
4.  **Inline Completion Provider:** Create `src/completionProvider.ts`. Implement the `provideInlineCompletionItems` method, which will call the Git and summarizer modules and return a `vscode.InlineCompletionItem`.
5.  **Extension Activation:** In `src/extension.ts`, update the `activate` function to read the user's configuration and register the `InlineCompletionItemProvider` for the `git-commit` language ID.
6.  **Dynamic Configuration:** Add a listener for `vscode.workspace.onDidChangeConfiguration` to enable or disable the completion provider on-the-fly as the user changes settings.
7.  **Refine and Test:** Iteratively improve the `summarizer.ts` logic for better accuracy and add comprehensive unit and integration tests for all new modules.

### 5. Testing Strategy

*   **Unit Testing:**
    *   Test the `summarizer.ts` module with a wide range of predefined diff strings to validate the accuracy, tone, and format of the generated messages.
    *   Test the `git.ts` module by mocking `child_process` to simulate various scenarios: a successful diff, no staged changes, and Git command errors.
*   **Integration Testing:**
    *   In `src/test/suite/extension.test.ts`, write tests that activate the extension and trigger the inline completion provider programmatically to ensure it integrates correctly with the VS Code API.
*   **Edge Case Testing:**
    *   Verify that no suggestion appears when there are no staged changes.
    *   Test performance with an unusually large diff to ensure the UI remains responsive.
    *   Confirm the extension handles being in a folder that is not a Git repository without errors.
*   **Manual Testing:**
    *   Perform end-to-end testing by staging various file changes (add, modify, delete) and confirming that relevant suggestions appear quickly in the Source Control panel.

### 6. Acceptance Criteria

*   [ ] The extension activates automatically when the user focuses the Source Control commit message input.
*   [ ] An inline "ghost text" suggestion appears within ~1 second if staged changes exist.
*   [ ] No suggestion appears if there are no staged changes.
*   [ ] The generated suggestion is a concise summary (20-50 words) in an imperative tone.
*   [ ] The suggestion is prefixed with a conventional commit type (e.g., `feat:`, `fix:`, `chore:`).
*   [ ] The user can accept the suggestion by pressing `Tab` or `Enter`.
*   [ ] The entire feature can be enabled or disabled via the `commitCopilot.enable` setting.
*   [ ] The extension introduces no noticeable performance overhead during normal editor use.
*   [ ] The extension gracefully handles errors (e.g., non-Git workspace) without crashing.