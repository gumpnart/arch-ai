#!/usr/bin/env bash
# setup-vault.sh — One-time setup for the diagrams vault git repo.
# Run this from the excalidraw-mcp project root.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$SCRIPT_DIR/diagrams-vault"

echo ""
echo "========================================"
echo "  excalidraw-mcp  —  Vault Setup"
echo "========================================"
echo ""
echo "Vault path: $VAULT_DIR"
echo ""

# ── Init git if needed ────────────────────────────────────────────────────────
if [ ! -d "$VAULT_DIR/.git" ]; then
  echo "Initialising git repository in diagrams-vault/ ..."
  git -C "$VAULT_DIR" init
  git -C "$VAULT_DIR" add .
  git -C "$VAULT_DIR" commit -m "chore: initial vault scaffold"
  echo "  ✓ git init done"
else
  echo "  ✓ git repo already initialised"
fi

# ── GitHub remote ─────────────────────────────────────────────────────────────
echo ""
read -rp "GitHub remote URL (leave blank to skip, e.g. git@github.com:you/my-diagrams.git): " REMOTE_URL

if [ -n "$REMOTE_URL" ]; then
  if git -C "$VAULT_DIR" remote get-url origin &>/dev/null; then
    git -C "$VAULT_DIR" remote set-url origin "$REMOTE_URL"
    echo "  ✓ Updated remote 'origin' → $REMOTE_URL"
  else
    git -C "$VAULT_DIR" remote add origin "$REMOTE_URL"
    echo "  ✓ Added remote 'origin' → $REMOTE_URL"
  fi

  read -rp "Push now? (y/N): " PUSH_NOW
  if [[ "$PUSH_NOW" =~ ^[Yy]$ ]]; then
    git -C "$VAULT_DIR" push -u origin HEAD
    echo "  ✓ Pushed to $REMOTE_URL"
  fi
else
  echo "  Skipped — diagrams will be committed locally only."
  echo "  You can add a remote later with:"
  echo "    git -C diagrams-vault remote add origin <url>"
fi

# ── Print Claude Desktop config ───────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Claude Desktop config block"
echo "========================================"
echo ""
echo 'Add or merge this into your claude_desktop_config.json:'
echo ""
cat <<JSON
{
  "mcpServers": {
    "excalidraw": {
      "command": "node",
      "args": ["$SCRIPT_DIR/mcp-server/dist/index.js"],
      "env": {
        "BRIDGE_URL": "http://localhost:3001",
        "KROKI_URL": "http://localhost:8000",
        "VAULT_PATH": "$VAULT_DIR"
      }
    }
  }
}
JSON

echo ""
echo "Then rebuild the MCP server and restart Claude Desktop:"
echo ""
echo "  cd $SCRIPT_DIR/mcp-server && pnpm install && pnpm run build"
echo ""
echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
