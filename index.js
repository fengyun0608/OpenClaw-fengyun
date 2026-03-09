import fs from "node:fs"
import path from "node:path"

const pluginDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const appsDir = path.join(pluginDir, 'apps')

let ret = []

if (fs.existsSync(appsDir)) {
  const files = fs.readdirSync(appsDir).filter(file => file.endsWith(".js"))
  files.forEach(file => {
    ret.push(import(`./apps/${file}`))
  })
  ret = await Promise.allSettled(ret)
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
