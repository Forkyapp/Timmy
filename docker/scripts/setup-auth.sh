#!/bin/bash
# =========================================
# Timmy Complete Setup Script
# One script to configure everything
# =========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# Print helpers
print_header() {
    echo ""
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${BLUE}${BOLD}▸ $1${NC}"
    echo -e "${DIM}$(printf '─%.0s' {1..40})${NC}"
}

print_step() { echo -e "${BLUE}${BOLD}[$1]${NC} $2"; }
print_success() { echo -e "  ${GREEN}✓${NC} $1"; }
print_error() { echo -e "  ${RED}✗${NC} $1"; }
print_warning() { echo -e "  ${YELLOW}!${NC} $1"; }
print_info() { echo -e "  ${CYAN}→${NC} $1"; }
print_dim() { echo -e "  ${DIM}$1${NC}"; }

command_exists() { command -v "$1" &> /dev/null; }

# Read input with bracketed paste handling
# Usage: value=$(read_clean "prompt text")
read_clean() {
    local prompt="$1"
    local input
    # Disable bracketed paste mode - send to terminal directly, not stdout
    printf '\e[?2004l' >/dev/tty
    printf '%s' "$prompt" >/dev/tty
    IFS= read -r input </dev/tty
    # Re-enable for other apps
    printf '\e[?2004h' >/dev/tty
    # Strip any escape sequences and control chars that got through
    printf '%s' "$input" | sed $'s/\x1b\\[[0-9;]*[~a-zA-Z]//g' | tr -d '[:cntrl:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Env file helpers
ensure_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        [ -f "$PROJECT_ROOT/.env.example" ] && cp "$PROJECT_ROOT/.env.example" "$ENV_FILE" || touch "$ENV_FILE"
    fi
}

