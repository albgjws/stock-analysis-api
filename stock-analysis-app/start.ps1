Write-Output "Starting server..."

# Kill all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Output "Killed old node processes"

# Clear tsx cache
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
Write-Output "Cleared tsx cache"

# Start the dev server
npm run dev
