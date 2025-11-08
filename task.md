### **Description:**
Develop a VS Code extension called **Git Whisperer** that provides intelligent **autocomplete suggestions for Git commit messages** directly inside the commit input field (e.g. terminal or Source Control panel).
Instead of generating full commit messages in a modal, the extension should act contextually: as soon as the user begins typing `git commit -m "`, or focuses the commit message box, the extension should analyze staged changes and begin suggesting **inline completions**.
The experience should feel natural — similar to **GitHub Copilot**, but focused solely on **summarizing code changes into concise commit phrasing (20–50 words)**.
* * *
### **Core Objectives:**
*   Detect when a developer starts typing a commit message.
*   Analyze staged Git diffs in real-time (`git diff --cached`).
*   Suggest short, contextually relevant commit text as inline autocomplete.
*   Support tab or enter key to accept suggestion.
*   Ensure low latency — suggestions should appear within ~1 second.
* * *
### **Key Features to Implement:**
1. **Trigger Conditions:**
    *   Detect commit command in the integrated terminal or when the VS Code Source Control input is focused.
    *   Activate only when there are staged changes.
    *   Passive mode until triggered (no constant polling).
2. **Autocomplete Behavior:**
    *   Display ghost text suggestion inline (Copilot-style).
    *   Update dynamically as user types additional words.
    *   Maintain 20–50 word limit.
    *   Suggestions must be concise, clear, and formatted in imperative tone (e.g., “Add input validation for login form”).
3. **Suggestion Source:**
    *   Use staged diff context (function names, changed files, added/removed lines).
    *   Optionally enrich with AI model or local summarizer.
    *   Detect commit type automatically (`feat`, `fix`, `chore`, etc.) and prepend it.
4. **Customization Options:**
    *   Enable/disable inline autocomplete feature.
    *   Configurable commit style (e.g., “Conventional Commits”, “plain English”).
    *   Toggle between local summarization and AI-powered mode.
    *   Adjustable maximum length.
5. **UX Expectations:**
    *   Seamless Copilot-like inline experience.
    *   Accept suggestion with Tab or Enter.
    *   Show subtle “✨ Git Whisperer suggestion” label under text.
    *   Respect dark/light themes.
6. **Performance & Security:**
    *   Minimal latency — quick local analysis.
    *   No code sent externally unless explicitly enabled by user.
    *   Handle large diffs gracefully (e.g., summarize key file changes).
* * *
### **Expected Outcome:**
When a developer begins writing a commit message (`git commit -m "…"` or via VS Code Source Control box), **Git Whisperer automatically provides inline autocomplete suggestions** summarizing the staged changes in a concise, natural commit style.
The user should feel like the tool is “finishing their thought” — offering accurate, context-aware completions that can be accepted or ignored instantly, without interrupting their workflow.
* * *
### **Potential Implementation Directions (Developer’s Choice):**
*   Hook into VS Code’s `InlineCompletionItemProvider` API for autocomplete behavior.
*   Use `child_process` to run `git diff --cached` for staged data.
*   Summarize diff context using local logic or AI model.
*   Cache last diff summary for faster re-suggestions.
* * *
### **Success Criteria:**
*   Autocomplete activates automatically on commit message input.
*   Suggestions are relevant and concise (<50 words).
*   Works both in terminal and Source Control commit box.
*   Non-blocking, fluid experience — no modal interruptions.
*   Extension feels "invisible until needed."

[Repo: commit-copilot]