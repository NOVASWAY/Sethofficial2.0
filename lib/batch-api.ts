/**
 * Batch API utility for combining multiple API requests into a single call
 * Reduces network overhead and improves performance
 */

interface BatchRequest {
  id: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  params?: Record<string, any>
  body?: any
  headers?: Record<string, string>
}

interface BatchResponse {
  id: string
  status: number
  data?: any
  error?: string
}

interface BatchRequestOptions {
  timeout?: number // Timeout in milliseconds (default: 30000)
  maxBatchSize?: number // Maximum requests per batch (default: 10)
}

/**
 * Batch API client for combining multiple requests
 */
class BatchAPIClient {
  private queue: BatchRequest[] = []
  private timer: NodeJS.Timeout | null = null
  private readonly defaultTimeout = 30 // 30ms
  private readonly defaultMaxBatchSize = 10

  /**
   * Add a request to the batch queue
   */
  add(request: BatchRequest): Promise<BatchResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        ...request,
        resolve,
        reject,
      } as any)

      // Process batch if queue is full or after timeout
      if (this.queue.length >= this.defaultMaxBatchSize) {
        this.processBatch()
      } else if (!this.timer) {
        this.timer = setTimeout(() => {
          this.processBatch()
        }, this.defaultTimeout)
      }
    })
  }

  /**
   * Process the current batch of requests
   */
  private async processBatch() {
    if (this.queue.length === 0) return

    const batch = this.queue.splice(0, this.defaultMaxBatchSize)
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    try {
      // Execute requests in parallel
      const results = await Promise.allSettled(
        batch.map(async (req: any) => {
          try {
            const response = await this.executeRequest(req)
            req.resolve({
              id: req.id,
              status: 200,
              data: response,
            })
            return { id: req.id, success: true, data: response }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Request failed'
            req.reject({
              id: req.id,
              status: 500,
              error: errorMessage,
            })
            return { id: req.id, success: false, error: errorMessage }
          }
        })
      )

      // Log batch processing results
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      
      if (failed > 0) {
        console.warn(`Batch API: ${successful} succeeded, ${failed} failed`)
      }
    } catch (error) {
      // Reject all requests in batch on catastrophic failure
      batch.forEach((req: any) => {
        req.reject({
          id: req.id,
          status: 500,
          error: 'Batch processing failed',
        })
      })
    }
  }

  /**
   * Execute a single API request
   */
  private async executeRequest(request: BatchRequest): Promise<any> {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
    const url = `${baseURL}${request.endpoint}`

    const options: RequestInit = {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...request.headers,
      },
    }

    if (request.body && (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH')) {
      options.body = JSON.stringify(request.body)
    }

    // Add query parameters for GET requests
    if (request.method === 'GET' && request.params) {
      const params = new URLSearchParams(request.params).toString()
      const fullUrl = `${url}?${params}`
      const response = await fetch(fullUrl, options)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    }

    const response = await fetch(url, options)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  /**
   * Flush the queue immediately
   */
  flush(): void {
    if (this.queue.length > 0) {
      this.processBatch()
    }
  }
}

// Singleton instance
const batchClient = new BatchAPIClient()

/**
 * Batch multiple API requests together
 * @param requests Array of batch requests
 * @param options Batch processing options
 * @returns Promise resolving to array of responses
 */
export async function batchRequests(
  requests: BatchRequest[],
  options: BatchRequestOptions = {}
): Promise<BatchResponse[]> {
  const { timeout = 30, maxBatchSize = 10 } = options

  // If only one request, execute directly
  if (requests.length === 1) {
    const req = requests[0]
    try {
      const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
      const url = `${baseURL}${req.endpoint}`
      const response = await fetch(url, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...req.headers,
        },
        body: req.body ? JSON.stringify(req.body) : undefined,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      return [{ id: req.id, status: 200, data }]
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Request failed'
      return [{ id: req.id, status: 500, error: errorMessage }]
    }
  }

  // Process requests in batches
  const batches: BatchRequest[][] = []
  for (let i = 0; i < requests.length; i += maxBatchSize) {
    batches.push(requests.slice(i, i + maxBatchSize))
  }

  const results: BatchResponse[] = []

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(async (req) => {
        try {
          const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
          const url = `${baseURL}${req.endpoint}`
          
          const options: RequestInit = {
            method: req.method,
            headers: {
              'Content-Type': 'application/json',
              ...req.headers,
            },
          }

          if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
            options.body = JSON.stringify(req.body)
          }

          // Add query parameters for GET requests
          if (req.method === 'GET' && req.params) {
            const params = new URLSearchParams(
              Object.entries(req.params).reduce((acc, [key, value]) => {
                if (value !== undefined && value !== null) {
                  acc[key] = String(value)
                }
                return acc
              }, {} as Record<string, string>)
            ).toString()
            const fullUrl = `${url}?${params}`
            const response = await fetch(fullUrl, options)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = await response.json()
            return { id: req.id, status: 200, data }
          }

          const response = await fetch(url, options)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          return { id: req.id, status: 200, data }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Request failed'
          return { id: req.id, status: 500, error: errorMessage }
        }
      })
    )

    results.push(
      ...batchResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value
        } else {
          return {
            id: batch[index].id,
            status: 500,
            error: result.reason?.message || 'Request failed',
          }
        }
      })
    )
  }

  return results
}

/**
 * Hook for using batch API requests in React components
 */
export function useBatchAPI() {
  const batchRequest = async (requests: BatchRequest[]): Promise<BatchResponse[]> => {
    return batchRequests(requests)
  }

  return { batchRequest }
}

/**
 * Helper to create batch requests for common patterns
 */
export const batchHelpers = {
  /**
   * Batch multiple GET requests
   */
  getMultiple: (endpoints: Array<{ id: string; endpoint: string; params?: Record<string, any> }>): BatchRequest[] => {
    return endpoints.map(({ id, endpoint, params }) => ({
      id,
      endpoint,
      method: 'GET' as const,
      params,
    }))
  },

  /**
   * Batch multiple POST requests
   */
  postMultiple: (endpoints: Array<{ id: string; endpoint: string; body: any }>): BatchRequest[] => {
    return endpoints.map(({ id, endpoint, body }) => ({
      id,
      endpoint,
      method: 'POST' as const,
      body,
    }))
  },
}

