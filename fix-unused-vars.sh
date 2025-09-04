#!/bin/bash

echo "Fixing unused variable warnings..."

# Fix unused request parameters in route handlers
sed -i 's/export async function GET(request: NextRequest)/export async function GET()/g' src/app/api/**/*.ts 2>/dev/null || true
sed -i 's/export async function POST(request: NextRequest)/export async function POST()/g' src/app/api/**/*.ts 2>/dev/null || true
sed -i 's/export async function GET(request: Request)/export async function GET()/g' src/app/api/**/*.ts 2>/dev/null || true
sed -i 's/export async function POST(request: Request)/export async function POST()/g' src/app/api/**/*.ts 2>/dev/null || true

# Fix where request is actually used - need to check manually
echo "Checking for routes that actually use request parameter..."
grep -l "request\." src/app/api/**/*.ts 2>/dev/null | head -10

echo "Done with automated fixes."