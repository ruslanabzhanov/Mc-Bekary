import { SemiFinishedProduct, DishCosting, RawMaterial } from '../types';

export const INITIAL_RAW_MATERIALS: RawMaterial[] = [
  // Мясо и птица
  { id: 'raw-chicken-fillet', name: 'Филе куриное сырое (охлажденное)', category: 'meat', categoryLabel: 'Мясо и птица', unit: 'кг', defaultUnitPrice: 1800 },
  { id: 'raw-spices', name: 'Специи для птицы и паприка', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'кг', defaultUnitPrice: 3000 },
  { id: 'raw-veg-oil', name: 'Масло растительное', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'л', defaultUnitPrice: 900 },
  
  // Рыба
  { id: 'raw-salmon-fillet', name: 'Филе семги охлажденное (Атлантик)', category: 'fish', categoryLabel: 'Рыба и морепродукты', unit: 'кг', defaultUnitPrice: 7500 },
  { id: 'raw-sea-salt-dill', name: 'Соль морская и укроп свежий', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'кг', defaultUnitPrice: 600 },

  // Овощи и зелень
  { id: 'raw-cucumber', name: 'Огурцы свежие (Гладкие/Тепличные)', category: 'veg', categoryLabel: 'Овощи и зелень', unit: 'кг', defaultUnitPrice: 850 },
  { id: 'raw-cherry-tomatoes', name: 'Томаты черри свежие', category: 'veg', categoryLabel: 'Овощи и зелень', unit: 'кг', defaultUnitPrice: 1600 },
  { id: 'raw-avocado', name: 'Авокадо свежий', category: 'veg', categoryLabel: 'Овощи и зелень', unit: 'шт', defaultUnitPrice: 450 },
  { id: 'raw-salad-mix', name: 'Салатный микс (Романо/Айсберг)', category: 'veg', categoryLabel: 'Овощи и зелень', unit: 'кг', defaultUnitPrice: 1500 },
  { id: 'raw-peking-cabbage', name: 'Пекинская капуста', category: 'veg', categoryLabel: 'Овощи и зелень', unit: 'кг', defaultUnitPrice: 600 },
  { id: 'raw-iceberg-leaves', name: 'Листья салата Айсберг', category: 'veg', categoryLabel: 'Овощи и зелень', unit: 'кг', defaultUnitPrice: 1200 },
  { id: 'raw-ginger-garlic', name: 'Имбирь свежий и чеснок', category: 'veg', categoryLabel: 'Овощи и зелень', unit: 'кг', defaultUnitPrice: 2000 },

  // Соусы и бакалея
  { id: 'raw-soy-sauce', name: 'Соус соевый классический', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'л', defaultUnitPrice: 1200 },
  { id: 'raw-teriyaki-base', name: 'Заправка кунжутная соус', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'л', defaultUnitPrice: 900 },
  { id: 'raw-pesto-sauce', name: 'Соус песто', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'л', defaultUnitPrice: 3500 },
  { id: 'raw-mustard-lemon', name: 'Соус лимонно-горчичный', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'л', defaultUnitPrice: 1100 },
  { id: 'raw-sugar', name: 'Сахар-песок', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'кг', defaultUnitPrice: 450 },
  { id: 'raw-corn-starch', name: 'Крахмал кукурузный', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'кг', defaultUnitPrice: 800 },
  { id: 'raw-rice-vinegar', name: 'Заправка рисовая (Мирин / Уксус)', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'л', defaultUnitPrice: 1500 },
  { id: 'raw-honey', name: 'Мед натуральный горный', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'кг', defaultUnitPrice: 2500 },

  // Крупы и мука
  { id: 'raw-rice-jasmine', name: 'Крупа Рис Жасмин / Киноа', category: 'bakery', categoryLabel: 'Крупы и мука', unit: 'кг', defaultUnitPrice: 1200 },
  { id: 'raw-flour', name: 'Мука пшеничная в/с', category: 'bakery', categoryLabel: 'Крупы и мука', unit: 'кг', defaultUnitPrice: 350 },
  { id: 'raw-sesame-seeds', name: 'Кунжут обжаренный', category: 'bakery', categoryLabel: 'Крупы и мука', unit: 'кг', defaultUnitPrice: 4000 },
  { id: 'raw-medovik-crumbs', name: 'Крошка медовая для посыпки', category: 'bakery', categoryLabel: 'Крупы и мука', unit: 'кг', defaultUnitPrice: 1200 },
  { id: 'raw-napoleon-crumbs', name: 'Крошка слоеная для посыпки', category: 'bakery', categoryLabel: 'Крупы и мука', unit: 'кг', defaultUnitPrice: 1000 },

  // Молочные продукты и яйцо
  { id: 'raw-egg', name: 'Яйцо куриное (С0 / Пашот)', category: 'dairy', categoryLabel: 'Молочные продукты и яйцо', unit: 'шт', defaultUnitPrice: 80 },
  { id: 'raw-butter', name: 'Масло сливочное 82.5%', category: 'dairy', categoryLabel: 'Молочные продукты и яйцо', unit: 'кг', defaultUnitPrice: 3200 },
  { id: 'raw-sour-cream', name: 'Сметана фермерская 30%', category: 'dairy', categoryLabel: 'Молочные продукты и яйцо', unit: 'кг', defaultUnitPrice: 1400 },
  { id: 'raw-vanilla-sugar', name: 'Пудра сахарная ванильная', category: 'sauce', categoryLabel: 'Соусы и бакалея', unit: 'кг', defaultUnitPrice: 700 },
  { id: 'raw-gouda-cheese', name: 'Сыр Гауда 45%', category: 'dairy', categoryLabel: 'Молочные продукты и яйцо', unit: 'кг', defaultUnitPrice: 3800 },
  { id: 'raw-cream-cheese', name: 'Сыр творожный сливочный', category: 'dairy', categoryLabel: 'Молочные продукты и яйцо', unit: 'кг', defaultUnitPrice: 2900 },
  { id: 'raw-cheddar-toast', name: 'Сыр тостовый Чеддер', category: 'dairy', categoryLabel: 'Молочные продукты и яйцо', unit: 'шт', defaultUnitPrice: 45 },

  // Выпечка заготовки
  { id: 'raw-toast-bread', name: 'Хлеб тостовый пшеничный', category: 'bakery', categoryLabel: 'Выпечка заготовки', unit: 'шт', defaultUnitPrice: 35 },
  { id: 'raw-croissant-shell', name: 'Круассан тестовая заготовка французская', category: 'bakery', categoryLabel: 'Выпечка заготовки', unit: 'шт', defaultUnitPrice: 280 },

  // Упаковка и расходники
  { id: 'pack-bowl-eco', name: 'Контейнер Боул Эко (крафт)', category: 'packaging', categoryLabel: 'Упаковка и расходники', unit: 'шт', defaultUnitPrice: 90 },
  { id: 'pack-salad-transparent', name: 'Салатник прозрачный с крышкой', category: 'packaging', categoryLabel: 'Упаковка и расходники', unit: 'шт', defaultUnitPrice: 85 },
  { id: 'pack-craft-bag', name: 'Крафт-пакет фирменный', category: 'packaging', categoryLabel: 'Упаковка и расходники', unit: 'шт', defaultUnitPrice: 25 },
  { id: 'pack-sandwich-tri', name: 'Упаковка сэндвич-треугольник', category: 'packaging', categoryLabel: 'Упаковка и расходники', unit: 'шт', defaultUnitPrice: 40 },
  { id: 'pack-blister-dessert', name: 'Блистер десертный треугольный', category: 'packaging', categoryLabel: 'Упаковка и расходники', unit: 'шт', defaultUnitPrice: 35 }
];

