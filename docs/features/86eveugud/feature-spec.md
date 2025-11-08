Here is the feature specification for "EnvLens”.

### 1. Feature Overview

EnvLens will be a CLI tool that inspects a software project's environment variables to improve configuration management. It will analyze `.env` files and source code to identify inconsistencies, such as unused or missing variables, and pinpoint exactly where each variable is used. The expected outcome is a significant reduction in runtime errors caused by misconfigured environments, ultimately helping developers catch mistakes before deployment.

### 2. Files to Modify

The following files will be created for this new CLI tool. The project will be initialized as a Node.js application.

*   `package.json` - To be created. Will define project metadata, dependencies (`yargs`, `dotenv`, `glob`), and the `bin` field to register the `env-lens` command.
*   `README.md` - To be created. Will contain installation instructions, usage examples, and a description of the tool's features and command-line options.
*   `src/main.js` - To be created. The main entry point of the application, responsible for orchestrating the scan and reporting process.
*   `src/cli.js` - To be created. Will handle parsing command-line arguments (e.g., target directory, output format) using `yargs`.
*   `src/scanner.js` - To be created. Contains the core logic for traversing the file system, reading files, and coordinating the different parsers.
*   `src/parsers/env-parser.js` - To be created. Logic to read and parse key-value pairs from `.env` and `.env.example` files.
*   `src/parsers/code-parser.js` - To be created. Will contain language-specific logic to find environment variable usages (e.g., `process.env.VAR`, `os.getenv("VAR")`) in source code files using regular expressions or ASTs.
*   `src/analyzer.js` - To be created. Responsible for cross-referencing the results from the parsers to determine which variables are missing, unused, or found in code.
*   `src/reporter.js` - To be created. Formats the analysis results for display in the console, showing a clear summary of findings.
*   `src/utils/git.js` - To be created. A utility to check if `.env` files are being tracked by Git, which is a potential security risk.
*   `.gitignore` - To be created. Will include standard Node.js ignores like `node_modules/`, `coverage/`, and any local log or report files.
*   `tests/integration.test.js` - To be created. An integration test suite that runs the CLI against a sample project fixture and validates the output.
*   `tests/fixtures/sample-project/` - To be created. A directory containing a sample project with a mix of Node.js, Python, and Go files, along with `.env` and `.env.example` files for testing purposes.

### 3. Technical Approach

*   **Architecture:** The tool will be a modular Node.js CLI application. The core logic (scanning, parsing, analysis) will be decoupled from the presentation layer (console reporting), allowing for future extensions like a JSON or HTML reporter.
*   **File Discovery:** The tool will use a glob-based file walker to recursively scan the target project directory. It will respect `.gitignore` rules by default to avoid scanning irrelevant files and directories like `node_modules`.
*   **Variable Parsing:** It will first parse all `.env` and `.env.example` files to establish a baseline of declared variables. For source code, it will initially use language-specific regular expressions to find potential environment variable usages (e.g., `process.env[A-Z_]+`, `os.getenv\(['"][A-Z_]+['"]\)`), which is a pragmatic first step before committing to complex AST-based parsing.
*   **Analysis & Reporting:** The collected data (declared variables vs. used variables) will be cross-referenced to generate a comprehensive report detailing: missing variables, unused variables, and a map of where each variable is referenced (file and line number).
*   **Dependencies:** Key Node.js dependencies will include `yargs` for argument parsing, `dotenv` for `.env` file parsing, and `fast-glob` for efficient file system traversal.
*   **Challenges:** The primary challenge will be accurately detecting variable usage across different languages and coding patterns, especially dynamic or constructed variable names (e.g., `process.env['MY_' + 'VAR']`), which may lead to false negatives.

### 4. Implementation Steps

1.  **Project Setup:** Initialize a new Node.js project, create the `package.json` with necessary dependencies, and set up the basic directory structure (`src/`, `tests/`).
2.  **CLI Interface:** Implement the basic command-line interface in `src/cli.js` to accept a directory path as an argument.
3.  **Env File Parser:** Build the logic in `src/parsers/env-parser.js` to read and parse variables from `.env` and `.env.example` files found in the target directory.
4.  **File Scanner:** Implement the file scanning mechanism in `src/scanner.js` to traverse the specified project directory and identify relevant source code files for parsing.
5.  **Code Parser (Node.js):** Implement the initial code parser in `src/parsers/code-parser.js` with support for Node.js projects, identifying `process.env.VAR` patterns.
6.  **Analysis Engine:** Create the `src/analyzer.js` module to compare the lists of declared and used variables and generate the core analysis report.
7.  **Console Reporter:** Develop the `src/reporter.js` to take the analysis object and print a human-readable summary to the console.
8.  **Integration:** Wire all modules together in `src/main.js` so the CLI can perform a full scan and report the results.
9.  **Secret Detection:** Add the Git check in `src/utils/git.js` to warn users if a `.env` file is committed.
10. **Expand Language Support:** Iteratively enhance `src/parsers/code-parser.js` to add support for Python (`os.environ`) and Go (`os.Getenv`).
11. **Documentation:** Write the `README.md` with clear usage instructions.

### 5. Testing Strategy

*   **Unit Tests:** Create unit tests for the `env-parser` to ensure it correctly handles various formats, including comments, empty lines, and quoted values. Unit test the `code-parser` with a variety of code snippets for each supported language to validate the accuracy of variable detection.
*   **Integration Tests:** The primary testing focus will be an integration test suite (`tests/integration.test.js`). This suite will execute the CLI tool against the `tests/fixtures/sample-project` and assert that the final console output is exactly as expected, covering all main scenarios (missing, unused, located vars).
*   **Edge Cases:** Tests should cover scenarios such as projects with no `.env` files, source files with no environment variables, directories with complex `.gitignore` rules, and files with non-standard encoding.
*   **Snapshot Testing:** Use snapshot tests for the console output to easily detect any unintended changes in the report format during development.

### 6. Acceptance Criteria

*   [ ] The tool can be invoked from the command line with a path to a project directory (e.g., `env-lens .`).
*   [ ] The tool correctly identifies all variables declared in `.env` and `.env.example`.
*   [ ] The output clearly lists variables that are declared but never used in the codebase.
*   [ ] The output clearly lists variables that are used in the code but not declared in any `.env` file.
*   [ ] For each variable found in the code, the output lists the file path and line number of every reference.
*   [ ] The tool scans and finds variable usage in `.js`, `.py`, and `.go` files.
*   [ ] The tool prints a clear warning if a `.env` file is found to be tracked by Git.
*   [ ] The scan correctly ignores files and directories listed in the project's `.gitignore` file.
*   [ ] The `README.md` file provides clear and sufficient instructions for installation and usage.