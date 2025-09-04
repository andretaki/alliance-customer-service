#!/bin/bash

echo "Fixing remaining lint issues..."

# Fix unused imports in API routes
sed -i '/^import.*NextRequest.*from.*next\/server.*$/d; /^export async function \(GET\|POST\|PUT\|DELETE\)(/s/NextRequest/Request/g' src/app/api/health/route.ts 2>/dev/null || true
sed -i 's/import { NextRequest, NextResponse }/import { NextResponse }/' src/app/api/health/route.ts 2>/dev/null || true

# Fix unused z import in customers route
sed -i '/^import { z } from.*zod.*$/d' src/app/api/customers/route.ts 2>/dev/null || true

# Fix specific unused vars in callbacks
sed -i 's/catch (_)/catch ()/g' src/app/api/**/*.ts 2>/dev/null || true
sed -i 's/} catch (error)/} catch ()/g' src/app/api/jobs/sla-check/route.ts 2>/dev/null || true
sed -i 's/} catch (error)/} catch ()/g' src/app/api/jobs/weekly-report/route.ts 2>/dev/null || true

# Fix unused imports in other files
sed -i '/^.*\/\/ @ts-ignore$/d' src/**/*.ts src/**/*.tsx 2>/dev/null || true

echo "Done with automated fixes."