export const INITIAL_SEMI_FINISHED: SemiFinishedProduct[] = [
  {
    id: 'semi-chicken-baked',
    name: 'Запеченное куриное филе со специями',
    unit: 'кг',
    unitCost: 2160,
    category: 'prep_meat',
    categoryLabel: 'Мясо и птица',
    prepInstructions: 'Натереть филе специями и маслом, запекать в пароконвектомате при 180°C 35 минут. Остудить, нарезать соломкой/кубиком.',
    ingredients: [
      { id: 'i1', rawMaterialName: 'Филе куриное сырое (охлажденное)', quantity: 1.15, unit: 'кг', unitPrice: 1800 },
      { id: 'i2', rawMaterialName: 'Специи для птицы и паприка', quantity: 0.02, unit: 'кг', unitPrice: 3000 },
      { id: 'i3', rawMaterialName: 'Масло растительное', quantity: 0.03, unit: 'л', unitPrice: 900 }
    ]
  },
  {
    id: 'semi-cucumber-sliced',
    name: 'Нарезанный свежий огурец',
    unit: 'кг',
    unitCost: 890,
    category: 'prep_veg',
    categoryLabel: 'Нарезка и овощи',
    prepInstructions: 'Промыть огурцы, срезать хвостики, нарезать слайсами или соломкой 4х4 мм на слайсере.',
    ingredients: [
      { id: 'i4', rawMaterialName: 'Огурцы свежие (Гладкие/Тепличные)', quantity: 1.05, unit: 'кг', unitPrice: 850 }
    ]
  },
  {
    id: 'semi-cherry-sliced',
    name: 'Нарезанные томаты черри',
    unit: 'кг',
    unitCost: 1650,
    category: 'prep_veg',
    categoryLabel: 'Нарезка и овощи',
    prepInstructions: 'Промыть томаты черри, обсушить полотенцем, разрезать вдоль на 2 половины.',
    ingredients: [
      { id: 'i5', rawMaterialName: 'Томаты черри свежие', quantity: 1.03, unit: 'кг', unitPrice: 1600 }
    ]
  },
  {
    id: 'semi-teriyaki-sauce',
    name: 'Соус Терияки фирменный',
    unit: 'л',
    unitCost: 970,
    category: 'prep_sauce',
    categoryLabel: 'Соусы и заправки',
    prepInstructions: 'Смешать соевый соус, сахар, имбирь и крахмал. Уваривать на медленном огне 15 минут до загустения.',
    ingredients: [
      { id: 'i6', rawMaterialName: 'Соус соевый классический', quantity: 0.6, unit: 'л', unitPrice: 1200 },
      { id: 'i7', rawMaterialName: 'Сахар-песок', quantity: 0.25, unit: 'кг', unitPrice: 450 },
      { id: 'i8', rawMaterialName: 'Имбирь свежий и чеснок', quantity: 0.05, unit: 'кг', unitPrice: 2000 },
      { id: 'i9', rawMaterialName: 'Крахмал кукурузный', quantity: 0.05, unit: 'кг', unitPrice: 800 }
    ]
  },
  {
    id: 'semi-cooked-rice',
    name: 'Сваренный рис / киноа для боулов',
    unit: 'кг',
    unitCost: 615,
    category: 'prep_grain',
    categoryLabel: 'Крупы и заготовки',
    prepInstructions: 'Промыть рис/киноа до прозрачной воды. Отваривать 1:2 в рисоварке 20 минут. Заправить рисовым уксусом.',
    ingredients: [
      { id: 'i10', rawMaterialName: 'Крупа Рис Жасмин / Киноа', quantity: 0.45, unit: 'кг', unitPrice: 1200 },
      { id: 'i11', rawMaterialName: 'Заправка рисовая (Мирин / Уксус)', quantity: 0.05, unit: 'л', unitPrice: 1500 }
    ]
  },
  {
    id: 'semi-salmon-cured',
    name: 'Семга слабосоленая (слайсы)',
    unit: 'кг',
    unitCost: 8265,
    category: 'prep_meat',
    categoryLabel: 'Рыба и морепродукты',
    prepInstructions: 'Засолить филе семги морской солью и сахаром с укропом. Выдержать 12 часов при +4°C, нарезать тонким слайсом.',
    ingredients: [
      { id: 'i12', rawMaterialName: 'Филе семги охлажденное (Атлантик)', quantity: 1.10, unit: 'кг', unitPrice: 7500 },
      { id: 'i13', rawMaterialName: 'Соль морская и укроп свежий', quantity: 0.05, unit: 'кг', unitPrice: 600 }
    ]
  },
  {
    id: 'semi-puff-dough',
    name: 'Коржи выпеченные (Медовик/Наполеон)',
    unit: 'кг',
    unitCost: 1650,
    category: 'prep_bakery',
    categoryLabel: 'Тесто и коржи',
    prepInstructions: 'Замесить медовое/слоеное тесто, раскатать тонкие пласты, выпекать при 200°C 8 минут до золотистой корочки.',
    ingredients: [
      { id: 'i14', rawMaterialName: 'Мука пшеничная в/с', quantity: 0.45, unit: 'кг', unitPrice: 350 },
      { id: 'i15', rawMaterialName: 'Масло сливочное 82.5%', quantity: 0.35, unit: 'кг', unitPrice: 3200 },
      { id: 'i16', rawMaterialName: 'Мед натуральный горный', quantity: 0.15, unit: 'кг', unitPrice: 2500 }
    ]
  },
  {
    id: 'semi-sour-cream-fill',
    name: 'Крем сметанно-заварной',
    unit: 'кг',
    unitCost: 1260,
    category: 'prep_sauce',
    categoryLabel: 'Соусы и заправки',
    prepInstructions: 'Взбить охлажденную сметану 30% с сахарной пудрой и натуральной ванилью в планетарном миксере 7 минут.',
    ingredients: [
      { id: 'i17', rawMaterialName: 'Сметана фермерская 30%', quantity: 0.80, unit: 'кг', unitPrice: 1400 },
      { id: 'i18', rawMaterialName: 'Пудра сахарная ванильная', quantity: 0.20, unit: 'кг', unitPrice: 700 }
    ]
  }
];

