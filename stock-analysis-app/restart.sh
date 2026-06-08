#!/bin/bash
# Kill old node processes
echo "=== Killing old node processes ==="
taskkill //F //IM node.exe 2>&1 || echo "No node processes to kill"

# Clear tsx cache
echo "=== Clearing tsx cache ==="
rm -rf node_modules/.cache 2>/dev/null
echo "Cache cleared"

# Start dev server
echo "=== Starting dev server ==="
npm run dev
