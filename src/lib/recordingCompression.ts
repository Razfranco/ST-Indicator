export const MAX_LOCAL_RECORDING_BYTES = 100_000_000
export const MAX_STORED_RECORDING_BYTES = 50_000_000
export const MAX_COMPRESSED_RECORDING_BYTES = 25_000_000

export type PreparedRecording = { file: File; compressed: boolean; originalBytes: number }
export type CompressionOptions = { signal?: AbortSignal; onProgress?: (progress: number) => void }

export function validateLocalRecording(file: File): void {
  if (!file.size || file.size > MAX_LOCAL_RECORDING_BYTES || !/\.(mp3|mp4|mpeg|mpga|m4a|wav|webm)$/i.test(file.name)) {
    throw new Error('בחרו הקלטה בפורמט נתמך בגודל של עד 100MB. קובץ שגדול מ־50MB יכווץ במכשיר לפני ההעלאה.')
  }
}

export async function prepareRecording(file: File, options: CompressionOptions = {}): Promise<PreparedRecording> {
  validateLocalRecording(file)
  if (options.signal?.aborted) throw new Error('דחיסת ההקלטה בוטלה. לא הועלה קובץ.')
  if (file.size <= MAX_STORED_RECORDING_BYTES) return { file, compressed: false, originalBytes: file.size }
  // Download the bundled codec only for large recordings. No external media service or CDN.
  const { compressRecording } = await import('./recordingCompressor.ts')
  if (options.signal?.aborted) throw new Error('דחיסת ההקלטה בוטלה. לא הועלה קובץ.')
  const compressed = await compressRecording(file, options)
  return { file: compressed, compressed: true, originalBytes: file.size }
}
