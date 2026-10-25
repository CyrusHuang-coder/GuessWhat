import { WordItem, Difficulty } from '../types/game';

export const THEMES = [
  '人物和名人',
  '身边的人',
  '职业',
  '水果',
  '植物',
  '食物',
  '动物',
  '日常物品',
  '地点',
  '影视、动漫及游戏角色',
  '自定义主题',
] as const;

export type ThemeType = (typeof THEMES)[number];

export const WORD_BANK: WordItem[] = [
  // ==========================================
  // 1. 人物和名人
  // ==========================================
  // easy
  { id: 'p1', name: '爱因斯坦', theme: '人物和名人', difficulty: 'easy', aliases: ['阿尔伯特·爱因斯坦'], note: '提出相对论的现代物理学泰斗' },
  { id: 'p2', name: '李白', theme: '人物和名人', difficulty: 'easy', aliases: ['诗仙'], note: '唐代著名浪漫主义诗人，好饮酒作诗' },
  { id: 'p3', name: '牛顿', theme: '人物和名人', difficulty: 'easy', aliases: ['艾萨克·牛顿'], note: '被苹果砸中灵感发现万有引力定律' },
  { id: 'p4', name: '莎士比亚', theme: '人物和名人', difficulty: 'easy', aliases: ['威廉·莎士比亚'], note: '英国剧作家，《哈姆雷特》作者' },
  { id: 'p5', name: '贝多芬', theme: '人物和名人', difficulty: 'easy', aliases: ['乐圣'], note: '扼住命运咽喉的聋人古典音乐大师' },
  { id: 'p6', name: '秦始皇', theme: '人物和名人', difficulty: 'easy', aliases: ['嬴政'], note: '统一六国建立秦朝的千古一帝' },
  // medium
  { id: 'p7', name: '图灵', theme: '人物和名人', difficulty: 'medium', aliases: ['艾伦·图灵'], note: '计算机科学与人工智能之父，破译恩尼格玛密码' },
  { id: 'p8', name: '居里夫人', theme: '人物和名人', difficulty: 'medium', aliases: ['玛丽·居里'], note: '发现镭和钋的两次诺贝尔奖得主' },
  { id: 'p9', name: '达·芬奇', theme: '人物和名人', difficulty: 'medium', aliases: ['达芬奇', '莱昂纳多·达·芬奇'], note: '文艺复兴全才，画了《蒙娜丽莎》与《最后的晚餐》' },
  { id: 'p10', name: '梵高', theme: '人物和名人', difficulty: 'medium', aliases: ['文森特·梵高'], note: '后印象派荷兰画家，代表作《星空》《向日葵》' },
  { id: 'p11', name: '霍金', theme: '人物和名人', difficulty: 'medium', aliases: ['史蒂芬·霍金'], note: '提出黑洞蒸发理论，《时间简史》作者' },
  { id: 'p12', name: '苏轼', theme: '人物和名人', difficulty: 'medium', aliases: ['苏东坡'], note: '北宋全能文豪与美食家，“但愿人长久”作者' },
  // hard
  { id: 'p13', name: '斐波那契', theme: '人物和名人', difficulty: 'hard', aliases: ['列奥纳多·斐波那契'], note: '提出斐波那契黄金数列的中世纪数学家' },
  { id: 'p14', name: '玻尔', theme: '人物和名人', difficulty: 'hard', aliases: ['尼尔斯·玻尔'], note: '量子力学哥本哈根学派领军人物' },
  { id: 'p15', name: '埃尔德什', theme: '人物和名人', difficulty: 'hard', aliases: ['保罗·埃尔德什'], note: '一生流浪旅行与上百人合作写数学论文的奇才' },
  { id: 'p16', name: '哥德尔', theme: '人物和名人', difficulty: 'hard', aliases: ['库尔特·哥德尔'], note: '提出不完备性定理改写数理逻辑的大师' },
  { id: 'p17', name: '汉谟拉比', theme: '人物和名人', difficulty: 'hard', aliases: ['汉谟拉比大帝'], note: '颁布以“以眼还眼以牙还牙”闻名的古巴比伦国王' },
  { id: 'p18', name: '特斯拉', theme: '人物和名人', difficulty: 'hard', aliases: ['尼古拉·特斯拉'], note: '交流电系统的发明者与超前电气发明家' },

  // ==========================================
  // 2. 身边的人
  // ==========================================
  // easy
  { id: 'f1', name: '同桌', theme: '身边的人', difficulty: 'easy', aliases: ['同窗'], note: '上课坐在你旁边的人，共享橡皮擦' },
  { id: 'f2', name: '室友', theme: '身边的人', difficulty: 'easy', aliases: ['舍友'], note: '同一个寝室每天抬头不见低头见的人' },
  { id: 'f3', name: '班长', theme: '身边的人', difficulty: 'easy', aliases: ['班委'], note: '负责班级日常琐事与收发通知的统筹者' },
  { id: 'f4', name: '妈妈', theme: '身边的人', difficulty: 'easy', aliases: ['母亲'], note: '家里最常叮嘱你穿秋裤和按时吃饭的人' },
  { id: 'f5', name: '前桌', theme: '身边的人', difficulty: 'easy', aliases: ['前面同学'], note: '上课坐在你正前方，经常被你戳后背的人' },
  // medium
  { id: 'f6', name: '宿管阿姨', theme: '身边的人', difficulty: 'medium', aliases: ['宿管大叔', '楼管'], note: '掌管整栋宿舍大门钥匙与晚归登记的长辈' },
  { id: 'f7', name: '导师', theme: '身边的人', difficulty: 'medium', aliases: ['指导老师', '老板'], note: '催论文进度与每周组会的主持者' },
  { id: 'f8', name: '食堂打饭阿姨', theme: '身边的人', difficulty: 'medium', aliases: ['打饭师傅'], note: '打肉菜时勺子可能会出现经典物理振动的人' },
  { id: 'f9', name: '外卖骑手', theme: '身边的人', difficulty: 'medium', aliases: ['外卖小哥'], note: '风雨无阻带着香气敲开你家门的黄色或蓝色骑士' },
  { id: 'f10', name: '辅导员', theme: '身边的人', difficulty: 'medium', aliases: ['导员'], note: '大学里主管请假审批、奖学金与日常事务的老师' },
  // hard
  { id: 'f11', name: '答辩委员会主席', theme: '身边的人', difficulty: 'hard', aliases: ['答辩主席'], note: '毕业论文答辩台上最具终极裁决权的气场之王' },
  { id: 'f12', name: '经常借笔不还的同学', theme: '身边的人', difficulty: 'hard', aliases: ['借笔同学'], note: '书包里永远缺文具，借走你黑笔后神秘失踪的朋友' },
  { id: 'f13', name: '早八被子封印者', theme: '身边的人', difficulty: 'hard', aliases: ['赖床室友'], note: '闹钟响了八遍仍安详裹在被窝里的宿舍战友' },
  { id: 'f14', name: '群聊潜水员', theme: '身边的人', difficulty: 'hard', aliases: ['窥屏怪'], note: '三年不发一句话，但发红包时一毫秒必抢的群友' },
  { id: 'f15', name: '健身房私教', theme: '身边的人', difficulty: 'hard', aliases: ['健身教练'], note: '在器械旁微笑着说“再来最后一个”的魔鬼教练' },

  // ==========================================
  // 3. 职业（包含冷门专业与趣味特色）
  // ==========================================
  // easy
  { id: 'o1', name: '程序员', theme: '职业', difficulty: 'easy', aliases: ['软件工程师', '码农'], note: '键盘敲代码、擅长修Bug与脱发的数字工匠' },
  { id: 'o2', name: '医生', theme: '职业', difficulty: 'easy', aliases: ['大夫', '医师'], note: '穿白大褂用听诊器看病救人的专业人员' },
  { id: 'o3', name: '消防员', theme: '职业', difficulty: 'easy', aliases: ['消防官兵'], note: '穿耐火服抢险救援逆行火场的英雄' },
  { id: 'o4', name: '警察', theme: '职业', difficulty: 'easy', aliases: ['警官'], note: '维护社会治安惩治罪恶的人民卫士' },
  { id: 'o5', name: '厨师', theme: '职业', difficulty: 'easy', aliases: ['掌勺大厨'], note: '颠勺起锅掌管人间美味的烹饪师傅' },
  // medium
  { id: 'o6', name: '宇航员', theme: '职业', difficulty: 'medium', aliases: ['航天员'], note: '穿宇航服乘坐火箭探索浩瀚太空的先锋' },
  { id: 'o7', name: '法医', theme: '职业', difficulty: 'medium', aliases: ['法医病理学家'], note: '以科学勘验逝者遗体解开死因谜题的探寻者' },
  { id: 'o8', name: '潜水员', theme: '职业', difficulty: 'medium', aliases: ['蛙人'], note: '背负压缩气瓶深入水下检修或勘探的作业人员' },
  { id: 'o9', name: '配音演员', theme: '职业', difficulty: 'medium', aliases: ['声优'], note: '用万变声线为动画与影视角色赋予灵魂的幕后人' },
  { id: 'o10', name: '验光师', theme: '职业', difficulty: 'medium', aliases: ['视光师'], note: '在暗室里用综合验光仪帮你配合适度数眼镜的人' },
  { id: 'o11', name: '考古学家', theme: '职业', difficulty: 'medium', aliases: ['考古队员'], note: '用小手铲在黄土与探方中发掘古代文明遗存的人' },
  // hard (特别涵盖极冷门小众职业)
  { id: 'o12', name: '天气观测员', theme: '职业', difficulty: 'hard', aliases: ['气象观测员', '高山气象员'], note: '常驻高山或孤岛气象站记录云层、风向与气温的孤独观测者' },
  { id: 'o13', name: '古籍修复师', theme: '职业', difficulty: 'hard', aliases: ['古籍装裱师'], note: '用浆糊、毛笔和特制纸张给破损千年古卷续命的匠人' },
  { id: 'o14', name: '驯鹰人', theme: '职业', difficulty: 'hard', aliases: ['猎鹰师'], note: '传承古老非遗技艺，与猛禽猎鹰心意相通的捕猎者' },
  { id: 'o15', name: '调香师', theme: '职业', difficulty: 'hard', aliases: ['闻香师', '大鼻子'], note: '记忆数千种香料气味，在试香纸间谱写香氛乐章的人' },
  { id: 'o16', name: '水族馆潜水饲养员', theme: '职业', difficulty: 'hard', aliases: ['水下饲养员'], note: '潜入巨大水槽在鲨鱼群和鳐鱼中投喂食物并互动的饲养员' },
  { id: 'o17', name: '试睡员', theme: '职业', difficulty: 'hard', aliases: ['酒店品评家'], note: '入住各大高端特色酒店体验床垫舒适度与服务的专业测评人' },
  { id: 'o18', name: '树木医生', theme: '职业', difficulty: 'hard', aliases: ['植物病理师', '古树保护专家'], note: '诊断古树名木病虫害，为参天大树打针修枝的白衣医生' },
  { id: 'o19', name: '引航员', theme: '职业', difficulty: 'hard', aliases: ['引水员'], note: '攀上巨轮软梯引领数十万吨国际船舶安全进出港口的技术专家' },

  // ==========================================
  // 4. 水果
  // ==========================================
  // easy
  { id: 'fr1', name: '香蕉', theme: '水果', difficulty: 'easy', aliases: ['蕉'], note: '黄色弯弯的外表，剥皮即食软糯香甜' },
  { id: 'fr2', name: '苹果', theme: '水果', difficulty: 'easy', aliases: ['红富士'], note: '红润脆甜，每天一个号称远离医生' },
  { id: 'fr3', name: '西瓜', theme: '水果', difficulty: 'easy', aliases: ['夏日西瓜'], note: '绿皮红瓤黑籽，夏天抱着用勺挖着吃的消暑神器' },
  { id: 'fr4', name: '草莓', theme: '水果', difficulty: 'easy', aliases: ['红莓'], note: '心形红艳、表面布满细小芝麻籽的浆果' },
  { id: 'fr5', name: '橙子', theme: '水果', difficulty: 'easy', aliases: ['甜橙'], note: '金黄多汁富含维C，需剥皮或切块食用' },
  // medium
  { id: 'fr6', name: '榴莲', theme: '水果', difficulty: 'medium', aliases: ['水果之王'], note: '全身硬刺重铠，气味极其浓烈但口感如奶酪' },
  { id: 'fr7', name: '百香果', theme: '水果', difficulty: 'medium', aliases: ['西番莲', '鸡蛋果'], note: '香气浓郁籽多酸爽，常泡蜂蜜果茶' },
  { id: 'fr8', name: '牛油果', theme: '水果', difficulty: 'medium', aliases: ['鳄梨'], note: '果肉如黄油般绵滑，健康沙拉常驻主角' },
  { id: 'fr9', name: '山竹', theme: '水果', difficulty: 'medium', aliases: ['水果皇后'], note: '紫红厚硬外壳下包裹着如大蒜瓣般白嫩甜美的果肉' },
  { id: 'fr10', name: '无花果', theme: '水果', difficulty: 'medium', aliases: ['天生子'], note: '花朵隐藏在果实内部的甘甜软糯果品' },
  // hard (冷门奇特水果)
  { id: 'fr11', name: '姑娘果', theme: '水果', difficulty: 'hard', aliases: ['菇娘', '灯笼果'], note: '包裹在如薄纸般灯笼花萼里的金黄甜美浆果' },
  { id: 'fr12', name: '红毛丹', theme: '水果', difficulty: 'hard', aliases: ['毛荔枝'], note: '外皮长满红黄软毛的东南亚热带荔枝亲戚' },
  { id: 'fr13', name: '指橙', theme: '水果', difficulty: 'hard', aliases: ['植物鱼子酱'], note: '果肉如晶莹透明鱼子酱般爆汁的澳洲野生柑橘' },
  { id: 'fr14', name: '佛手柑', theme: '水果', difficulty: 'hard', aliases: ['九爪木'], note: '果实裂开如观音手指形状、香气极清雅的柑橘类药果' },
  { id: 'fr15', name: '神秘果', theme: '水果', difficulty: 'hard', aliases: ['变味果'], note: '吃下它几小时内，再酸的柠檬吃起来都会变甜' },
  { id: 'fr16', name: '嘉宝果', theme: '水果', difficulty: 'hard', aliases: ['树葡萄'], note: '黑紫色圆果直接密密麻麻长在树干上的奇特水果' },

  // ==========================================
  // 5. 植物
  // ==========================================
  // easy
  { id: 'pl1', name: '向日葵', theme: '植物', difficulty: 'easy', aliases: ['太阳花', '朝阳花'], note: '盘面硕大、永远朝向阳光的金色草本' },
  { id: 'pl2', name: '仙人掌', theme: '植物', difficulty: 'easy', aliases: ['仙人球'], note: '生长于沙漠旱地，叶退化成刺防蒸发' },
  { id: 'pl3', name: '竹子', theme: '植物', difficulty: 'easy', aliases: ['翠竹'], note: '中通外直、节节高升的禾本科木质化植物' },
  { id: 'pl4', name: '蒲公英', theme: '植物', difficulty: 'easy', aliases: ['婆婆丁'], note: '成熟后果实自带白色羽毛降落伞随风飞舞' },
  // medium
  { id: 'pl5', name: '含羞草', theme: '植物', difficulty: 'medium', aliases: ['感应草'], note: '羽状复叶只要轻微碰触就会立刻闭合下垂' },
  { id: 'pl6', name: '猪笼草', theme: '植物', difficulty: 'medium', aliases: ['捕虫草'], note: '叶片末端演化出瓶状笼子诱捕昆虫消化吸收' },
  { id: 'pl7', name: '银杏', theme: '植物', difficulty: 'medium', aliases: ['白果树', '公孙树'], note: '第四纪冰川孑遗活化石，深秋满树尽披黄金甲' },
  { id: 'pl8', name: '捕蝇草', theme: '植物', difficulty: 'medium', aliases: ['捕蝇夹'], note: '叶缘长满刺毛，如兽夹般感知昆虫后瞬间合拢' },
  // hard (罕见/奇特)
  { id: 'pl9', name: '大王花', theme: '植物', difficulty: 'hard', aliases: ['霸王花', '食尸花'], note: '寄生无叶无茎，开出世界最大散发腐肉恶臭的花朵' },
  { id: 'pl10', name: '九死还魂草', theme: '植物', difficulty: 'hard', aliases: ['卷柏'], note: '极度干旱时卷缩如枯球假死，浸水数小时便奇迹复活' },
  { id: 'pl11', name: '空气凤梨', theme: '植物', difficulty: 'hard', aliases: ['气生凤梨'], note: '完全不需要泥土，挂在空气中靠叶面吸水生存' },
  { id: 'pl12', name: '猴面包树', theme: '植物', difficulty: 'hard', aliases: ['波巴布树'], note: '非洲大草原上树干粗圆如水塔、蓄水上万升的生命之树' },
  { id: 'pl13', name: '见血封喉', theme: '植物', difficulty: 'hard', aliases: ['箭毒木'], note: '汁液剧毒无比，古代用于涂抹毒箭的雨林高大乔木' },

  // ==========================================
  // 6. 食物
  // ==========================================
  // easy
  { id: 'fd1', name: '火锅', theme: '食物', difficulty: 'easy', aliases: ['麻辣火锅'], note: '红汤清汤沸腾翻滚，大家围坐涮肥牛毛肚' },
  { id: 'fd2', name: '饺子', theme: '食物', difficulty: 'easy', aliases: ['水饺'], note: '逢年过节必吃，元宝造型薄皮大馅' },
  { id: 'fd3', name: '汉堡包', theme: '食物', difficulty: 'easy', aliases: ['汉堡'], note: '两片圆面包中间夹着厚实肉饼和生菜酱料' },
  { id: 'fd4', name: '炸鸡', theme: '食物', difficulty: 'easy', aliases: ['香脆炸鸡'], note: '金黄酥脆外皮包裹鲜嫩多汁鸡肉的快乐源泉' },
  // medium
  { id: 'fd5', name: '螺蛳粉', theme: '食物', difficulty: 'medium', aliases: ['柳州螺蛳粉'], note: '酸笋气味浓郁独特，酸辣鲜爽让不少人欲罢不能' },
  { id: 'fd6', name: '北京烤鸭', theme: '食物', difficulty: 'medium', aliases: ['烤鸭'], note: '挂炉烤制枣红油亮，蘸甜面酱葱丝卷荷叶饼' },
  { id: 'fd7', name: '提拉米苏', theme: '食物', difficulty: 'medium', aliases: ['带我走'], note: '融合马斯卡彭奶酪、手指饼干与浓郁咖啡酒香的意式甜点' },
  { id: 'fd8', name: '臭豆腐', theme: '食物', difficulty: 'medium', aliases: ['长沙臭豆腐'], note: '闻着奇臭无比但下油锅炸透浇汁后外酥里嫩奇香' },
  // hard
  { id: 'fd9', name: '鲱鱼罐头', theme: '食物', difficulty: 'hard', aliases: ['瑞典盐腌鲱鱼'], note: '世界公认臭味指数登峰造极的发酵海鲜挑战品' },
  { id: 'fd10', name: '佛跳墙', theme: '食物', difficulty: 'hard', aliases: ['福寿全'], note: '汇聚海参、鲍鱼、花胶慢火文煨、荤香四溢的闽菜极品' },
  { id: 'fd11', name: '仰望星空派', theme: '食物', difficulty: 'hard', aliases: ['死不瞑目派'], note: '数只鱼头从派皮中仰首向上凝望星空的英格兰传统名菜' },
  { id: 'fd12', name: '活珠子', theme: '食物', difficulty: 'hard', aliases: ['旺鸡蛋'], note: '孵化十二天左右鸡胚胎经煮熟食用的南京风味特产' },

  // ==========================================
  // 7. 动物
  // ==========================================
  // easy
  { id: 'an1', name: '大熊猫', theme: '动物', difficulty: 'easy', aliases: ['国宝', '大胖熊'], note: '中国国宝，黑白圆润喜欢懒洋洋啃竹子' },
  { id: 'an2', name: '企鹅', theme: '动物', difficulty: 'easy', aliases: ['南极企鹅'], note: '身穿黑白燕尾服、在冰雪上摇摆行走的潜泳飞鸟' },
  { id: 'an3', name: '老虎', theme: '动物', difficulty: 'easy', aliases: ['百兽之王'], note: '额带王字条纹、威震山林的独居猫科猛兽' },
  { id: 'an4', name: '长颈鹿', theme: '动物', difficulty: 'easy', aliases: ['高个子'], note: '地球上最高的陆生哺乳动物，脖子极长' },
  // medium
  { id: 'an5', name: '鸭嘴兽', theme: '动物', difficulty: 'medium', aliases: ['单孔目'], note: '卵生却哺乳、长着鸭子扁嘴与海狸尾巴的澳洲奇兽' },
  { id: 'an6', name: '变色龙', theme: '动物', difficulty: 'medium', aliases: ['避役'], note: '两只眼睛可独立转动，皮肤能随情绪和光线变幻色彩' },
  { id: 'an7', name: '树懒', theme: '动物', difficulty: 'medium', aliases: ['树獭'], note: '新陈代谢极慢，终年倒吊树上移动一步要花几分钟' },
  { id: 'an8', name: '羊驼', theme: '动物', difficulty: 'medium', aliases: ['草泥马'], note: '南美高原蓬松毛绒萌物，生气时喜欢冲人吐口水' },
  // hard
  { id: 'an9', name: '水熊虫', theme: '动物', difficulty: 'hard', aliases: ['缓步动物'], note: '能在绝对零度、真空辐射与高压深海休眠存活的微观超神生物' },
  { id: 'an10', name: '霍加皮', theme: '动物', difficulty: 'hard', aliases: ['欧卡皮鹿'], note: '长颈鹿在刚果雨林的隐秘近亲，后腿长着斑马般的斑纹' },
  { id: 'an11', name: '兔狲', theme: '动物', difficulty: 'hard', aliases: ['大脸猫'], note: '高原野生小型猫科，毛发极浓密、表情丰富多变' },
  { id: 'an12', name: '裸鼹鼠', theme: '动物', difficulty: 'hard', aliases: ['长寿鼠'], note: '生活在地下几乎不患癌症、寿命达30年以上的真社会性哺乳动物' },
  { id: 'an13', name: '鲸头鹳', theme: '动物', difficulty: 'hard', aliases: ['鸟中二哈'], note: '长着巨大靴状鸟喙、呆立数小时一动不动的非洲大鸟' },

  // ==========================================
  // 8. 日常物品
  // ==========================================
  // easy
  { id: 'ob1', name: '牙刷', theme: '日常物品', difficulty: 'easy', aliases: ['电动牙刷'], note: '早起与睡前配合牙膏清洁口腔的工具' },
  { id: 'ob2', name: '雨伞', theme: '日常物品', difficulty: 'easy', aliases: ['伞', '晴雨伞'], note: '下雨遮雨水、艳阳天遮紫外线的折叠装备' },
  { id: 'ob3', name: '手机', theme: '日常物品', difficulty: 'easy', aliases: ['智能手机'], note: '装满App现代人哪怕上厕所都离不开的便携通讯终端' },
  { id: 'ob4', name: '剪刀', theme: '日常物品', difficulty: 'easy', aliases: ['纸剪'], note: '双刃相交运用杠杆原理裁剪纸张布料的工具' },
  // medium
  { id: 'ob5', name: '指甲刀', theme: '日常物品', difficulty: 'medium', aliases: ['指甲剪'], note: '利用复合杠杆轻巧剪短手指甲脚趾甲的金属小工具' },
  { id: 'ob6', name: '订书机', theme: '日常物品', difficulty: 'medium', aliases: ['装订机'], note: '用力下压将金属小针穿透并压弯装订文件' },
  { id: 'ob7', name: '充电宝', theme: '日常物品', difficulty: 'medium', aliases: ['移动电源'], note: '出门在外手机电量告急时的便携蓄电救命稻草' },
  { id: 'ob8', name: '卷尺', theme: '日常物品', difficulty: 'medium', aliases: ['钢卷尺'], note: '拉出测量长度、一按卡扣自动弹簧收回的带刻度薄钢条' },
  // hard
  { id: 'ob9', name: '拔塞器', theme: '日常物品', difficulty: 'hard', aliases: ['红酒开瓶器'], note: '带螺旋钻头借助杠杆专门拔出红酒橡木软木塞的工具' },
  { id: 'ob10', name: '静电手环', theme: '日常物品', difficulty: 'hard', aliases: ['防静电手腕带'], note: '电子维修人员佩戴将人体静电释放入大地的专用手带' },
  { id: 'ob11', name: '挂烫机', theme: '日常物品', difficulty: 'hard', aliases: ['立式蒸汽熨斗'], note: '通电喷射高温强劲蒸汽瞬间抚平褶皱衣服的立式家电' },
  { id: 'ob12', name: '音叉', theme: '日常物品', difficulty: 'hard', aliases: ['测音叉'], note: '敲击后产生极其纯净单一固定频率振动的U型金属器' },

  // ==========================================
  // 9. 地点
  // ==========================================
  // easy
  { id: 'lc1', name: '长城', theme: '地点', difficulty: 'easy', aliases: ['万里长城'], note: '中国古代崇山峻岭间蜿蜒万里的巨型军事防御奇迹' },
  { id: 'lc2', name: '埃菲尔铁塔', theme: '地点', difficulty: 'easy', aliases: ['巴黎铁塔'], note: '矗立在法国巴黎塞纳河畔的标志性镂空钢铁高塔' },
  { id: 'lc3', name: '金字塔', theme: '地点', difficulty: 'easy', aliases: ['胡夫金字塔'], note: '古埃及尼罗河畔巨石砌筑的法老陵墓与古代七大奇迹' },
  { id: 'lc4', name: '故宫', theme: '地点', difficulty: 'easy', aliases: ['紫禁城'], note: '明清两代皇帝居住的红墙金瓦大型皇家古建筑群' },
  // medium
  { id: 'lc5', name: '马里亚纳海沟', theme: '地点', difficulty: 'medium', aliases: ['深渊挑战者深渊'], note: '西太平洋海底已知地球表面的最深凹陷区域' },
  { id: 'lc6', name: '布达拉宫', theme: '地点', difficulty: 'medium', aliases: ['拉萨布达拉宫'], note: '西藏拉萨红山之上高耸庄严的藏式宫堡式建筑群' },
  { id: 'lc7', name: '巨石阵', theme: '地点', difficulty: 'medium', aliases: ['环状列石'], note: '英国平原上几千年前由几十吨巨石环列的未解之谜' },
  { id: 'lc8', name: '死海', theme: '地点', difficulty: 'medium', aliases: ['盐海'], note: '含盐量极高、不会游泳的人也能轻轻松松浮在水面看报的内陆湖' },
  // hard
  { id: 'lc9', name: '切尔诺贝利', theme: '地点', difficulty: 'hard', aliases: ['普里皮亚季鬼城'], note: '1986年发生四级以上毁灭性核电站事故的隔离封锁禁区' },
  { id: 'lc10', name: '复活节岛', theme: '地点', difficulty: 'hard', aliases: ['拉帕努伊'], note: '太平洋孤悬小岛上数百尊凝望大海的巨型摩艾石像故乡' },
  { id: 'lc11', name: '地狱之门', theme: '地点', difficulty: 'hard', aliases: ['达尔瓦扎天然气坑'], note: '土库曼斯坦卡拉库姆沙漠中日夜熊熊燃烧五十多年的天然气大坑' },
  { id: 'lc12', name: '南极昆仑站', theme: '地点', difficulty: 'hard', aliases: ['南极冰穹A'], note: '坐落在南极冰盖最高点、极寒低氧的中国极地科考科研站' },

  // ==========================================
  // 10. 影视、动漫及游戏角色
  // ==========================================
  // easy
  { id: 'ch1', name: '皮卡丘', theme: '影视、动漫及游戏角色', difficulty: 'easy', aliases: ['黄皮耗子'], note: '宝可梦的绝对门面，脸颊带红晕会十万伏特招式的电气鼠' },
  { id: 'ch2', name: '孙悟空', theme: '影视、动漫及游戏角色', difficulty: 'easy', aliases: ['齐天大圣', '美猴王'], note: '从仙石蹦出、手持金箍棒身通七十二变的齐天大圣' },
  { id: 'ch3', name: '哈利·波特', theme: '影视、动漫及游戏角色', difficulty: 'easy', aliases: ['大难不死的男孩'], note: '霍格沃茨格兰芬多学院额头留有闪电伤疤的小巫师' },
  { id: 'ch4', name: '哆啦A梦', theme: '影视、动漫及游戏角色', difficulty: 'easy', aliases: ['机器猫', '小叮当'], note: '来自二十二世纪怕老鼠、四次元口袋里装满神奇道具的蓝胖子' },
  { id: 'ch5', name: '蜘蛛侠', theme: '影视、动漫及游戏角色', difficulty: 'easy', aliases: ['彼得·帕克'], note: '被辐射蜘蛛咬中、秉持“能力越大责任越大”在纽约楼间荡绳的英雄' },
  // medium
  { id: 'ch6', name: '柯南', theme: '影视、动漫及游戏角色', difficulty: 'medium', aliases: ['江户川柯南', '工藤新一'], note: '身体变小但头脑依旧绝顶聪明、走哪哪有命案的死神小学生' },
  { id: 'ch7', name: '马里奥', theme: '影视、动漫及游戏角色', difficulty: 'medium', aliases: ['水管工马里奥'], note: '头戴红帽穿背带裤、吃蘑菇长大钻管道救碧姬公主的意大利水管工' },
  { id: 'ch8', name: '灭霸', theme: '影视、动漫及游戏角色', difficulty: 'medium', aliases: ['萨诺斯'], note: '漫威宇宙中集齐六颗无限宝石只为打个响指抹除宇宙一半生命的紫薯霸主' },
  { id: 'ch9', name: '路飞', theme: '影视、动漫及游戏角色', difficulty: 'medium', aliases: ['草帽路飞', '蒙奇·D·路飞'], note: '吃了橡胶果实立志成为海贼王的草帽海贼团船长' },
  { id: 'ch10', name: '无脸男', theme: '影视、动漫及游戏角色', difficulty: 'medium', aliases: ['千寻无脸怪'], note: '《千与千寻》中戴着苍白笑脸面具、渴望被理解的黑色影子妖怪' },
  // hard
  { id: 'ch11', name: '林克', theme: '影视、动漫及游戏角色', difficulty: 'hard', aliases: ['海拉鲁老流氓', '勇者林克'], note: '《塞尔达传说》中手持大师之剑与希卡之石拯救塞尔达与海拉鲁的勇者' },
  { id: 'ch12', name: '杰洛特', theme: '影视、动漫及游戏角色', difficulty: 'hard', aliases: ['白狼', '利维亚的杰洛特'], note: '《猎魔人/巫师》中饮下魔药、双剑斩杀妖魔却沉迷打昆特牌的白发猎魔人' },
  { id: 'ch13', name: '尤达宝宝', theme: '影视、动漫及游戏角色', difficulty: 'hard', aliases: ['古古', 'Grogu'], note: '《曼达洛人》中大眼睛尖耳朵、对原力充满好奇的绿色萌神' },
  { id: 'ch14', name: '哥斯拉', theme: '影视、动漫及游戏角色', difficulty: 'hard', aliases: ['怪兽之王'], note: '核辐射唤醒的史前远古泰坦巨兽、口喷蓝色原子吐息的怪兽之王' },
  { id: 'ch15', name: '甘道夫', theme: '影视、动漫及游戏角色', difficulty: 'hard', aliases: ['白袍甘道夫', '灰袍甘道夫'], note: '《指环王》中在卡扎督姆之桥高呼“You shall not pass”的迈雅巫师' },
];

