/**
 * useDocumentation Hook
 * 
 * Manages documentation generation state and export operations.
 * Polls status during generation and provides export functions.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getDocumentationStatus, 
  generateDocumentation,
  getDocumentationExportUrl,
  DocumentationStatusResponse 
} from '../services/api'

interface UseDocumentationOptions {
  repoId: string
  enabled?: boolean
}

interface UseDocumentationReturn {
  // Status
  status: 'not_generated' | 'generating' | 'generated' | 'failed'
  createdAt: string | null
  errorMessage: string | null
  isLoading: boolean
  
  // Generation
  generate: () => void
  isGenerating: boolean
  
  // Export
  exportMarkdown: () => Promise<void>
  exportPdf: () => Promise<void>
  exportError: string | null
  clearExportError: () => void
}

export function useDocumentation({ 
  repoId, 
  enabled = true 
}: UseDocumentationOptions): UseDocumentationReturn {
  const queryClient = useQueryClient()
  const [exportError, setExportError] = useState<string | null>(null)
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null)
  
  // Query documentation status
  const { data: statusData, isLoading } = useQuery({
    queryKey: ['documentation', repoId, 'status'],
    queryFn: async () => {
      const response = await getDocumentationStatus(repoId)
      
      // Check for timeout (if generating for more than 5 minutes)
      if (response.data.state === 'generating' && generationStartTime) {
        const elapsedSeconds = (Date.now() - generationStartTime) / 1000
        
        if (elapsedSeconds > 300) { // 5 minutes
          console.error('[useDocumentation] Generation timeout detected')
          // Don't automatically fail - let backend handle it
          // Just log for debugging
        }
      }
      
      return response.data
    },
    enabled,
    refetchInterval: (query) => {
      // Poll every 2 seconds while generating
      const data = query.state.data as DocumentationStatusResponse | undefined
      const shouldPoll = data?.state === 'generating'
      return shouldPoll ? 2000 : false
    },
    staleTime: 30000, // Consider data stale after 30 seconds
  })
  
  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      
      try {
        const response = await generateDocumentation(repoId)
        return response.data
      } catch (err) {
        console.error('[useDocumentation] ===== GENERATE API FAILED =====')
        console.error('[useDocumentation] Error in mutationFn:', err)
        throw err
      }
    },
    onSuccess: () => {
      // Record start time for timeout tracking
      setGenerationStartTime(Date.now())
      // Invalidate status query to trigger refetch
      queryClient.invalidateQueries({ 
        queryKey: ['documentation', repoId, 'status'] 
      })
    },
    onError: (error: any) => {
      console.error('[useDocumentation] ===== ON ERROR CALLED =====')
      console.error('[useDocumentation] Generation failed:', error)
      console.error('[useDocumentation] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      })
      // Clear start time on error
      setGenerationStartTime(null)
      // Invalidate to refresh status (might show failed state)
      queryClient.invalidateQueries({ 
        queryKey: ['documentation', repoId, 'status'] 
      })
    }
  })
  
  // Export functions
  const exportMarkdown = async () => {
    setExportError(null)
    try {
      const url = getDocumentationExportUrl(repoId, 'md')
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Export failed with status:', response.status, 'body:', errorText)
        
        // Try to parse error message from response
        try {
          const errorJson = JSON.parse(errorText)
          throw new Error(errorJson.error?.message || `Export failed: ${response.status}`)
        } catch {
          throw new Error(`Export failed: ${response.status} ${response.statusText}`)
        }
      }
      
      const blob = await response.blob()
      
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${repoId}-docs.md`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
    } catch (error) {
      console.error('Markdown export failed:', error)
      setExportError(error instanceof Error ? error.message : 'Failed to export documentation')
      throw error
    }
  }
  
  const exportPdf = async () => {
    setExportError(null)
    try {
      const url = getDocumentationExportUrl(repoId, 'pdf')
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Export failed with status:', response.status, 'body:', errorText)
        
        // Try to parse error message from response
        try {
          const errorJson = JSON.parse(errorText)
          throw new Error(errorJson.error?.message || `Export failed: ${response.status}`)
        } catch {
          throw new Error(`Export failed: ${response.status} ${response.statusText}`)
        }
      }
      
      // Get response as text first to check if it's base64
      const responseText = await response.text()
      
      let blob: Blob
      
      // Check if response is base64-encoded (starts with base64 PDF signature)
      if (responseText.startsWith('JVBERi')) {
        // Decode base64 to binary
        const binaryString = atob(responseText)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        blob = new Blob([bytes], { type: 'application/pdf' })
      } else {
        // Already binary, use as-is
        blob = new Blob([responseText], { type: 'application/pdf' })
      }
      
      
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${repoId}-docs.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
    } catch (error) {
      console.error('PDF export failed:', error)
      setExportError(error instanceof Error ? error.message : 'Failed to export documentation')
      throw error
    }
  }
  
  const clearExportError = () => {
    setExportError(null)
  }
  
  return {
    // Status
    status: statusData?.state || 'not_generated',
    createdAt: statusData?.created_at || null,
    errorMessage: statusData?.error_message || null,
    isLoading,
    
    // Generation
    generate: () => {
      generateMutation.mutate()
    },
    isGenerating: generateMutation.isPending,
    
    // Export
    exportMarkdown,
    exportPdf,
    exportError,
    clearExportError,
  }
}
