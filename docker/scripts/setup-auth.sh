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
    read -p "  Update $name? (y/N): " update
    [[ "$update" =~ ^[Yy]$ ]]
}

# =========================================
# SECTION 1: Browser OAuth Services
# =========================================

setup_github_auth() {
    print_step "1/8" "GitHub Authentication"

    if ! command_exists gh; then
        print_warning "GitHub CLI not installed"
        print_info "Install: brew install gh"
        return 1
    fi

    if gh auth status &> /dev/null; then
        local user=$(gh api user --jq '.login' 2>/dev/null || echo "unknown")
        print_success "Already authenticated as @${user}"
        set_env_var "GITHUB_DEFAULT_USERNAME" "$user"
        return 0
    fi

    print_info "Opening browser for GitHub auth..."
    if gh auth login --web --scopes "repo,workflow,read:org"; then
        local user=$(gh api user --jq '.login' 2>/dev/null || echo "unknown")
        print_success "Authenticated as @${user}"
        set_env_var "GITHUB_DEFAULT_USERNAME" "$user"
    else
        print_error "GitHub auth failed"
        return 1
    fi
}

setup_claude_auth() {
    print_step "2/8" "Claude (Anthropic)"

    if command_exists claude; then
        print_info "Opening browser for Anthropic auth..."
        if claude auth login 2>/dev/null || claude login 2>/dev/null; then
            print_success "Authenticated via browser"
            return 0
        fi
    fi

    if is_configured "ANTHROPIC_API_KEY"; then
        print_success "Already configured (API key)"
        prompt_update "API key" || return 0
    fi

    print_info "Get key: https://console.anthropic.com/settings/keys"
    read -p "  API key (or Enter to skip): " api_key
    [ -n "$api_key" ] && set_env_var "ANTHROPIC_API_KEY" "$api_key" && print_success "Saved" || print_warning "Skipped"
}

setup_gemini_auth() {
    print_step "3/8" "Gemini (Google)"

    if command_exists gemini && gemini auth login 2>/dev/null; then
        print_success "Authenticated via browser"
        return 0
    fi

    if is_configured "GOOGLE_API_KEY"; then
        print_success "Already configured (API key)"
        prompt_update "API key" || return 0
    fi

    print_info "Get key: https://aistudio.google.com/apikey"
    read -p "  API key (or Enter to skip): " api_key
    [ -n "$api_key" ] && set_env_var "GOOGLE_API_KEY" "$api_key" && print_success "Saved" || print_warning "Skipped"
}

setup_codex_auth() {
    print_step "4/8" "Codex (OpenAI)"

    if command_exists codex && codex auth login 2>/dev/null; then
        print_success "Authenticated via browser"
        return 0
    fi

    if is_configured "OPENAI_API_KEY"; then
        print_success "Already configured (API key)"
        prompt_update "API key" || return 0
    fi

    print_info "Get key: https://platform.openai.com/api-keys"
    read -p "  API key (or Enter to skip): " api_key
    [ -n "$api_key" ] && set_env_var "OPENAI_API_KEY" "$api_key" && print_success "Saved" || print_warning "Skipped"
}

# =========================================
# SECTION 2: Manual API Keys
# =========================================

