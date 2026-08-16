// 主应用（网页版）—— 纯原生 JS SPA
// 依赖全局：SlimAlgo（算法）、SlimStore（存储）、SlimSprites / SlimSpriteColors（精灵 SVG）
(function () {
  'use strict'

  var A = window.SlimAlgo
  var S = window.SlimStore
  var SPR = window.SlimSprites
  var SCOL = window.SlimSpriteColors

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
      (mealTip ? '<div class="card" style="background:#EAF6F2;color:#3C7A75">' + mealTip + '</div>' : '') +
      '<div class="hero" style="background:' + bmiColor + '">' +
        '<div class="hero-label">今日 BMI</div>' +
        '<div class="bmi-big">' + (c.bmi || '—') + '</div>' +
        '<div class="badge-bmi">' + bmiLabel + '</div>' +
        '<div class="hero-sub">体重 ' + (lw ? lw.weight + ' kg' : '未记录') + ' · 健康 ' + A.healthyRange(profile.height).low + '~' + A.healthyRange(profile.height).high + 'kg</div>' +
      '</div>' +

      card('今日体重', lw ? ('<div class="row"><span class="big-num">' + lw.weight + '</span><span class="unit">kg</span>' +
        (S.getWeights().length > 1 ? '' : '') + '</div>') : '<div class="muted">今天还没称重，去「体重」页记录～</div>',
        '去记录 ›', function () { setTab('weight') }) +

      '<div class="card"><div class="row-between"><span class="card-title">💧 今日喝水</span><span class="link" data-go="settings">目标 ' + waterGoal + 'ml ›</span></div>' +
        '<div class="water-total">' + waterMl + ' / ' + waterGoal + ' ml</div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + waterPct + '%;background:#4A9FD6"></div></div>' +
        '<div class="slots">' + slotHtml + '</div>' +
        '<div class="muted small">点时间段打卡（每次 250ml）</div></div>' +

      '<div class="card"><div class="row-between"><span class="card-title">今日热量</span><span class="link" data-go="diet">去记录 ›</span></div>' +
        '<div class="row"><span class="kcal-now" style="font-size:26px;font-weight:800">' + todayKcal + '</span><span class="muted">/ ' + tgtKcal + ' kcal</span></div>' +
        (planActive ? '<div class="plan-flag">📋 30天计划进行中</div>' : '') +
        '<div class="bar"><div class="bar-fill" style="width:' + kcalPct + '%;background:' + (kcalPct > 90 ? '#E57373' : '#4E9C96') + '"></div></div>' +
        '<div class="n-row"><span class="n-name">蛋白质</span><div class="bar"><div class="bar-fill" style="width:' + nutriPct.protein + '%;background:#5BBF8A"></div></div><span class="n-val">' + p.protein + '/' + tp.protein.value + 'g</span></div>' +
        '<div class="n-row"><span class="n-name">碳水</span><div class="bar"><div class="bar-fill" style="width:' + nutriPct.carb + '%;background:#F2B705"></div></div><span class="n-val">' + p.carb + '/' + tp.carb.value + 'g</span></div>' +
        '<div class="n-row"><span class="n-name">脂肪</span><div class="bar"><div class="bar-fill" style="width:' + nutriPct.fat + '%;background:#F2994A"></div></div><span class="n-val">' + p.fat + '/' + tp.fat.value + 'g</span></div></div>' +

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
  }

  function mealSuggestion() {
    var h = new Date().getHours()
    if (h < 9) return '🌅 早上好，记得吃份营养早餐～'
    if (h < 13) return '🍱 午餐时间到，记录你吃了什么吧'
    if (h < 18) return '🍵 下午加个餐也别忘了记一下'
    return '🌙 晚餐清淡些，睡前别吃宵夜哦'
  }

  function card(title, body, linkText, linkFn) {
    return '<div class="card"><div class="row-between"><span class="card-title">' + title + '</span>' +
      (linkText ? '<span class="link" data-link="1">' + linkText + '</span>' : '') + '</div>' + body + '</div>'
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
      view().innerHTML =
        '<div class="page-title">📋 30天减肥计划</div>' +
        '<div class="card"><div class="card-title">制定你的计划</div>' +
          '<div class="field"><label>当前体重 (kg)</label><input id="pCur" type="number" value="' + (lw ? lw.weight : profile.targetWeight) + '"></div>' +
          '<div class="field"><label>目标体重 (kg)</label><input id="pTgt" type="number" value="' + profile.targetWeight + '"></div>' +
          '<div class="field"><label>周期 (天)</label><input id="pDur" type="number" value="30"></div>' +
          '<button class="btn" id="pBuild">生成计划</button>' +
          '<div class="muted small" style="margin-top:10px">基于 Mifflin-St Jeor 基础代谢与 7700kcal≈1kg 脂肪，安全缺口 ≤500kcal/天</div>' +
        '</div>'
      $('pBuild').onclick = function () {
        var cur = parseFloat($('pCur').value), tgt = parseFloat($('pTgt').value), dur = parseInt($('pDur').value) || 30
        if (!cur || !tgt) { toast('请填写完整'); return }
        var p = A.buildPlan(profile, cur, tgt, dur)
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
        '<div class="kv"><span>每日热量预算</span><span>' + budget.kcal + ' kcal</span></div>' +
        '<div class="kv"><span>预计达成</span><span>' + plan.realisticDays + ' 天（' + plan.endDate + '）</span></div>' +
        (plan.feasible30 ? '' : '<div class="muted small" style="color:#E57373;margin-top:6px">⚠ 按安全缺口，30天内较难达标，建议延长周期或微调目标</div>') +
        '<div class="bar" style="margin-top:10px"><div class="bar-fill" style="width:' + progress + '%;background:#4E9C96"></div></div>' +
        '<div class="muted small" style="text-align:center">已推进 ' + progress + '%</div></div>' +

      '<div class="card"><div class="card-title">每日营养预算</div>' +
        '<div class="n-row"><span class="n-name">热量</span><div class="bar"></div><span class="n-val">' + budget.kcal + ' kcal</span></div>' +
        '<div class="n-row"><span class="n-name">蛋白质</span><div class="bar"></div><span class="n-val">' + budget.protein + ' g</span></div>' +
        '<div class="n-row"><span class="n-name">碳水</span><div class="bar"></div><span class="n-val">' + budget.carb + ' g</span></div>' +
        '<div class="n-row"><span class="n-name">脂肪</span><div class="bar"></div><span class="n-val">' + budget.fat + ' g</span></div>' +
        '<div class="n-row"><span class="n-name">膳食纤维</span><div class="bar"></div><span class="n-val">' + budget.fiber + ' g</span></div></div>' +

      '<div class="card"><div class="card-title">膳食宝塔分配</div>' + distHtml + '</div>' +
      '<div class="card"><div class="card-title">示意一日菜单</div>' + menuHtml + '</div>' +
      '<button class="btn" id="pReset" style="background:#EEF3F2;color:#8AA09C">重新制定计划</button>'
    $('pReset').onclick = function () { S.setPlan(null); renderPlan(); refreshSprite() }
  }

  // ---------- 分析 ----------
  function renderAnalysis() {
    var c = todayContext()
    var p = c.sum.total, tp = c.tgt
    var plan = c.plan
    var pred = A.predict(profile, c.w, p.kcal, 0)
    var predText = pred.direction === 'down' ? ('↓ 约 ' + pred.low + '~' + pred.high + ' kg')
      : pred.direction === 'up' ? ('↑ 约 ' + pred.low + '~' + pred.high + ' kg') : ('约 ' + pred.low + '~' + pred.high + ' kg')
    var budgetKcal = plan ? plan.dailyIntake : tp.kcal.value
    var pct = {
      protein: clamp(Math.round(p.protein / tp.protein.value * 100), 0, 120),
      carb: clamp(Math.round(p.carb / tp.carb.value * 100), 0, 120),
      fat: clamp(Math.round(p.fat / tp.fat.value * 100), 0, 120),
      fiber: clamp(Math.round(p.fiber / tp.fiber.value * 100), 0, 120)
    }
    var spark = sparkline(S.getWeights().slice(-14).map(function (i) { return i.weight }))

    view().innerHTML =
      '<div class="page-title">📊 今日分析</div>' +
      '<div class="card"><span class="card-title">明日体重预测</span>' +
        '<div style="font-size:22px;font-weight:800;margin-top:6px">' + predText + '</div>' +
        '<div class="muted small">基于今日摄入与基础代谢估算</div></div>' +
      '<div class="card"><span class="card-title">热量预算</span>' +
        (plan ? '<div class="plan-flag">📋 30天计划预算</div>' : '') +
        '<div class="row"><span style="font-size:24px;font-weight:800">' + p.kcal + '</span><span class="muted">/ ' + budgetKcal + ' kcal</span></div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + clamp(Math.round(p.kcal / budgetKcal * 100), 0, 100) + '%;background:' + (p.kcal / budgetKcal > 0.9 ? '#E57373' : '#4E9C96') + '"></div></div></div>' +
      '<div class="card"><span class="card-title">三大营养素</span>' +
        '<div class="n-row"><span class="n-name">蛋白质</span><div class="bar"><div class="bar-fill" style="width:' + pct.protein + '%;background:#5BBF8A"></div></div><span class="n-val">' + p.protein + '/' + tp.protein.value + 'g</span></div>' +
        '<div class="n-row"><span class="n-name">碳水</span><div class="bar"><div class="bar-fill" style="width:' + pct.carb + '%;background:#F2B705"></div></div><span class="n-val">' + p.carb + '/' + tp.carb.value + 'g</span></div>' +
        '<div class="n-row"><span class="n-name">脂肪</span><div class="bar"><div class="bar-fill" style="width:' + pct.fat + '%;background:#F2994A"></div></div><span class="n-val">' + p.fat + '/' + tp.fat.value + 'g</span></div>' +
        '<div class="n-row"><span class="n-name">膳食纤维</span><div class="bar"><div class="bar-fill" style="width:' + pct.fiber + '%;background:#4A7FA5"></div></div><span class="n-val">' + p.fiber + '/' + tp.fiber.value + 'g</span></div></div>' +
      (spark ? '<div class="card"><span class="card-title">体重趋势</span>' + spark + '</div>' : '')
  }

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
    var overlay = $('settingsOverlay')
    overlay.classList.remove('hidden')
    overlay.innerHTML =
      '<div class="mask"><div class="panel">' +
        '<h3>⚙ 设置</h3>' +
        '<div class="field"><label>身高 (cm)</label><input id="sH" type="number" value="' + profile.height + '"></div>' +
        '<div class="field"><label>年龄</label><input id="sA" type="number" value="' + profile.age + '"></div>' +
        '<div class="field"><label>目标体重 (kg)</label><input id="sT" type="number" value="' + profile.targetWeight + '"></div>' +
        '<div class="field"><label>性别</label><div class="seg" id="sG">' +
          '<button data-g="female" class="' + (profile.gender === 'female' ? 'on' : '') + '">女</button>' +
          '<button data-g="male" class="' + (profile.gender === 'male' ? 'on' : '') + '">男</button></div></div>' +
        '<div class="field"><label>活动量</label><div class="acts" id="sAct">' +
          ACTS.map(function (a, i) { return '<button data-act="' + i + '" class="' + (i === actIdx ? 'on' : '') + '">' + a.label + '</button>' }).join('') +
        '</div></div>' +
        '<div class="field"><label>每日饮水目标 (ml)</label><input id="sW" type="number" value="' + settings.waterGoalMl + '"></div>' +
        '<div class="switch-row"><span>饮水提醒</span><input type="checkbox" id="sWR" ' + (settings.waterReminder ? 'checked' : '') + '></div>' +
        '<div class="switch-row"><span>饭点提醒</span><input type="checkbox" id="sMR" ' + (settings.mealReminder ? 'checked' : '') + '></div>' +
        '<button class="btn" id="sSave" style="margin-top:8px">保存</button>' +
        '<button class="btn" id="sClear" style="background:#EEF3F2;color:#8AA09C;margin-top:10px">清空所有数据</button>' +
      '</div></div>'
    overlay.querySelector('.mask').onclick = function (e) { if (e.target.classList.contains('mask')) closeSettings() }
    overlay.querySelectorAll('#sG button').forEach(function (b) { b.onclick = function () { overlay.querySelectorAll('#sG button').forEach(function (x) { x.classList.remove('on') }); b.classList.add('on') } })
    overlay.querySelectorAll('#sAct button').forEach(function (b) { b.onclick = function () { overlay.querySelectorAll('#sAct button').forEach(function (x) { x.classList.remove('on') }); b.classList.add('on') } })
    $('sSave').onclick = function () {
      var h = parseFloat($('sH').value), a = parseInt($('sA').value), t = parseFloat($('sT').value)
      if (!h || !a || !t) { toast('请填写完整'); return }
      var g = overlay.querySelector('#sG button.on').getAttribute('data-g')
      var ai = parseInt(overlay.querySelector('#sAct button.on').getAttribute('data-act'), 10)
      profile = S.saveProfile({ height: h, age: a, targetWeight: t, gender: g, activityFactor: ACTS[ai].v })
      settings = S.saveSettings({ waterGoalMl: parseInt($('sW').value) || 1700, waterReminder: $('sWR').checked, mealReminder: $('sMR').checked })
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
    tx = sx; ty = sy
    place()

    // 仅拖拽时跟随触点：非拖拽时精灵停在原来位置（带呼吸动画），不挡按钮
    document.addEventListener('pointermove', function (e) {
      if (!dragging) return
      var px = e.clientX, py = e.clientY
      sx = clamp(px - dragOX, 0, window.innerWidth - sSize); sy = clamp(py - dragOY, 0, window.innerHeight - sSize); moved = true; place()
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
  function toggleBubble() {
    if (bubbleEl.classList.contains('hidden')) showBubble(spriteTextFor(tab))
    else { bubbleEl.classList.add('hidden'); clearTimeout(bubbleTimer) }
  }

  // 各 Tab 的精灵提示文案
  function spriteTextFor(which) {
    var c = todayContext()
    if (which === 'weight') return c.bmi ? ('当前 BMI ' + c.bmi + '（' + c.band.label + '），坚持记录就能看到变化～') : '称个体重，看看今天的 BMI 吧～'
    if (which === 'plan') {
      if (!c.plan) return '还没有计划哦，去「计划」页定制一个 30 天目标吧！'
      return '计划进行中，每天按 ' + c.plan.dailyIntake + ' kcal 预算吃，精灵陪你达成 ' + c.plan.targetWeight + 'kg！'
    }
    // home / diet / analysis：用情绪系统
    var mood = A.moodFor(c.sum, c.band, c.tgt)
    return mood.text
  }

  function refreshSprite() {
    var which = (tab === 'home' || tab === 'diet' || tab === 'analysis') ? tab : tab
    // 计算情绪以更新造型
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
    else if (tab === 'plan') renderPlan()
    else if (tab === 'analysis') renderAnalysis()
    refreshSprite()
  }
  function setTab(name) {
    tab = name
    document.querySelectorAll('#tabbar .tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name) })
    renderTab()
    announce()
  }

  // ============================================================
  //  启动
  // ============================================================
  function boot() {
    initSprite()
    document.querySelectorAll('#tabbar .tab').forEach(function (b) { b.onclick = function () { setTab(b.getAttribute('data-tab')) } })
    $('topbarGear').onclick = openSettings
    // 首次进入提示
    if (!S.getLatestWeight() && !S.getPlan()) {
      toast('欢迎使用 Fiona的减肥记录仪')
    }
    renderTab()
    setTimeout(announce, 600)

    // PWA service worker（仅在 http(s) 下注册）
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {})
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
