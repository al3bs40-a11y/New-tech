export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) {
    return fallback;
  }

  if ('data' in error) {
    const data = error.data;
    if (typeof data === 'string' && data.trim()) {
      return data.trim();
    }

    if (typeof data === 'object' && data !== null) {
      const fields = data as Record<string, unknown>;
      for (const key of ['error', 'message', 'detail', 'title']) {
        const message = fields[key];
        if (typeof message === 'string' && message.trim()) {
          return message.trim();
        }
      }
    }
  }

  if ('message' in error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}
