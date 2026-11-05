// Local-only browser integration test. Start Vite before running this test; no accounts or cloud calls.
import { chromium, webkit } from '@playwright/test'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import assert from 'node:assert/strict'
const directory = await mkdtemp(join(tmpdir(), 'st-compression-browser-'))
try {
 const path = join(directory, 'sample.m4a')
 await promisify(execFile)('ffmpeg', ['-v','error','-f','lavfi','-i','sine=frequency=440:duration=10','-c:a','aac','-b:a','128k',path])
 // A valid large free atom verifies large M4A container handling without an enormous test recording.
 const free = Buffer.alloc(50_000_008); free.writeUInt32BE(free.length,0); free.write('free',4)
 await writeFile(path, Buffer.concat([await readFile(path),free]))
 for (const [name,browserType] of [['Chromium',chromium],['WebKit',webkit]]) {
  const browser = await browserType.launch({ headless: true })
  try {
   const page = await browser.newPage()
   const external = []
   await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1' && !route.request().url().startsWith('blob:http://127.0.0.1:5173/')) { external.push(url.hostname); return route.abort() }
    return route.continue()
   })
   await page.goto((process.env.ST_AUDIO_TEST_URL || 'http://127.0.0.1:5173') + '/tests/recordingCompression.browser.html')
   await page.locator('#source').setInputFiles(path)
   await page.locator('#start').click()
   await page.waitForFunction(() => document.querySelector('#result').textContent.startsWith('{'), { timeout: 60000 })
   const result = JSON.parse(await page.locator('#result').textContent())
   assert.equal(result.ok,true, JSON.stringify(result))
   assert.equal(result.compressed,true)
   assert(result.size < 100000)
   assert(Math.abs(result.duration - 10) < 1)
   assert.deepEqual(external,[])
   console.log(JSON.stringify({ browser:name,...result,externalMediaRequests:external.length }))
  } finally { await browser.close() }
 }
} finally { await rm(directory,{recursive:true,force:true}) }
