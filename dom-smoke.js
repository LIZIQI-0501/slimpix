// DOM 冒烟测试：用 jsdom 加载网页版，跑通各 Tab 与关键交互，捕获运行时错误
const { JSDOM, VirtualConsole } = require('C:/Users/55230/.workbuddy/binaries/node/workspace/node_modules/jsdom')
const fs = require('fs')
const path = require('path')

const webDir = path.resolve(__dirname)
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '')

const errors = []
const vc = new VirtualConsole()
vc.on('jsdomError', function (e) { errors.push('jsdomError: ' + (e.detail || e.message || e)) })

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc })
const { window } = dom
window.addEventListener('error', function (e) { errors.push('window.error: ' + (e.error && e.error.stack || e.message)) })

function inject() {
  const files = ['js/sprite-data.js', 'js/algo.js', 'js/store.js', 'js/app.js']
  const code = files.map(f => fs.readFileSync(path.join(webDir, f), 'utf8')).join('\n;\n')
  try {
    window.eval(code)
  } catch (e) {
    errors.push('INJECT THREW: ' + (e.stack || e.message || e))
  }
  // jsdom 在 eval 时 readyState 仍为 loading，app 仅注册了 DOMContentLoaded 监听；手动派发以触发 boot
  if (!window.document.getElementById('sprite')) {
    try { window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true })) } catch (e2) {}
  }
}
function click(el) { if (!el) throw new Error('click target missing'); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) }
function setVal(el, v) { el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })) }

let steps = 0
try {
  inject()
  const doc = window.document
  // 1. 启动后首页渲染 + 精灵存在
  if (!doc.getElementById('sprite')) throw new Error('sprite 未创建')
  if (!doc.getElementById('view').innerHTML) throw new Error('首页未渲染')
  steps++; console.log('✓ 启动 + 首页渲染 + 精灵创建')

  // 2. 切到饮食 Tab
  click(doc.querySelector('#tabbar .tab[data-tab="diet"]'))
  const grid = doc.getElementById('foodGrid')
  if (!grid || !grid.children.length) throw new Error('饮食食物网格为空')
  steps++; console.log('✓ 饮食 Tab + 食物网格 (' + grid.children.length + ' 项)')

  // 3. 搜索食物
  const search = doc.getElementById('dietSearch')
  setVal(search, '鸡胸肉')
  const afterSearch = doc.getElementById('foodGrid').children.length
  if (afterSearch < 1) throw new Error('搜索无结果')
  steps++; console.log('✓ 搜索食物 -> ' + afterSearch + ' 项')

  // 4. 点开食物 -> 加克数 -> 添加
  const firstFood = doc.getElementById('foodGrid').querySelector('[data-food]')
  click(firstFood)
  const sheet = doc.getElementById('sheetOk')
  if (!sheet) throw new Error('食物详情面板未打开')
  setVal(doc.getElementById('sheetGrams'), 120)
  click(sheet)
  const mealList = doc.getElementById('mealList')
  if (!mealList.innerHTML.includes('fr-name')) throw new Error('添加后餐列表未更新')
  steps++; console.log('✓ 添加食物到餐记录')

  // 5. 体重 Tab：填写并保存
  click(doc.querySelector('#tabbar .tab[data-tab="weight"]'))
  setVal(doc.getElementById('wInput'), '52.5')
  click(doc.getElementById('wSave'))
  if (!doc.querySelector('.hist-row')) throw new Error('体重历史未生成')
  steps++; console.log('✓ 体重记录 + 历史生成')

  // 6. 计划 Tab：生成计划
  click(doc.querySelector('#tabbar .tab[data-tab="plan"]'))
  const build = doc.getElementById('pBuild')
  if (build) {
    setVal(doc.getElementById('pCur'), '55')
    setVal(doc.getElementById('pTgt'), '51')
    click(build)
  }
  if (!doc.getElementById('pReset')) throw new Error('计划未生成')
  steps++; console.log('✓ 30天计划生成')

  // 7. 分析 Tab
  click(doc.querySelector('#tabbar .tab[data-tab="analysis"]'))
  if (!doc.getElementById('view').innerHTML.includes('明日体重预测')) throw new Error('分析页未渲染')
  steps++; console.log('✓ 分析 Tab 渲染')

  // 8. 设置面板：打开 + 保存
  click(doc.getElementById('topbarGear'))
  const saveBtn = doc.getElementById('sSave')
  if (!saveBtn) throw new Error('设置面板未打开')
  setVal(doc.getElementById('sH'), '160')
  setVal(doc.getElementById('sT'), '50')
  click(saveBtn)
  steps++; console.log('✓ 设置面板打开 + 保存')

  // 9. 清空数据（不确认）
  click(doc.getElementById('topbarGear'))
  // 直接调用清空会被 confirm 拦截；这里只验证按钮存在
  if (!doc.getElementById('sClear')) throw new Error('清空按钮缺失')
  steps++; console.log('✓ 设置面板可再次打开')

  // 10. 科普 Tab：渲染 + 视频播放器存在 + 无报错
  click(doc.querySelector('#tabbar .tab[data-tab="science"]'))
  const v = doc.getElementById('view').innerHTML
  if (!v.includes('健康科普')) throw new Error('科普页未渲染')
  if (!v.includes('video-wrap') || !v.includes('iframe')) throw new Error('科普页缺少视频播放器')
  if (!v.includes('v.qq.com/iframe/player.html')) throw new Error('科普页缺少视频嵌入地址')
  steps++; console.log('✓ 科普 Tab 渲染 + 视频播放器 + 官方链接')

} catch (e) {
  errors.push('TEST STEP FAILED: ' + e.message)
}

dom.window.close()
console.log('\n==== DOM 冒烟: 完成 ' + steps + ' 步, 错误 ' + errors.length + ' ====')
errors.forEach(e => console.log('  ✗ ' + e))
process.exit(errors.length ? 1 : 0)
