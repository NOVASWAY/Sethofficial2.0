# Migration To-Do List: Card-to-Digital Data Recording

**Goal**: Improve data recording and migration from card-based storage to digital system  
**Focus**: Data import, validation, and quality - **NO card scanning/OCR**

**Date**: January 2025  
**Status**: Active Development Tasks

---

## 🎯 Priority Tasks

### High Priority (Core Migration Features)

#### 1. ✅ Duplicate Detection System
**Status**: ⏳ Pending  
**Priority**: High  
**Estimated Effort**: 3-5 days

**Requirements:**
- Implement fuzzy matching algorithm to detect duplicate patients during CSV import
- Check for similar:
  - Names (Levenshtein distance, phonetic matching)
  - OP numbers (exact and similar)
  - Phone numbers (normalized comparison)
- Show duplicate warnings in preview before import
- Provide merge functionality for duplicates
- Generate duplicate detection report

**Files to Modify:**
- `components/patient-import.tsx` - Add duplicate detection UI
- `lib/validation.ts` - Add fuzzy matching functions
- `backend/src/utils/validation.rs` - Add duplicate detection logic
- `backend/src/simple_handlers.rs` - Add duplicate check in import handler

**Acceptance Criteria:**
- [ ] Detects duplicates during CSV preview
- [ ] Shows duplicate warnings with similarity scores
- [ ] Allows user to skip or merge duplicates
- [ ] Generates duplicate report after import

---

#### 2. ✅ Migration Workflow Wizard
**Status**: ⏳ Pending  
**Priority**: High  
**Estimated Effort**: 5-7 days

**Requirements:**
- Create step-by-step guided workflow:
  1. **Data Preparation** - Checklist and guidelines
  2. **File Upload** - CSV file selection and upload
  3. **Data Mapping** - Column mapping interface
  4. **Validation Review** - Preview with errors/warnings
  5. **Import Execution** - Progress tracking
  6. **Post-Import Review** - Summary and next steps
- Add progress indicators (step 1 of 6, etc.)
- Add status tracking (completed, in-progress, pending)
- Save progress for later continuation

**Files to Create:**
- `components/migration-wizard.tsx` - Main wizard component
- `components/migration-steps/` - Individual step components
- `contexts/migration-context.tsx` - Migration state management

**Files to Modify:**
- `components/patient-import.tsx` - Integrate with wizard
- `app/dashboard/[role]/registration/page.tsx` - Add wizard entry point

**Acceptance Criteria:**
- [ ] 6-step workflow implemented
- [ ] Progress tracking works
- [ ] Can save and resume workflow
- [ ] Clear navigation between steps

---

#### 3. ✅ Batch Processing for Large Imports
**Status**: ⏳ Pending  
**Priority**: High  
**Estimated Effort**: 4-6 days

**Requirements:**
- Process imports in batches (100-500 records per batch)
- Show progress bar with real-time updates
- Background job processing for large files
- Resume capability for failed batches
- Show import statistics (imported/failed/total)
- Handle timeouts gracefully

**Files to Modify:**
- `backend/src/simple_handlers.rs` - Add batch processing logic
- `components/patient-import.tsx` - Add progress UI
- `lib/api-client.ts` - Add batch import API calls
- `backend/src/handlers/patient_handlers.rs` - Batch import handler

**Files to Create:**
- `backend/src/services/import_service.rs` - Import service with batching
- `components/import-progress.tsx` - Progress component

**Acceptance Criteria:**
- [ ] Processes files in configurable batch sizes
- [ ] Shows real-time progress
- [ ] Can resume from last successful batch
- [ ] Handles errors without stopping entire import

---

### Medium Priority (Enhanced User Experience)

#### 4. ✅ Migration Progress Tracking
**Status**: ⏳ Pending  
**Priority**: Medium  
**Estimated Effort**: 3-4 days

**Requirements:**
- Create progress dashboard showing:
  - Import statistics (total/imported/failed)
  - Current batch status
  - Estimated time remaining
  - Import history
- Store import sessions in database
- Allow review of past imports
- Export import reports

**Files to Create:**
- `components/migration-dashboard.tsx` - Progress dashboard
- `backend/src/models.rs` - Import session model
- `backend/migrations/XXX_import_sessions.sql` - Database migration

