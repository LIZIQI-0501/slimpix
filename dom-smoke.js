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

  // 7. 首页：科学减肥视频（B站嵌入）+ 运动模块（帕梅拉）
  click(doc.querySelector('#tabbar .tab[data-tab="home"]'))
  const homeV = doc.getElementById('view').innerHTML
  if (!homeV.includes('player.bilibili.com')) throw new Error('首页缺少 B站科普视频')
  if (!homeV.includes('科学减肥')) throw new Error('首页缺少科学减肥标题')
  if (!homeV.includes('每日塑形') || !homeV.includes('BV1vzu36mEVd')) throw new Error('首页缺少运动模块/帕梅拉视频')
  steps++; console.log('✓ 首页科普视频(B站) + 运动模块(帕梅拉) 渲染')

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

  // 10. 验证已删除的 分析 / 科普 Tab 不再存在，基础 Tab 完整
  const tabbar = doc.getElementById('tabbar').innerHTML
  if (tabbar.includes('data-tab="analysis"')) throw new Error('分析 Tab 仍存在')
  if (tabbar.includes('data-tab="science"')) throw new Error('科普 Tab 仍存在')
  if (!tabbar.includes('data-tab="home"') || !tabbar.includes('data-tab="diet"') || !tabbar.includes('data-tab="weight"') || !tabbar.includes('data-tab="plan"')) throw new Error('基础 Tab 缺失')
  steps++; console.log('✓ 分析/科普 Tab 已移除, 仅保留 首页/饮食/体重/计划')

} catch (e) {
  errors.push('TEST STEP FAILED: ' + e.message)
}

dom.window.close()
console.log('\n==== DOM 冒烟: 完成 ' + steps + ' 步, 错误 ' + errors.length + ' ====')
errors.forEach(e => console.log('  ✗ ' + e))
process.exit(errors.length ? 1 : 0)
