# Enhanced Error Handling and Loading States Guide

This guide explains how to use the enhanced error handling and loading state system implemented in the clinic management frontend.

## Overview

The enhanced error handling system provides:
- **Comprehensive error types** with user-friendly messages
- **Automatic error logging** and tracking
- **Retry mechanisms** for failed operations
- **Loading states** with skeleton components
- **Form validation** with field-specific error display
- **Error boundaries** for component-level error handling

## Core Components

### 1. Error Handling Hooks

#### `useErrorHandler()`
A hook that provides comprehensive error handling capabilities.

```typescript
import { useErrorHandler } from '@/hooks/use-error-handler'

function MyComponent() {
  const { error, isLoading, handleError, clearError, executeWithErrorHandling } = useErrorHandler()

  const handleOperation = async () => {
    await executeWithErrorHandling(
      () => someAsyncOperation(),
      'MyComponent.handleOperation'
    )
  }

  return (
    <div>
      {error && <ErrorDisplay error={error} onRetry={handleOperation} />}
      {isLoading && <Loading text="Processing..." />}
      <button onClick={handleOperation}>Execute</button>
    </div>
  )
}
```

#### `useAsyncOperation<T>()`
A specialized hook for managing async operations with built-in error handling.

```typescript
import { useAsyncOperation } from '@/hooks/use-async-operation'

function DataComponent() {
  const { state, execute, reset } = useAsyncOperation<MyDataType>()

  const loadData = async () => {
    await execute(
      () => fetchDataFromAPI(),
      'DataComponent.loadData'
    )
  }

  return (
    <div>
      {state.loading && <Loading text="Loading data..." />}
      {state.error && <ErrorDisplay error={state.error} onRetry={loadData} />}
      {state.data && <DataDisplay data={state.data} />}
    </div>
  )
}
```

#### `useDataFetching<T>()`
Specialized hook for data fetching operations.

```typescript
import { useDataFetching } from '@/hooks/use-async-operation'

function PatientList() {
  const { data, loading, error, fetchData } = useDataFetching<Patient[]>()

  useEffect(() => {
    fetchData(() => patientAPI.getAll(), 'PatientList.loadPatients')
  }, [])

  return (
    <div>
      {loading && <PatientListSkeleton />}
      {error && <ErrorDisplay error={error} onRetry={() => fetchData(() => patientAPI.getAll())} />}
      {data && <PatientList data={data} />}
    </div>
  )
}
```

#### `useFormSubmission<T>()`
Specialized hook for form submissions.

```typescript
import { useFormSubmission } from '@/hooks/use-async-operation'

function PatientForm() {
  const { state, submit, reset } = useFormSubmission<Patient>()

  const handleSubmit = async (formData: PatientFormData) => {
    await submit(
      () => patientAPI.create(formData),
      'PatientForm.submit'
    )
  }

  return (
    <FormLoadingOverlay loading={state.loading}>
      <form onSubmit={handleSubmit}>
        {/* form fields */}
        <LoadingButton loading={state.loading} type="submit">
          Submit
        </LoadingButton>
      </form>
    </FormLoadingOverlay>
  )
}
```

### 2. Error Display Components

#### `ErrorDisplay`
A comprehensive error display component with multiple variants.

```typescript
import { ErrorDisplay } from '@/components/ui/error-display'

// Inline error
<ErrorDisplay 
  error={error} 
  onRetry={handleRetry}
  variant="inline"
/>

// Card error
<ErrorDisplay 
  error={error} 
  onRetry={handleRetry}
  variant="card"
/>

// Fullscreen error
<ErrorDisplay 
  error={error} 
  onRetry={handleRetry}
  variant="fullscreen"
  showDismiss={true}
/>
```

#### Specialized Error Components
```typescript
import { NetworkError, ServerError, ValidationError } from '@/components/ui/error-display'

// Network-specific error
<NetworkError onRetry={handleRetry} />

// Server-specific error
<ServerError onRetry={handleRetry} onDismiss={handleDismiss} />

// Validation errors
<ValidationError errors={validationErrors} onRetry={handleRetry} />
```

### 3. Loading Components

#### Basic Loading
```typescript
import { Loading } from '@/components/ui/loading'

// Basic loading
<Loading text="Loading..." />

// Different variants
<Loading variant="dots" text="Processing..." />
<Loading variant="pulse" text="Saving..." />
<Loading variant="spinner" text="Loading..." />

// Fullscreen loading
<Loading fullScreen text="Loading application..." />
```

