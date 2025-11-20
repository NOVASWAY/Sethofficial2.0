#!/bin/bash

# TODO/FIXME Analysis Script
# This script analyzes TODO/FIXME comments across the codebase

set -e

echo "=========================================="
echo "TODO/FIXME Analysis"
echo "=========================================="
echo ""

OUTPUT_FILE="TODO_ANALYSIS.md"

echo "Analyzing codebase for TODO/FIXME comments..."
echo ""

# Count TODOs by file
echo "## TODO/FIXME Count by File" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
grep -r "TODO\|FIXME\|XXX\|HACK" --include="*.rs" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" backend/src app components lib contexts hooks | \
    cut -d: -f1 | \
    sort | \
    uniq -c | \
    sort -rn | \
    head -30 >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Total count
TOTAL=$(grep -r "TODO\|FIXME\|XXX\|HACK" --include="*.rs" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" backend/src app components lib contexts hooks 2>/dev/null | wc -l)

echo "## Summary" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "- **Total TODO/FIXME comments**: $TOTAL" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Critical TODOs (in main files)
echo "## Critical TODOs (Main Files)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
grep -n "TODO\|FIXME" backend/src/main.rs backend/src/handlers/*.rs backend/src/services/*.rs 2>/dev/null | head -20 >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Backend TODOs
BACKEND_TODOS=$(grep -r "TODO\|FIXME" --include="*.rs" backend/src 2>/dev/null | wc -l)
echo "- **Backend TODOs**: $BACKEND_TODOS" >> "$OUTPUT_FILE"

# Frontend TODOs
FRONTEND_TODOS=$(grep -r "TODO\|FIXME" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" app components lib contexts hooks 2>/dev/null | wc -l)
echo "- **Frontend TODOs**: $FRONTEND_TODOS" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Priority categorization
echo "## Priority Categorization" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### High Priority (Security/Critical Features)" >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
grep -r "TODO\|FIXME" --include="*.rs" backend/src | grep -i "security\|auth\|password\|token\|csrf\|admin" | head -10 >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Medium Priority (Features/Enhancements)" >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
grep -r "TODO\|FIXME" --include="*.rs" backend/src | grep -v -i "security\|auth\|password\|token" | head -10 >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "✅ Analysis complete! Results saved to $OUTPUT_FILE"
echo ""
echo "Summary:"
echo "  Total TODOs: $TOTAL"
echo "  Backend: $BACKEND_TODOS"
echo "  Frontend: $FRONTEND_TODOS"