**Files to Modify:**
- `backend/src/simple_handlers.rs` - Track import sessions
- `app/dashboard/[role]/registration/page.tsx` - Add dashboard link

**Acceptance Criteria:**
- [ ] Shows real-time import progress
- [ ] Stores import history
- [ ] Can review past imports
- [ ] Exports import reports

---

#### 5. ✅ Custom Data Mapping Interface
**Status**: ⏳ Pending  
**Priority**: Medium  
**Estimated Effort**: 4-5 days

**Requirements:**
- Allow users to map CSV columns to database fields
- Drag-and-drop interface for mapping
- Support multiple CSV formats
- Save mapping templates for reuse
- Field mapping validation
- Preview mapped data

**Files to Create:**
- `components/data-mapping.tsx` - Mapping interface
- `lib/mapping-utils.ts` - Mapping utilities
- `contexts/mapping-context.tsx` - Mapping state

**Files to Modify:**
- `components/patient-import.tsx` - Integrate mapping
- `backend/src/simple_handlers.rs` - Handle custom mappings

**Acceptance Criteria:**
- [ ] Drag-and-drop column mapping
- [ ] Can save mapping templates
- [ ] Validates field mappings
- [ ] Preview mapped data

---

#### 6. ✅ Import Template System
**Status**: ⏳ Pending  
**Priority**: Medium  
**Estimated Effort**: 3-4 days

**Requirements:**
- Create template library for common card formats
- Allow users to create custom templates
- Save and share templates
- Template download/upload functionality
- Template validation

**Files to Create:**
- `components/import-templates.tsx` - Template management
- `backend/src/models.rs` - Template model
- `backend/src/handlers/template_handlers.rs` - Template handlers
- `backend/migrations/XXX_import_templates.sql` - Database migration

**Files to Modify:**
- `components/patient-import.tsx` - Add template selection
- `lib/api-client.ts` - Template API calls

**Acceptance Criteria:**
- [ ] Can create and save templates
- [ ] Template library available
- [ ] Can download/upload templates
- [ ] Templates validate correctly

---

#### 7. ✅ Duplicate Merge Functionality
**Status**: ⏳ Pending  
**Priority**: Medium  
**Estimated Effort**: 4-5 days

