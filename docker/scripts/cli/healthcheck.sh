#!/bin/bash
# =========================================
# AI CLI Health Check
# Verifies all AI CLIs are installed and responsive
# =========================================

ERRORS=0

echo "Checking AI CLI availability..."
echo ""

# Check Claude
echo -n "Claude CLI: "
if command -v claude &> /dev/null; then
    VERSION=$(claude --version 2>/dev/null || echo "unknown")
    echo "OK ($VERSION)"
else
    echo "NOT INSTALLED"
    ((ERRORS++))
fi

# Check Gemini
echo -n "Gemini CLI: "
if command -v gemini &> /dev/null; then
    VERSION=$(gemini --version 2>/dev/null || echo "unknown")
    echo "OK ($VERSION)"
else
    echo "NOT INSTALLED"
    ((ERRORS++))
fi

# Check Codex
echo -n "Codex CLI: "
if command -v codex &> /dev/null; then
    VERSION=$(codex --version 2>/dev/null || echo "unknown")
    echo "OK ($VERSION)"
else
    echo "NOT INSTALLED"
    ((ERRORS++))
fi

echo ""

# Check API keys (warn only, don't fail)
echo "Checking API keys..."
[ -z "$ANTHROPIC_API_KEY" ] && echo "  WARNING: ANTHROPIC_API_KEY not set"
[ -z "$GOOGLE_API_KEY" ] && [ -z "$GEMINI_API_KEY" ] && echo "  WARNING: GOOGLE_API_KEY/GEMINI_API_KEY not set"
[ -z "$OPENAI_API_KEY" ] && echo "  WARNING: OPENAI_API_KEY not set"

echo ""

if [ $ERRORS -eq 0 ]; then
    echo "All CLIs healthy!"
    exit 0
else
    echo "$ERRORS CLI(s) not available"
    # Don't fail - allow graceful degradation
    exit 0
fi
