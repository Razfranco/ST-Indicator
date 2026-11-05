import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepareRecording, validateLocalRecording, MAX_LOCAL_RECORDING_BYTES, MAX_COMPRESSED_RECORDING_BYTES } from '../src/lib/recordingCompression.ts'
import { Input, ALL_FORMATS, BlobSource } from 'mediabunny'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

function wavFile(seconds, rate = 22050) {
  const frames = seconds * rate, length = frames * 2, wav = Buffer.alloc(44 + length)
  wav.write('RIFF'); wav.writeUInt32LE(36 + length, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(length, 40)
  // Sound at both ends detects an accidentally truncated or silent tail.
  for (const start of [0, (seconds - 2) * rate])
    for (let i = 0; i < 2 * rate; i++) wav.writeInt16LE(Math.round(Math.sin(i * Math.PI / 11) * 8000), 44 + (start + i) * 2)
  return new File([wav], 'meeting.wav', { type: 'audio/wav' })
}

test('keeps small recordings unchanged and rejects invalid/oversized selections before processing', async () => {
  const file = new File(['original'], 'voice.m4a', { type: 'audio/mp4' })
  const result = await prepareRecording(file)
  assert.equal(result.file, file)
  assert.equal(result.compressed, false)
  assert.throws(() => validateLocalRecording(new File([], 'empty.mp3')))
  assert.throws(() => validateLocalRecording(new File(['x'], 'bad.txt')))
  assert.doesNotThrow(() => validateLocalRecording(new File([new Uint8Array(MAX_LOCAL_RECORDING_BYTES)], 'limit.wav')))
  assert.throws(() => validateLocalRecording(new File([new Uint8Array(MAX_LOCAL_RECORDING_BYTES + 1)], 'large.wav')))
  const controller = new AbortController(); controller.abort()
  await assert.rejects(prepareRecording(file, { signal: controller.signal }))
})

test('compresses a complete 37-minute, 97.9 MB recording and preserves sound at both ends', { timeout: 180000 }, async () => {
  const original = wavFile(37 * 60)
  const progress = []
  const prepared = await prepareRecording(original, { onProgress: p => progress.push(p) })
  assert.equal(prepared.compressed, true)
  assert.equal(prepared.originalBytes, 97_902_044)
  assert(prepared.file.size < MAX_COMPRESSED_RECORDING_BYTES)
  assert(prepared.file.size > 8_000_000)
  assert.equal(prepared.file.type, 'audio/mpeg')
  assert.equal(progress.at(-1), 1)
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(prepared.file) })
  try { assert(Math.abs(await input.computeDuration() - 2220) < 1) } finally { input.dispose() }
  const dir = await mkdtemp(join(tmpdir(), 'st-browser-compress-'))
  try {
    const path = join(dir, 'compressed.mp3'); await writeFile(path, Buffer.from(await prepared.file.arrayBuffer()))
    for (const start of ['0', '2218']) {
      const { stdout } = await promisify(execFile)('ffmpeg', ['-v', 'error', '-ss', start, '-i', path, '-t', '1.5', '-f', 's16le', '-ac', '1', '-ar', '8000', '-'], { maxBuffer: 1000000, encoding: 'buffer' })
      let peak = 0
      for (let i = 0; i < stdout.length - 1; i += 2) peak = Math.max(peak, Math.abs(stdout.readInt16LE(i)))
      assert(peak > 1000, `sound missing at ${start}`)
    }
    console.log(JSON.stringify({ originalBytes: original.size, compressedBytes: prepared.file.size, seconds: 2220, soundAtBothEnds: true }))
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('cancels active compression and rejects corrupt recordings instead of returning a partial upload', { timeout: 30000 }, async () => {
  const controller = new AbortController()
  await assert.rejects(prepareRecording(wavFile(20 * 60), { signal: controller.signal, onProgress: p => { if (p > 0.01) controller.abort() } }), /בוטלה/)
  await assert.rejects(prepareRecording(new File([new Uint8Array(50_000_001)], 'corrupt.mp4')), /לא ניתן לדחוס/)
})
