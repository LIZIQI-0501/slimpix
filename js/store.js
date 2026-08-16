// 浏览器存储层（网页版）
// 浏览器移植自 miniprogram/utils/storage.js：把 wx.getStorageSync/setStorageSync 替换为 localStorage
// 同时补齐 profile / settings 读写（原小程序写在 app.js 的 globalData 里）。
(function (global) {
  'use strict'

  const PREFIX = 'slimpix.'
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw == null) return fallback
      return JSON.parse(raw)
    } catch (e) { return fallback }
  }
  function write(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)) } catch (e) {}
  }

  const KEY = {
    PROFILE: 'profile', WEIGHTS: 'weights', DIET: 'diet', PLAN: 'plan',
    WATER: 'water', SETTINGS: 'settings', REMINDER_LOG: 'reminder_log'
  }

  const WATER_SLOTS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:30', '19:00', '21:30']
  const DEFAULT_WATER_ML = 250

  const DEFAULT_PROFILE = {
    height: 160, gender: 'female', age: 27, targetWeight: 51, activityFactor: 1.2
  }
  const DEFAULT_SETTINGS = {
    waterReminder: true, mealReminder: true, waterGoalMl: 1700, bgMusic: false
  }

  function getProfile() {
    const saved = read(KEY.PROFILE, null)
    return Object.assign({}, DEFAULT_PROFILE, saved || {})
  }
  function saveProfile(patch) {
    const merged = Object.assign({}, getProfile(), patch)
    write(KEY.PROFILE, merged)
    return merged
  }
  function getSettings() {
    const saved = read(KEY.SETTINGS, null)
    return Object.assign({}, DEFAULT_SETTINGS, saved || {})
  }
  function saveSettings(patch) {
    const merged = Object.assign({}, getSettings(), patch)
    write(KEY.SETTINGS, merged)
    return merged
  }

  function getWeights() { return read(KEY.WEIGHTS, []) }
  function addWeight(record) {
    const list = getWeights()
    const idx = list.findIndex(w => w.date === record.date)
    if (idx >= 0) list[idx] = record
    else list.push(record)
    list.sort((a, b) => a.date.localeCompare(b.date))
    write(KEY.WEIGHTS, list)
    return list
  }
  function getLatestWeight() {
    const list = getWeights()
    return list.length ? list[list.length - 1] : null
  }

  function getDiet(date) {
    const all = read(KEY.DIET, {})
    return all[date] || { breakfast: [], lunch: [], dinner: [], extra: [] }
  }
  function setDiet(date, meals) {
    const all = read(KEY.DIET, {})
    all[date] = meals
    write(KEY.DIET, all)
  }

  function todayStr() {
    const d = new Date()
    const m = `${d.getMonth() + 1}`.padStart(2, '0')
    const day = `${d.getDate()}`.padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  }

  function getPlan() { return read(KEY.PLAN, null) }
  function setPlan(plan) { write(KEY.PLAN, plan); return plan }

  function getWaters(date) {
    const all = read(KEY.WATER, {})
    return all[date] || {}
  }
  function toggleWater(date, slot, ml) {
    const all = read(KEY.WATER, {})
    const day = all[date] || {}
    if (day[slot] && day[slot] > 0) day[slot] = 0
    else day[slot] = ml || DEFAULT_WATER_ML
    all[date] = day
    write(KEY.WATER, all)
    return day
  }
  function waterTotal(date) {
    const day = getWaters(date)
    let t = 0
    Object.keys(day).forEach(k => { t += (day[k] || 0) })
    return t
  }

  function getReminderLog(date) {
    const all = read(KEY.REMINDER_LOG, {})
    return all[date] || {}
  }
  function markReminder(date, key) {
    const all = read(KEY.REMINDER_LOG, {})
    all[date] = all[date] || {}
    all[date][key] = true
    write(KEY.REMINDER_LOG, all)
  }

  function clearAll() {
    Object.keys(KEY).forEach(k => { try { localStorage.removeItem(PREFIX + KEY[k]) } catch (e) {} })
  }

  const api = {
    KEY, WATER_SLOTS, DEFAULT_WATER_ML, DEFAULT_PROFILE, DEFAULT_SETTINGS,
    getProfile, saveProfile, getSettings, saveSettings,
    getWeights, addWeight, getLatestWeight,
    getDiet, setDiet, todayStr,
    getPlan, setPlan,
    getWaters, toggleWater, waterTotal,
    getReminderLog, markReminder, clearAll
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  global.SlimStore = api
})(typeof window !== 'undefined' ? window : globalThis)
