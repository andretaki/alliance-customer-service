#!/bin/bash

echo "Fixing Next.js 15 async params in dynamic routes..."

# Fix all dynamic route files to use Promise<{ param: string }> pattern
files=(
  "src/app/api/calls/lookup/[callId]/route.ts"
  "src/app/api/transcripts/[callId]/route.ts"
  "src/app/api/transcripts/[callId]/summarize/route.ts"
  "src/app/api/customers/email/[email]/route.ts"
  "src/app/api/customers/[id]/route.ts"
  "src/app/api/tickets/[id]/suggest-responses/route.ts"
  "src/app/api/tickets/[id]/actions/quote/route.ts"
  "src/app/api/tickets/[id]/route.ts"
  "src/app/api/tickets/[id]/route/route.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    
    # Fix params type and await params
    sed -i 's/{ params }: { params: { \([^}]*\) } }/{ params }: { params: Promise<{ \1 }> }/g' "$file"
    
    # Add await params at the beginning of try blocks
    # This is complex so we'll need to handle it file by file
  fi
done

echo "Please manually add 'const { paramName } = await params;' at the start of each function body."
echo "Done with automated fixes."