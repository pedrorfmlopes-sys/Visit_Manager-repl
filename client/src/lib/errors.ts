export function isUnauthorizedError(error: Error): boolean {
  return error.message.includes('401') || 
         error.message.includes('Unauthorized') ||
         error.message.includes('unauthorized');
}

export function isNetworkError(error: Error): boolean {
  return error.message.includes('fetch') || 
         error.message.includes('NetworkError') ||
         error.message.includes('Failed to fetch') ||
         !navigator.onLine;
}