#### Skeleton Components
```typescript
import { 
  PatientListSkeleton, 
  AppointmentListSkeleton, 
  MedicineListSkeleton,
  DashboardSkeleton,
  DataTableSkeleton 
} from '@/components/ui/loading'

// Patient list skeleton
<PatientListSkeleton count={5} />

// Dashboard skeleton
<DashboardSkeleton />

// Data table skeleton
<DataTableSkeleton rows={10} columns={4} showHeader={true} />
```

#### Loading Button
```typescript
import { LoadingButton } from '@/components/ui/loading'

<LoadingButton 
  loading={isSubmitting}
  loadingText="Saving..."
  onClick={handleSubmit}
>
  Save Changes
</LoadingButton>
```

#### Form Loading Overlay
```typescript
import { FormLoadingOverlay } from '@/components/ui/loading'

<FormLoadingOverlay loading={isSubmitting}>
  <form>
    {/* form content */}
  </form>
</FormLoadingOverlay>
```

### 4. Error Boundary

#### Basic Usage
```typescript
import { ErrorBoundary } from '@/components/error-boundary'

function App() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  )
}
```

#### With Custom Error Handler
```typescript
import { ErrorBoundary } from '@/components/error-boundary'
import { AppError } from '@/lib/error-handler'

function App() {
  const handleError = (error: AppError) => {
    // Send to error tracking service
    console.log('Error caught by boundary:', error)
  }

  return (
    <ErrorBoundary 
      context="App"
      onError={handleError}
    >
      <MyComponent />
    </ErrorBoundary>
  )
}
```

#### Higher-Order Component
```typescript
import { withErrorBoundary } from '@/components/error-boundary'

const MyComponentWithErrorBoundary = withErrorBoundary(
  MyComponent,
  { context: 'MyComponent' }
)
```

## Error Types

The system defines several error types for better error handling:

```typescript
import { ERROR_TYPES } from '@/lib/error-handler'

// Available error types:
ERROR_TYPES.NETWORK          // Network connection issues
ERROR_TYPES.VALIDATION       // Form validation errors
ERROR_TYPES.AUTHENTICATION   // Authentication failures
ERROR_TYPES.AUTHORIZATION    // Permission denied
ERROR_TYPES.NOT_FOUND        // Resource not found
ERROR_TYPES.SERVER           // Server errors
ERROR_TYPES.UNKNOWN          // Unknown errors
```

## Best Practices

### 1. Use Appropriate Hooks
- Use `useDataFetching` for data loading operations
- Use `useFormSubmission` for form submissions
- Use `useAsyncOperation` for general async operations
- Use `useErrorHandler` for custom error handling

### 2. Provide User-Friendly Error Messages
```typescript
const handleError = (error: any) => {
  const userFriendlyMessage = error.code === ERROR_TYPES.NETWORK 
    ? 'Please check your internet connection'
    : 'Something went wrong. Please try again.'
  
  setError(userFriendlyMessage)
}
```

### 3. Always Provide Retry Options
```typescript
<ErrorDisplay 
  error={error} 
  onRetry={handleRetry}
  showRetry={true}
/>
```

### 4. Use Loading States Appropriately
- Show loading states for operations that take time
- Use skeleton components for data loading
- Use loading buttons for form submissions
- Use overlays for form processing

### 5. Handle Validation Errors
```typescript
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

const validateField = (field: string, value: string) => {
  const error = validateFieldValue(field, value)
  if (error) {
    setFieldErrors(prev => ({ ...prev, [field]: error }))
  } else {
    setFieldErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }
}
```

## Example Implementation

See the example components:
- `components/examples/enhanced-patient-list.tsx` - Complete data fetching example
- `components/examples/enhanced-patient-form.tsx` - Complete form submission example

These examples demonstrate:
- Proper error handling with retry mechanisms
- Loading states with skeleton components
- Form validation with field-specific errors
- Error boundary integration
- User-friendly error messages

## Integration with Existing Components

To integrate enhanced error handling into existing components:

1. **Replace basic error handling**:
```typescript
// Before
const [error, setError] = useState<string | null>(null)
const [loading, setLoading] = useState(false)

// After
const { state, execute } = useAsyncOperation()
```

2. **Replace basic loading states**:
```typescript
// Before
{loading && <div>Loading...</div>}

// After
{state.loading && <PatientListSkeleton />}
```

3. **Replace basic error display**:
```typescript
// Before
{error && <div className="error">{error}</div>}

// After
{state.error && <ErrorDisplay error={state.error} onRetry={handleRetry} />}
```

4. **Add error boundaries**:
```typescript
// Wrap components with error boundaries
const MyComponentWithErrorBoundary = withErrorBoundary(MyComponent)
```

This enhanced error handling system provides a robust foundation for building reliable, user-friendly applications with proper error management and loading states.
