// 用豆包语音合成大模型（火山引擎）把老师讲解录成 mp3：public/voice/<编号>.mp3，再写 src/voice-manifest.json。
// 网页只放这些录音，API Key 不会进网页。录的话和网页要读的话来自同一个地方（src/narration.js）。
//
// 用法：API Key 只从环境变量读，不要写进代码，也不要提交。
//   DOUBAO_API_KEY=你的key npm run voice
//   也可以写在项目根目录的 .env 文件里（照着 .env.example 写；.env 不会提交）。
//   npm run voice -- --list    只列出要录的话，不调用接口，不需要 key
//   npm run voice -- --force   全部重新录
// 可选的环境变量：
//   DOUBAO_VOICE        音色，默认 zh_female_xiaohe_uranus_bigtts（小何 2.0）
//   DOUBAO_SPEECH_RATE  语速，-50 到 100，0 是正常，默认 -10（慢一点，孩子听得清）
//   DOUBAO_RESOURCE_ID  默认 seed-tts-2.0；自己复刻的音色（S_ 开头）用 seed-icl-2.0
//   旧版控制台的 App ID + Access Token：DOUBAO_APP_ID、DOUBAO_ACCESS_TOKEN（没有 DOUBAO_API_KEY 时用）
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { recordedTexts } from '../src/narration.js'
import { voiceKey } from '../src/speech.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = join(ROOT, 'public', 'voice')
const MANIFEST = join(ROOT, 'src', 'voice-manifest.json')
const ENDPOINT = process.env.DOUBAO_TTS_URL || 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'
const args = process.argv.slice(2)

// .env：一行一个 名字=值，已经有的环境变量不覆盖
function loadDotEnv(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

function credentials() {
  const env = process.env
  if (env.DOUBAO_API_KEY) return [['X-Api-Key', env.DOUBAO_API_KEY.trim()]]
  if (env.DOUBAO_APP_ID && env.DOUBAO_ACCESS_TOKEN) {
    // 有的接口文档写 App-Id，有的写 App-Key，两个都带上
    return [
      ['X-Api-App-Id', env.DOUBAO_APP_ID.trim()],
      ['X-Api-App-Key', env.DOUBAO_APP_ID.trim()],
      ['X-Api-Access-Key', env.DOUBAO_ACCESS_TOKEN.trim()],
    ]
  }
  return null
}

// fatal：后面的也不会成功（连不上、鉴权没通过、音色不对），就不再试了；retry：过一会儿再试一次可能就好了
const failure = (message, { fatal = false, retry = false } = {}) => Object.assign(new Error(message), { fatal, retry })
const quote = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

// 用 curl 发请求：curl 会走系统设置的代理；key 通过标准输入交给 curl，不出现在命令行里
function curl(config) {
  return new Promise((resolve, reject) => {
    const child = spawn('curl', ['--config', '-'], { stdio: ['pipe', 'pipe', 'pipe'] })
    const out = []
    let err = ''
    child.stdout.on('data', (chunk) => out.push(chunk))
    child.stderr.on('data', (chunk) => (err += chunk))
    child.on('error', (e) => reject(failure(e.code === 'ENOENT' ? '找不到 curl，请先安装 curl（macOS 和 Windows 10 以上一般自带）。' : e.message, { fatal: true })))
    child.on('close', (code) => resolve({ code, stdout: Buffer.concat(out).toString('utf8'), stderr: err.trim() }))
    child.stdin.end(config)
  })
}

// 回来的是一行一个 JSON：code 0 带一段 base64 的声音，20000000 是结束，别的是出错
export function parseStream(text) {
  const chunks = []
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^data:\s*/, '')
    if (!line.startsWith('{')) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    if (obj.code === 20000000) break
    if (obj.code === 0) {
      if (obj.data) chunks.push(Buffer.from(obj.data, 'base64'))
      continue
    }
    const message = obj.message || `code ${obj.code}`
    if (/resource|speaker|voice|音色|资源/i.test(message)) {
      throw failure(`${message}（检查音色和 DOUBAO_RESOURCE_ID 是否配套：预置音色用 seed-tts-2.0，复刻音色用 seed-icl-2.0）`, { fatal: true })
    }
    throw failure(message, { fatal: /auth|permission|quota|balance|权限|额度|余额|欠费/i.test(message), retry: /limit|busy|timeout|qps|频繁/i.test(message) })
  }
  const audio = Buffer.concat(chunks)
  if (!audio.length) throw failure('没有收到声音（检查音色和 DOUBAO_RESOURCE_ID 是否配套：预置音色用 seed-tts-2.0，复刻音色用 seed-icl-2.0）', { fatal: true })
  return audio
}

