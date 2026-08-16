// 纯算法核心（网页版）
// 原样移植自 miniprogram/utils/{bmi,predict,nutrition,plan,sprite}.js 与 data/foods.js
// 公式保持不变；仅把 CommonJS require 改为同文件作用域调用，并去除 wx 依赖。
// 同时挂载到 window.SlimAlgo（浏览器）与 module.exports（Node 校验）。
(function (global) {
  'use strict'

  // ===================== 食物库（141 项） =====================
  const CATEGORIES = [
    { key: 'staple', name: '主食' },
    { key: 'protein', name: '肉蛋豆' },
    { key: 'veg', name: '蔬菜' },
    { key: 'fruit', name: '水果' },
    { key: 'drink', name: '饮品' },
    { key: 'snack', name: '零食' },
    { key: 'black', name: '黑名单' }
  ]

  // kcal 千卡 / protein 蛋白质 g / carb 碳水 g / fat 脂肪 g / fiber 膳食纤维 g
  const FOODS = [
    // ===== 主食 =====
    { id: 'rice_cooked', name: '米饭(熟)', cat: 'staple', kcal: 116, protein: 2.6, carb: 25.9, fat: 0.3, fiber: 0.3 },
    { id: 'congee', name: '白粥', cat: 'staple', kcal: 46, protein: 1.1, carb: 9.9, fat: 0.3, fiber: 0.2 },
    { id: 'noodle_cooked', name: '面条(熟)', cat: 'staple', kcal: 110, protein: 3.8, carb: 22.0, fat: 0.4, fiber: 0.7 },
    { id: 'mantou', name: '馒头', cat: 'staple', kcal: 223, protein: 7.0, carb: 47.0, fat: 1.1, fiber: 1.3 },
    { id: 'whole_bread', name: '全麦面包', cat: 'staple', kcal: 250, protein: 9.0, carb: 41.0, fat: 3.4, fiber: 6.0 },
    { id: 'oats', name: '燕麦(干)', cat: 'staple', kcal: 389, protein: 16.9, carb: 66.0, fat: 6.9, fiber: 10.6 },
    { id: 'sweet_potato', name: '红薯', cat: 'staple', kcal: 86, protein: 1.6, carb: 20.0, fat: 0.1, fiber: 3.0 },
    { id: 'corn', name: '玉米', cat: 'staple', kcal: 106, protein: 4.0, carb: 22.8, fat: 1.2, fiber: 2.9 },
    { id: 'brown_rice', name: '糙米饭(熟)', cat: 'staple', kcal: 123, protein: 2.6, carb: 25.9, fat: 1.0, fiber: 1.8 },
    { id: 'noodle_dry', name: '面条(干)', cat: 'staple', kcal: 355, protein: 12.0, carb: 73.0, fat: 1.5, fiber: 3.0 },
    { id: 'dumpling', name: '饺子(熟)', cat: 'staple', kcal: 220, protein: 8.0, carb: 26.0, fat: 9.0, fiber: 1.0 },
    { id: 'baozi', name: '包子(猪肉)', cat: 'staple', kcal: 220, protein: 8.0, carb: 28.0, fat: 8.0, fiber: 1.0 },
    { id: 'youtiao', name: '油条', cat: 'staple', kcal: 388, protein: 6.0, carb: 51.0, fat: 18.0, fiber: 1.5 },
    { id: 'jianbing', name: '煎饼', cat: 'staple', kcal: 200, protein: 7.0, carb: 30.0, fat: 6.0, fiber: 2.0 },
    { id: 'pasta', name: '意大利面(熟)', cat: 'staple', kcal: 158, protein: 5.8, carb: 31.0, fat: 0.9, fiber: 1.8 },
    { id: 'rice_cake', name: '年糕', cat: 'staple', kcal: 154, protein: 3.3, carb: 34.0, fat: 0.3, fiber: 0.8 },
    { id: 'griddle_cake', name: '烙饼', cat: 'staple', kcal: 255, protein: 8.0, carb: 45.0, fat: 5.0, fiber: 1.5 },
    { id: 'hefen', name: '河粉(熟)', cat: 'staple', kcal: 110, protein: 2.0, carb: 25.0, fat: 0.2, fiber: 0.5 },
    { id: 'instant_noodle', name: '方便面(熟)', cat: 'staple', kcal: 140, protein: 3.5, carb: 22.0, fat: 4.0, fiber: 0.6 },
    { id: 'bagel', name: '贝果', cat: 'staple', kcal: 250, protein: 9.0, carb: 48.0, fat: 1.5, fiber: 2.0 },
    { id: 'white_bread', name: '白吐司', cat: 'staple', kcal: 265, protein: 8.0, carb: 49.0, fat: 4.0, fiber: 2.0 },
    { id: 'wonton', name: '馄饨(熟)', cat: 'staple', kcal: 180, protein: 7.0, carb: 20.0, fat: 7.0, fiber: 0.8 },

    // ===== 肉蛋豆 =====
    { id: 'egg', name: '鸡蛋', cat: 'protein', kcal: 144, protein: 13.3, carb: 2.8, fat: 8.8, fiber: 0.0 },
    { id: 'chicken_breast', name: '鸡胸肉(熟)', cat: 'protein', kcal: 165, protein: 31.0, carb: 0.0, fat: 3.6, fiber: 0.0 },
    { id: 'beef_lean', name: '瘦牛肉(生)', cat: 'protein', kcal: 106, protein: 20.2, carb: 1.2, fat: 2.3, fiber: 0.0 },
    { id: 'pork_lean', name: '猪里脊', cat: 'protein', kcal: 155, protein: 20.2, carb: 1.5, fat: 7.9, fiber: 0.0 },
    { id: 'salmon', name: '三文鱼', cat: 'protein', kcal: 139, protein: 17.2, carb: 0.0, fat: 7.8, fiber: 0.0 },
    { id: 'shrimp', name: '虾仁', cat: 'protein', kcal: 93, protein: 18.6, carb: 0.8, fat: 1.7, fiber: 0.0 },
    { id: 'tofu', name: '豆腐', cat: 'protein', kcal: 81, protein: 8.1, carb: 1.9, fat: 4.8, fiber: 0.4 },
    { id: 'soymilk', name: '无糖豆浆', cat: 'protein', kcal: 31, protein: 3.0, carb: 1.2, fat: 1.6, fiber: 0.3 },
    { id: 'milk', name: '全脂牛奶', cat: 'protein', kcal: 54, protein: 3.0, carb: 3.4, fat: 3.2, fiber: 0.0 },
    { id: 'yogurt', name: '无糖酸奶', cat: 'protein', kcal: 72, protein: 3.3, carb: 4.9, fat: 3.5, fiber: 0.0 },
    { id: 'greek_yogurt', name: '希腊酸奶(无糖)', cat: 'protein', kcal: 59, protein: 10.0, carb: 3.6, fat: 0.4, fiber: 0.0 },
    { id: 'chicken_leg', name: '鸡腿(带皮)', cat: 'protein', kcal: 209, protein: 18.0, carb: 0.0, fat: 15.0, fiber: 0.0 },
    { id: 'pork_belly', name: '五花肉', cat: 'protein', kcal: 349, protein: 13.2, carb: 2.4, fat: 32.0, fiber: 0.0 },
    { id: 'duck_breast', name: '鸭胸肉(去皮)', cat: 'protein', kcal: 135, protein: 18.0, carb: 0.0, fat: 7.0, fiber: 0.0 },
    { id: 'lamb_lean', name: '羊肉(瘦)', cat: 'protein', kcal: 118, protein: 20.0, carb: 0.0, fat: 4.0, fiber: 0.0 },
    { id: 'bacon', name: '培根', cat: 'protein', kcal: 430, protein: 12.0, carb: 1.4, fat: 41.0, fiber: 0.0 },
    { id: 'ham', name: '火腿', cat: 'protein', kcal: 145, protein: 16.0, carb: 1.0, fat: 9.0, fiber: 0.0 },
    { id: 'sausage', name: '香肠', cat: 'protein', kcal: 300, protein: 12.0, carb: 5.0, fat: 26.0, fiber: 0.0 },
    { id: 'bass', name: '鲈鱼', cat: 'protein', kcal: 105, protein: 18.6, carb: 0.0, fat: 3.0, fiber: 0.0 },
    { id: 'hairtail', name: '带鱼', cat: 'protein', kcal: 127, protein: 17.7, carb: 0.0, fat: 4.9, fiber: 0.0 },
    { id: 'squid', name: '鱿鱼', cat: 'protein', kcal: 92, protein: 15.0, carb: 2.0, fat: 1.4, fiber: 0.0 },
    { id: 'crab', name: '蟹肉', cat: 'protein', kcal: 95, protein: 17.0, carb: 0.0, fat: 2.0, fiber: 0.0 },
    { id: 'edamame', name: '毛豆', cat: 'protein', kcal: 131, protein: 13.0, carb: 11.0, fat: 5.0, fiber: 4.0 },
    { id: 'chickpea', name: '鹰嘴豆(熟)', cat: 'protein', kcal: 164, protein: 8.9, carb: 27.0, fat: 2.6, fiber: 7.6 },
    { id: 'lentil', name: '扁豆(熟)', cat: 'protein', kcal: 116, protein: 9.0, carb: 20.0, fat: 0.4, fiber: 7.9 },
    { id: 'yuba', name: '腐竹', cat: 'protein', kcal: 459, protein: 44.0, carb: 12.0, fat: 22.0, fiber: 1.0 },
    { id: 'preserved_egg', name: '皮蛋', cat: 'protein', kcal: 171, protein: 14.0, carb: 2.0, fat: 11.0, fiber: 0.0 },
    { id: 'quail_egg', name: '鹌鹑蛋', cat: 'protein', kcal: 160, protein: 12.8, carb: 2.0, fat: 11.0, fiber: 0.0 },
    { id: 'beef_jerky', name: '牛肉干', cat: 'protein', kcal: 290, protein: 46.0, carb: 10.0, fat: 6.0, fiber: 0.0 },

    // ===== 蔬菜 =====
    { id: 'broccoli', name: '西兰花', cat: 'veg', kcal: 34, protein: 2.8, carb: 6.6, fat: 0.4, fiber: 2.6 },
    { id: 'spinach', name: '菠菜', cat: 'veg', kcal: 23, protein: 2.6, carb: 3.6, fat: 0.3, fiber: 2.2 },
    { id: 'cucumber', name: '黄瓜', cat: 'veg', kcal: 15, protein: 0.8, carb: 2.9, fat: 0.2, fiber: 0.5 },
    { id: 'tomato', name: '番茄', cat: 'veg', kcal: 18, protein: 0.9, carb: 3.9, fat: 0.2, fiber: 1.2 },
    { id: 'lettuce', name: '生菜', cat: 'veg', kcal: 15, protein: 1.4, carb: 2.9, fat: 0.2, fiber: 1.3 },
    { id: 'carrot', name: '胡萝卜', cat: 'veg', kcal: 39, protein: 1.0, carb: 9.6, fat: 0.2, fiber: 2.8 },
    { id: 'winter_melon', name: '冬瓜', cat: 'veg', kcal: 11, protein: 0.4, carb: 2.6, fat: 0.2, fiber: 0.7 },
    { id: 'pepper', name: '青椒', cat: 'veg', kcal: 22, protein: 1.0, carb: 5.4, fat: 0.2, fiber: 2.1 },
    { id: 'mushroom', name: '香菇', cat: 'veg', kcal: 26, protein: 2.2, carb: 5.2, fat: 0.3, fiber: 3.3 },
    { id: 'cabbage', name: '白菜', cat: 'veg', kcal: 20, protein: 1.5, carb: 3.2, fat: 0.1, fiber: 1.2 },
    { id: 'greens', name: '油麦菜', cat: 'veg', kcal: 15, protein: 1.4, carb: 2.0, fat: 0.2, fiber: 1.2 },
    { id: 'celery', name: '芹菜', cat: 'veg', kcal: 16, protein: 0.8, carb: 3.0, fat: 0.1, fiber: 1.6 },
    { id: 'eggplant', name: '茄子', cat: 'veg', kcal: 24, protein: 1.0, carb: 5.0, fat: 0.1, fiber: 1.8 },
    { id: 'zucchini', name: '西葫芦', cat: 'veg', kcal: 18, protein: 0.8, carb: 3.4, fat: 0.1, fiber: 1.0 },
    { id: 'pumpkin', name: '南瓜', cat: 'veg', kcal: 26, protein: 1.0, carb: 6.0, fat: 0.1, fiber: 0.8 },
    { id: 'potato', name: '土豆', cat: 'veg', kcal: 77, protein: 2.0, carb: 17.0, fat: 0.1, fiber: 1.5 },
    { id: 'yam', name: '山药', cat: 'veg', kcal: 56, protein: 1.5, carb: 14.0, fat: 0.1, fiber: 1.4 },
    { id: 'lotus_root', name: '莲藕', cat: 'veg', kcal: 73, protein: 1.9, carb: 17.0, fat: 0.1, fiber: 2.2 },
    { id: 'onion', name: '洋葱', cat: 'veg', kcal: 40, protein: 1.1, carb: 9.0, fat: 0.1, fiber: 1.5 },
    { id: 'garlic_sprout', name: '蒜薹', cat: 'veg', kcal: 37, protein: 2.1, carb: 7.0, fat: 0.2, fiber: 1.8 },
    { id: 'wood_ear', name: '木耳', cat: 'veg', kcal: 27, protein: 1.5, carb: 6.0, fat: 0.2, fiber: 2.6 },
    { id: 'enoki', name: '金针菇', cat: 'veg', kcal: 32, protein: 2.4, carb: 6.0, fat: 0.2, fiber: 2.7 },
    { id: 'kelp', name: '海带', cat: 'veg', kcal: 13, protein: 1.1, carb: 2.1, fat: 0.1, fiber: 0.5 },

    // ===== 水果 =====
    { id: 'apple', name: '苹果', cat: 'fruit', kcal: 52, protein: 0.3, carb: 13.8, fat: 0.2, fiber: 2.4 },
    { id: 'banana', name: '香蕉', cat: 'fruit', kcal: 89, protein: 1.1, carb: 22.8, fat: 0.3, fiber: 2.6 },
    { id: 'blueberry', name: '蓝莓', cat: 'fruit', kcal: 57, protein: 0.7, carb: 14.5, fat: 0.3, fiber: 2.4 },
    { id: 'strawberry', name: '草莓', cat: 'fruit', kcal: 32, protein: 0.8, carb: 7.7, fat: 0.2, fiber: 2.0 },
    { id: 'orange', name: '橙子', cat: 'fruit', kcal: 47, protein: 0.9, carb: 11.8, fat: 0.1, fiber: 2.4 },
    { id: 'watermelon', name: '西瓜', cat: 'fruit', kcal: 30, protein: 0.6, carb: 7.6, fat: 0.1, fiber: 0.4 },
    { id: 'grape', name: '葡萄', cat: 'fruit', kcal: 43, protein: 0.5, carb: 10.3, fat: 0.2, fiber: 0.4 },
    { id: 'pear', name: '梨', cat: 'fruit', kcal: 44, protein: 0.4, carb: 11.0, fat: 0.1, fiber: 2.4 },
    { id: 'peach', name: '桃子', cat: 'fruit', kcal: 39, protein: 0.9, carb: 9.5, fat: 0.1, fiber: 1.3 },
    { id: 'mango', name: '芒果', cat: 'fruit', kcal: 60, protein: 0.8, carb: 15.0, fat: 0.4, fiber: 1.3 },
    { id: 'pineapple', name: '菠萝', cat: 'fruit', kcal: 50, protein: 0.5, carb: 12.0, fat: 0.1, fiber: 1.2 },
    { id: 'kiwi', name: '猕猴桃', cat: 'fruit', kcal: 61, protein: 1.1, carb: 14.0, fat: 0.5, fiber: 2.6 },
    { id: 'pomelo', name: '柚子', cat: 'fruit', kcal: 42, protein: 0.8, carb: 9.5, fat: 0.1, fiber: 0.4 },
    { id: 'cherry', name: '樱桃', cat: 'fruit', kcal: 46, protein: 1.0, carb: 10.0, fat: 0.2, fiber: 0.3 },
    { id: 'lychee', name: '荔枝', cat: 'fruit', kcal: 71, protein: 0.8, carb: 17.0, fat: 0.2, fiber: 0.5 },
    { id: 'cantaloupe', name: '哈密瓜', cat: 'fruit', kcal: 34, protein: 0.8, carb: 8.0, fat: 0.1, fiber: 0.8 },
    { id: 'dragon_fruit', name: '火龙果', cat: 'fruit', kcal: 50, protein: 1.1, carb: 12.0, fat: 0.2, fiber: 1.6 },
    { id: 'papaya', name: '木瓜', cat: 'fruit', kcal: 43, protein: 0.7, carb: 11.0, fat: 0.1, fiber: 1.7 },
    { id: 'loquat', name: '枇杷', cat: 'fruit', kcal: 39, protein: 0.8, carb: 9.0, fat: 0.2, fiber: 0.8 },

    // ===== 饮品 =====
    { id: 'water', name: '白开水', cat: 'drink', kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 },
    { id: 'black_coffee', name: '美式咖啡', cat: 'drink', kcal: 2, protein: 0.1, carb: 0, fat: 0, fiber: 0 },
    { id: 'green_tea', name: '绿茶', cat: 'drink', kcal: 1, protein: 0, carb: 0.1, fat: 0, fiber: 0 },
    { id: 'cola', name: '可乐', cat: 'drink', kcal: 43, protein: 0, carb: 10.6, fat: 0, fiber: 0 },
    { id: 'orange_juice', name: '橙汁', cat: 'drink', kcal: 45, protein: 0.7, carb: 10.4, fat: 0.2, fiber: 0.2 },
    { id: 'beer', name: '啤酒', cat: 'drink', kcal: 43, protein: 0.5, carb: 3.6, fat: 0, fiber: 0 },
    { id: 'latte', name: '拿铁', cat: 'drink', kcal: 50, protein: 3.0, carb: 4.5, fat: 2.2, fiber: 0 },
    { id: 'cappuccino', name: '卡布奇诺', cat: 'drink', kcal: 40, protein: 2.5, carb: 3.8, fat: 1.8, fiber: 0 },
    { id: 'milk_tea_unsweet', name: '奶茶(无糖)', cat: 'drink', kcal: 35, protein: 1.5, carb: 5.0, fat: 1.0, fiber: 0 },
    { id: 'coconut_water', name: '椰子水', cat: 'drink', kcal: 19, protein: 0.2, carb: 4.0, fat: 0, fiber: 0 },
    { id: 'sport_drink', name: '运动饮料', cat: 'drink', kcal: 26, protein: 0, carb: 6.0, fat: 0, fiber: 0 },
    { id: 'soda', name: '苏打水', cat: 'drink', kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 },
    { id: 'lemon_water', name: '柠檬水', cat: 'drink', kcal: 9, protein: 0, carb: 2.0, fat: 0, fiber: 0 },
    { id: 'oat_milk', name: '燕麦奶', cat: 'drink', kcal: 45, protein: 1.0, carb: 7.0, fat: 1.5, fiber: 0.5 },
    { id: 'soy_milk_drink', name: '豆奶', cat: 'drink', kcal: 30, protein: 2.0, carb: 3.0, fat: 1.0, fiber: 0.3 },
    { id: 'red_wine', name: '红酒', cat: 'drink', kcal: 85, protein: 0.1, carb: 2.5, fat: 0, fiber: 0 },

    // ===== 零食 =====
    { id: 'nuts', name: '混合坚果', cat: 'snack', kcal: 600, protein: 20, carb: 20, fat: 50, fiber: 8 },
    { id: 'avocado', name: '牛油果', cat: 'snack', kcal: 160, protein: 2, carb: 8.5, fat: 14.7, fiber: 6.7 },
    { id: 'chips', name: '薯片', cat: 'snack', kcal: 547, protein: 6.9, carb: 53, fat: 35, fiber: 4.4 },
    { id: 'chocolate', name: '巧克力', cat: 'snack', kcal: 589, protein: 7.6, carb: 51, fat: 40, fiber: 7 },
    { id: 'cheese', name: '奶酪', cat: 'snack', kcal: 328, protein: 25, carb: 3.5, fat: 24, fiber: 0 },
    { id: 'biscuit', name: '饼干', cat: 'snack', kcal: 430, protein: 7.0, carb: 65.0, fat: 15.0, fiber: 2.0 },
    { id: 'mochi', name: '麻薯', cat: 'snack', kcal: 280, protein: 2.0, carb: 65.0, fat: 1.0, fiber: 1.0 },
    { id: 'egg_tart', name: '蛋挞', cat: 'snack', kcal: 376, protein: 6.0, carb: 34.0, fat: 24.0, fiber: 1.0 },
    { id: 'macaron', name: '马卡龙', cat: 'snack', kcal: 450, protein: 6.0, carb: 75.0, fat: 18.0, fiber: 1.0 },
    { id: 'ice_cream', name: '冰淇淋', cat: 'snack', kcal: 127, protein: 2.5, carb: 20.0, fat: 4.0, fiber: 0 },
    { id: 'pudding', name: '布丁', cat: 'snack', kcal: 120, protein: 3.0, carb: 18.0, fat: 4.0, fiber: 0 },
    { id: 'jelly', name: '果冻', cat: 'snack', kcal: 70, protein: 0, carb: 17.0, fat: 0, fiber: 0 },
    { id: 'popcorn', name: '爆米花', cat: 'snack', kcal: 380, protein: 12.0, carb: 73.0, fat: 4.0, fiber: 5.0 },
    { id: 'sha_qi_ma', name: '沙琪玛', cat: 'snack', kcal: 450, protein: 6.0, carb: 70.0, fat: 18.0, fiber: 1.0 },
    { id: 'sesame_paste', name: '芝麻糊', cat: 'snack', kcal: 320, protein: 6.0, carb: 55.0, fat: 10.0, fiber: 3.0 },
    { id: 'gui_lin_gao', name: '龟苓膏', cat: 'snack', kcal: 50, protein: 0.5, carb: 11.0, fat: 0, fiber: 0 },

    // ===== 黑名单 =====
    { id: 'fried_string', name: '炸串', cat: 'black', kcal: 280, protein: 12, carb: 18, fat: 18, fiber: 1, blackReason: '油炸 + 高油高盐，热量炸弹' },
    { id: 'bbq', name: '烧烤', cat: 'black', kcal: 290, protein: 16, carb: 5, fat: 24, fiber: 0, blackReason: '油脂重、调料多，一顿抵一天额度' },
    { id: 'milk_tea', name: '奶茶(全糖)', cat: 'black', kcal: 65, protein: 0.8, carb: 10, fat: 2.5, fiber: 0, blackReason: '一杯≈325kcal，糖分远超每日上限', unit: 'ml' },
    { id: 'cake', name: '奶油蛋糕', cat: 'black', kcal: 350, protein: 5, carb: 45, fat: 17, fiber: 1, blackReason: '精制糖 + 反式脂肪，减脂期黑名单' },
    { id: 'hotpot', name: '火锅', cat: 'black', kcal: 180, protein: 12, carb: 8, fat: 11, fiber: 1, blackReason: '蘸料 + 肥牛 = 隐形热量池', unit: '份' },
    { id: 'midnight_snack', name: '宵夜(泡面等)', cat: 'black', kcal: 450, protein: 9, carb: 58, fat: 18, fiber: 2, blackReason: '睡前进食最易囤积，且影响睡眠', unit: '份' },
    { id: 'fried_chicken', name: '炸鸡', cat: 'black', kcal: 300, protein: 18, carb: 15, fat: 19, fiber: 0, blackReason: '油炸裹粉，热量与钠双高' },
    { id: 'fries', name: '薯条', cat: 'black', kcal: 298, protein: 3.4, carb: 41, fat: 14, fiber: 3.5, blackReason: '油炸淀粉，一盒≈全天脂肪额度' },
    { id: 'donut', name: '甜甜圈', cat: 'black', kcal: 440, protein: 5, carb: 52, fat: 24, fiber: 1.5, blackReason: '油炸 + 糖霜，纯热量炸弹' },
    { id: 'luosifen', name: '螺蛳粉', cat: 'black', kcal: 120, protein: 3, carb: 20, fat: 3, fiber: 1, blackReason: '重油重盐重辣，一碗≈500kcal', unit: '100g' },
    { id: 'malatang', name: '麻辣烫', cat: 'black', kcal: 90, protein: 3, carb: 6, fat: 5, fiber: 1, blackReason: '汤底油盐高、丸子加工多', unit: '100g' },
    { id: 'sugar_oil_cake', name: '糖油粑粑', cat: 'black', kcal: 350, protein: 3, carb: 50, fat: 15, fiber: 1, blackReason: '糯米油炸裹糖，减脂期大忌' },
    { id: 'grass_jelly', name: '烧仙草', cat: 'black', kcal: 60, protein: 0, carb: 13, fat: 1, fiber: 0, blackReason: '奶茶基底 + 糖水，隐形糖' },
    { id: 'cheese_stick', name: '芝士棒', cat: 'black', kcal: 320, protein: 12, carb: 28, fat: 18, fiber: 0, blackReason: '油炸芝士，热量爆表' },
    { id: 'egg_cake', name: '蛋黄派', cat: 'black', kcal: 390, protein: 5, carb: 55, fat: 18, fiber: 0, blackReason: '反式脂肪 + 糖，减脂黑名单' },
    { id: 'latiao', name: '辣条', cat: 'black', kcal: 400, protein: 8, carb: 40, fat: 22, fiber: 3, blackReason: '高油高盐高添加剂' }
  ]

  const BLACK_KEYWORDS = ['炸', '烤串', '烧烤', '奶茶', '蛋糕', '火锅', '宵夜', '泡面', '炸鸡', '薯条', '甜甜圈', '可乐', '薯片', '巧克力', '螺蛳粉', '麻辣烫', '糖油粑粑', '芝士棒', '蛋黄派', '辣条', '烧仙草']

  function getById(id) { return FOODS.find(f => f.id === id) }
  function search(keyword) { if (!keyword) return FOODS; return FOODS.filter(f => f.name.indexOf(keyword) >= 0) }
  function listByCat(catKey) { return FOODS.filter(f => f.cat === catKey) }

  // ===================== BMI =====================
  const BMI_BANDS = [
    { max: 18.5, label: '偏瘦', color: '#4A7FA5', tip: '低于健康范围，注意均衡营养' },
    { max: 24, label: '健康', color: '#5BBF8A', tip: '保持在健康范围内，继续保持' },
    { max: 28, label: '超重', color: '#F2B705', tip: '建议控制饮食 + 增加运动' },
    { max: Infinity, label: '肥胖', color: '#E57373', tip: '建议制定科学减重计划' }
  ]

  function calcBmi(weightKg, heightCm) {
    const h = heightCm / 100
    if (h <= 0) return 0
    return Math.round((weightKg / (h * h)) * 10) / 10
  }
  function bandOf(bmi) {
    for (const b of BMI_BANDS) { if (bmi < b.max) return b }
    return BMI_BANDS[BMI_BANDS.length - 1]
  }
  function healthyRange(heightCm) {
    const h = heightCm / 100
    const low = Math.round(18.5 * h * h * 10) / 10
    const high = Math.round(23.9 * h * h * 10) / 10
    return { low, high }
  }

  // ===================== 预测（Mifflin-St Jeor） =====================
  const KCAL_PER_KG = 7700
  function bmr(profile, weightKg) {
    const { height, gender, age } = profile
    const base = 10 * weightKg + 6.25 * height
    if (gender === 'female') return base - 5 * age - 161
    return base - 5 * age + 5
  }
  function predict(profile, weightKg, intakeKcal, exerciseKcal) {
    const activity = profile.activityFactor || 1.2
    const b = bmr(profile, weightKg)
    const tdee = b * activity
    const exercise = exerciseKcal || 0
    const deficit = tdee - intakeKcal - exercise
    const delta = deficit / KCAL_PER_KG
    const center = weightKg - delta
    const low = Math.round((center - 0.12) * 10) / 10
    const high = Math.round((center + 0.12) * 10) / 10
    return {
      bmr: Math.round(b),
      tdee: Math.round(tdee),
      deficit: Math.round(deficit),
      delta: Math.round(delta * 100) / 100,
      low, high,
      direction: delta > 0.02 ? 'down' : (delta < -0.02 ? 'up' : 'flat')
    }
  }

  // ===================== 营养 =====================
  const SAFE_DEFICIT = 500
  const MIN_INTAKE = 1200
  const PROTEIN_PER_KG = 1.2
  const PROTEIN_RNI_F = 55
  const FAT_ENERGY_MAX = 0.30
  const CARB_ENERGY_MAX = 0.65
  const FIBER_AI = 25

  function computeItem(food, grams) {
    const ratio = grams / 100
    return {
      foodId: food.id, name: food.name, grams: grams, cat: food.cat,
      kcal: Math.round(food.kcal * ratio),
      protein: Math.round(food.protein * ratio * 10) / 10,
      carb: Math.round(food.carb * ratio * 10) / 10,
      fat: Math.round(food.fat * ratio * 10) / 10,
      fiber: Math.round(food.fiber * ratio * 10) / 10,
      black: !!food.blackReason,
      blackReason: food.blackReason || ''
    }
  }
  function sumMeals(meals) {
    const keys = ['kcal', 'protein', 'carb', 'fat', 'fiber']
    const total = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 }
    let blackHits = 0
    const blackList = []
    ;['breakfast', 'lunch', 'dinner', 'extra'].forEach(k => {
      ;(meals[k] || []).forEach(it => {
        keys.forEach(key => { total[key] += it[key] || 0 })
        if (it.black) { blackHits += 1; if (blackList.indexOf(it.name) < 0) blackList.push(it.name) }
      })
    })
    total.kcal = Math.round(total.kcal)
    total.protein = Math.round(total.protein * 10) / 10
    total.carb = Math.round(total.carb * 10) / 10
    total.fat = Math.round(total.fat * 10) / 10
    total.fiber = Math.round(total.fiber * 10) / 10
    return { total: total, blackHits: blackHits, blackList: blackList }
  }
  function tdeeOf(profile, weightKg) { return predict(profile, weightKg, 0, 0).tdee }
  function targets(weightKg, profile, opts) {
    const tdee = tdeeOf(profile, weightKg)
    const defaultCeiling = Math.max(Math.round(tdee - SAFE_DEFICIT), MIN_INTAKE)
    const kcalCeiling = opts && opts.kcalOverride ? opts.kcalOverride : defaultCeiling
    const lowIntake = !!(opts && opts.lowIntake)
    const proteinG = Math.round(Math.max(weightKg * PROTEIN_PER_KG, PROTEIN_RNI_F))
    const fatG = Math.round(kcalCeiling * FAT_ENERGY_MAX / 9)
    const carbG = Math.round(kcalCeiling * CARB_ENERGY_MAX / 4)
    const kcalNote = lowIntake
      ? '你设定的 ' + kcalCeiling + ' kcal 低于 1200 kcal 安全下限，长期可能流失肌肉/降低基础代谢，建议谨慎并关注身体反应'
      : 'WHO / 中国居民膳食指南2022：在维持热量(TDEE≈' + tdee + 'kcal)基础上制造安全缺口(≤500kcal/天)，且不低于1200kcal安全下限'
    return {
      kcal: { value: kcalCeiling, type: 'max', note: kcalNote },
      protein: { value: proteinG, type: 'min', note: '中国DRIs2023 女性RNI 0.9g/kg；减脂期按1.2g/kg提高饱腹感、保留瘦体组织(运动营养共识)' },
      fat: { value: fatG, type: 'max', note: 'WHO2023 总脂肪≤30%总能量；中国DRIs2023 AMDR 20~30%' },
      carb: { value: carbG, type: 'max', note: '中国DRIs2023 碳水 AMDR 50~65%' },
      fiber: { value: FIBER_AI, type: 'min', note: 'WHO2023 ≥25g/天(天然膳食纤维)；中国DRIs2023 AI 25~30g' }
    }
  }

  // ===================== 30天计划 =====================
  const DISTRIBUTION = [
    { group: '谷薯类', grams: '200~300g', note: '其中全谷物/杂豆 50~150g、薯类 50~100g，优先粗粮', examples: ['燕麦', '糙米', '红薯', '玉米', '全麦面包'] },
    { group: '蔬菜', grams: '≥300g', note: '深色蔬菜占 1/2（西兰花/菠菜/胡萝卜等）', examples: ['西兰花', '菠菜', '番茄', '黄瓜', '胡萝卜'] },
    { group: '水果', grams: '200~350g', note: '鲜果为主，不榨汁', examples: ['苹果', '蓝莓', '草莓', '橙子', '香蕉'] },
    { group: '鱼禽蛋瘦肉', grams: '120~200g', note: '优先鱼虾与禽肉，少吃深加工肉', examples: ['鸡胸肉', '三文鱼', '虾仁', '鸡蛋', '瘦牛肉'] },
    { group: '奶及奶制品', grams: '300ml+', note: '无糖酸奶/牛奶/豆浆均可', examples: ['无糖酸奶', '全脂牛奶', '无糖豆浆'] },
    { group: '大豆及坚果', grams: '25~35g', note: '坚果每天一小把，约 15g', examples: ['豆腐', '混合坚果', '鹰嘴豆'] },
    { group: '烹调油', grams: '25~30g', note: '少油烹饪，优先植物油', examples: ['橄榄油', '菜籽油'] },
    { group: '盐', grams: '<5g', note: '清淡，少吃腌制/外卖', examples: ['—'] }
  ]
  const SAMPLE_TEMPLATE = [
    { meal: '早餐', foodId: 'oats', grams: 40 },
    { meal: '早餐', foodId: 'egg', grams: 50 },
    { meal: '早餐', foodId: 'milk', grams: 200 },
    { meal: '早餐', foodId: 'apple', grams: 100 },
    { meal: '午餐', foodId: 'rice_cooked', grams: 150 },
    { meal: '午餐', foodId: 'chicken_breast', grams: 100 },
    { meal: '午餐', foodId: 'broccoli', grams: 150 },
    { meal: '午餐', foodId: 'tomato', grams: 100 },
    { meal: '晚餐', foodId: 'sweet_potato', grams: 100 },
    { meal: '晚餐', foodId: 'tofu', grams: 100 },
    { meal: '晚餐', foodId: 'spinach', grams: 150 },
    { meal: '晚餐', foodId: 'shrimp', grams: 50 },
    { meal: '加餐', foodId: 'greek_yogurt', grams: 100 },
    { meal: '加餐', foodId: 'nuts', grams: 15 }
  ]
  function fmtDate(d) {
    const m = `${d.getMonth() + 1}`.padStart(2, '0')
    const day = `${d.getDate()}`.padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  }
  function buildPlan(profile, currentWeight, targetWeight, duration, userIntake) {
    const dur = duration || 30
    const cur = parseFloat(currentWeight)
    const tgt = parseFloat(targetWeight)
    const result = {
      createdAt: fmtDate(new Date()), startDate: fmtDate(new Date()), duration: dur,
      currentWeight: cur, targetWeight: tgt, height: profile.height,
      gender: profile.gender, age: profile.age,
      activityFactor: profile.activityFactor || 1.2, alreadyThere: false, feasible30: true,
      userIntake: null
    }
    if (cur <= tgt) {
      result.alreadyThere = true
      result.tdee = predict(profile, cur, 0, 0).tdee
      return result
    }
    const b = predict(profile, cur, 0, 0)
    const tdee = b.tdee
    const needLoseKg = Math.round((cur - tgt) * 10) / 10
    const requiredDeficitPerDay = Math.round((needLoseKg * KCAL_PER_KG) / dur)
    const safeDeficit = Math.min(requiredDeficitPerDay, SAFE_DEFICIT)
    const autoIntake = Math.max(Math.round(tdee - safeDeficit), MIN_INTAKE)

    // 用户自定义摄入：留空/0 → 用安全缺口推导的默认值；其余按用户值（尊重用户设定，不强行夹取）
    let dailyIntake = autoIntake
    let lowIntakeWarn = false
    if (userIntake !== undefined && userIntake !== null && userIntake !== '' && !isNaN(parseFloat(userIntake)) && parseFloat(userIntake) > 0) {
      dailyIntake = Math.round(parseFloat(userIntake))
      result.userIntake = dailyIntake
      if (dailyIntake < MIN_INTAKE) lowIntakeWarn = true
    }
    const actualDeficit = tdee - dailyIntake
    const realisticDays = actualDeficit > 0 ? Math.ceil((needLoseKg * KCAL_PER_KG) / actualDeficit) : 999
    const end = new Date()
    end.setDate(end.getDate() + dur - 1)
    const t = targets(tgt, profile, { kcalOverride: dailyIntake, lowIntake: lowIntakeWarn })
    const sampleMenu = []
    const sampleTotal = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 }
    SAMPLE_TEMPLATE.forEach(it => {
      const food = getById(it.foodId)
      if (!food) return
      const item = computeItem(food, it.grams)
      sampleMenu.push({ meal: it.meal, foodId: food.id, name: food.name, grams: it.grams, kcal: item.kcal, protein: item.protein, carb: item.carb, fat: item.fat, fiber: item.fiber })
      sampleTotal.kcal += item.kcal
      sampleTotal.protein += item.protein
      sampleTotal.carb += item.carb
      sampleTotal.fat += item.fat
      sampleTotal.fiber += item.fiber
    })
    sampleTotal.kcal = Math.round(sampleTotal.kcal)
    sampleTotal.protein = Math.round(sampleTotal.protein * 10) / 10
    sampleTotal.carb = Math.round(sampleTotal.carb * 10) / 10
    sampleTotal.fat = Math.round(sampleTotal.fat * 10) / 10
    sampleTotal.fiber = Math.round(sampleTotal.fiber * 10) / 10
    result.bmr = b.bmr
    result.tdee = tdee
    result.needLoseKg = needLoseKg
    result.requiredDeficitPerDay = requiredDeficitPerDay
    result.safeDeficit = safeDeficit
    result.dailyIntake = dailyIntake
    result.actualDeficit = actualDeficit
    result.realisticDays = realisticDays
    result.lowIntakeWarn = lowIntakeWarn
    result.feasible30 = realisticDays <= dur
    result.endDate = fmtDate(end)
    result.budget = { kcal: t.kcal.value, protein: t.protein.value, fat: t.fat.value, carb: t.carb.value, fiber: t.fiber.value }
    result.distribution = DISTRIBUTION
    result.sampleMenu = sampleMenu
    result.sampleTotal = sampleTotal
    return result
  }

  // ===================== 小精灵情绪 =====================
  // 三态 SVG 与颜色由 sprite-data.js 注入到 global.SlimSprites / SlimSpriteColors
  function moodFor(sum, band, tgt) {
    const sprites = global.SlimSprites || {}
    const colors = global.SlimSpriteColors || { green: '#5BBF8A', orange: '#F2994A', red: '#E57373' }
    const kcalT = tgt && tgt.kcal ? tgt.kcal.value : 1
    const overRatio = sum.total.kcal / kcalT
    let sev = 0
    const reasons = []
    if (sum.total.kcal === 0) {
      return { mood: 'green', src: sprites.green, color: colors.green, text: '今天还没记录呀～记得按时吃饭、好好记录，精灵陪你一起开始！' }
    }
    if (sum.blackHits > 0) { sev = 2; reasons.push('吃了黑名单食物(' + sum.blackList.join('、') + ')') }
    if (overRatio > 1.25) { sev = Math.max(sev, 2); reasons.push('热量超出今日上限 25% 以上') }
    else if (overRatio > 1.0) { sev = Math.max(sev, 1); reasons.push('热量略超今日上限') }
    if (band) {
      if (band.label === '肥胖') { sev = Math.max(sev, 1); reasons.push('BMI 处于肥胖区间') }
      if (band.label === '偏瘦') { sev = Math.max(sev, 1); reasons.push('BMI 偏瘦，注意不要节食过度') }
    }
    if (tgt && sum.total.fiber < tgt.fiber.value) { sev = Math.max(sev, 1); reasons.push('膳食纤维不足') }
    if (tgt && sum.total.protein < tgt.protein.value) { sev = Math.max(sev, 1); reasons.push('蛋白质没吃够') }
    if (sev >= 2) {
      const what = reasons.length ? '（' + reasons.join('、') + '）' : ''
      return { mood: 'red', src: sprites.red, color: colors.red, text: '今天不太理想呢' + what + '，精灵有点小失落…明天需要加油！' }
    }
    if (sev === 1) {
      return { mood: 'orange', src: sprites.orange, color: colors.orange, text: '今天有点小波动哦' + '（' + reasons.join('、') + '），精灵有点担心，明天咱们调整一下～' }
    }
    return { mood: 'green', src: sprites.green, color: colors.green, text: '今天状态超棒！指标都在健康线内，精灵为你骄傲，明天继续保持～' }
  }

  const api = {
    CATEGORIES, FOODS, BLACK_KEYWORDS, getById, search, listByCat,
    BMI_BANDS, calcBmi, bandOf, healthyRange,
    KCAL_PER_KG, bmr, predict,
    SAFE_DEFICIT, MIN_INTAKE, PROTEIN_PER_KG, PROTEIN_RNI_F, FAT_ENERGY_MAX, CARB_ENERGY_MAX, FIBER_AI,
    computeItem, sumMeals, tdeeOf, targets,
    DISTRIBUTION, SAMPLE_TEMPLATE, buildPlan,
    moodFor
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  global.SlimAlgo = api
})(typeof window !== 'undefined' ? window : globalThis)
