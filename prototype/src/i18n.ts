export type Lang = 'uz' | 'ru'

type Dict = Record<string, { uz: string; ru: string }>

const t: Dict = {
  appTitle: { uz: 'Forest AI', ru: 'Forest AI' },
  appSubtitle: {
    uz: 'Daraxtlarni dron va sun\'iy intellekt yordamida raqamli monitoring',
    ru: 'Цифровой мониторинг деревьев с помощью дронов и ИИ',
  },
  legalBasis: {
    uz: 'Huquqiy asos: PF-47-son Farmon · 25.03.2026',
    ru: 'Правовая основа: Указ ПФ-47 · 25.03.2026',
  },
  view2d: { uz: '2D xarita', ru: '2D карта' },
  view3d: { uz: '3D xarita', ru: '3D карта' },
  viewMap: { uz: 'Xarita', ru: 'Карта' },
  viewChart: { uz: '3D diagramma', ru: '3D диаграмма' },
  levelRegion: { uz: 'Viloyat', ru: 'Область' },
  levelDistrict: { uz: 'Tuman', ru: 'Район' },
  chartHint: {
    uz: 'Ustunlar — yashillik darajasi bo\'yicha saralangan · sichqoncha bilan aylantiring',
    ru: 'Столбцы отсортированы по уровню озеленения · вращайте мышью',
  },
  topDistricts: { uz: 'Eng yashil 24 tuman', ru: 'Топ-24 района по озеленению' },
  allRegions: { uz: 'Barcha viloyatlar', ru: 'Все области' },

  nationalOverview: { uz: 'Milliy ko\'rsatkichlar', ru: 'Национальные показатели' },
  target2030: { uz: '2030-yilgacha maqsad', ru: 'Цель к 2030 году' },
  currentGreenery: { uz: 'Hozirgi yashillik darajasi', ru: 'Текущий уровень озеленения' },
  perCapita: { uz: 'Aholi jon boshiga yashil hudud', ru: 'Зелень на человека' },
  pmReduction: { uz: 'PM2.5 / PM10 kamaytirish', ru: 'Снижение PM2.5 / PM10' },
  districtsCount: { uz: 'Kuzatilayotgan tumanlar', ru: 'Отслеживаемых районов' },
  totalTrees: { uz: 'Jami hisobga olingan daraxtlar', ru: 'Всего учтённых деревьев' },

  selectRegionHint: {
    uz: 'Statistikani ko\'rish uchun xaritadan hududni tanlang',
    ru: 'Выберите район на карте для просмотра статистики',
  },
  greeneryPercent: { uz: 'Yashillik darajasi', ru: 'Уровень озеленения' },
  treeCount: { uz: 'Daraxtlar soni', ru: 'Количество деревьев' },
  healthyPercent: { uz: 'Sog\'lom daraxtlar', ru: 'Здоровых деревьев' },
  atRisk: { uz: 'Xavf ostida', ru: 'Под угрозой' },
  dead: { uz: 'Nobud bo\'lgan', ru: 'Погибших' },
  newlyPlanted: { uz: 'Yangi ekilgan', ru: 'Недавно высажено' },
  avgNdvi: { uz: 'O\'rtacha NDVI', ru: 'Средний NDVI' },
  lastSurvey: { uz: 'Oxirgi s\'yomka', ru: 'Последняя съёмка' },
  trendTitle: { uz: 'Yashillik dinamikasi (2021–2026)', ru: 'Динамика озеленения (2021–2026)' },
  healthBreakdown: { uz: 'Daraxtlar holati', ru: 'Состояние деревьев' },
  healthy: { uz: 'Sog\'lom', ru: 'Здоровые' },

  close: { uz: 'Yopish', ru: 'Закрыть' },
  cat_healthy: { uz: 'Sog\'lom', ru: 'Здоровые' },
  cat_atRisk: { uz: 'Xavf ostida', ru: 'Под угрозой' },
  cat_dead: { uz: 'Nobud bo\'lgan', ru: 'Погибшие' },
  cat_planted: { uz: 'Ekilgan', ru: 'Посаженные' },
  zoneTotal: { uz: 'Jami daraxtlar', ru: 'Всего деревьев' },
  yearLabel: { uz: 'Yil', ru: 'Год' },
  mfyZone: { uz: 'Mahalla (MFY)', ru: 'Махалля (MFY)' },
  backToMap: { uz: 'Xaritaga qaytish', ru: 'Назад к карте' },
  zoomForZones: { uz: 'Zonalarni ko\'rish uchun yaqinlashtiring', ru: 'Приблизьте, чтобы увидеть зоны' },
  dynamicsByYear: { uz: 'Yillar bo\'yicha dinamika', ru: 'Динамика по годам' },
  statsTab: { uz: 'Statistika', ru: 'Статистика' },
  speciesTitle: { uz: 'Daraxt turlari', ru: 'Породы деревьев' },
  sp_chinor: { uz: 'Chinor', ru: 'Чинар' },
  sp_dub: { uz: 'Eman', ru: 'Дуб' },
  sp_klen: { uz: 'Zarang', ru: 'Клён' },
  sp_bereza: { uz: 'Qayin', ru: 'Берёза' },
  sp_osina: { uz: 'Tol terak', ru: 'Осина' },
  sp_iva: { uz: 'Tol', ru: 'Ива' },
  sp_kashtan: { uz: 'Kashtan', ru: 'Каштан' },
  sp_ryabina: { uz: 'Chetan', ru: 'Рябина' },

  legendTitle: { uz: 'Yashillik darajasi', ru: 'Уровень озеленения' },
  legendLow: { uz: 'past', ru: 'низкий' },
  legendHigh: { uz: 'yuqori', ru: 'высокий' },

  rotateHint: {
    uz: 'Aylantirish uchun sichqonchani torting · yaqinlashtirish uchun g\'ildirak',
    ru: 'Вращение — перетаскивание мышью · масштаб — колесо',
  },
  footer: {
    uz: 'Raqamli daraxt monitoringi · Prototip 2026',
    ru: 'Цифровой мониторинг деревьев · Прототип 2026',
  },
}

export function tr(key: keyof typeof t, lang: Lang): string {
  return t[key]?.[lang] ?? String(key)
}

// Daraxt turi nomi (species id -> UZ/RU)
export function speciesName(id: string, lang: Lang): string {
  const key = `sp_${id}` as keyof typeof t
  return t[key]?.[lang] ?? id
}

// Tuman nomlarini toza ko'rsatish (kodlash muammolarini yumshatish)
export function cleanName(name: string): string {
  return name.replace(/�/g, "'").trim()
}