/**
 * 根据主题与难度筛选词条
 */
export function getWordsByFilter(theme?: string, difficulty?: string): WordItem[] {
  return WORD_BANK.filter((item) => {
    if (theme && theme !== '自定义主题' && item.theme !== theme) return false;
    if (difficulty && item.difficulty !== difficulty) return false;
    return true;
  });
}

/**
 * 随机乱序并抽取指定数量的候选词条（避免每次出题看到的都是固定几个）
 */
export function getRandomWordsByFilter(
  theme?: string,
  difficulty?: string,
  count: number = 6,
  excludeWords?: string[]
): WordItem[] {
  let matched = getWordsByFilter(theme, difficulty);

  // 排除近期已展示过的词条，保证主动换一批时内容持续更新
  if (excludeWords && excludeWords.length > 0) {
    const excludeSet = new Set(excludeWords);
    const nonExcluded = matched.filter((item) => !excludeSet.has(item.name));
    if (nonExcluded.length >= count) {
      matched = nonExcluded;
    } else if (nonExcluded.length > 0) {
      // 优先放入未排除的词条，剩余不足部分再从其它项补充
      const remaining = matched.filter((item) => excludeSet.has(item.name));
      matched = [...nonExcluded, ...remaining];
    }
  }

  // 如果当前难度匹配的词条不够，补充该主题下其他难度的词条
  if (matched.length < count && theme && theme !== '自定义主题') {
    const supplement = WORD_BANK.filter(
      (item) => item.theme === theme && !matched.some((m) => m.id === item.id)
    );
    matched = [...matched, ...supplement];
  }

  // 洗牌算法 Fisher-Yates shuffle
  const pool = [...matched];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}
