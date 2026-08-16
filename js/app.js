// 主应用（网页版）—— 纯原生 JS SPA
// 依赖全局：SlimAlgo（算法）、SlimStore（存储）、SlimSprites / SlimSpriteColors（精灵 SVG）
(function () {
  'use strict'

  var A = window.SlimAlgo
  var S = window.SlimStore
  var SPR = window.SlimSprites
  var SCOL = window.SlimSpriteColors

  // ===================== Web Push 配置（关 App 也能提醒） =====================
  // 部署好 push-server 后，把下面 URL 改成你的后端地址（例如 https://slimpix-push.onrender.com）
  // 注意：必须是 https，且未配置前下方占位符会让订阅自动跳过（退化为仅 App 内提醒）
  var PUSH_SERVER_URL = 'https://slimpix-push.onrender.com'
  // VAPID 公钥（与 push-server 的私钥配对，可换成你自己的）
  var VAPID_PUBLIC_KEY = 'BM8WW8C4JhCgSsZTA9LDBxsjgj8c42xkZJH1QR5aq2LOzFrjBAW6s3aXFNu9CKhHd1HEnYnFeVk7iHjUgMJIWkg'

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4)
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    var raw = atob(base64)
    var arr = new Uint8Array(raw.length)
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
    return arr
  }
  function pushEnabled() {
    return typeof PUSH_SERVER_URL === 'string' && PUSH_SERVER_URL.indexOf('REPLACE_WITH_YOUR') !== 0 && PUSH_SERVER_URL.length > 8
  }

  // ---------- 全局状态 ----------
  var profile = S.getProfile()
  var settings = S.getSettings()
  var tab = 'home'
  var dietState = { meal: 'breakfast', keyword: '', cat: 'staple', sheet: null }
  var bubbleTimer = null

  function $(id) { return document.getElementById(id) }
  function fmt(n, d) { d = d == null ? 1 : d; return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d) }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  function toast(msg) {
    var t = $('toast')
    t.textContent = msg
    t.classList.remove('hidden')
    clearTimeout(toast._t)
    toast._t = setTimeout(function () { t.classList.add('hidden') }, 1400)
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  function escapeAttr(s) { return escapeHtml(s) }

  // 当前体重：以最新记录为准，无记录则用目标体重兜底
  function currentWeight() {
    var lw = S.getLatestWeight()
    return lw ? lw.weight : profile.targetWeight
  }

  // 今日饮食汇总 + 目标 + BMI + 精灵情绪
  function todayContext() {
    var w = currentWeight()
    var diet = S.getDiet(S.todayStr())
    var sum = A.sumMeals(diet)
    var plan = S.getPlan()
    var opts = plan ? { kcalOverride: plan.dailyIntake } : {}
    var tgt = A.targets(w, profile, opts)
    var lw = S.getLatestWeight()
    var bmi = lw ? A.calcBmi(lw.weight, profile.height) : 0
    var band = bmi ? A.bandOf(bmi) : null
    return { w: w, diet: diet, sum: sum, tgt: tgt, bmi: bmi, band: band, plan: plan }
  }

  // ============================================================
  //  渲染：各个 Tab
  // ============================================================
  var view = function () { return $('view') }

  function renderHome() {
    var c = todayContext()
    var lw = S.getLatestWeight()
    var bmiColor = c.band ? c.band.color : '#7A8A86'
    var bmiLabel = c.band ? c.band.label : '—'
    var todayKcal = c.sum.total.kcal
    var tgtKcal = c.tgt.kcal.value
    var kcalPct = clamp(Math.round(todayKcal / tgtKcal * 100), 0, 120)
    var p = c.sum.total
    var tp = c.tgt
    var nutriPct = {
      protein: clamp(Math.round(p.protein / tp.protein.value * 100), 0, 120),
      carb: clamp(Math.round(p.carb / tp.carb.value * 100), 0, 120),
      fat: clamp(Math.round(p.fat / tp.fat.value * 100), 0, 120)
    }
    var waterMl = S.waterTotal(S.todayStr())
    var waterGoal = settings.waterGoalMl
    var waterPct = clamp(Math.round(waterMl / waterGoal * 100), 0, 100)
    var slots = S.WATER_SLOTS
    var waters = S.getWaters(S.todayStr())
    var planActive = !!c.plan
    var predict = A.predict(profile, c.w, todayKcal, 0)
    var predText = predict.direction === 'down' ? ('约 ' + predict.low + '~' + predict.high + ' kg ↓')
      : predict.direction === 'up' ? ('约 ' + predict.low + '~' + predict.high + ' kg ↑')
      : ('约 ' + predict.low + '~' + predict.high + ' kg')
    var mealTip = mealSuggestion()

    var slotHtml = slots.map(function (s) {
      var on = waters[s] && waters[s] > 0
      return '<span class="slot ' + (on ? 'on' : '') + '" data-slot="' + s + '">' + s + '</span>'
    }).join('')

    view().innerHTML =
      // 顶部最醒目：科学减肥科普视频（B站嵌入，无广告，封面即方法）
      '<div class="card sci-hero">' +
        '<div class="sci-head">🎬 科学减肥 · 不走弯路</div>' +
        '<div class="muted small" style="margin:4px 0 2px">权威科普：合理饮食 + 规律运动，拒绝液断 / 节食 / 饥饿</div>' +
        '<div class="video-wrap"><iframe src="https://player.bilibili.com/player.html?bvid=BV1Rh4y1c7s9&page=1&high_quality=1&danmaku=0&autoplay=0" allowfullscreen="true" scrolling="no" frameborder="0"></iframe></div>' +
        '<a class="video-link" href="https://www.bilibili.com/video/BV1Rh4y1c7s9" target="_blank" rel="noopener">B站原视频 ↗</a>' +
      '</div>' +
      (mealTip ? '<div class="card" style="background:#EAF6F2;color:#3C7A75">' + mealTip + '</div>' : '') +
      '<div class="hero" style="background:' + bmiColor + '">' +
        '<div class="hero-label">今日 BMI</div>' +
        '<div class="bmi-big">' + (c.bmi || '—') + '</div>' +
        '<div class="badge-bmi">' + bmiLabel + '</div>' +
        '<div class="hero-sub">体重 ' + (lw ? lw.weight + ' kg' : '未记录') + ' · 健康 ' + A.healthyRange(profile.height).low + '~' + A.healthyRange(profile.height).high + 'kg</div>' +
      '</div>' +

      card('今日体重', lw ? ('<div class="row"><span class="big-num">' + lw.weight + '</span><span class="unit">kg</span>' +
        (S.getWeights().length > 1 ? '' : '') + '</div>') : '<div class="muted">今天还没称重，去「体重」页记录～</div>',
        '去记录 ›', 'weight') +

      '<div class="card"><div class="row-between"><span class="card-title">💧 今日喝水</span><span class="link" data-go="settings">目标 ' + waterGoal + 'ml ›</span></div>' +
        '<div class="water-total">' + waterMl + ' / ' + waterGoal + ' ml</div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + waterPct + '%;background:#4A9FD6"></div></div>' +
        '<div class="slots">' + slotHtml + '</div>' +
        '<div class="remind-row" id="waterRemindRow"></div></div>' +

      '<div class="card"><div class="row-between"><span class="card-title">今日热量</span><span class="link" data-go="diet">去记录 ›</span></div>' +
        '<div class="row"><span class="kcal-now" style="font-size:26px;font-weight:800">' + todayKcal + '</span><span class="muted">/ ' + tgtKcal + ' kcal</span></div>' +
        (planActive ? '<div class="plan-flag" data-go="plan" style="cursor:pointer">📋 30天计划进行中 ›</div>' : '') +
        '<div class="bar"><div class="bar-fill" style="width:' + kcalPct + '%;background:' + (kcalPct > 90 ? '#E57373' : '#4E9C96') + '"></div></div>' +
        '<div class="n-row"><span class="n-name">蛋白质</span><div class="bar"><div class="bar-fill" style="width:' + nutriPct.protein + '%;background:#5BBF8A"></div></div><span class="n-val">' + p.protein + '/' + tp.protein.value + 'g</span></div>' +
        '<div class="n-row"><span class="n-name">碳水</span><div class="bar"><div class="bar-fill" style="width:' + nutriPct.carb + '%;background:#F2B705"></div></div><span class="n-val">' + p.carb + '/' + tp.carb.value + 'g</span></div>' +
        '<div class="n-row"><span class="n-name">脂肪</span><div class="bar"><div class="bar-fill" style="width:' + nutriPct.fat + '%;background:#F2994A"></div></div><span class="n-val">' + p.fat + '/' + tp.fat.value + 'g</span></div></div>' +

      exerciseRecordCard() +
      '<div class="card"><span class="card-title">明日体重预测</span><div style="font-size:20px;font-weight:700;margin-top:6px">' + predText + '</div>' +
        '<div class="muted small">基于今日摄入与基础代谢估算，仅供参考</div></div>'

    // 绑定
    view().querySelectorAll('[data-slot]').forEach(function (el) {
      el.onclick = function () {
        S.toggleWater(S.todayStr(), el.getAttribute('data-slot'))
        renderHome()
      }
    })
    view().querySelectorAll('[data-go]').forEach(function (el) {
      el.onclick = function () { if (el.getAttribute('data-go') === 'settings') openSettings(); else setTab(el.getAttribute('data-go')) }
    })
    view().querySelectorAll('[data-exid]').forEach(function (el) {
      el.onclick = function () {
        S.toggleExercise(S.todayStr(), el.getAttribute('data-exid'))
        renderHome()
      }
    })
    var rr = $('waterRemindRow')
    if (rr) renderWaterRemindRow(rr)
  }

  // 首页「今日运动」实时完成记录卡：与喝水/饮食同构，点动作打卡，去记录跳运动 Tab
  function exerciseRecordCard() {
    var plan = A.dailyExercisePlan(profile, currentWeight())
    var adv = plan.advice
    var moves = plan.moves
    var doneMap = S.getExercises(S.todayStr())
    var done = moves.filter(function (m) { return doneMap[m.id] }).length
    var total = moves.length
    var pct = total ? Math.round(done / total * 100) : 0
    var phaseColor = adv.phase === '减脂强化期' ? '#E57373' : adv.phase === '塑形进阶期' ? '#F2994A' : '#5BBF8A'
    var top = moves.slice(0, 4)
    var miniHtml = top.map(function (m) {
      var on = !!doneMap[m.id]
      return '<span class="ex-chip ' + (on ? 'on' : '') + '" data-exid="' + m.id + '">' + (on ? '✓ ' : '') + m.name + '</span>'
    }).join('')
    return '<div class="card ex-home">' +
      '<div class="row-between"><span class="card-title">💪 今日运动 · ' + adv.phase + '</span><span class="link" data-go="exercise">去记录 ›</span></div>' +
      '<div class="row"><span class="ex-done" style="font-size:24px;font-weight:800;color:' + phaseColor + '">' + done + '</span>' +
        '<span class="muted">/ ' + total + ' 项完成</span>' +
        '<span class="muted small" style="margin-left:auto;text-align:right">有氧' + adv.dailyAerobicMin + '′<br>+力量' + adv.dailyStrengthMin + '′</span></div>' +
      '<div class="bar"><div class="bar-fill" style="width:' + pct + '%;background:' + phaseColor + '"></div></div>' +
      '<div class="ex-chips">' + miniHtml + '</div>' +
      '<div class="muted small">' + adv.standard.split(' / ')[0] + ' · 当前体脂约 ' + adv.currentBF + '% / 目标 ' + adv.targetBF + '%</div>' +
    '</div>'
  }

  function mealSuggestion() {
    var h = new Date().getHours()
    if (h < 9) return '🌅 早上好，记得吃份营养早餐～'
    if (h < 13) return '🍱 午餐时间到，记录你吃了什么吧'
    if (h < 18) return '🍵 下午加个餐也别忘了记一下'
    return '🌙 晚餐清淡些，睡前别吃宵夜哦'
  }

  function card(title, body, linkText, tabName) {
    return '<div class="card"><div class="row-between"><span class="card-title">' + title + '</span>' +
      (linkText ? '<span class="link" data-go="' + tabName + '">' + linkText + '</span>' : '') + '</div>' + body + '</div>'
  }

  // 运动 Tab：依据体重 + 目标体脂率给出的每日方案（权威标准）+ 实时打卡 + 帕梅拉跟练
  function renderExercise() {
    var w = currentWeight()
    var plan = A.dailyExercisePlan(profile, w)
    var adv = plan.advice
    var moves = plan.moves
    var doneMap = S.getExercises(S.todayStr())
    var done = moves.filter(function (m) { return doneMap[m.id] }).length
    var total = moves.length
    var pct = total ? Math.round(done / total * 100) : 0
    var phaseColor = adv.phase === '减脂强化期' ? '#E57373' : adv.phase === '塑形进阶期' ? '#F2994A' : '#5BBF8A'
    var moveHtml = moves.map(function (m) {
      var on = !!doneMap[m.id]
      return '<div class="ex-row ' + (on ? 'done' : '') + '" data-exid="' + m.id + '">' +
        '<span class="ex-check">' + (on ? '✓' : '') + '</span>' +
        '<span class="ex-name">' + m.name + '</span>' +
        '<span class="ex-reps">' + m.amount + '</span>' +
        '<span class="ex-note">' + m.note + '</span></div>'
    }).join('')

    view().innerHTML =
      '<div class="page-title">🏃 每日运动</div>' +
      '<div class="card"><div class="row-between"><span class="card-title">今日完成进度</span>' +
        '<span class="badge-ex ' + (pct === 100 ? 'done' : '') + '">' + done + '/' + total + '</span></div>' +
        '<div class="bar" style="margin-top:8px"><div class="bar-fill" style="width:' + pct + '%;background:' + phaseColor + '"></div></div>' +
        (pct === 100 ? '<div class="muted small" style="color:#5BBF8A;margin-top:6px">🎉 今日运动达标，Hanna 为你点赞！</div>'
          : '') +
      '</div>' +

      '<div class="card ex-card">' +
        '<div class="card-title">💡 今日运动方案 · <span style="color:' + phaseColor + '">' + adv.phase + '</span></div>' +
        '<div class="muted small" style="margin:4px 0 2px">依据 ' + adv.standard + '：每周 ≥' + adv.weeklyAerobicMin + ' 分钟中等有氧（或 ≥' + adv.weeklyVigorousMin + ' 分钟高强度）+ ≥' + adv.strengthDays + ' 天力量训练（主要肌群）</div>' +
        '<div class="ex-summary">今日建议：有氧 ~' + adv.dailyAerobicMin + ' 分钟 + 力量 ~' + adv.dailyStrengthMin + ' 分钟（' + adv.trainingDays + ' 天 / 周）</div>' +
        '<div class="muted small">当前体脂率约 <b>' + adv.currentBF + '%</b> · 目标 <b>' + adv.targetBF + '%</b> · 差 ' + adv.gap + '%</div>' +
        '<div class="muted small" style="margin-top:2px">' + adv.note + '</div>' +
        '<div class="ex-list">' + moveHtml + '</div>' +
        '<div class="video-wrap"><iframe src="https://player.bilibili.com/player.html?bvid=BV1vzu36mEVd&page=1&high_quality=1&danmaku=0&autoplay=0" allowfullscreen="true" scrolling="no" frameborder="0"></iframe></div>' +
        '<a class="video-link" href="https://www.bilibili.com/video/BV1vzu36mEVd" target="_blank" rel="noopener">帕梅拉 40 分钟有氧燃脂（站立·瘦腹纤腿·含拉伸）跟练 ↗</a>' +
      '</div>'

    view().querySelectorAll('[data-exid]').forEach(function (el) {
      el.onclick = function () {
        S.toggleExercise(S.todayStr(), el.getAttribute('data-exid'))
        renderExercise(); refreshSprite()
      }
    })
  }

  // 首页喝水卡片：根据通知权限渲染「开启提醒」入口或已开启状态
  function renderWaterRemindRow(el) {
    if (!('Notification' in window)) {
      el.innerHTML = '<span class="muted small">当前浏览器不支持系统通知</span>'
      return
    }
    if (Notification.permission === 'granted') {
      el.innerHTML = settings.waterReminder
        ? '<span class="muted small">✅ 已开启定时喝水提醒（' + S.WATER_SLOTS.length + ' 个时段）</span>'
        : '<span class="muted small">提醒已关闭</span>'
      return
    }
    el.innerHTML = '<button class="mini-btn" id="waterAuthBtn">开启喝水提醒 💧</button>'
    var b = $('waterAuthBtn')
    if (b) b.onclick = requestWaterPermission
  }

  // ---------- 饮食 ----------
  function renderDiet() {
    var c = todayContext()
    var meals = ['breakfast', 'lunch', 'dinner', 'extra']
    var mealLabels = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', extra: '加餐' }
    var mealKcal = meals.map(function (m) { return c.diet[m].reduce(function (a, it) { return a + it.kcal }, 0) }).reduce(function (a, b) { return a + b }, 0)

    var tabsHtml = meals.map(function (m) {
      return '<div class="tab-meal ' + (dietState.meal === m ? 'active' : '') + '" data-meal="' + m + '">' + mealLabels[m] + ' ' + (c.diet[m].reduce(function (a, it) { return a + it.kcal }, 0)) + 'kcal</div>'
    }).join('')

    var list = c.diet[dietState.meal]
    var listHtml = list.length === 0 ? '<div class="muted small">还没有记录，下面挑点吃的吧～</div>'
      : list.map(function (it, i) {
        return '<div class="food-row"><div class="fr-left"><span class="fr-name">' + it.name + (it.black ? ' ⚠' : '') + '</span>' +
          '<span class="fr-sub">' + it.grams + 'g · ' + it.kcal + 'kcal · 蛋白' + it.protein + 'g</span></div>' +
          '<span class="fr-del" data-del="' + i + '">删除</span></div>'
      }).join('')

    var catsHtml = A.CATEGORIES.map(function (cat) {
      return '<span class="cat ' + (dietState.cat === cat.key ? 'active' : '') + '" data-cat="' + cat.key + '">' + cat.name + '</span>'
    }).join('')

    var foods = dietState.keyword ? A.search(dietState.keyword) : A.listByCat(dietState.cat)
    var gridHtml = foods.map(function (f) {
      return '<div class="food-item ' + (f.blackReason ? 'is-black' : '') + '" data-food="' + f.id + '">' +
        '<span class="fi-name">' + f.name + (f.blackReason ? ' ⚠' : '') + '</span>' +
        '<span class="fi-kcal">' + f.kcal + '/100g</span></div>'
    }).join('') || '<div class="muted">没找到相关食物</div>'

    view().innerHTML =
      '<div class="tabs">' + tabsHtml + '</div>' +
      '<div class="card"><div class="row-between"><span class="card-title">' + mealLabels[dietState.meal] + '已记录</span><span class="muted">' + mealKcal + ' kcal</span></div>' +
        '<div id="mealList">' + listHtml + '</div></div>' +
      '<div class="card recognize-card"><div class="card-title">🍽 自由输入识别</div>' +
        '<input class="search-input rec-input" id="recInput" placeholder="描述你吃了什么，如：中午吃了红烧肉和半碗米饭">' +
        '<button class="btn rec-btn" id="recBtn">识别</button>' +
        '<div id="recResult"></div></div>' +
      '<div class="search-bar"><input class="search-input" id="dietSearch" placeholder="搜索食物，如 鸡胸肉" value="' + dietState.keyword + '"></div>' +
      '<div class="cats">' + catsHtml + '</div>' +
      '<div class="food-grid" id="foodGrid">' + gridHtml + '</div>'

    // 绑定
    view().querySelectorAll('[data-meal]').forEach(function (el) {
      el.onclick = function () { dietState.meal = el.getAttribute('data-meal'); renderDiet() }
    })
    view().querySelectorAll('[data-cat]').forEach(function (el) {
      el.onclick = function () { dietState.cat = el.getAttribute('data-cat'); dietState.keyword = ''; var inp = $('dietSearch'); if (inp) inp.value = ''; renderDiet() }
    })
    view().querySelectorAll('[data-food]').forEach(function (el) {
      el.onclick = function () { openFoodSheet(el.getAttribute('data-food')) }
    })
    view().querySelectorAll('[data-del]').forEach(function (el) {
      el.onclick = function () {
        var i = parseInt(el.getAttribute('data-del'), 10)
        var arr = c.diet[dietState.meal]; arr.splice(i, 1); S.setDiet(S.todayStr(), c.diet)
        renderDiet(); refreshSprite()
      }
    })
    var inp = $('dietSearch')
    if (inp) inp.oninput = function () { dietState.keyword = inp.value; renderFoodGrid() }
    var rb = $('recBtn')
    if (rb) rb.onclick = recognizeFood
    var ri = $('recInput')
    if (ri) ri.onkeydown = function (e) { if (e.key === 'Enter') recognizeFood() }
  }

  function renderFoodGrid() {
    var grid = $('foodGrid')
    if (!grid) return
    var foods = dietState.keyword ? A.search(dietState.keyword) : A.listByCat(dietState.cat)
    grid.innerHTML = foods.map(function (f) {
      return '<div class="food-item ' + (f.blackReason ? 'is-black' : '') + '" data-food="' + f.id + '">' +
        '<span class="fi-name">' + f.name + (f.blackReason ? ' ⚠' : '') + '</span>' +
        '<span class="fi-kcal">' + f.kcal + '/100g</span></div>'
    }).join('') || '<div class="muted">没找到相关食物</div>'
    grid.querySelectorAll('[data-food]').forEach(function (el) {
      el.onclick = function () { openFoodSheet(el.getAttribute('data-food')) }
    })
  }

  function openFoodSheet(foodId) {
    var food = A.getById(foodId)
    dietState.sheet = { food: food, grams: 100 }
    var overlay = $('settingsOverlay')
    overlay.classList.remove('hidden')
    overlay.innerHTML =
      '<div class="mask"><div class="sheet">' +
        '<div class="sheet-title">' + food.name + (food.blackReason ? ' ⚠' : '') + '</div>' +
        '<div class="sheet-sub">' + (food.blackReason ? '⚠ ' + food.blackReason : '每100g: ' + food.kcal + 'kcal') + '</div>' +
        '<div class="grams-row"><span>克数</span><input class="grams-input" id="sheetGrams" type="number" value="100"><span>g</span></div>' +
        '<div class="preview" id="sheetPreview"></div>' +
        '<div class="sheet-btns"><div class="sheet-btn cancel" id="sheetCancel">取消</div><div class="sheet-btn ok" id="sheetOk">添加</div></div>' +
      '</div></div>'
    var g = $('sheetGrams')
    function preview() {
      var gr = parseFloat(g.value) || 0
      var it = A.computeItem(food, gr)
      $('sheetPreview').textContent = '约 ' + it.kcal + ' kcal · 蛋白' + it.protein + 'g · 碳水' + it.carb + 'g · 脂肪' + it.fat + 'g'
    }
    g.oninput = preview; preview()
    $('sheetCancel').onclick = closeSheet
    $('sheetOk').onclick = function () {
      var gr = parseFloat(g.value) || 0
      if (gr <= 0) { toast('请输入克数'); return }
      var it = A.computeItem(food, gr)
      var diet = S.getDiet(S.todayStr())
      diet[dietState.meal].push(it)
      S.setDiet(S.todayStr(), diet)
      closeSheet(); renderDiet(); refreshSprite()
      toast('已添加 ' + food.name)
    }
    overlay.querySelector('.mask').onclick = function (e) { if (e.target.classList.contains('mask')) closeSheet() }
  }
  function closeSheet() {
    dietState.sheet = null
    var overlay = $('settingsOverlay')
    overlay.classList.add('hidden'); overlay.innerHTML = ''
  }

  // ---------- 饮食：自由输入识别（调后端 /recognize） ----------
  function recognizeFood() {
    var inp = $('recInput')
    var text = (inp && inp.value || '').trim()
    if (!text) { toast('请输入你吃了什么'); return }
    var btn = $('recBtn'); if (btn) { btn.disabled = true; btn.textContent = '识别中…' }
    var box = $('recResult')
    if (box) box.innerHTML = '<div class="muted small">正在识别…</div>'
    var payload = JSON.stringify({ text: text, apiKey: (settings.llmApiKey || '') })
    fetch(PUSH_SERVER_URL + '/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j } })
    }).then(function (res) {
      if (btn) { btn.disabled = false; btn.textContent = '识别' }
      if (!res.ok || !res.j || !res.j.ok) {
        var msg = (res.j && res.j.error) || '识别失败'
        if (box) box.innerHTML = '<div class="muted small">识别失败：' + escapeHtml(msg) + '</div>'
        if (res.status === 503) toast('请先在「设置」填写大模型 API Key')
        return
      }
      renderRecResult(res.j.items || [])
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = '识别' }
      if (box) box.innerHTML = '<div class="muted small">网络错误：请确认后端已部署且可访问</div>'
    })
  }

  function renderRecResult(items) {
    var box = $('recResult')
    if (!box) return
    if (!items.length) { box.innerHTML = '<div class="muted small">没识别出食物，换个说法试试～</div>'; return }
    var html = items.map(function (it, i) {
      return '<label class="rec-item"><input type="checkbox" data-ri="' + i + '" checked>' +
        '<span class="ri-text"><span class="ri-name">' + escapeHtml(it.name) + '</span>' +
        '<span class="ri-sub">' + it.grams + 'g · ' + it.kcal + 'kcal · 蛋白' + it.protein + 'g</span></span></label>'
    }).join('')
    html += '<button class="btn" id="recAdd">加入' + ({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', extra: '加餐' }[dietState.meal]) + '</button>'
    box.innerHTML = html
    $('recAdd').onclick = function () {
      var meal = dietState.meal
      var diet = S.getDiet(S.todayStr())
      var added = 0
      items.forEach(function (it, i) {
        var cb = box.querySelector('[data-ri="' + i + '"]')
        if (cb && cb.checked) {
          diet[meal].push({
            foodId: null, name: it.name, grams: it.grams, cat: null,
            kcal: it.kcal, protein: it.protein, carb: it.carb, fat: it.fat, fiber: it.fiber,
            black: false, blackReason: ''
          })
          added++
        }
      })
      S.setDiet(S.todayStr(), diet)
      box.innerHTML = '<div class="muted small">已加入 ' + added + ' 项 ✓</div>'
      renderDiet(); refreshSprite()
      toast('已加入 ' + added + ' 项')
    }
  }

  // ---------- 体重 ----------
  function renderWeight() {
    var lw = S.getLatestWeight()
    var list = S.getWeights()
    var recent = list.slice(-7).reverse().map(function (it) {
      var b = A.calcBmi(it.weight, profile.height)
      var band = A.bandOf(b)
      return { date: it.date.slice(5), weight: it.weight, bmi: b, label: band.label, color: band.color }
    })
    var histHtml = recent.length === 0 ? '<div class="muted small">还没有记录，先称个体重吧～</div>'
      : recent.map(function (it) {
        return '<div class="hist-row"><span>' + it.date + '</span>' +
          '<span><b>' + it.weight + ' kg</b> · BMI ' + it.bmi + ' <span style="color:' + it.color + '">' + it.label + '</span></span></div>'
      }).join('')
    var spark = sparkline(list.slice(-14).map(function (i) { return i.weight }))

    view().innerHTML =
      '<div class="page-title">⚖️ 记录体重</div>' +
      '<div class="card"><div class="card-title">今日称重</div>' +
        '<input class="w-input" id="wInput" type="number" inputmode="decimal" placeholder="输入今日体重 kg" value="">' +
        '<button class="btn" id="wSave">保存今日体重</button>' +
        '<div id="wBmi" class="muted small" style="margin-top:8px"></div></div>' +
      (spark ? '<div class="card"><div class="card-title">近期趋势</div>' + spark + '</div>' : '') +
      '<div class="card"><div class="card-title">历史（最近 7 次）</div><div class="hist">' + histHtml + '</div></div>'

    var inp = $('wInput')
    var bmiBox = $('wBmi')
    function upd() {
      var n = parseFloat(inp.value)
      if (n > 0) { var b = A.calcBmi(n, profile.height); var band = A.bandOf(b); bmiBox.textContent = 'BMI ' + b + ' · ' + band.label; bmiBox.style.color = band.color }
      else { bmiBox.textContent = '' }
    }
    inp.oninput = upd
    $('wSave').onclick = function () {
      var n = parseFloat(inp.value)
      if (!n || n <= 0) { toast('请输入有效体重'); return }
      S.addWeight({ date: S.todayStr(), weight: n })
      toast('已记录 ' + n + ' kg')
      renderWeight(); refreshSprite()
    }
  }

  function sparkline(arr) {
    if (arr.length < 2) return ''
    var w = 320, h = 90, pad = 8
    var min = Math.min.apply(null, arr), max = Math.max.apply(null, arr)
    var span = (max - min) || 1
    var pts = arr.map(function (v, i) {
      var x = pad + i * (w - 2 * pad) / (arr.length - 1)
      var y = h - pad - (v - min) / span * (h - 2 * pad)
      return x.toFixed(1) + ',' + y.toFixed(1)
    }).join(' ')
    var last = arr[arr.length - 1], first = arr[0]
    var color = last <= first ? '#5BBF8A' : '#E57373'
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      arr.map(function (v, i) { var p = pts.split(' ')[i]; return '<circle cx="' + p.split(',')[0] + '" cy="' + p.split(',')[1] + '" r="2.5" fill="' + color + '"/>' }).join('') +
      '</svg>'
  }

  // ---------- 计划 ----------
  function renderPlan() {
    var plan = S.getPlan()
    if (!plan) {
      var lw = S.getLatestWeight()
      var curW = lw ? lw.weight : profile.targetWeight
      var tdeeNow = A.predict(profile, curW, 0, 0).tdee
      var safeMax = Math.max(Math.round(tdeeNow - 500), 1200)
      var safeMin = 1200
      view().innerHTML =
        '<div class="page-title">📋 30天减肥计划</div>' +
        '<div class="card"><div class="card-title">制定你的计划</div>' +
          '<div class="field"><label>当前体重 (kg)</label><input id="pCur" type="number" value="' + curW + '"></div>' +
          '<div class="field"><label>目标体重 (kg)</label><input id="pTgt" type="number" value="' + profile.targetWeight + '"></div>' +
          '<div class="field"><label>目标体脂率 (%)</label><input id="pTbf" type="number" value="' + (profile.targetBodyFat != null ? profile.targetBodyFat : (profile.gender === 'female' ? 24 : 18)) + '"></div>' +
          '<div class="field"><label>当前体脂率 (%) 选填</label><input id="pCbf" type="number" value="' + (profile.currentBodyFat != null ? profile.currentBodyFat : '') + '" placeholder="留空按身高体重估算"></div>' +
          '<div class="field"><label>周期 (天)</label><input id="pDur" type="number" value="30"></div>' +
          '<div class="field"><label>每日摄入热量 (kcal)</label><input id="pKcal" type="number" value="' + safeMax + '" placeholder="留空按安全缺口自动"></div>' +
          '<div class="muted small" style="margin-top:-4px">推荐范围 ' + safeMin + '~' + tdeeNow + ' kcal（你的 TDEE≈' + tdeeNow + '），不低于 1200 kcal 安全下限；超过 TDEE 不会掉秤</div>' +
          '<button class="btn" id="pBuild" style="margin-top:14px">生成计划</button>' +
          '<div class="muted small" style="margin-top:10px">基于 Mifflin-St Jeor 基础代谢与 7700kcal≈1kg 脂肪，安全缺口 ≤500kcal/天；运动建议依据 WHO/ACSM 与你的目标体脂率</div>' +
        '</div>'
      $('pBuild').onclick = function () {
        var cur = parseFloat($('pCur').value), tgt = parseFloat($('pTgt').value), dur = parseInt($('pDur').value) || 30
        if (!cur || !tgt) { toast('请填写完整'); return }
        var tbf = parseFloat($('pTbf').value)
        if (!isFinite(tbf) || tbf <= 0) { toast('请填写目标体脂率'); return }
        var cbfRaw = $('pCbf').value
        var cbf = cbfRaw === '' || cbfRaw == null ? null : parseFloat(cbfRaw)
        if (cbf !== null && (!isFinite(cbf) || cbf <= 0)) { toast('当前体脂率请填正数或留空'); return }
        profile = S.saveProfile({ targetBodyFat: tbf, currentBodyFat: cbf })
        var kcalRaw = $('pKcal').value
        var userIntake = kcalRaw === '' || kcalRaw === null ? null : parseFloat(kcalRaw)
        if (userIntake !== null && (!isFinite(userIntake) || userIntake <= 0)) { toast('每日摄入热量请填正数或留空'); return }
        var p = A.buildPlan(profile, cur, tgt, dur, userIntake)
        S.setPlan(p); toast('计划已生成'); renderPlan(); refreshSprite()
      }
      return
    }
    var b = A.bandOf(A.calcBmi(plan.currentWeight, profile.height))
    var c = todayContext()
    var lw = S.getLatestWeight()
    var progress = lw ? clamp(Math.round((plan.currentWeight - lw.weight) / (plan.currentWeight - plan.targetWeight || 1) * 100), 0, 100) : 0
    var budget = plan.budget
    var distHtml = plan.distribution.map(function (d) {
      return '<div class="dist"><span class="dist-group">' + d.group + ' ' + d.grams + '</span><div class="dist-note">' + d.note + '</div></div>'
    }).join('')
    var menuHtml = plan.sampleMenu.map(function (m) {
      return '<div class="hist-row"><span>' + m.meal + ' · ' + m.name + ' ' + m.grams + 'g</span><span class="muted">' + m.kcal + 'kcal</span></div>'
    }).join('')

    view().innerHTML =
      '<div class="page-title">📋 我的减肥计划</div>' +
      '<div class="card"><div class="plan-flag">进行中 · ' + plan.duration + '天</div>' +
        '<div class="kv"><span>当前体重</span><span>' + plan.currentWeight + ' kg</span></div>' +
        '<div class="kv"><span>目标体重</span><span>' + plan.targetWeight + ' kg</span></div>' +
        '<div class="kv"><span>每日热量预算</span><span>' + budget.kcal + ' kcal' + (plan.userIntake ? '（你设定）' : '（自动推导）') + '</span></div>' +
        '<div class="kv"><span>预计达成</span><span>' + plan.realisticDays + ' 天（' + plan.endDate + '）</span></div>' +
        (plan.lowIntakeWarn ? '<div class="muted small" style="color:#E57373;margin-top:6px">⚠ 你设定的每日摄入低于 1200 kcal 安全下限，长期可能流失肌肉/降低代谢，请谨慎并留意身体反应</div>' : '') +
        (plan.feasible30 ? '' : '<div class="muted small" style="color:#E57373;margin-top:6px">⚠ 按安全缺口，30天内较难达标，建议延长周期或微调目标</div>') +
        '<div class="bar" style="margin-top:10px"><div class="bar-fill" style="width:' + progress + '%;background:#4E9C96"></div></div>' +
        '<div class="muted small" style="text-align:center">已推进 ' + progress + '%</div></div>' +

      '<div class="card"><div class="card-title">每日营养预算</div>' +
        '<div class="n-row"><span class="n-name">热量</span><div class="bar"></div><span class="n-val">' + budget.kcal + ' kcal</span></div>' +
        '<div class="n-row"><span class="n-name">蛋白质</span><div class="bar"></div><span class="n-val">' + budget.protein + ' g</span></div>' +
        '<div class="n-row"><span class="n-name">碳水</span><div class="bar"></div><span class="n-val">' + budget.carb + ' g</span></div>' +
        '<div class="n-row"><span class="n-name">脂肪</span><div class="bar"></div><span class="n-val">' + budget.fat + ' g</span></div>' +
        '<div class="n-row"><span class="n-name">膳食纤维</span><div class="bar"></div><span class="n-val">' + budget.fiber + ' g</span></div></div>' +

      '<div class="card"><div class="card-title">🏃 运动建议（每周）</div>' +
        (plan.exerciseAdvice ? (function (ea) {
          return '<div class="ex-summary">阶段：<b>' + ea.phase + '</b>（当前体脂约 ' + ea.currentBF + '% · 目标 ' + ea.targetBF + '%）</div>' +
            '<div class="n-row"><span class="n-name">中等有氧</span><div class="bar"></div><span class="n-val">≥' + ea.weeklyAerobicMin + ' 分</span></div>' +
            '<div class="n-row"><span class="n-name">高强度(等效)</span><div class="bar"></div><span class="n-val">≥' + ea.weeklyVigorousMin + ' 分</span></div>' +
            '<div class="n-row"><span class="n-name">力量训练</span><div class="bar"></div><span class="n-val">≥' + ea.strengthDays + ' 天</span></div>' +
            '<div class="muted small" style="margin-top:6px">每日拆分：有氧 ~' + ea.dailyAerobicMin + ' 分钟 + 力量 ~' + ea.dailyStrengthMin + ' 分钟（' + ea.trainingDays + ' 天 / 周）</div>' +
            '<div class="muted small" style="margin-top:2px">' + ea.note + '</div>' +
            '<div class="muted small" style="margin-top:2px">依据：' + ea.standard + '</div>'
        })(plan.exerciseAdvice) : '<div class="muted small">未生成运动建议</div>') + '</div>' +

      '<div class="card"><div class="card-title">膳食宝塔分配</div>' + distHtml + '</div>' +
      '<div class="card"><div class="card-title">示意一日菜单</div>' + menuHtml + '</div>' +
      '<button class="btn" id="pReset" style="background:#EEF3F2;color:#8AA09C">重新制定计划</button>'
    $('pReset').onclick = function () { S.setPlan(null); renderPlan(); refreshSprite() }
  }

  // （原「分析」Tab 已移除：明日体重预测已并入首页 renderHome；三大营养素/趋势仍可在饮食/体重页查看）

  // （原「健康科普」Tab 已移除：科普视频已移至首页顶部 renderHome 的 sci-hero 卡片，改用 B站嵌入、无广告）

  // ============================================================
  //  设置面板
  // ============================================================
  var ACTS = [
    { label: '久坐', v: 1.2 }, { label: '轻度', v: 1.375 },
    { label: '中度', v: 1.55 }, { label: '高强度', v: 1.725 }
  ]
  function openSettings() {
    profile = S.getProfile(); settings = S.getSettings()
    var actIdx = ACTS.findIndex(function (a) { return a.v === profile.activityFactor }); if (actIdx < 0) actIdx = 0
    var tbf = profile.targetBodyFat != null ? profile.targetBodyFat : (profile.gender === 'female' ? 24 : 18)
    var cbf = profile.currentBodyFat != null ? profile.currentBodyFat : ''
    var overlay = $('settingsOverlay')
    overlay.classList.remove('hidden')
    overlay.innerHTML =
      '<div class="mask"><div class="panel">' +
        '<h3>⚙ 设置</h3>' +
        '<div class="field"><label>身高 (cm)</label><input id="sH" type="number" value="' + profile.height + '"></div>' +
        '<div class="field"><label>年龄</label><input id="sA" type="number" value="' + profile.age + '"></div>' +
        '<div class="field"><label>目标体重 (kg)</label><input id="sT" type="number" value="' + profile.targetWeight + '"></div>' +
        '<div class="field"><label>目标体脂率 (%)</label><input id="sTBF" type="number" value="' + tbf + '"></div>' +
        '<div class="field"><label>当前体脂率 (%) 选填</label><input id="sCBF" type="number" value="' + cbf + '" placeholder="留空按身高体重估算"></div>' +
        '<div class="field"><label>性别</label><div class="seg" id="sG">' +
          '<button data-g="female" class="' + (profile.gender === 'female' ? 'on' : '') + '">女</button>' +
          '<button data-g="male" class="' + (profile.gender === 'male' ? 'on' : '') + '">男</button></div></div>' +
        '<div class="field"><label>活动量</label><div class="acts" id="sAct">' +
          ACTS.map(function (a, i) { return '<button data-act="' + i + '" class="' + (i === actIdx ? 'on' : '') + '">' + a.label + '</button>' }).join('') +
        '</div></div>' +
        '<div class="field"><label>每日饮水目标 (ml)</label><input id="sW" type="number" value="' + settings.waterGoalMl + '"></div>' +
        '<div class="field"><label>大模型 API Key（食物识别，选填）</label><input id="sKey" type="text" value="' + escapeAttr(settings.llmApiKey || '') + '" placeholder="DeepSeek / OpenAI Key，留空则无法识别"></div>' +
        '<div class="switch-row"><span>饮水提醒</span><input type="checkbox" id="sWR" ' + (settings.waterReminder ? 'checked' : '') + '></div>' +
        '<div class="switch-row"><span>饭点提醒</span><input type="checkbox" id="sMR" ' + (settings.mealReminder ? 'checked' : '') + '></div>' +
        '<div class="switch-row"><span>背景纯音乐</span><input type="checkbox" id="sBM" ' + (settings.bgMusic ? 'checked' : '') + '></div>' +
        '<button class="btn" id="sSave" style="margin-top:8px">保存</button>' +
        '<button class="btn" id="sClear" style="background:#EEF3F2;color:#8AA09C;margin-top:10px">清空所有数据</button>' +
      '</div></div>'
    overlay.querySelector('.mask').onclick = function (e) { if (e.target.classList.contains('mask')) closeSettings() }
    overlay.querySelectorAll('#sG button').forEach(function (b) { b.onclick = function () { overlay.querySelectorAll('#sG button').forEach(function (x) { x.classList.remove('on') }); b.classList.add('on') } })
    overlay.querySelectorAll('#sAct button').forEach(function (b) { b.onclick = function () { overlay.querySelectorAll('#sAct button').forEach(function (x) { x.classList.remove('on') }); b.classList.add('on') } })
    $('sSave').onclick = function () {
      var h = parseFloat($('sH').value), a = parseInt($('sA').value), t = parseFloat($('sT').value)
      if (!h || !a || !t) { toast('请填写完整'); return }
      var tbf = parseFloat($('sTBF').value)
      if (!isFinite(tbf) || tbf <= 0) { toast('请填写目标体脂率'); return }
      var cbfRaw = $('sCBF').value
      var cbf = cbfRaw === '' || cbfRaw == null ? null : parseFloat(cbfRaw)
      if (cbf !== null && (!isFinite(cbf) || cbf <= 0)) { toast('当前体脂率请填正数或留空'); return }
      var g = overlay.querySelector('#sG button.on').getAttribute('data-g')
      var ai = parseInt(overlay.querySelector('#sAct button.on').getAttribute('data-act'), 10)
      profile = S.saveProfile({ height: h, age: a, targetWeight: t, gender: g, activityFactor: ACTS[ai].v, targetBodyFat: tbf, currentBodyFat: cbf })
      settings = S.saveSettings({ waterGoalMl: parseInt($('sW').value) || 1700, waterReminder: $('sWR').checked, mealReminder: $('sMR').checked, bgMusic: $('sBM').checked, llmApiKey: ($('sKey').value || '').trim() })
      if (window.SlimMusic) window.SlimMusic.setEnabled($('sBM').checked)
      if (settings.waterReminder) requestWaterPermission(); else { stopWaterScheduler(); unsubscribeFromPush() }
      if (settings.mealReminder) setupMealReminder(); else { stopMealScheduler() }
      closeSettings(); renderTab(); refreshSprite(); toast('已保存')
    }
    $('sClear').onclick = function () { if (confirm('确定清空所有体重/饮食/计划数据？')) { S.clearAll(); profile = S.getProfile(); settings = S.getSettings(); closeSettings(); renderTab(); refreshSprite(); toast('已清空') } }
  }
  function closeSettings() { var o = $('settingsOverlay'); o.classList.add('hidden'); o.innerHTML = '' }

  // ============================================================
  //  浮动小精灵（拖拽 + 跟随触点 + 动态气泡 + 三态情绪）
  // ============================================================
  var spriteEl, bubbleEl, sSize = 64
  var sx = 16, sy = 0, tx = 16, ty = 0, dragging = false, dragOX = 0, dragOY = 0, moved = false
  var EASE = 0.18
  var spritePos = null

  function initSprite() {
    spriteEl = document.createElement('div')
    spriteEl.id = 'sprite'
    spriteEl.className = 'bob'
    spriteEl.innerHTML = '<img alt="精灵"/><div class="bubble hidden"></div>'
    document.body.appendChild(spriteEl)
    bubbleEl = spriteEl.querySelector('.bubble')

    try { spritePos = JSON.parse(localStorage.getItem('slimpix.sprite_pos') || 'null') } catch (e) {}
    var W = window.innerWidth, H = window.innerHeight
    if (spritePos && typeof spritePos.x === 'number') { sx = spritePos.x; sy = spritePos.y } else { sx = 16; sy = Math.max(120, H - sSize - 140) }
    clampSprite()
    tx = sx; ty = sy
    place()

    // 仅拖拽时跟随触点：非拖拽时精灵停在原来位置（带呼吸动画），不挡按钮
    document.addEventListener('pointermove', function (e) {
      if (!dragging) return
      var px = e.clientX, py = e.clientY
      sx = clamp(px - dragOX, 0, window.innerWidth - sSize); sy = clamp(py - dragOY, 0, window.innerHeight - sSize); moved = true; clampSprite(); place()
    })
    // 按下精灵：进入拖拽
    spriteEl.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false
      var r = spriteEl.getBoundingClientRect(); dragOX = e.clientX - r.left; dragOY = e.clientY - r.top
      spriteEl.classList.add('dragging'); spriteEl.classList.remove('bob')
      try { spriteEl.setPointerCapture(e.pointerId) } catch (e2) {}
    })
    spriteEl.addEventListener('pointerup', function () {
      dragging = false; tx = sx; ty = sy
      spriteEl.classList.remove('dragging'); spriteEl.classList.add('bob')
      if (!moved) toggleBubble()
      else { try { localStorage.setItem('slimpix.sprite_pos', JSON.stringify({ x: sx, y: sy })) } catch (e) {} }
    })
    spriteEl.addEventListener('pointercancel', function () { dragging = false; tx = sx; ty = sy; spriteEl.classList.remove('dragging'); spriteEl.classList.add('bob') })

    loop()
  }

  function clampSprite() {
    var W = window.innerWidth, H = window.innerHeight
    var topSafe = 96, bottomSafe = 96  // 远离顶部 header 与底部 tabbar，避免遮挡点击
    sx = clamp(sx, 0, Math.max(0, W - sSize))
    sy = clamp(sy, topSafe, Math.max(topSafe, H - sSize - bottomSafe))
  }
  function place() { spriteEl.style.left = sx + 'px'; spriteEl.style.top = sy + 'px' }
  function loop() {
    if (!dragging) {
      sx += (tx - sx) * EASE; sy += (ty - sy) * EASE
      if (Math.abs(tx - sx) > 0.3 || Math.abs(ty - sy) > 0.3) place()
    }
    requestAnimationFrame(loop)
  }

  function setSpriteMood(mood) {
    var src = (SPR && SPR[mood.mood]) || ''
    spriteEl.querySelector('img').src = src
    spriteEl.style.setProperty('--mood', mood.color)
  }
  function showBubble(text) {
    if (!text) return
    bubbleEl.textContent = text
    bubbleEl.classList.remove('hidden')
    clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(function () { bubbleEl.classList.add('hidden') }, 4500)
  }
  // 精灵语音：点击时朗读提示词。尽量挑自然中文嗓音 + 调参去除"机器朗读"感
  var cachedVoices = []
  function loadVoices() {
    try { cachedVoices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [] } catch (e) { cachedVoices = [] }
  }
  if (window.speechSynthesis) {
    loadVoices()
    try { window.speechSynthesis.onvoiceschanged = loadVoices } catch (e2) {}
  }
  function pickVoice() {
    if (!cachedVoices.length) return null
    var best = null
    for (var i = 0; i < cachedVoices.length; i++) {
      var n = (cachedVoices[i].name || '') + ' ' + (cachedVoices[i].lang || '')
      if (/zh|cmn|Chinese|中文|普通话|國語/i.test(n)) {
        best = cachedVoices[i]
        if (/(Google|Ting|Yue|Natural|Premium|Female|女|yaoyao|Mei|Hui|Kangkang|Xiaoxiao|Yun|Shanshan|Yaoyao)/i.test(n)) break
      }
    }
    return best
  }
  function speak(text) {
    if (!text) return
    var synth = window.speechSynthesis
    if (!synth) return
    try {
      synth.cancel()
      var u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-CN'
      u.rate = 0.98   // 略慢一点点，更像真人说话、不像机器朗读
      u.pitch = 1.0   // 不抬高音调，避免"电音 / 童音"感
      u.volume = 1.0
      var v = pickVoice()
      if (v) u.voice = v
      try { if (synth.resume) synth.resume() } catch (e2) {}  // iOS 有时需先 resume 才发声
      synth.speak(u)
    } catch (e) {}
  }
  function toggleBubble() {
    if (bubbleEl.classList.contains('hidden')) { var t = spriteTextFor(tab); showBubble(t); speak(t) }
    else { bubbleEl.classList.add('hidden'); clearTimeout(bubbleTimer) }
  }

  // 各 Tab 的精灵提示文案
  function spriteTextFor(which) {
    var c = todayContext()
    if (which === 'weight') return c.bmi ? ('当前 BMI ' + c.bmi + '（' + c.band.label + '），坚持记录就能看到变化～') : '称个体重，看看今天的 BMI 吧～'
    if (which === 'plan') {
      if (!c.plan) return '还没有计划哦，去「计划」页定制一个 30 天目标吧！'
      return '计划进行中，每天按 ' + c.plan.dailyIntake + ' kcal 预算吃，Hanna 陪你达成 ' + c.plan.targetWeight + 'kg！'
    }
    if (which === 'exercise') {
      var ep = A.dailyExercisePlan(profile, c.w)
      return '今天运动方案：' + ep.advice.phase + '，有氧 ~' + ep.advice.dailyAerobicMin + ' 分钟 + 力量 ~' + ep.advice.dailyStrengthMin + ' 分钟，点动作就能打卡哦～'
    }
    // home / diet：用情绪系统
    var mood = A.moodFor(c.sum, c.band, c.tgt)
    return mood.text
  }

  function refreshSprite() {
    // 计算情绪以更新造型（首页/饮食等均以情绪系统驱动）
    var c = todayContext()
    var mood = A.moodFor(c.sum, c.band, c.tgt)
    setSpriteMood(mood)
  }

  // Tab 切换时让精灵说一句
  function announce() { showBubble(spriteTextFor(tab)) }

  // ============================================================
  //  Tab 切换
  // ============================================================
  function renderTab() {
    if (tab === 'home') renderHome()
    else if (tab === 'diet') renderDiet()
    else if (tab === 'weight') renderWeight()
    else if (tab === 'exercise') renderExercise()
    else if (tab === 'plan') renderPlan()
    refreshSprite()
  }
  function setTab(name) {
    tab = name
    document.querySelectorAll('#tabbar .tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name) })
    renderTab()
    announce()
  }

  // ============================================================
  //  喝水提醒（Notification + 定时检查；App 打开时生效）
  //  说明：纯前端 PWA 无法实现「App 关闭时」的后台推送（那需要 VAPID + 后端推送服务）。
  //  这里的方案是：App 处于打开/后台保活状态时，到点用系统通知 + 提示音提醒喝水。
  // ============================================================
  var waterSchedulerId = null
  var waterNotified = {}
  function loadWaterNotified() {
    try { waterNotified = S.getReminderLog(S.todayStr()) || {} } catch (e) { waterNotified = {} }
  }
  function slotDate(slot) {
    var p = slot.split(':'); var d = new Date()
    d.setHours(+p[0], +p[1], 0, 0); return d
  }
  function fireWaterNotification(slot) {
    // 已订阅 Web Push（后台可关 App 推送）时，系统通知交由后台发送，这里不再重复弹；否则用本地通知兜底
    try {
      if ('Notification' in window && Notification.permission === 'granted' && !S.getPush().subscribed) {
        new Notification('该喝水啦 💧', {
          body: '现在是 ' + slot + '，喝一杯温水（约 250ml）有助代谢～',
          tag: 'slimpix-water-' + slot, icon: 'icon.svg'
        })
      }
    } catch (e) {}
    if (window.SlimMusic && window.SlimMusic.chime) window.SlimMusic.chime()
    toast('💧 该喝水啦（' + slot + '）')
  }
  function checkWaterReminder() {
    if (!settings.waterReminder) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    var now = new Date()
    S.WATER_SLOTS.forEach(function (slot) {
      var sd = slotDate(slot)
      var diffMin = (now - sd) / 60000
      // 仅在该时段过后 30 分钟内、且今天尚未提醒过时，推送一次
      if (diffMin >= 0 && diffMin <= 30 && !waterNotified[slot]) {
        waterNotified[slot] = true
        S.markReminder(S.todayStr(), slot)
        fireWaterNotification(slot)
      }
    })
  }
  function startWaterScheduler() {
    if (waterSchedulerId) return
    loadWaterNotified()
    checkWaterReminder() // 立即检查一次（若已过点且今天未提醒）
    waterSchedulerId = setInterval(checkWaterReminder, 30000)
  }
  function stopWaterScheduler() {
    if (waterSchedulerId) { clearInterval(waterSchedulerId); waterSchedulerId = null }
  }
  function setupWaterReminder() {
    if (settings.waterReminder && 'Notification' in window && Notification.permission === 'granted') startWaterScheduler()
  }
  // ===================== 饭点提醒（与喝水提醒同构：早8 / 中12 / 晚6） =====================
  var mealSchedulerId = null
  var mealNotified = {}
  function loadMealNotified() {
    try { mealNotified = S.getReminderLog(S.todayStr() + ':meal') || {} } catch (e) { mealNotified = {} }
  }
  function fireMealNotification(slot) {
    // 已订阅 Web Push（后台可关 App 推送）时，系统通知交由后台发送，这里不再重复弹；否则用本地通知兜底
    try {
      if ('Notification' in window && Notification.permission === 'granted' && !S.getPush().subscribed) {
        new Notification('该吃饭啦 🍚', {
          body: '现在是 ' + slot + '，记得按时吃饭、记录一下哦～',
          tag: 'slimpix-meal-' + slot, icon: 'icon.svg'
        })
      }
    } catch (e) {}
    if (window.SlimMusic && window.SlimMusic.chime) window.SlimMusic.chime()
    toast('🍚 该吃饭啦（' + slot + '）')
  }
  function checkMealReminder() {
    if (!settings.mealReminder) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    var now = new Date()
    S.MEAL_SLOTS.forEach(function (slot) {
      var sd = slotDate(slot)
      var diffMin = (now - sd) / 60000
      // 仅在该时段过后 30 分钟内、且今天尚未提醒过时，推送一次
      if (diffMin >= 0 && diffMin <= 30 && !mealNotified[slot]) {
        mealNotified[slot] = true
        S.markReminder(S.todayStr() + ':meal', slot)
        fireMealNotification(slot)
      }
    })
  }
  function startMealScheduler() {
    if (mealSchedulerId) return
    loadMealNotified()
    checkMealReminder() // 立即检查一次（若已过点且今天未提醒）
    mealSchedulerId = setInterval(checkMealReminder, 30000)
  }
  function stopMealScheduler() {
    if (mealSchedulerId) { clearInterval(mealSchedulerId); mealSchedulerId = null }
  }
  function setupMealReminder() {
    if (settings.mealReminder && 'Notification' in window && Notification.permission === 'granted') startMealScheduler()
  }
  // ===================== Web Push 订阅（让后台能关 App 也推送） =====================
  // 当前提醒偏好，随订阅一并上报后端（后端据此决定是否推送水/饭点）
  function pushPrefs() {
    return { water: !!settings.waterReminder, meal: !!settings.mealReminder }
  }
  function subscribeToPush() {
    if (!pushEnabled()) return false
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { toast('当前浏览器不支持 Web 推送'); return false }
    try {
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
      }).then(function (sub) {
        return fetch(PUSH_SERVER_URL + '/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub, prefs: pushPrefs() })
        }).then(function (res) {
          if (!res.ok) throw new Error('subscribe failed')
          S.setPush({ subscribed: true, endpoint: sub.endpoint })
          toast('已开启「关 App 也提醒」 💧')
        })
      }).catch(function (err) { console.warn('subscribeToPush error', err); S.setPush({ subscribed: false, endpoint: null }) })
    } catch (e) { console.warn('subscribeToPush sync error', e) }
    return false
  }
  function unsubscribeFromPush() {
    var st = S.getPush()
    if (!st.subscribed) return
    try {
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription()
      }).then(function (sub) {
        if (sub) {
          fetch(PUSH_SERVER_URL + '/unsubscribe', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint })
          }).catch(function () {})
          return sub.unsubscribe()
        }
      }).then(function () { S.setPush({ subscribed: false, endpoint: null }) }).catch(function () {})
    } catch (e) {}
  }
  // 静默兜底：本地曾订阅(subscribed=true)但后端可能因 Render 重启丢了记录时，
  // 重新把设备现有 PushSubscription 推给后端 /subscribe（幂等），修复丢订阅。
  function ensureSubscribed() {
    var st = S.getPush()
    if (!st.subscribed) return
    if (!pushEnabled()) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription()
      }).then(function (sub) {
        if (!sub) { S.setPush({ subscribed: false, endpoint: null }); return } // OS 层已取消，清本地标记
        return fetch(PUSH_SERVER_URL + '/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub, prefs: pushPrefs() })
        }).catch(function () {})
      }).catch(function (err) { console.warn('ensureSubscribed error', err) })
    } catch (e) {}
  }

  function requestWaterPermission() {
    if (!('Notification' in window)) { toast('当前浏览器不支持系统通知'); return }
    function afterGrant() {
      toast('喝水提醒已开启 💧'); startWaterScheduler(); subscribeToPush(); if (tab === 'home') renderHome()
    }
    if (Notification.permission === 'granted') { afterGrant(); return }
    function done(p) {
      if (p === 'granted') { afterGrant() }
      else { toast('未授权，将无法收到提醒') }
      if (tab === 'home') renderHome()
    }
    try { var pr = Notification.requestPermission(function (p) { done(p) }); if (pr && pr.then) pr.then(done) } catch (e) {}
  }

  // ============================================================
  //  启动
  // ============================================================
  // 开屏：渐变动效 + 健康食物大碗 + 点击「进入」播放轻提示音
  function initSplash() {
    var sp = document.getElementById('splash')
    if (!sp) return
    var enter = document.getElementById('splashEnter')
    var done = false
    function playIntro() {
      try {
        var AC = window.AudioContext || window.webkitAudioContext
        if (AC) {
          var ac = new AC()
          if (ac.resume) ac.resume()
          var t0 = ac.currentTime
          ;[523.25, 659.25, 783.99].forEach(function (f, i) {
            var o = ac.createOscillator(), g = ac.createGain()
            o.type = 'sine'; o.frequency.value = f
            var s = t0 + i * 0.13
            g.gain.setValueAtTime(0.0001, s)
            g.gain.linearRampToValueAtTime(0.18, s + 0.02)
            g.gain.exponentialRampToValueAtTime(0.0001, s + 0.5)
            o.connect(g).connect(ac.destination)
            o.start(s); o.stop(s + 0.55)
          })
        }
      } catch (e) {}
    }
    function close() {
      if (done) return
      done = true
      sp.classList.add('hide')
      setTimeout(function () { sp.style.display = 'none' }, 700)
    }
    function startBgmIfEnabled() {
      try { if (settings.bgMusic && window.SlimMusic && !window.SlimMusic.isEnabled()) window.SlimMusic.start() } catch (e) {}
    }
    if (enter) enter.addEventListener('click', function (e) { e.stopPropagation(); playIntro(); startBgmIfEnabled(); close() })
    sp.addEventListener('click', function () { playIntro(); startBgmIfEnabled(); close() })
    setTimeout(close, 5000) // 无交互时 5 秒自动进入
  }

  function boot() {
    initSprite()
    initSplash()
    // 首次任意点击兜底启动背景纯音乐（若已开启且尚未播放，满足浏览器自动播放策略）
    document.addEventListener('pointerdown', function () {
      try { if (settings.bgMusic && window.SlimMusic && !window.SlimMusic.isEnabled()) window.SlimMusic.start() } catch (e) {}
    }, { once: true })
    document.querySelectorAll('#tabbar .tab').forEach(function (b) { b.onclick = function () { setTab(b.getAttribute('data-tab')) } })
    $('topbarGear').onclick = openSettings
    // 首次进入提示
    if (!S.getLatestWeight() && !S.getPlan()) {
      toast('欢迎使用 Fiona的减肥记录仪')
    }
    renderTab()
    setTimeout(announce, 600)
    setupWaterReminder()
    setupMealReminder()

    // PWA service worker（仅在 http(s) 下注册）
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {})
    }
    // 静默兜底：若此前已订阅但后端记录丢失（Render 重启），重新注册订阅
    ensureSubscribed()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
