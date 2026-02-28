export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
}

export async function invokeApi<T = void>(
    apiCall: () => Promise<ApiResponse<T> | { success: boolean; error?: string }>
): Promise<ApiResponse<T>> {
    try {
        if (!window.electronAPI) {
            throw new Error('window.electronAPI is not defined. Ensure you are running in Electron.')
        }
        const result = await apiCall()
        return result as ApiResponse<T>
    } catch (error) {
        console.error('[API Error]:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}