setup_clickup() {
    print_step "5/8" "ClickUp"
    print_dim "(No browser auth available)"

    if is_configured "CLICKUP_API_KEY"; then
        print_success "Already configured"
        prompt_update "ClickUp settings" || return 0
    fi

    echo ""
    print_info "Get your API key:"
    print_info "1. Go to: https://app.clickup.com/settings/apps"
    print_info "2. Click 'Generate' under Personal Token"
    echo ""
    read -p "  API key: " api_key

    if [ -n "$api_key" ]; then
        set_env_var "CLICKUP_API_KEY" "$api_key"
        print_success "API key saved"

        # Validate and get user info
        print_info "Validating API key..."
        local user_response=$(curl -s -H "Authorization: $api_key" https://api.clickup.com/api/v2/user 2>/dev/null)
        local user_id=$(echo "$user_response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        local username=$(echo "$user_response" | grep -o '"username":"[^"]*"' | head -1 | cut -d'"' -f4)

        if [ -n "$user_id" ]; then
            print_success "Authenticated as: $username"
            set_env_var "CLICKUP_BOT_USER_ID" "$user_id"
        else
            print_warning "Could not validate key, continuing anyway"
            read -p "  Bot User ID (your user ID): " bot_user_id
            [ -n "$bot_user_id" ] && set_env_var "CLICKUP_BOT_USER_ID" "$bot_user_id"
        fi

        # Get workspaces
        echo ""
        print_info "Fetching workspaces..."
        local teams_response=$(curl -s -H "Authorization: $api_key" https://api.clickup.com/api/v2/team 2>/dev/null)
        local teams=$(echo "$teams_response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

        if [ -n "$teams" ]; then
            print_info "Found workspaces. Enter Workspace ID from URL:"
            print_dim "app.clickup.com/{WORKSPACE_ID}/..."
        else
            print_info "Workspace ID (from URL: app.clickup.com/{ID}/...)"
        fi
        read -p "  Workspace ID: " workspace_id
        [ -n "$workspace_id" ] && set_env_var "CLICKUP_WORKSPACE_ID" "$workspace_id"

        # Optional: List ID for Discord integration
        echo ""
        print_info "List ID (optional - for Discord → ClickUp task creation)"
        print_dim "Find in URL when viewing a List: app.clickup.com/.../li/{LIST_ID}"
        read -p "  List ID (or Enter to skip): " list_id
        [ -n "$list_id" ] && set_env_var "CLICKUP_LIST_ID" "$list_id"

        print_success "ClickUp configured"
    else
        print_error "ClickUp API key is required"
        return 1
    fi
}

setup_openrouter() {
    print_step "6/8" "OpenRouter (AI Brain)"
    print_dim "(Used for Discord analysis & task reasoning)"

    if is_configured "OPENROUTER_API_KEY"; then
        print_success "Already configured"
        prompt_update "API key" || return 0
    fi

    print_info "Get key: https://openrouter.ai/keys"
    read -p "  API key (or Enter to skip): " api_key
    [ -n "$api_key" ] && set_env_var "OPENROUTER_API_KEY" "$api_key" && print_success "Saved" || print_warning "Skipped"
}

setup_discord() {
    print_step "7/8" "Discord Bot (Optional)"

    if is_configured "DISCORD_BOT_TOKEN"; then
        print_success "Already configured"
        prompt_update "Discord settings" || return 0
    fi

    echo ""
    read -p "  Set up Discord integration? (y/N): " setup_discord
    [[ ! "$setup_discord" =~ ^[Yy]$ ]] && print_warning "Skipped" && set_env_var "DISCORD_ENABLED" "false" && return 0

    echo ""
    print_info "Create a Discord bot:"
    print_info "1. Go to: https://discord.com/developers/applications"
    print_info "2. Click 'New Application' → name it 'Timmy Bot'"
    print_info "3. Go to 'Bot' tab → 'Add Bot'"
    print_info "4. Enable: SERVER MEMBERS INTENT & MESSAGE CONTENT INTENT"
    print_info "5. Click 'Reset Token' and copy it"
    echo ""
    read -p "  Bot Token: " bot_token

    if [ -n "$bot_token" ]; then
        set_env_var "DISCORD_BOT_TOKEN" "$bot_token"
        set_env_var "DISCORD_ENABLED" "true"

        echo ""
        print_info "Get IDs (enable Developer Mode in Discord settings first):"
        print_info "Right-click server → Copy ID = Guild ID"
        print_info "Right-click channel → Copy ID = Channel ID"
        echo ""

        read -p "  Guild (Server) ID: " guild_id
        [ -n "$guild_id" ] && set_env_var "DISCORD_GUILD_ID" "$guild_id"

        read -p "  Channel IDs (comma-separated): " channel_ids
        [ -n "$channel_ids" ] && set_env_var "DISCORD_CHANNEL_IDS" "$channel_ids"

        # Set defaults
        set_env_var "DISCORD_KEYWORDS" "bug,issue,error,problem,broken,crash,fix,create,task"
        set_env_var "DISCORD_POLL_INTERVAL_MS" "600000"

        print_success "Discord configured"
        echo ""
        print_info "Don't forget to add the bot to your server!"
        print_info "Go to OAuth2 → URL Generator → select 'bot' scope"
        print_info "Permissions: Read Messages, Read Message History"
    else
        print_warning "Discord skipped"
        set_env_var "DISCORD_ENABLED" "false"
    fi
}

# =========================================
# SECTION 3: Project & System Settings
# =========================================

setup_project() {
    print_step "8/8" "Project Configuration"

    # Check if projects.json exists
    if [ -f "$PROJECT_ROOT/projects.json" ]; then
        print_success "projects.json already exists"
        prompt_update "project settings" || return 0
    fi

    echo ""
    print_info "Configure your first project"
    echo ""

    read -p "  Project name (e.g., my-app): " project_name
    [ -z "$project_name" ] && project_name="default"

    read -p "  Project description: " project_desc

    # Get GitHub username for default
    local default_owner=$(gh api user --jq '.login' 2>/dev/null || get_env_var "GITHUB_DEFAULT_USERNAME" || echo "")

    read -p "  GitHub owner [$default_owner]: " repo_owner
    repo_owner="${repo_owner:-$default_owner}"
    [ -n "$repo_owner" ] && set_env_var "GITHUB_OWNER" "$repo_owner"

    read -p "  Repository name: " repo_name
    [ -n "$repo_name" ] && set_env_var "GITHUB_REPO" "$repo_name"

    read -p "  Local repo path (e.g., ~/projects/$repo_name): " repo_path
    repo_path="${repo_path/#\~/$HOME}"
    [ -n "$repo_path" ] && set_env_var "GITHUB_REPO_PATH" "$repo_path"

    read -p "  Base branch [main]: " base_branch
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
    print_section "System Settings"

    echo ""
    read -p "  Poll interval in seconds [15]: " poll_interval
    poll_interval="${poll_interval:-15}"
    set_env_var "POLL_INTERVAL_MS" "$((poll_interval * 1000))"

    read -p "  Disable comments on ClickUp/GitHub? (y/N): " disable_comments
    [[ "$disable_comments" =~ ^[Yy]$ ]] && set_env_var "DISABLE_COMMENTS" "true" || set_env_var "DISABLE_COMMENTS" "false"

    read -p "  Auto-create GitHub repos when needed? (Y/n): " auto_create
    [[ "$auto_create" =~ ^[Nn]$ ]] && set_env_var "AUTO_CREATE_REPO" "false" || set_env_var "AUTO_CREATE_REPO" "true"

    read -p "  Base directory for new repos [~/Documents/Personal-Projects]: " base_dir
    base_dir="${base_dir:-$HOME/Documents/Personal-Projects}"
    base_dir="${base_dir/#\~/$HOME}"
    set_env_var "AUTO_REPO_BASE_DIR" "$base_dir"
    set_env_var "AUTO_REPO_PRIVATE" "true"
    set_env_var "AUTO_REPO_DEFAULT_BRANCH" "main"

    # Context settings
    set_env_var "CONTEXT_MODE" "hybrid"
    set_env_var "CONTEXT_FALLBACK" "true"
    set_env_var "CONTEXT_CACHE_ENABLED" "true"
    set_env_var "CONTEXT_CACHE_TTL" "3600"

    print_success "System settings saved"
}

setup_directories() {
    print_section "Creating Directories"

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
    print_success "Created data directories"

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
    print_success "Created initial data files"
}

# =========================================
# Main
# =========================================

show_summary() {
    print_header "Setup Complete"

    echo -e "${BOLD}Configuration status:${NC}"
    is_configured "CLICKUP_API_KEY" && echo -e "  ${GREEN}✓${NC} ClickUp" || echo -e "  ${RED}✗${NC} ClickUp (required)"
    (gh auth status &>/dev/null) && echo -e "  ${GREEN}✓${NC} GitHub" || echo -e "  ${RED}✗${NC} GitHub (required)"
    (is_configured "ANTHROPIC_API_KEY" || [ -d ~/.claude ]) && echo -e "  ${GREEN}✓${NC} Claude" || echo -e "  ${YELLOW}○${NC} Claude"
    (is_configured "GOOGLE_API_KEY" || [ -d ~/.gemini ]) && echo -e "  ${GREEN}✓${NC} Gemini" || echo -e "  ${YELLOW}○${NC} Gemini"
    (is_configured "OPENAI_API_KEY" || [ -d ~/.codex ]) && echo -e "  ${GREEN}✓${NC} Codex" || echo -e "  ${YELLOW}○${NC} Codex"
    is_configured "OPENROUTER_API_KEY" && echo -e "  ${GREEN}✓${NC} OpenRouter" || echo -e "  ${YELLOW}○${NC} OpenRouter"
    [[ "$(get_env_var DISCORD_ENABLED)" == "true" ]] && echo -e "  ${GREEN}✓${NC} Discord" || echo -e "  ${YELLOW}○${NC} Discord"
    [ -f "$PROJECT_ROOT/projects.json" ] && echo -e "  ${GREEN}✓${NC} Project config" || echo -e "  ${YELLOW}○${NC} Project config"
    echo ""

    echo -e "${DIM}Credentials stored in:${NC}"
    echo -e "  ${DIM}~/.config/gh/${NC}     GitHub"
    echo -e "  ${DIM}~/.claude/${NC}        Claude"
    echo -e "  ${DIM}.env${NC}              API keys"
    echo -e "  ${DIM}projects.json${NC}     Project settings"
    echo ""

    echo -e "${GREEN}${BOLD}Next steps:${NC}"
    echo -e "  ${CYAN}./docker/scripts/build-base.sh${NC}   Build Docker image"
    echo -e "  ${CYAN}docker compose up -d${NC}             Start Timmy"
    echo ""
    echo -e "${DIM}Or without Docker:${NC}"
    echo -e "  ${DIM}npm install && npm run build && npm start${NC}"
    echo ""
}

main() {
    clear
    print_header "Timmy Setup"

    echo -e "This script configures everything needed to run Timmy."
    echo ""
    echo -e "${GREEN}Browser OAuth:${NC} GitHub, Claude, Gemini, Codex"
    echo -e "${YELLOW}Manual keys:${NC}   ClickUp, OpenRouter, Discord"
    echo -e "${BLUE}Settings:${NC}      Project config, system settings"
    echo ""
    read -p "Press Enter to start..."

    # Browser OAuth services
    print_section "Browser OAuth (just click Authorize)"
    setup_github_auth || true
    setup_claude_auth || true
    setup_gemini_auth || true
    setup_codex_auth || true

    # Manual API keys
    print_section "API Keys (manual entry)"
    setup_clickup || true
    setup_openrouter || true
    setup_discord || true

    # Project & system config
    setup_project || true
    setup_system_settings || true
    setup_directories || true

    # Summary
    show_summary
}

main "$@"