export const INITIAL_DISH_COSTINGS: Record<string, DishCosting> = {
  'bowl': {
    productId: 'bowl',
    semiFinishedItems: [
      { semiFinishedId: 'semi-cooked-rice', quantity: 0.12, unit: 'кг' },
      { semiFinishedId: 'semi-cherry-sliced', quantity: 0.04, unit: 'кг' },
      { semiFinishedId: 'semi-cucumber-sliced', quantity: 0.04, unit: 'кг' }
    ],
    rawIngredients: [
      { id: 'r1', name: 'Авокадо свежий', quantity: 0.5, unit: 'шт', unitPrice: 450 },
      { id: 'r2', name: 'Яйцо пашот', quantity: 1, unit: 'шт', unitPrice: 80 },
      { id: 'r3', name: 'Заправка кунжутная соус', quantity: 0.03, unit: 'л', unitPrice: 900 },
      { id: 'r4', name: 'Контейнер Боул Эко (крафт)', quantity: 1, unit: 'шт', unitPrice: 90 }
    ]
  },
  'salmon-salad': {
    productId: 'salmon-salad',
    semiFinishedItems: [
      { semiFinishedId: 'semi-salmon-cured', quantity: 0.06, unit: 'кг' },
      { semiFinishedId: 'semi-cherry-sliced', quantity: 0.04, unit: 'кг' }
    ],
    rawIngredients: [
      { id: 'r5', name: 'Салатный микс (Романо/Айсберг)', quantity: 0.10, unit: 'кг', unitPrice: 1500 },
      { id: 'r6', name: 'Соус лимонно-горчичный', quantity: 0.03, unit: 'л', unitPrice: 1100 },
      { id: 'r7', name: 'Салатник прозрачный с крышкой', quantity: 1, unit: 'шт', unitPrice: 85 }
    ]
  },
  'teriyaki-chicken-salad': {
    productId: 'teriyaki-chicken-salad',
    semiFinishedItems: [
      { semiFinishedId: 'semi-chicken-baked', quantity: 0.09, unit: 'кг' },
      { semiFinishedId: 'semi-teriyaki-sauce', quantity: 0.03, unit: 'л' },
      { semiFinishedId: 'semi-cucumber-sliced', quantity: 0.05, unit: 'кг' }
    ],
    rawIngredients: [
      { id: 'r8', name: 'Пекинская капуста', quantity: 0.08, unit: 'кг', unitPrice: 600 },
      { id: 'r9', name: 'Кунжут обжаренный', quantity: 0.005, unit: 'кг', unitPrice: 4000 },
      { id: 'r10', name: 'Салатник прозрачный с крышкой', quantity: 1, unit: 'шт', unitPrice: 85 }
    ]
  },
  'chicken-croissant': {
    productId: 'chicken-croissant',
    semiFinishedItems: [
      { semiFinishedId: 'semi-chicken-baked', quantity: 0.08, unit: 'кг' },
      { semiFinishedId: 'semi-cucumber-sliced', quantity: 0.03, unit: 'кг' }
    ],
    rawIngredients: [
      { id: 'r11', name: 'Круассан тестовая заготовка французская', quantity: 1, unit: 'шт', unitPrice: 280 },
      { id: 'r12', name: 'Сыр Гауда 45%', quantity: 0.03, unit: 'кг', unitPrice: 3800 },
      { id: 'r13', name: 'Соус песто', quantity: 0.015, unit: 'л', unitPrice: 3500 },
      { id: 'r14', name: 'Крафт-пакет фирменный', quantity: 1, unit: 'шт', unitPrice: 25 }
    ]
  },
  'salmon-croissant': {
    productId: 'salmon-croissant',
    semiFinishedItems: [
      { semiFinishedId: 'semi-salmon-cured', quantity: 0.05, unit: 'кг' },
      { semiFinishedId: 'semi-cucumber-sliced', quantity: 0.02, unit: 'кг' }
    ],
    rawIngredients: [
      { id: 'r15', name: 'Круассан тестовая заготовка французская', quantity: 1, unit: 'шт', unitPrice: 280 },
      { id: 'r16', name: 'Сыр творожный сливочный', quantity: 0.03, unit: 'кг', unitPrice: 2900 },
      { id: 'r17', name: 'Крафт-пакет фирменный', quantity: 1, unit: 'шт', unitPrice: 25 }
    ]
  },
  'chicken-sandwich': {
    productId: 'chicken-sandwich',
    semiFinishedItems: [
      { semiFinishedId: 'semi-chicken-baked', quantity: 0.09, unit: 'кг' },
      { semiFinishedId: 'semi-teriyaki-sauce', quantity: 0.02, unit: 'л' }
    ],
    rawIngredients: [
      { id: 'r18', name: 'Хлеб тостовый пшеничный', quantity: 2, unit: 'шт', unitPrice: 35 },
      { id: 'r19', name: 'Листья салата Айсберг', quantity: 0.03, unit: 'кг', unitPrice: 1200 },
      { id: 'r20', name: 'Сыр тостовый Чеддер', quantity: 1, unit: 'шт', unitPrice: 45 },
      { id: 'r21', name: 'Упаковка сэндвич-треугольник', quantity: 1, unit: 'шт', unitPrice: 40 }
    ]
  },
  'medovik': {
    productId: 'medovik',
    semiFinishedItems: [
      { semiFinishedId: 'semi-puff-dough', quantity: 0.09, unit: 'кг' },
      { semiFinishedId: 'semi-sour-cream-fill', quantity: 0.06, unit: 'кг' }
    ],
    rawIngredients: [
      { id: 'r22', name: 'Крошка медовая для посыпки', quantity: 0.01, unit: 'кг', unitPrice: 1200 },
      { id: 'r23', name: 'Блистер десертный треугольный', quantity: 1, unit: 'шт', unitPrice: 35 }
    ]
  },
  'napoleon': {
    productId: 'napoleon',
    semiFinishedItems: [
      { semiFinishedId: 'semi-puff-dough', quantity: 0.10, unit: 'кг' },
      { semiFinishedId: 'semi-sour-cream-fill', quantity: 0.06, unit: 'кг' }
    ],
    rawIngredients: [
      { id: 'r24', name: 'Крошка слоеная для посыпки', quantity: 0.01, unit: 'кг', unitPrice: 1000 },
      { id: 'r25', name: 'Блистер десертный треугольный', quantity: 1, unit: 'шт', unitPrice: 35 }
    ]
  }
};

// Helper: Compute cost of 1 unit of semi-finished product
export function calculateSemiCost(semi: SemiFinishedProduct): number {
  return semi.ingredients.reduce((acc, ing) => {
    return acc + (ing.quantity * ing.unitPrice);
  }, 0);
}

// Helper: Compute prime cost of a finished dish
export function calculateDishPrimeCost(
  costing: DishCosting,
  semiMap: Map<string, SemiFinishedProduct>
): number {
  let total = 0;
  // Cost of semi-finished items
  costing.semiFinishedItems.forEach((item) => {
    const semi = semiMap.get(item.semiFinishedId);
    if (semi) {
      const semiUnitPrice = calculateSemiCost(semi) || semi.unitCost;
      total += item.quantity * semiUnitPrice;
    }
  });
  // Cost of direct raw ingredients
  costing.rawIngredients.forEach((item) => {
    total += item.quantity * item.unitPrice;
  });
  return Math.round(total);
}
