import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const pluginDir = path.dirname(fileURLToPath(import.meta.url))
const appsDir = path.join(pluginDir, 'apps')

let ret = []

if (fs.existsSync(appsDir)) {
  const files = fs.readdirSync(appsDir).filter(file => file.endsWith(".js"))
  files.forEach(file => {
    ret.push(import(`./apps/${file}`))
  })
  ret = await Promise.allSettled(ret)
  
  for (const r of ret) {
    if (r.status === 'rejected') {
      console.error('[OpenClaw-fengyun] 加载插件失败:', r.reason)
    }
  }
} else {
  console.error('[OpenClaw-fengyun] apps目录不存在:', appsDir)
}

let apps = {}
if (ret.length > 0) {
  for (let i in ret) {
    if (ret[i].status !== "fulfilled") continue
    const keys = Object.keys(ret[i].value)
    if (keys.length > 0) {
      apps[keys[0]] = ret[i].value[keys[0]]
    }
  }
}

export { apps }