async function synthesize(text, { auth, voice, resource, rate }) {
  const body = {
    req_params: {
      text,
      speaker: voice,
      audio_params: { format: 'mp3', sample_rate: 24000, ...(rate ? { speech_rate: rate } : {}) },
    },
  }
  const config = [
    `url = ${quote(ENDPOINT)}`,
    'request = "POST"',
    'silent',
    'show-error',
    'connect-timeout = 20',
    'max-time = 180',
    `header = ${quote('Content-Type: application/json')}`,
    ...auth.map(([name, value]) => `header = ${quote(`${name}: ${value}`)}`),
    `header = ${quote(`X-Api-Resource-Id: ${resource}`)}`,
    `header = ${quote(`X-Api-Request-Id: ${randomUUID()}`)}`,
    `data-binary = ${quote(JSON.stringify(body))}`,
    `write-out = ${quote('\n%{http_code}')}`,
  ].join('\n')

  for (let attempt = 1; ; attempt++) {
    const res = await curl(`${config}\n`)
    const lines = res.stdout.split('\n')
    const status = Number(lines.pop())
    const reply = lines.join('\n')
    let problem
    if (res.code !== 0) {
      const host = new URL(ENDPOINT).host
      if (/CONNECT tunnel failed|response 403/i.test(res.stderr)) {
        problem = failure(`连不上 ${host}：网络不允许访问这个域名（${res.stderr}）。在云端环境里运行时，要在环境的网络设置里允许 ${host}。`, { fatal: true })
      } else if (res.code === 6 || res.code === 7) {
        problem = failure(`连不上 ${host}（${res.stderr}），检查一下网络。`, { fatal: true })
      } else {
        problem = failure(`网络出错：${res.stderr || `curl 退出码 ${res.code}`}`, { retry: true })
      }
    } else if (status === 401 || status === 403) {
      problem = failure(`鉴权没通过（HTTP ${status}）：检查 API Key 对不对、账号是否开通了豆包语音合成大模型。${reply.slice(0, 200)}`, { fatal: true })
    } else if (status !== 200) {
      problem = failure(`接口出错（HTTP ${status}）：${reply.slice(0, 300)}`, { retry: status === 429 || status >= 500 })
    } else {
      try {
        return parseStream(reply)
      } catch (e) {
        problem = e
      }
    }
    if (!problem.retry || attempt >= 3) throw problem
    await sleep(2000 * attempt)
  }
}

async function main() {
  loadDotEnv(join(ROOT, '.env'))
  const texts = recordedTexts()

  if (args.includes('--list')) {
    texts.forEach((text, i) => console.log(`${String(i + 1).padStart(2)}. ${text}`))
    console.log(`\n一共 ${texts.length} 段，${texts.reduce((sum, text) => sum + text.length, 0)} 个字。`)
    return
  }

  const auth = credentials()
  if (!auth) {
    console.error('没有找到豆包语音的 API Key。请把它放进环境变量 DOUBAO_API_KEY（或者写进项目根目录的 .env 文件），再运行 npm run voice。')
    process.exitCode = 1
    return
  }
  const voice = process.env.DOUBAO_VOICE?.trim() || 'zh_female_xiaohe_uranus_bigtts'
  const resource = process.env.DOUBAO_RESOURCE_ID?.trim() || (voice.startsWith('S_') ? 'seed-icl-2.0' : 'seed-tts-2.0')
  const rateText = process.env.DOUBAO_SPEECH_RATE?.trim()
  const rate = Math.max(-50, Math.min(100, Math.round(Number(rateText || -10)) || 0))
  const profile = rate ? `${voice}@${rate}` : voice
  const options = { auth, voice, resource, rate }

  mkdirSync(OUT, { recursive: true })
  const jobs = texts.map((text) => ({ text, key: voiceKey(profile, text), file: '' }))
  for (const job of jobs) job.file = join(OUT, `${job.key}.mp3`)
  const todo = jobs.filter((job) => args.includes('--force') || !existsSync(job.file) || statSync(job.file).size === 0)
  console.log(`要录 ${todo.length} 段（一共 ${jobs.length} 段，已经录好 ${jobs.length - todo.length} 段）。声音：${voice}，语速 ${rate}，资源 ${resource}`)

  const failed = []
  let done = 0
  let stop = null
  async function worker() {
    while (todo.length && !stop) {
      const job = todo.shift()
      try {
        const audio = await synthesize(job.text, options)
        writeFileSync(job.file, audio)
        done++
        console.log(`✓ ${done}/${jobs.length}  ${job.text.slice(0, 28)}…`)
      } catch (e) {
        failed.push(job)
        console.error(`✗ ${job.text.slice(0, 28)}…  ${e.message}`)
        if (e.fatal) stop = e
      }
    }
  }
  await Promise.all([worker(), worker()])

  const ok = !failed.length && !stop
  const keys = [...new Set(jobs.filter((job) => existsSync(job.file) && statSync(job.file).size > 0).map((job) => job.key))].sort()
  const before = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}
  // 全部录好了才删掉用不着的旧录音；换了声音又没录完，就先接着用原来的录音
  let removed = 0
  if (ok) {
    const keep = new Set(keys)
    for (const name of readdirSync(OUT)) {
      if (name.endsWith('.mp3') && !keep.has(name.slice(0, -4))) {
        rmSync(join(OUT, name))
        removed++
      }
    }
  }
  if (ok || !before.voice || before.voice === profile) {
    writeFileSync(MANIFEST, `${JSON.stringify({ voice: keys.length ? profile : null, keys }, null, 2)}\n`)
  }

  console.log(`\n录好 ${keys.length} / ${jobs.length} 段${removed ? `，删掉 ${removed} 个不用的旧录音` : ''}。录音在 public/voice/，清单在 src/voice-manifest.json。`)
  if (ok) {
    console.log('重新打包（npm run build）以后，网页就会用这些录音。')
    return
  }
  console.error(`有 ${failed.length + todo.length} 段没录好。${stop ? stop.message : ''}`)
  process.exitCode = 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
