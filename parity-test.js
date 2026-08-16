// 奇偶校验：网页版 web/js/algo.js 与原小程序 utils 逐项对比
const path = require('path')
global.window = global
const root = path.resolve(__dirname, '..')

const origBmi = require(path.join(root, 'miniprogram/utils/bmi.js'))
const origPredict = require(path.join(root, 'miniprogram/utils/predict.js'))
const origNutrition = require(path.join(root, 'miniprogram/utils/nutrition.js'))
const origPlan = require(path.join(root, 'miniprogram/utils/plan.js'))
const origSprite = require(path.join(root, 'miniprogram/utils/sprite.js'))
const origFoods = require(path.join(root, 'miniprogram/utils/../data/foods.js'))

global.SlimSprites = origSprite.SPRITES
global.SlimSpriteColors = origSprite.COLORS
const web = require(path.join(root, 'web/js/algo.js'))

let pass = 0, fail = 0
function eq(name, a, b) {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  if (ok) { pass++; } else { fail++; console.log('FAIL', name, '\n  web:', JSON.stringify(a), '\n  org:', JSON.stringify(b)) }
}

const profile = { height: 160, gender: 'female', age: 27, activityFactor: 1.2 }

// BMI
eq('calcBmi', web.calcBmi(51, 160), origBmi.calcBmi(51, 160))
eq('bandOf', web.bandOf(22).label, origBmi.bandOf(22).label)
eq('healthyRange', web.healthyRange(160), origBmi.healthyRange(160))

// predict
eq('predict', web.predict(profile, 51, 1500, 0), origPredict.predict(profile, 51, 1500, 0))

// nutrition targets
eq('targets', web.targets(51, profile, {}), origNutrition.targets(51, profile, {}))
eq('computeItem', web.computeItem(origFoods.getById('egg'), 50), origNutrition.computeItem(origFoods.getById('egg'), 50))

const meals = {
  breakfast: [web.computeItem(origFoods.getById('oats'), 40)],
  lunch: [web.computeItem(origFoods.getById('rice_cooked'), 150), web.computeItem(origFoods.getById('chicken_breast'), 100)],
  dinner: [], extra: [web.computeItem(origFoods.getById('milk_tea'), 300)]
}
eq('sumMeals', web.sumMeals(meals), origNutrition.sumMeals(meals))

// plan
const pWeb = web.buildPlan(profile, 55, 51, 30)
const pOrg = origPlan.buildPlan(profile, 55, 51, 30)
// web 端新增可选字段 userIntake / lowIntakeWarn（原版无），排除后再比 keys
const webPlanKeys = Object.keys(pWeb).filter(k => k !== 'userIntake' && k !== 'lowIntakeWarn').sort()
const orgPlanKeys = Object.keys(pOrg).sort()
eq('plan.keys', webPlanKeys, orgPlanKeys)
eq('plan.scalars', [pWeb.bmr,pWeb.tdee,pWeb.needLoseKg,pWeb.dailyIntake,pWeb.realisticDays,pWeb.feasible30],
                       [pOrg.bmr,pOrg.tdee,pOrg.needLoseKg,pOrg.dailyIntake,pOrg.realisticDays,pOrg.feasible30])
eq('plan.budget', pWeb.budget, pOrg.budget)
eq('plan.sampleMenu.length', pWeb.sampleMenu.length, pOrg.sampleMenu.length)

// sprite moodFor 三态
const tgt = web.targets(51, profile, {})
const zero = { total: { kcal:0,protein:0,carb:0,fat:0,fiber:0 }, blackHits:0, blackList:[] }
const red = { total: { kcal:2000,protein:60,carb:200,fat:40,fiber:25 }, blackHits:1, blackList:['奶茶(全糖)'] }
const orange = { total: { kcal:1320,protein:65,carb:200,fat:40,fiber:26 }, blackHits:0, blackList:[] }
const green = { total: { kcal:1100,protein:65,carb:150,fat:35,fiber:26 }, blackHits:0, blackList:[] }
eq('mood.zero', web.moodFor(zero, web.bandOf(20), tgt).mood, origSprite.moodFor(zero, origBmi.bandOf(20), tgt).mood)
eq('mood.red', web.moodFor(red, web.bandOf(28), tgt).mood, origSprite.moodFor(red, origBmi.bandOf(28), tgt).mood)
eq('mood.orange', web.moodFor(orange, web.bandOf(22), tgt).mood, origSprite.moodFor(orange, origBmi.bandOf(22), tgt).mood)
eq('mood.green', web.moodFor(green, web.bandOf(22), tgt).mood, origSprite.moodFor(green, origBmi.bandOf(22), tgt).mood)

// foods 库
eq('foods.length', web.FOODS.length, 141)
eq('foods.blacklist', web.FOODS.filter(f=>f.cat==='black').length, 16)
eq('foods.first', web.FOODS[17].id, origFoods.FOODS[17].id)

console.log('\n==== 奇偶校验结果: PASS=' + pass + ' FAIL=' + fail + ' ====')
process.exit(fail ? 1 : 0)
