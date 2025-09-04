#!/bin/bash

# Fix all TypeScript any errors by removing explicit any type annotations
# The TypeScript compiler will handle type inference

echo "Fixing TypeScript any errors..."

# Fix all catch blocks with any type
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/catch (error: any)/catch (error)/g'

# Fix function parameters and returns with any type - will need manual review for proper types
echo "Files that still need manual type fixes:"
grep -r ": any" src --include="*.ts" --include="*.tsx" | grep -v "// @ts-" | head -20

echo "Done with automated fixes. Manual review needed for remaining any types."