**Requirements:**
- UI to merge duplicate patient records
- Side-by-side comparison view
- Allow field selection (which record's data to keep)
- Preserve all historical data during merge
- Merge consultation/appointment history
- Audit log for merge operations

**Files to Create:**
- `components/duplicate-merge.tsx` - Merge interface
- `backend/src/handlers/merge_handlers.rs` - Merge handlers
- `backend/src/services/merge_service.rs` - Merge logic

**Files to Modify:**
- `components/patient-import.tsx` - Add merge option
- `backend/src/models.rs` - Add merge tracking

**Acceptance Criteria:**
- [ ] Side-by-side comparison view
- [ ] Can select fields to keep
- [ ] Preserves all history
- [ ] Audit logs merge operations

---

### Lower Priority (Nice to Have)

#### 8. ✅ Import Audit Trail
**Status**: ⏳ Pending  
**Priority**: Low  
**Estimated Effort**: 2-3 days

**Requirements:**
- Track all import operations:
  - Import date/time
  - User who imported
  - File name
  - Record counts (imported/failed)
  - Errors encountered
- Create import history log
- Generate import reports
- Export audit data

**Files to Create:**
- `components/import-history.tsx` - History viewer
- `backend/src/models.rs` - Import audit model
- `backend/migrations/XXX_import_audit.sql` - Database migration

**Files to Modify:**
- `backend/src/simple_handlers.rs` - Log imports
- `app/dashboard/[role]/audit-logs/page.tsx` - Add import logs

**Acceptance Criteria:**
- [ ] Tracks all import operations
- [ ] Shows import history
- [ ] Generates reports
- [ ] Exports audit data

---

#### 9. ✅ Data Quality Dashboard
**Status**: ⏳ Pending  
**Priority**: Low  
**Estimated Effort**: 4-5 days

**Requirements:**
- Dashboard showing:
  - Import statistics
  - Data completeness metrics (missing fields %)
  - Quality score calculation
  - Duplicate detection results
  - Recommendations for improvement
- Visual charts and graphs
- Export quality reports

**Files to Create:**
- `components/data-quality-dashboard.tsx` - Quality dashboard
- `backend/src/handlers/quality_handlers.rs` - Quality analysis
- `lib/quality-metrics.ts` - Quality calculations

**Files to Modify:**
- `app/dashboard/[role]/reports/page.tsx` - Add quality section

**Acceptance Criteria:**
- [ ] Shows quality metrics
- [ ] Visual charts
- [ ] Recommendations provided
- [ ] Exports reports

---

#### 10. ✅ Resume Capability for Failed Imports
**Status**: ⏳ Pending  
**Priority**: Low  
**Estimated Effort**: 3-4 days

**Requirements:**
- Allow users to resume interrupted imports
- Store import state in database
- Show which records were imported
- Allow continuing from last successful batch
- Retry mechanism for failed records
- Skip already-imported records

**Files to Modify:**
- `backend/src/simple_handlers.rs` - Add resume logic
- `components/patient-import.tsx` - Add resume UI
- `backend/src/models.rs` - Import state model

**Files to Create:**
- `backend/src/services/resume_service.rs` - Resume logic

**Acceptance Criteria:**
- [ ] Can resume interrupted imports
- [ ] Shows imported records
- [ ] Skips duplicates
- [ ] Retries failed records

---

#### 11. ✅ Enhanced Import Validation
**Status**: ⏳ Pending  
**Priority**: Low  
**Estimated Effort**: 2-3 days

**Requirements:**
- Add more validation rules:
  - Phone number format validation (multiple countries)
  - Date format detection and conversion
  - Email validation
  - Address standardization
- Show validation summary before import
- Categorize errors (critical, warning, info)
- Provide fix suggestions

**Files to Modify:**
- `lib/validation.ts` - Add validation rules
- `backend/src/utils/validation.rs` - Backend validation
- `components/patient-import.tsx` - Enhanced validation UI

**Acceptance Criteria:**
- [ ] Multiple validation rules
- [ ] Validation summary shown
- [ ] Error categorization
- [ ] Fix suggestions provided

---

#### 12. ✅ Post-Import Cleanup Tools
**Status**: ⏳ Pending  
**Priority**: Low  
**Estimated Effort**: 3-4 days

**Requirements:**
- Tools to:
  - Identify and merge duplicates after import
  - Bulk update missing fields
  - Data standardization (phone numbers, addresses)
  - Generate cleanup reports with recommendations
- Bulk edit interface
- Data standardization wizard

**Files to Create:**
- `components/cleanup-tools.tsx` - Cleanup interface
- `backend/src/handlers/cleanup_handlers.rs` - Cleanup handlers
- `lib/cleanup-utils.ts` - Cleanup utilities

**Files to Modify:**
- `app/dashboard/[role]/patients/page.tsx` - Add cleanup link

**Acceptance Criteria:**
- [ ] Can identify duplicates
- [ ] Bulk update functionality
- [ ] Data standardization
- [ ] Cleanup reports

---

## 📊 Implementation Priority Summary

### Phase 1: Core Migration (Weeks 1-3)
1. Duplicate Detection System
2. Migration Workflow Wizard
3. Batch Processing

### Phase 2: Enhanced Experience (Weeks 4-6)
4. Migration Progress Tracking
5. Custom Data Mapping Interface
6. Import Template System
7. Duplicate Merge Functionality

### Phase 3: Polish & Quality (Weeks 7-9)
8. Import Audit Trail
9. Data Quality Dashboard
10. Resume Capability
11. Enhanced Import Validation
12. Post-Import Cleanup Tools

---

## 🎯 Success Metrics

### For Each Feature:
- [ ] Feature implemented and tested
- [ ] Documentation updated
- [ ] User guide created
- [ ] Integration tests passing
- [ ] Code reviewed and approved

### Overall Migration Success:
- [ ] Can import 1000+ records without issues
- [ ] Duplicate detection accuracy > 90%
- [ ] Import success rate > 95%
- [ ] User satisfaction with migration process
- [ ] Data quality score > 85%

---

## 📝 Notes

- **Excluded**: Card scanning/OCR features (not in scope)
- **Focus**: Data recording, validation, and quality
- **Target**: Smooth migration from card-based to digital system
- **Timeline**: 9 weeks for all features (can be prioritized)

---

**Last Updated**: January 2025

