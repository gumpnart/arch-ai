#!/bin/bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 20 --silent
cd /Users/gumpnart/Developments/arch-ai/web
exec pnpm run dev
