import { Input, BlobSource, ALL_FORMATS, Output, BufferTarget, Mp3OutputFormat, Conversion } from 'mediabunny'
import { registerMp3Encoder } from '@mediabunny/mp3-encoder'
import { MAX_COMPRESSED_RECORDING_BYTES, type CompressionOptions } from './recordingCompression.ts'

let registered = false
/** Stream decoded samples into a worker-backed encoder; do not decode the whole recording into memory. */
export async function compressRecording(file: File, { signal, onProgress }: CompressionOptions): Promise<File> {
  signal?.throwIfAborted()
  if (!registered) { registerMp3Encoder(); registered = true }
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })
  let conversion: Conversion | undefined
  let outputInput: Input | undefined
  let exceeded = false
  const cancel = () => { if (conversion && conversion.state !== 'canceled' && conversion.state !== 'done') void conversion.cancel().catch(() => undefined) }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    onProgress?.(0)
    const tracks = await input.getAudioTracks()
    if (tracks.length !== 1) throw new Error('בחרו קובץ עם רצועת שמע אחת. לא נוותר על רצועות נוספות בזמן הדחיסה.')
    const track = tracks[0]
    if (!(await track.canDecode())) throw new Error('הדפדפן אינו תומך בדחיסת פורמט ההקלטה הזה. נסו דפדפן מעודכן או ייצוא ההקלטה ל־MP3.')
    const duration = (await track.computeDuration()) - Math.max(0, await track.getFirstTimestamp())
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('לא ניתן לקרוא את משך ההקלטה. לא הועלה קובץ חלקי.')
    signal?.throwIfAborted()
    const target = new BufferTarget()
    const output = new Output({ format: new Mp3OutputFormat(), target })
    conversion = await Conversion.init({
      input, output, video: { discard: true },
      audio: { codec: 'mp3', bitrate: 32_000, numberOfChannels: 1, sampleRate: 16_000, forceTranscode: true },
      showWarnings: false,
    })
    if (!conversion.isValid || !conversion.utilizedTracks.includes(track)) throw new Error('לא ניתן להכין את ההקלטה בדפדפן הזה. נסו ייצוא ל־MP3.')
    signal?.throwIfAborted()
    target.on('write', ({ end }) => {
      if (end > MAX_COMPRESSED_RECORDING_BYTES) { exceeded = true; cancel() }
    })
    conversion.onProgress = progress => onProgress?.(Math.min(0.99, progress))
    await conversion.execute()
    signal?.throwIfAborted()
    if (!target.buffer?.byteLength || target.buffer.byteLength > MAX_COMPRESSED_RECORDING_BYTES) throw new Error('ההקלטה עדיין גדולה מדי לאחר דחיסה. יש לפצל אותה למספר הקלטות; השיחה לא קוצרה.')
    const prepared = new File([target.buffer], 'recording-compressed.mp3', { type: 'audio/mpeg', lastModified: file.lastModified })
    outputInput = new Input({ formats: ALL_FORMATS, source: new BlobSource(prepared) })
    const compressedDuration = await outputInput.computeDuration()
    if (!Number.isFinite(compressedDuration) || Math.abs(compressedDuration - duration) > 1) throw new Error('לא ניתן לאמת שההקלטה נשמרה במלואה. לא הועלה קובץ חלקי; נסו ייצוא ל־MP3.')
    onProgress?.(1)
    return prepared
  } catch (error) {
    if (conversion && conversion.state !== 'canceled' && conversion.state !== 'done') await conversion.cancel().catch(() => undefined)
    if (signal?.aborted) throw new Error('דחיסת ההקלטה בוטלה. לא הועלה קובץ.')
    if (exceeded) throw new Error('ההקלטה עדיין גדולה מדי לאחר דחיסה. יש לפצל אותה למספר הקלטות; השיחה לא קוצרה.')
    if (error instanceof Error && /[א-ת]/.test(error.message)) throw error
    throw new Error('לא ניתן לדחוס את ההקלטה. נסו דפדפן מעודכן או ייצוא ההקלטה ל־MP3. לא הועלה קובץ חלקי.', { cause: error })
  } finally {
    signal?.removeEventListener('abort', cancel)
    outputInput?.dispose()
    input.dispose()
  }
}