set_env_var() {
    local key="$1" value="$2"
    ensure_env_file
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        [[ "$OSTYPE" == "darwin"* ]] && sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" || sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

get_env_var() { grep "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-; }

is_configured() {
    local val=$(get_env_var "$1")
    [ -n "$val" ] && [ "$val" != "your_"* ] && [ "$val" != "pk_your"* ] && [ "$val" != "ghp_your"* ] && [ "$val" != "sk-your"* ] && [ "$val" != "sk-or-v1-your"* ]
}

prompt_update() {
    local name="$1"
    echo -n "  Update $name? (y/N): "
    read -r update
    [[ "$update" =~ ^[Yy]$ ]]
}

# =========================================
# SECTION 1: Browser OAuth Services
# =========================================

setup_github_auth() {
    echo -e "  ${BOLD}GitHub${NC} ${DIM}(for creating PRs)${NC}"

    if ! command_exists gh; then
        echo -e "    ${YELLOW}!${NC} GitHub CLI not installed"
        echo -e "    ${DIM}Install: brew install gh${NC}"
        return 1
    fi

    if gh auth status &> /dev/null; then
        local user=$(gh api user --jq '.login' 2>/dev/null || echo "unknown")
        echo -e "    ${GREEN}✓${NC} Already logged in as ${BOLD}@${user}${NC}"
        set_env_var "GITHUB_DEFAULT_USERNAME" "$user"
        return 0
    fi

    echo -e "    ${DIM}Opening browser...${NC}"
    if gh auth login --web --scopes "repo,workflow,read:org"; then
        local user=$(gh api user --jq '.login' 2>/dev/null || echo "unknown")
        echo -e "    ${GREEN}✓${NC} Logged in as ${BOLD}@${user}${NC}"
        set_env_var "GITHUB_DEFAULT_USERNAME" "$user"
    else
        echo -e "    ${RED}✗${NC} GitHub auth failed"
        return 1
    fi
}

setup_claude_auth() {
    echo ""
    echo -e "  ${BOLD}Claude${NC} ${DIM}(AI code implementation)${NC}"

    if ! command_exists claude; then
        echo -e "    ${YELLOW}!${NC} Claude CLI not installed"
        echo -e "    ${DIM}Install: npm install -g @anthropic-ai/claude-code${NC}"
        return 1
    fi

    if [ -d "$HOME/.claude" ] && [ -f "$HOME/.claude/.credentials.json" ]; then
        echo -e "    ${GREEN}✓${NC} Already authenticated"
        return 0
    fi

    echo -e "    ${DIM}This will open Claude CLI.${NC}"
    echo -e "    ${DIM}Type ${NC}${BOLD}/login${NC}${DIM} and authorize in browser.${NC}"
    echo ""
    echo -n "    Press Enter to continue..."
    read -r
    claude

    if [ -f "$HOME/.claude/.credentials.json" ]; then
        echo -e "    ${GREEN}✓${NC} Authenticated"
    else
        echo -e "    ${YELLOW}!${NC} Run 'claude' → '/login' manually if needed"
    fi
}

setup_gemini_auth() {
    echo ""
    echo -e "  ${BOLD}Gemini${NC} ${DIM}(AI task analysis)${NC}"

    if ! command_exists gemini; then
        echo -e "    ${YELLOW}!${NC} Gemini CLI not installed"
        echo -e "    ${DIM}Install: npm install -g @anthropic-ai/gemini-cli${NC}"
        return 1
    fi

    if [ -d "$HOME/.gemini" ]; then
        echo -e "    ${GREEN}✓${NC} Already authenticated"
        return 0
    fi

    echo -e "    ${DIM}This will open Gemini CLI.${NC}"
    echo -e "    ${DIM}Select ${NC}${BOLD}Login with Google${NC}${DIM} when prompted.${NC}"
    echo ""
    echo -n "    Press Enter to continue..."
    read -r
    gemini

    if [ -d "$HOME/.gemini" ]; then
        echo -e "    ${GREEN}✓${NC} Authenticated"
    else
        echo -e "    ${YELLOW}!${NC} Run 'gemini' manually if needed"
    fi
}

setup_codex_auth() {
    echo ""
    echo -e "  ${BOLD}Codex${NC} ${DIM}(AI code review)${NC}"

    if ! command_exists codex; then
        echo -e "    ${YELLOW}!${NC} Codex CLI not installed"
        echo -e "    ${DIM}Install: npm install -g @openai/codex${NC}"
        return 1
    fi

    if codex login status &>/dev/null; then
        echo -e "    ${GREEN}✓${NC} Already authenticated"
        return 0
    fi

    echo -e "    ${DIM}Opening browser for ChatGPT login...${NC}"
    codex login

    if codex login status &>/dev/null; then
        echo -e "    ${GREEN}✓${NC} Authenticated"
    else
        echo -e "    ${YELLOW}!${NC} Run 'codex login' manually if needed"
    fi
}

# =========================================
# SECTION 2: Manual API Keys
# =========================================

setup_clickup() {
    echo ""
    echo -e "${CYAN}${BOLD}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}${BOLD}│  CLICKUP SETUP                                              │${NC}"
    echo -e "${CYAN}${BOLD}│  ${DIM}Required - This is where Timmy gets tasks from${NC}${CYAN}${BOLD}             │${NC}"
    echo -e "${CYAN}${BOLD}└─────────────────────────────────────────────────────────────┘${NC}"

    if is_configured "CLICKUP_API_KEY" && is_configured "CLICKUP_WORKSPACE_ID"; then
        print_success "Already configured"
        prompt_update "ClickUp settings" || return 0
    fi

    echo ""
    echo -e "  ${DIM}Opening ClickUp settings...${NC}"

    # Auto-open ClickUp Apps settings
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "https://app.clickup.com/settings/apps" 2>/dev/null
    elif command_exists xdg-open; then
        xdg-open "https://app.clickup.com/settings/apps" 2>/dev/null
    fi

    echo ""
    echo -e "  ${BOLD}To get your API key:${NC}"
    echo ""
    echo "  1. Scroll down to ${BOLD}API Token${NC}"
    echo "  2. Click ${BOLD}[Generate]${NC} (or [Regenerate] if you have one)"
    echo "  3. Click ${BOLD}[Copy]${NC}"
    echo ""
    api_key=$(read_clean "  Paste API key here: ")

    if [ -z "$api_key" ]; then
        print_error "ClickUp API key is required"
        return 1
    fi

    # Validate and get user info
    print_info "Validating API key..."
    local user_response=$(curl -s -H "Authorization: $api_key" https://api.clickup.com/api/v2/user 2>/dev/null)
    local user_id=$(echo "$user_response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    local username=$(echo "$user_response" | grep -o '"username":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -n "$user_id" ]; then
        print_success "Authenticated as: $username (ID: $user_id)"
        set_env_var "CLICKUP_API_KEY" "$api_key"
        set_env_var "CLICKUP_BOT_USER_ID" "$user_id"
    else
        print_error "Invalid API key"
        return 1
    fi

    # Fetch workspaces
    echo ""
    print_info "Fetching your workspaces..."
    local teams_response=$(curl -s -H "Authorization: $api_key" https://api.clickup.com/api/v2/team 2>/dev/null)

    # Parse workspaces - use jq if available, otherwise use careful grep
    local workspace_ids=()
    local workspace_names=()

    if command_exists jq; then
        # Use jq for reliable JSON parsing
        while IFS= read -r id; do
            workspace_ids+=("$id")
        done < <(echo "$teams_response" | jq -r '.teams[].id')
        while IFS= read -r name; do
            workspace_names+=("$name")
        done < <(echo "$teams_response" | jq -r '.teams[].name')
    else
        # Fallback: extract id/name pairs that appear at start of team objects
        # Team objects start with {"id":"...","name":"..." pattern
        while IFS='|' read -r id name; do
            [ -n "$id" ] && workspace_ids+=("$id")
            [ -n "$name" ] && workspace_names+=("$name")
        done < <(echo "$teams_response" | grep -oE '\{"id":"[0-9]+","name":"[^"]+"|"id":"[0-9]+","name":"[^"]+","color"' | sed 's/.*"id":"\([0-9]*\)","name":"\([^"]*\)".*/\1|\2/')
    fi

    local workspace_count=${#workspace_ids[@]}

    if [ "$workspace_count" -eq 0 ]; then
        print_warning "Could not fetch workspaces"
        echo -n "  Enter Workspace ID manually: "
        read -r workspace_id
        [ -n "$workspace_id" ] && set_env_var "CLICKUP_WORKSPACE_ID" "$workspace_id"
    elif [ "$workspace_count" -eq 1 ]; then
        print_success "Found workspace: ${workspace_names[0]} (ID: ${workspace_ids[0]})"
        set_env_var "CLICKUP_WORKSPACE_ID" "${workspace_ids[0]}"
    else
        echo ""
        print_info "Found $workspace_count workspaces:"
        for i in "${!workspace_ids[@]}"; do
            echo "    $((i+1))) ${workspace_names[$i]} (ID: ${workspace_ids[$i]})"
        done
        echo ""
        echo -n "  Select workspace (1-$workspace_count): "
        read -r choice

        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "$workspace_count" ]; then
            local idx=$((choice-1))
            print_success "Selected: ${workspace_names[$idx]}"
            set_env_var "CLICKUP_WORKSPACE_ID" "${workspace_ids[$idx]}"
        else
            print_warning "Invalid selection"
            echo -n "  Enter Workspace ID manually: "
            read -r workspace_id
            [ -n "$workspace_id" ] && set_env_var "CLICKUP_WORKSPACE_ID" "$workspace_id"
        fi
    fi

    # Optional: List ID for Discord integration
    echo ""
    print_info "List ID (optional - for Discord → ClickUp task creation)"
    print_info "Open a list in ClickUp, copy URL containing /li/XXXXXXXXX"
    echo -n "  List URL or ID (or Enter to skip): "
    read -r list_input

    if [ -n "$list_input" ]; then
        local list_id=$(echo "$list_input" | grep -oE '/li/([0-9]+)' | grep -oE '[0-9]+')
        [ -z "$list_id" ] && list_id="$list_input"
        set_env_var "CLICKUP_LIST_ID" "$list_id"
        print_success "List ID: $list_id"
    fi

    print_success "ClickUp configured"
}

setup_openrouter() {
    echo ""
    echo -e "${YELLOW}${BOLD}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${YELLOW}${BOLD}│  OPENROUTER SETUP                                           │${NC}"
    echo -e "${YELLOW}${BOLD}│  ${DIM}Optional - Powers AI reasoning for Discord messages${NC}${YELLOW}${BOLD}        │${NC}"
    echo -e "${YELLOW}${BOLD}└─────────────────────────────────────────────────────────────┘${NC}"

    if is_configured "OPENROUTER_API_KEY"; then
        print_success "Already configured"
        prompt_update "API key" || return 0
    fi

    echo ""
    echo -n "  Set up OpenRouter? (y/N): "
    read -r setup_openrouter_choice
    if [[ ! "$setup_openrouter_choice" =~ ^[Yy]$ ]]; then
        print_warning "Skipped"
        return 0
    fi

    echo ""
    echo -e "  ${DIM}Opening OpenRouter...${NC}"

    # Auto-open OpenRouter keys page
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "https://openrouter.ai/keys" 2>/dev/null
    elif command_exists xdg-open; then
        xdg-open "https://openrouter.ai/keys" 2>/dev/null
    fi

    echo ""
    echo -e "  ${BOLD}To get your API key:${NC}"
    echo ""
    echo "  1. Sign in or create an account"
    echo "  2. Click ${BOLD}[Create Key]${NC}"
    echo "  3. Name it: ${BOLD}Timmy${NC}"
    echo "  4. Click ${BOLD}[Create]${NC} → Copy the key"
    echo ""
    api_key=$(read_clean "  Paste API key here (or Enter to skip): ")

    if [ -n "$api_key" ]; then
        set_env_var "OPENROUTER_API_KEY" "$api_key"
        print_success "OpenRouter configured"
    else
        print_warning "Skipped"
    fi
}

setup_discord() {
    echo ""
    echo -e "${YELLOW}${BOLD}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${YELLOW}${BOLD}│  DISCORD BOT SETUP                                          │${NC}"
    echo -e "${YELLOW}${BOLD}│  ${DIM}Optional - Monitor Discord channels for task keywords${NC}${YELLOW}${BOLD}      │${NC}"
    echo -e "${YELLOW}${BOLD}└─────────────────────────────────────────────────────────────┘${NC}"

    if is_configured "DISCORD_BOT_TOKEN"; then
        print_success "Already configured"
        prompt_update "Discord settings" || return 0
    fi

    echo ""
    echo -n "  Set up Discord integration? (y/N): "
    read -r setup_discord_choice
    [[ ! "$setup_discord_choice" =~ ^[Yy]$ ]] && print_warning "Skipped" && set_env_var "DISCORD_ENABLED" "false" && return 0

    echo ""
    echo -e "${BOLD}  This will take about 5 minutes.${NC}"
    echo ""
    echo -e "  ${DIM}Timmy will monitor your Discord channels for keywords like${NC}"
    echo -e "  ${DIM}\"bug\", \"issue\", \"error\" and create ClickUp tasks automatically.${NC}"
    echo ""
    echo -e "${CYAN}STEP 1: Create Application${NC}"
    echo -e "  ${DIM}Opening Discord Developer Portal...${NC}"

    # Auto-open Discord Developer Portal
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "https://discord.com/developers/applications" 2>/dev/null
    elif command_exists xdg-open; then
        xdg-open "https://discord.com/developers/applications" 2>/dev/null
    fi

    echo ""
    echo "  1. Click the ${BOLD}[New Application]${NC} button (top right)"
    echo "  2. Name it: ${BOLD}Timmy Bot${NC}"
    echo "  3. Click ${BOLD}[Create]${NC}"
    echo ""
    echo -n "  Press Enter when done..."
    read -r

    echo ""
    echo -e "${CYAN}STEP 2: Create Bot & Enable Permissions${NC}"
    echo ""
    echo "  1. Click ${BOLD}[Bot]${NC} in the left sidebar"
    echo "  2. Click ${BOLD}[Reset Token]${NC} → ${BOLD}[Yes, do it!]${NC}"
    echo "  3. Click ${BOLD}[Copy]${NC} to copy the token"
    echo ""
    echo "  4. Scroll down to ${BOLD}Privileged Gateway Intents${NC}"
    echo "     Turn ON these switches:"
    echo "     ${GREEN}✓${NC} SERVER MEMBERS INTENT"
    echo "     ${GREEN}✓${NC} MESSAGE CONTENT INTENT"
    echo ""
    echo "  5. Click ${BOLD}[Save Changes]${NC} at the bottom"
    echo ""
    bot_token=$(read_clean "  Paste Bot Token here: ")

    if [ -z "$bot_token" ]; then
        print_warning "Discord skipped"
        set_env_var "DISCORD_ENABLED" "false"
        return 0
    fi

    set_env_var "DISCORD_BOT_TOKEN" "$bot_token"
    set_env_var "DISCORD_ENABLED" "true"

    echo ""
    echo -e "${CYAN}STEP 3: Invite Bot to Your Server${NC}"
    echo ""
    echo "  1. Click ${BOLD}[OAuth2]${NC} in the left sidebar"
    echo "  2. Click ${BOLD}[URL Generator]${NC}"
    echo ""
    echo "  3. Under ${BOLD}SCOPES${NC}, check:"
    echo "     ${GREEN}✓${NC} bot"
    echo ""
    echo "  4. Under ${BOLD}BOT PERMISSIONS${NC}, check:"
    echo "     ${GREEN}✓${NC} Read Messages/View Channels"
    echo "     ${GREEN}✓${NC} Read Message History"
    echo ""
    echo "  5. Copy the ${BOLD}GENERATED URL${NC} at the bottom"
    echo "  6. Open it in browser → Select your server → ${BOLD}[Authorize]${NC}"
    echo ""
    echo -n "  Press Enter when bot is in your server..."
    read -r

    echo ""
    echo -e "${CYAN}STEP 4: Get Server & Channel IDs${NC}"
    echo ""
    echo "  ${BOLD}First, enable Developer Mode in Discord:${NC}"
    echo "  Discord App → Settings (gear icon) → Advanced → ${GREEN}✓${NC} Developer Mode"
    echo ""
    echo -n "  Press Enter when Developer Mode is enabled..."
    read -r

    echo ""
    echo "  ${BOLD}Now copy the IDs:${NC}"
    echo "  • Right-click your ${BOLD}server icon${NC} → Copy Server ID"
    echo ""
    guild_id=$(read_clean "  Paste Server ID: " | tr -d '[:space:]')
    [ -n "$guild_id" ] && set_env_var "DISCORD_GUILD_ID" "$guild_id"

    echo ""
    echo "  • Right-click the ${BOLD}channel(s)${NC} to monitor → Copy Channel ID"
    echo "    ${DIM}(For multiple channels, separate with commas)${NC}"
    echo ""
    channel_ids=$(read_clean "  Paste Channel ID(s): " | tr -d '[:space:]')
    [ -n "$channel_ids" ] && set_env_var "DISCORD_CHANNEL_IDS" "$channel_ids"

    # Set defaults
    set_env_var "DISCORD_KEYWORDS" "bug,issue,error,problem,broken,crash,fix,create,task"
    set_env_var "DISCORD_POLL_INTERVAL_MS" "600000"

    echo ""
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ Discord bot configured successfully!${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# =========================================
# SECTION 3: Project & System Settings
# =========================================

setup_project() {
    echo ""
    echo -e "${BLUE}${BOLD}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BLUE}${BOLD}│  PROJECT CONFIGURATION                                      │${NC}"
    echo -e "${BLUE}${BOLD}│  ${DIM}Tell Timmy which repository to work on${NC}${BLUE}${BOLD}                    │${NC}"
    echo -e "${BLUE}${BOLD}└─────────────────────────────────────────────────────────────┘${NC}"

    # Check if projects.json exists
    if [ -f "$PROJECT_ROOT/projects.json" ]; then
        print_success "projects.json already exists"
        prompt_update "project settings" || return 0
    fi

    echo ""
    echo -e "  ${BOLD}Your First Project${NC}"
    echo -e "  ${DIM}This is the repo where Timmy will create branches and PRs.${NC}"
    echo ""

    echo -n "  Project name (e.g., my-app): "
    read -r project_name
    [ -z "$project_name" ] && project_name="default"

    echo -n "  Description (optional): "
    read -r project_desc

    # Get GitHub username for default
    local default_owner=$(gh api user --jq '.login' 2>/dev/null || get_env_var "GITHUB_DEFAULT_USERNAME" || echo "")

    echo ""
    echo -e "  ${BOLD}GitHub Repository${NC}"
    echo ""

    if [ -n "$default_owner" ]; then
        echo -n "  Owner [$default_owner]: "
    else
        echo -n "  Owner (GitHub username or org): "
    fi
    read -r repo_owner
    repo_owner="${repo_owner:-$default_owner}"
    [ -n "$repo_owner" ] && set_env_var "GITHUB_OWNER" "$repo_owner"

    echo -n "  Repository name: "
    read -r repo_name
    [ -n "$repo_name" ] && set_env_var "GITHUB_REPO" "$repo_name"

    echo ""
    echo -e "  ${BOLD}Local Path${NC}"
    echo -e "  ${DIM}Where is this repo cloned on your machine?${NC}"
    echo ""
    echo -n "  Path (e.g., ~/projects/$repo_name): "
    read -r repo_path
    repo_path="${repo_path/#\~/$HOME}"
    [ -n "$repo_path" ] && set_env_var "GITHUB_REPO_PATH" "$repo_path"

    echo ""
    echo -n "  Base branch [main]: "
    read -r base_branch
    base_branch="${base_branch:-main}"
    set_env_var "GITHUB_BASE_BRANCH" "$base_branch"

    # Create projects.json
    cat > "$PROJECT_ROOT/projects.json" << EOF
{
  "projects": {
    "$project_name": {
      "name": "$project_name",
      "description": "$project_desc",
      "clickup": {
        "workspaceId": "$(get_env_var CLICKUP_WORKSPACE_ID)"
      },
      "github": {
        "owner": "$repo_owner",
        "repo": "$repo_name",
        "path": "$repo_path",
        "baseBranch": "$base_branch"
      }
    }
  }
}
EOF
    print_success "Created projects.json"

    # Create workspace.json
    cat > "$PROJECT_ROOT/workspace.json" << EOF
{
  "activeProject": "$project_name"
}
EOF
    print_success "Created workspace.json"
}

setup_system_settings() {
    echo ""
    echo -e "${BLUE}${BOLD}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BLUE}${BOLD}│  SYSTEM SETTINGS                                            │${NC}"
    echo -e "${BLUE}${BOLD}│  ${DIM}Fine-tune how Timmy behaves (defaults are fine)${NC}${BLUE}${BOLD}           │${NC}"
    echo -e "${BLUE}${BOLD}└─────────────────────────────────────────────────────────────┘${NC}"

    echo ""
    echo -e "  ${DIM}Press Enter to accept the default value in [brackets].${NC}"
    echo ""

    echo -n "  How often to check for new tasks? [15] seconds: "
    read -r poll_interval
    poll_interval="${poll_interval:-15}"
    set_env_var "POLL_INTERVAL_MS" "$((poll_interval * 1000))"

    echo -n "  Post progress comments to ClickUp/GitHub? (Y/n): "
    read -r enable_comments
    [[ "$enable_comments" =~ ^[Nn]$ ]] && set_env_var "DISABLE_COMMENTS" "true" || set_env_var "DISABLE_COMMENTS" "false"

    echo -n "  Auto-create GitHub repos if they don't exist? (Y/n): "
    read -r auto_create
    [[ "$auto_create" =~ ^[Nn]$ ]] && set_env_var "AUTO_CREATE_REPO" "false" || set_env_var "AUTO_CREATE_REPO" "true"

    echo ""
    echo -e "  ${DIM}Where should new repos be created?${NC}"
    echo -n "  Base directory [~/Documents/Personal-Projects]: "
    read -r base_dir
    base_dir="${base_dir:-$HOME/Documents/Personal-Projects}"
    base_dir="${base_dir/#\~/$HOME}"
    set_env_var "AUTO_REPO_BASE_DIR" "$base_dir"
    set_env_var "AUTO_REPO_PRIVATE" "true"
    set_env_var "AUTO_REPO_DEFAULT_BRANCH" "main"

    # Context settings (auto-configured)
    set_env_var "CONTEXT_MODE" "hybrid"
    set_env_var "CONTEXT_FALLBACK" "true"
    set_env_var "CONTEXT_CACHE_ENABLED" "true"
    set_env_var "CONTEXT_CACHE_TTL" "3600"

    echo ""
    print_success "System settings saved"
}

setup_directories() {
    echo ""
    echo -e "  ${DIM}Creating data directories...${NC}"

    local dirs=(
        "logs"
        "progress"
        "features"
        "data/cache"
        "data/state"
        "data/tracking"
        "data/discord"
        ".context/models"
        ".context/shared"
        ".context/projects"
    )

    for dir in "${dirs[@]}"; do
        mkdir -p "$PROJECT_ROOT/$dir" 2>/dev/null
    done

    # Create initial data files
    local files=(
        "data/cache/processed-tasks.json:[]"
        "data/cache/processed-comments.json:[]"
        "data/state/task-queue.json:[]"
        "data/state/pipeline-state.json:{}"
        "data/tracking/pr-tracking.json:{}"
        "data/tracking/review-tracking.json:{}"
        "data/discord/processed-messages.json:[]"
    )

    for file_spec in "${files[@]}"; do
        local file="${file_spec%%:*}"
        local content="${file_spec#*:}"
        [ ! -f "$PROJECT_ROOT/$file" ] && echo "$content" > "$PROJECT_ROOT/$file"
    done

    print_success "Created data directories and files"
}

# =========================================
# Main
# =========================================

show_summary() {
    echo ""
    echo ""
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║                                                              ║${NC}"
    echo -e "${GREEN}${BOLD}║                    ✓ SETUP COMPLETE!                         ║${NC}"
    echo -e "${GREEN}${BOLD}║                                                              ║${NC}"
    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "  ${BOLD}Status:${NC}"
    echo ""
    echo -e "  ${BOLD}Required:${NC}"
    is_configured "CLICKUP_API_KEY" && is_configured "CLICKUP_WORKSPACE_ID" && echo -e "    ${GREEN}✓${NC} ClickUp" || echo -e "    ${RED}✗${NC} ClickUp ${RED}(missing!)${NC}"
    (gh auth status &>/dev/null) && echo -e "    ${GREEN}✓${NC} GitHub" || echo -e "    ${RED}✗${NC} GitHub ${RED}(missing!)${NC}"
    echo ""
    echo -e "  ${BOLD}AI Tools:${NC} ${DIM}(need at least one)${NC}"
    [ -d ~/.claude ] && echo -e "    ${GREEN}✓${NC} Claude" || echo -e "    ${DIM}○${NC} Claude"
    [ -d ~/.gemini ] && echo -e "    ${GREEN}✓${NC} Gemini" || echo -e "    ${DIM}○${NC} Gemini"
    (codex login status &>/dev/null 2>&1) && echo -e "    ${GREEN}✓${NC} Codex" || echo -e "    ${DIM}○${NC} Codex"
    echo ""
    echo -e "  ${BOLD}Optional:${NC}"
    is_configured "OPENROUTER_API_KEY" && echo -e "    ${GREEN}✓${NC} OpenRouter" || echo -e "    ${DIM}○${NC} OpenRouter"
    [[ "$(get_env_var DISCORD_ENABLED)" == "true" ]] && echo -e "    ${GREEN}✓${NC} Discord" || echo -e "    ${DIM}○${NC} Discord"
    [ -f "$PROJECT_ROOT/projects.json" ] && echo -e "    ${GREEN}✓${NC} Project config" || echo -e "    ${DIM}○${NC} Project config"
    echo ""

    echo -e "  ${BOLD}Files created:${NC}"
    echo -e "    ${DIM}.env${NC}              API keys & settings"
    echo -e "    ${DIM}projects.json${NC}     Project configuration"
    echo ""

    echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  NEXT STEPS${NC}"
    echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}Option 1: Docker (recommended)${NC}"
    echo -e "    ${CYAN}./docker/scripts/build-base.sh${NC}"
    echo -e "    ${CYAN}docker compose up -d${NC}"
    echo ""
    echo -e "  ${BOLD}Option 2: Run locally${NC}"
    echo -e "    ${CYAN}npm install && npm run build && npm start${NC}"
    echo ""
    echo -e "  ${DIM}View logs: docker compose logs -f${NC}"
    echo ""
}

main() {
    clear
    echo ""
    echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}${BOLD}║                                                              ║${NC}"
    echo -e "${CYAN}${BOLD}║                    🤖 TIMMY SETUP                            ║${NC}"
    echo -e "${CYAN}${BOLD}║                                                              ║${NC}"
    echo -e "${CYAN}${BOLD}║   Autonomous Task Automation: ClickUp → AI → GitHub PRs     ║${NC}"
    echo -e "${CYAN}${BOLD}║                                                              ║${NC}"
    echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  This wizard will configure all services Timmy needs."
    echo -e "  Estimated time: ${BOLD}5-10 minutes${NC}"
    echo ""
    echo -e "  ${BOLD}WHAT WE'LL SET UP:${NC}"
    echo ""
    echo -e "  ${GREEN}Quick (browser login):${NC}"
    echo -e "    • GitHub     - For creating pull requests"
    echo -e "    • Claude     - AI code implementation"
    echo -e "    • Gemini     - AI task analysis"
    echo -e "    • Codex      - AI code review"
    echo ""
    echo -e "  ${YELLOW}Manual (paste API key):${NC}"
    echo -e "    • ClickUp    - Task management ${DIM}(required)${NC}"
    echo -e "    • OpenRouter - AI reasoning ${DIM}(optional)${NC}"
    echo -e "    • Discord    - Message monitoring ${DIM}(optional)${NC}"
    echo ""
    echo -n "  Press Enter to begin..."
    read -r

    # Browser OAuth services
    echo ""
    echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  PART 1: AI TOOLS (Browser Login)${NC}"
    echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${DIM}These tools open your browser - just click Authorize.${NC}"
    echo ""
    setup_github_auth || true
    setup_claude_auth || true
    setup_gemini_auth || true
    setup_codex_auth || true

    # Manual API keys
    echo ""
    echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  PART 2: API KEYS (Copy & Paste)${NC}"
    echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${DIM}These require copying an API key from a website.${NC}"
    echo ""
    setup_clickup || true
    setup_openrouter || true
    setup_discord || true

    # Project & system config
    echo ""
    echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  PART 3: PROJECT SETTINGS${NC}"
    echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    setup_project || true
    setup_system_settings || true
    setup_directories || true

    # Summary
    show_summary
}

main "$@"
