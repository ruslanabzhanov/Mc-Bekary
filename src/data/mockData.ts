import { Product, CoffeeShop, ShopOrder, StaffMember, RegistrationRequest, StaffRole } from '../types';

export const PRODUCTS: Product[] = [
  // -------------------------------------------------------------
  // 1. Круассаны и слойки (6)
  // -------------------------------------------------------------
  {
    id: 'croissant-chicken',
    name: 'Круассан с курицей',
    category: 'croissants',
    categoryLabel: 'Круассаны и слойки',
    unit: 'шт',
    price: 1850,
    unitWeight: '190г',
    shelfLife: '18 ч',
    department: 'bakery',
    imageEmoji: '🥐',
    imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80',
    description: 'Хрустящий масляный круассан с запеченной куриной грудкой, сыром гауда и свежей зеленью'
  },
  {
    id: 'croissant-salmon',
    name: 'Круассан с семгой',
    category: 'croissants',
    categoryLabel: 'Круассаны и слойки',
    unit: 'шт',
    price: 2450,
    unitWeight: '185г',
    shelfLife: '18 ч',
    department: 'bakery',
    imageEmoji: '🥐',
    imageUrl: 'https://images.unsplash.com/photo-1530610478688-64203991d3fc?auto=format&fit=crop&w=800&q=80',
    description: 'Круассан со слабосоленой семгой, нежным сливочным сыром и свежим огурчиком'
  },
  {
    id: 'croissant-almond',
    name: 'Миндальный круассан',
    category: 'croissants',
    categoryLabel: 'Круассаны и слойки',
    unit: 'шт',
    price: 1650,
    unitWeight: '160г',
    shelfLife: '24 ч',
    department: 'bakery',
    imageEmoji: '🥐',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    description: 'Французский круассан с миндальным кремом франжипан и лепестками миндаля'
  },
  {
    id: 'croissant-pistachio',
    name: 'Фисташковый круассан',
    category: 'croissants',
    categoryLabel: 'Круассаны и слойки',
    unit: 'шт',
    price: 1890,
    unitWeight: '170г',
    shelfLife: '24 ч',
    department: 'bakery',
    imageEmoji: '🥐',
    imageUrl: 'https://images.unsplash.com/photo-1623334044303-241021148842?auto=format&fit=crop&w=800&q=80',
    description: 'Пышный круассан с густой фисташковой пастой и дробленым орехом'
  },
  {
    id: 'croissant-classic',
    name: 'Классический круассан',
    category: 'croissants',
    categoryLabel: 'Круассаны и слойки',
    unit: 'шт',
    price: 950,
    unitWeight: '110г',
    shelfLife: '24 ч',
    department: 'bakery',
    imageEmoji: '🥐',
    imageUrl: 'https://images.unsplash.com/photo-1549903072-7e6e0bedb7fb?auto=format&fit=crop&w=800&q=80',
    description: 'Классический слоеный рогалик на натуральном французском сливочном масле'
  },
  {
    id: 'puff-apple',
    name: 'Яблочная слойка',
    category: 'croissants',
    categoryLabel: 'Круассаны и слойки',
    unit: 'шт',
    price: 1150,
    unitWeight: '150г',
    shelfLife: '24 ч',
    department: 'bakery',
    imageEmoji: '🥐',
    imageUrl: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&w=800&q=80',
    description: 'Слоеный конвертик с ароматной яблочно-коричной начинкой'
  },

  // -------------------------------------------------------------
  // 2. Сэндвичи и завтраки (14)
  // -------------------------------------------------------------
  {
    id: 'twist-chicken',
    name: 'Твист с курицей',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'шт',
    price: 1750,
    unitWeight: '220г',
    shelfLife: '24 ч',
    department: 'sandwiches',
    imageEmoji: '🥪',
    imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=800&q=80',
    description: 'Запеченный твист-ролл с курицей, овощами и пикантным фирменным соусом'
  },
  {
    id: 'puff-sandwich-cheese',
    name: 'Слойка сэндвич с курией и сыром',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'шт',
    price: 1850,
    unitWeight: '200г',
    shelfLife: '24 ч',
    department: 'sandwiches',
    imageEmoji: '🥪',
    imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80',
    description: 'Слоеная чиабатта с сочной куриной грудкой и расплавленным сыром чеддер'
  },
  {
    id: 'puff-sandwich-chicken',
    name: 'Слойка сэндвич с курицей',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'шт',
    price: 1690,
    unitWeight: '190г',
    shelfLife: '24 ч',
    department: 'sandwiches',
    imageEmoji: '🥪',
    imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
    description: 'Слоеная выпечка с куриным филе и авторской заправкой'
  },
  {
    id: 'bagel-chicken',
    name: 'Бейгл с курицей',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'шт',
    price: 1950,
    unitWeight: '210г',
    shelfLife: '24 ч',
    department: 'sandwiches',
    imageEmoji: '🥯',
    imageUrl: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=800&q=80',
    description: 'Нью-йоркский бейгл с кунжутом, куриным филе и соусом песто'
  },
  {
    id: 'sandwich-turkey-pesto',
    name: 'Сэндвич индейка с песто',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'шт',
    price: 2150,
    unitWeight: '230г',
    shelfLife: '24 ч',
    department: 'sandwiches',
    imageEmoji: '🥪',
    imageUrl: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=800&q=80',
    description: 'Клаб-сэндвич с копченой грудкой индейки, итальянским песто и томатами'
  },
  {
    id: 'crepe-chicken',
    name: 'Креп с курицей',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'порц',
    price: 1890,
    unitWeight: '240г',
    shelfLife: '24 ч',
    department: 'sandwiches',
    imageEmoji: '🥞',
    imageUrl: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=800&q=80',
    description: 'Французские блинчики с начинкой из курицы в сливочно-грибном соусе'
  },
  {
    id: 'sandwich-coleslaw',
    name: 'Сэндвич с коул слоу',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'шт',
    price: 1450,
    unitWeight: '200г',
    shelfLife: '24 ч',
    department: 'sandwiches',
    imageEmoji: '🥪',
    imageUrl: 'https://images.unsplash.com/photo-1475090169767-40ea83182965?auto=format&fit=crop&w=800&q=80',
    description: 'Сэндвич с сочным хрустящим салатом коул-слоу и заправкой'
  },
  {
    id: 'sandwich-corn-cheese',
    name: 'Сэндвич с сырной кукурузой',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'шт',
    price: 1550,
    unitWeight: '210г',
    shelfLife: '24 ч',
    department: 'sandwiches',
    imageEmoji: '🥪',
    imageUrl: 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?auto=format&fit=crop&w=800&q=80',
    description: 'Горячий тост со сладкой кукурузой и расплавленным сыром'
  },
  {
    id: 'sandwich-kazy-new',
    name: 'Сэндвич с казы новый',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'шт',
    price: 2650,
    unitWeight: '240г',
    shelfLife: '18 ч',
    department: 'sandwiches',
    imageEmoji: '🥪',
    imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80',
    description: 'Премиум сэндвич с тонкой нарезкой деликатесной казы и пикантным соусом'
  },
  {
    id: 'porridge-oatmeal',
    name: 'Каша овсяная',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'порц',
    price: 1250,
    unitWeight: '280г',
    shelfLife: '12 ч',
    department: 'sandwiches',
    imageEmoji: '🥣',
    imageUrl: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=800&q=80',
    description: 'Нежная овсяная каша на молоке со сливочным маслом'
  },
  {
    id: 'porridge-rice',
    name: 'Каша рисовая',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'порц',
    price: 1250,
    unitWeight: '280г',
    shelfLife: '12 ч',
    department: 'sandwiches',
    imageEmoji: '🥣',
    imageUrl: 'https://images.unsplash.com/photo-1584947897116-41913f0267e8?auto=format&fit=crop&w=800&q=80',
    description: 'Традиционная кремовая рисовая каша со сливочным маслом'
  },
  {
    id: 'fried-eggs-sausages',
    name: 'Глазунья с колбасками',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'порц',
    price: 2250,
    unitWeight: '310г',
    shelfLife: '12 ч',
    department: 'sandwiches',
    imageEmoji: '🍳',
    imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
    description: 'Горячий завтрак из двух яиц глазунья, обжаренных колбасок и черри'
  },
  {
    id: 'quiche-chicken-mushroom',
    name: 'Киш курица-грибы',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'шт',
    price: 1850,
    unitWeight: '200г',
    shelfLife: '24 ч',
    department: 'sandwiches',
    imageEmoji: '🥧',
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    description: 'Французский открытый пирог с курочкой, шампиньонами и сырной заливкой'
  },
  {
    id: 'scramble-kazy',
    name: 'Скрембл с казы',
    category: 'sandwiches',
    categoryLabel: 'Сэндвичи и завтраки',
    unit: 'порц',
    price: 2750,
    unitWeight: '290г',
    shelfLife: '12 ч',
    department: 'sandwiches',
    imageEmoji: '🍳',
    imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
    description: 'Пышный яичный скрембл со ломтиками обжаренной казы и салатным миксом'
  },

  // -------------------------------------------------------------
  // 3. Десерты (15)
  // -------------------------------------------------------------
  {
    id: 'waffle-tube',
    name: 'Вафельная трубочка',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 850,
    unitWeight: '90г',
    shelfLife: '48 ч',
    department: 'desserts',
    imageEmoji: '🧇',
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
    description: 'Хрустящая домашняя вафельная трубочка с густой вареной сгущенкой'
  },
  {
    id: 'syrniki',
    name: 'Сырники',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'порц',
    price: 1850,
    unitWeight: '220г',
    shelfLife: '24 ч',
    department: 'desserts',
    imageEmoji: '🥞',
    imageUrl: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80',
    description: 'Нежные сырники из отборного творога с фирменным ягодным соусом и сметаной'
  },
  {
    id: 'cupcake-chocolate',
    name: 'Кекс шоколадный',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 950,
    unitWeight: '130г',
    shelfLife: '72 ч',
    department: 'desserts',
    imageEmoji: '🧁',
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
    description: 'Шоколадный маффин с кусочками темного бельгийского шоколада'
  },
  {
    id: 'cupcake-carrot',
    name: 'Кекс морковный',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 950,
    unitWeight: '130г',
    shelfLife: '72 ч',
    department: 'desserts',
    imageEmoji: '🧁',
    imageUrl: 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=800&q=80',
    description: 'Ароматный морковный маффин с корицей и грецким орехом'
  },
  {
    id: 'mini-pie-cherry',
    name: 'Мини пирог вишня',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 1250,
    unitWeight: '150г',
    shelfLife: '48 ч',
    department: 'desserts',
    imageEmoji: '🥧',
    imageUrl: 'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=800&q=80',
    description: 'Песочный порционный тарт со спелой сочной вишней'
  },
  {
    id: 'brownie-portion',
    name: 'Брауни порционный',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 1350,
    unitWeight: '120г',
    shelfLife: '72 ч',
    department: 'desserts',
    imageEmoji: '🍫',
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
    description: 'Классический тягучий брауни из темного шоколада'
  },
  {
    id: 'cookie-classic',
    name: 'Классический кукис',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 750,
    unitWeight: '80г',
    shelfLife: '96 ч',
    department: 'desserts',
    imageEmoji: '🍪',
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80',
    description: 'Американское печенье с капельками молочного шоколада'
  },
  {
    id: 'cookie-chocolate',
    name: 'Шоколадный кукис',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 750,
    unitWeight: '80г',
    shelfLife: '96 ч',
    department: 'desserts',
    imageEmoji: '🍪',
    imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=800&q=80',
    description: 'Шоколадное печенье с белыми шоколадными дропсами'
  },
  {
    id: 'chia-dessert-peach-mango',
    name: 'Десерт чиа персик-манго',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 1650,
    unitWeight: '200г',
    shelfLife: '36 ч',
    department: 'desserts',
    imageEmoji: '🍧',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    description: 'Чиа-пудинг на кокосовом молоке с мангово-персиковым пюре'
  },
  {
    id: 'mini-pie-currant',
    name: 'Мини пирог смородина',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 1250,
    unitWeight: '150г',
    shelfLife: '48 ч',
    department: 'desserts',
    imageEmoji: '🥧',
    imageUrl: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
    description: 'Мини-пирог с начинкой из ароматной черной смородины'
  },
  {
    id: 'trifle-snikers',
    name: 'Трайфл сникерс',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 1750,
    unitWeight: '180г',
    shelfLife: '48 ч',
    department: 'desserts',
    imageEmoji: '🍰',
    imageUrl: 'https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=800&q=80',
    description: 'Многослойный десерт в стаканчике: шоколад, арахис и тягучая карамель'
  },
  {
    id: 'cheesecake-oreo',
    name: 'Чизкейк орео',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 1850,
    unitWeight: '160г',
    shelfLife: '48 ч',
    department: 'desserts',
    imageEmoji: '🍰',
    imageUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80',
    description: 'Сливочный чизкейк с хрустящей крошкой печенья Oreo'
  },
  {
    id: 'cheesecake-choco-cherry',
    name: 'Чизкейк шоколад вишня',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 1850,
    unitWeight: '165г',
    shelfLife: '48 ч',
    department: 'desserts',
    imageEmoji: '🍰',
    imageUrl: 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?auto=format&fit=crop&w=800&q=80',
    description: 'Шоколадный чизкейк со свежей вишневой прослойкой'
  },
  {
    id: 'cheesecake-raffaello',
    name: 'Чизкейк рафаэлло',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 1950,
    unitWeight: '160г',
    shelfLife: '48 ч',
    department: 'desserts',
    imageEmoji: '🍰',
    imageUrl: 'https://images.unsplash.com/photo-1508737027454-e6454ef46afd?auto=format&fit=crop&w=800&q=80',
    description: 'Кокосовый чизкейк с миндалем и нежным кремом'
  },
  {
    id: 'cheesecake-tropic-peach',
    name: 'Чизкейк тропик персик',
    category: 'desserts',
    categoryLabel: 'Десерты',
    unit: 'шт',
    price: 1850,
    unitWeight: '160г',
    shelfLife: '48 ч',
    department: 'desserts',
    imageEmoji: '🍰',
    imageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80',
    description: 'Тропический чизкейк с желе из спелого персика'
  },

  // -------------------------------------------------------------
  // 4. Заготовки бара (12)
  // -------------------------------------------------------------
  {
    id: 'bar-prep-currant-1l',
    name: 'Заготовка смородина 1 л новая',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'л',
    price: 2800,
    unitWeight: '1 л',
    shelfLife: '10 дн',
    department: 'bar_prep',
    imageEmoji: '🧃',
    imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80',
    description: 'Ягодный концентрат черной смородины для напитков бара'
  },
  {
    id: 'bar-cheese-foam-1kg',
    name: 'Сырная пена 1 кг новая',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'кг',
    price: 3400,
    unitWeight: '1 кг',
    shelfLife: '5 дн',
    department: 'bar_prep',
    imageEmoji: '🥛',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80',
    description: 'Фирменная сырная пена для раф-кофе и матча чая'
  },
  {
    id: 'bar-cheese-foam-500g',
    name: 'Сырная пена 500 гр новая',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'уп',
    price: 1800,
    unitWeight: '500г',
    shelfLife: '5 дн',
    department: 'bar_prep',
    imageEmoji: '🥛',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80',
    description: 'Сырная пенка в порционной таре 500 гр'
  },
  {
    id: 'bar-orange-fresh-250',
    name: 'Апельсиновый фреш 250 мл',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'шт',
    price: 1200,
    unitWeight: '250мл',
    shelfLife: '24 ч',
    department: 'bar_prep',
    imageEmoji: '🍊',
    imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80',
    description: 'Свежевыжатый 100% апельсиновый сок без сахара'
  },
  {
    id: 'bar-prep-cherry-1l',
    name: 'Заготовка вишня 1 л',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'л',
    price: 2700,
    unitWeight: '1 л',
    shelfLife: '10 дн',
    department: 'bar_prep',
    imageEmoji: '🧃',
    imageUrl: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=800&q=80',
    description: 'Вишневый соус-база для авторского кофе и согревающего чая'
  },
  {
    id: 'bar-prep-mango-ginger-1l',
    name: 'Заготовка манго-имбирь 1 л новая',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'л',
    price: 3200,
    unitWeight: '1 л',
    shelfLife: '10 дн',
    department: 'bar_prep',
    imageEmoji: '🥭',
    imageUrl: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=800&q=80',
    description: 'Пряный концентрат манго с имбирем для фирменного меню'
  },
  {
    id: 'bar-prep-mandarin-1l',
    name: 'Заготовка мандарин 1 л',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'л',
    price: 2900,
    unitWeight: '1 л',
    shelfLife: '10 дн',
    department: 'bar_prep',
    imageEmoji: '🍊',
    imageUrl: 'https://images.unsplash.com/photo-1618897996318-5a901fa6ca71?auto=format&fit=crop&w=800&q=80',
    description: 'Мандариновая основа для зимних согревающих миксов'
  },
  {
    id: 'bar-prep-lime-1l',
    name: 'Заготовка лайм 1 л',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'л',
    price: 2600,
    unitWeight: '1 л',
    shelfLife: '10 дн',
    department: 'bar_prep',
    imageEmoji: '🍋',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    description: 'Лаймовый кордиал для лимонадов и эспрессо-тоника'
  },
  {
    id: 'bar-prep-lime-250g',
    name: 'Заготовка лайм 250 гр',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'уп',
    price: 800,
    unitWeight: '250г',
    shelfLife: '10 дн',
    department: 'bar_prep',
    imageEmoji: '🍋',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    description: 'Лаймовая заготовка 250г в индивидуальной упаковке'
  },
  {
    id: 'bar-powder-vanilla-1kg',
    name: 'Пудра ваниль 1 кг',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'кг',
    price: 2200,
    unitWeight: '1 кг',
    shelfLife: '180 дн',
    department: 'bar_prep',
    imageEmoji: '✨',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    description: 'Ванильная ароматная пудра тонкого помола'
  },
  {
    id: 'bar-powder-spicy-1kg',
    name: 'Пудра пряная 1 кг',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'кг',
    price: 2400,
    unitWeight: '1 кг',
    shelfLife: '180 дн',
    department: 'bar_prep',
    imageEmoji: '🌶️',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    description: 'Пряный порошок (корица, кардамон, гвоздика) для пряного латте'
  },
  {
    id: 'bar-prep-passion-1l',
    name: 'Заготовка маракуйя 1 л',
    category: 'bar_prep',
    categoryLabel: 'Заготовки бара',
    unit: 'л',
    price: 3500,
    unitWeight: '1 л',
    shelfLife: '10 дн',
    department: 'bar_prep',
    imageEmoji: '🍹',
    imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80',
    description: 'Концентрат маракуйи с косточкой для айс-ти и лимонадов'
  },

  // -------------------------------------------------------------
  // 5. Заготовки кухня (8)
  // -------------------------------------------------------------
  {
    id: 'kit-syrniki-classic',
    name: 'Сырники классика цех',
    category: 'kitchen_prep',
    categoryLabel: 'Заготовки кухня',
    unit: 'кг',
    price: 2900,
    unitWeight: '1 кг',
    shelfLife: '48 ч',
    department: 'kitchen_prep',
    imageEmoji: '🥞',
    imageUrl: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80',
    description: 'Заготовка формованных сырников цеха готовых к выпеканию'
  },
  {
    id: 'kit-cutlet-chicken',
    name: 'Котлета куриная цех',
    category: 'kitchen_prep',
    categoryLabel: 'Заготовки кухня',
    unit: 'кг',
    price: 3200,
    unitWeight: '1 кг',
    shelfLife: '48 ч',
    department: 'kitchen_prep',
    imageEmoji: '🥩',
    imageUrl: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=800&q=80',
    description: 'Охлажденные котлеты из рубленного куриного филе'
  },
  {
    id: 'kit-syrniki-rice',
    name: 'Сырники на рисовой муке цех',
    category: 'kitchen_prep',
    categoryLabel: 'Заготовки кухня',
    unit: 'кг',
    price: 3100,
    unitWeight: '1 кг',
    shelfLife: '48 ч',
    department: 'kitchen_prep',
    imageEmoji: '🥞',
    imageUrl: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80',
    description: 'Сырники на рисовой муке без глютена'
  },
  {
    id: 'kit-cutlet-beef',
    name: 'Котлета говяжья цех',
    category: 'kitchen_prep',
    categoryLabel: 'Заготовки кухня',
    unit: 'кг',
    price: 4100,
    unitWeight: '1 кг',
    shelfLife: '48 ч',
    department: 'kitchen_prep',
    imageEmoji: '🥩',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    description: 'Сочные котлеты из отборной говядины'
  },
  {
    id: 'kit-bagel-base',
    name: 'Бейгл 1 шт 150тг',
    category: 'kitchen_prep',
    categoryLabel: 'Заготовки кухня',
    unit: 'шт',
    price: 150,
    unitWeight: '100г',
    shelfLife: '72 ч',
    department: 'kitchen_prep',
    imageEmoji: '🥯',
    imageUrl: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=800&q=80',
    description: 'Выпеченная заготовка бейгла под сборку сэндвичей'
  },
  {
    id: 'kit-puff-carrot-flax',
    name: 'Слойка морковь-лен 1 шт 150тг',
    category: 'kitchen_prep',
    categoryLabel: 'Заготовки кухня',
    unit: 'шт',
    price: 150,
    unitWeight: '90г',
    shelfLife: '72 ч',
    department: 'kitchen_prep',
    imageEmoji: '🥐',
    imageUrl: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&w=800&q=80',
    description: 'Слоененая булочка с семенами льна и морковью'
  },
  {
    id: 'kit-brioche-bread',
    name: 'Бриошь 1 булка 750 гр',
    category: 'kitchen_prep',
    categoryLabel: 'Заготовки кухня',
    unit: 'шт',
    price: 750,
    unitWeight: '750г',
    shelfLife: '72 ч',
    department: 'kitchen_prep',
    imageEmoji: '🍞',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    description: 'Сдобный батон бриошь на сливочном масле'
  },
  {
    id: 'kit-panini-base',
    name: 'Панини 1 шт 150тг',
    category: 'kitchen_prep',
    categoryLabel: 'Заготовки кухня',
    unit: 'шт',
    price: 150,
    unitWeight: '110г',
    shelfLife: '72 ч',
    department: 'kitchen_prep',
    imageEmoji: '🥖',
    imageUrl: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=800&q=80',
    description: 'Итальянская булочка панини для запекания'
  },

  // -------------------------------------------------------------
  // 6. Новинки (3)
  // -------------------------------------------------------------
  {
    id: 'new-cherry-brew-300',
    name: 'Черри Брю 300гр',
    category: 'new_items',
    categoryLabel: 'Новинки',
    unit: 'шт',
    price: 1950,
    unitWeight: '300г',
    shelfLife: '24 ч',
    department: 'new_items',
    imageEmoji: '🍒',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80',
    description: 'Новинка! Колд-брю с натуральным вишневым настоем 300г'
  },
  {
    id: 'new-pomegranate-brew-300',
    name: 'Гранат Брю 300гр',
    category: 'new_items',
    categoryLabel: 'Новинки',
    unit: 'шт',
    price: 1950,
    unitWeight: '300г',
    shelfLife: '24 ч',
    department: 'new_items',
    imageEmoji: '🍷',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    description: 'Новинка! Колд-брю на гранатовом соке прямого отжима 300г'
  },
  {
    id: 'new-raspberry-brew-300',
    name: 'Малина Брю 300гр',
    category: 'new_items',
    categoryLabel: 'Новинки',
    unit: 'шт',
    price: 1950,
    unitWeight: '300г',
    shelfLife: '24 ч',
    department: 'new_items',
    imageEmoji: '🍓',
    imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80',
    description: 'Новинка! Освежающий малиновый брю-микс 300г'
  }
];

const DISTRICTS = ['Центр', 'Север', 'Юг', 'ТРЦ / ТРК', 'Бизнес-Центры'];

const MANAGERS = [
  'Айгерим С.', 'Данияр Т.', 'Мадина К.', 'Ерлан Б.', 'Алина Р.',
  'Арман М.', 'Зарина Н.', 'Руслан А.', 'Камила В.', 'Алишер С.',
  'Гульнара Т.', 'Темирлан И.', 'Динара П.', 'Султан Б.', 'Асель К.',
  'Нурлан Ж.', 'Оксана М.', 'Жандос С.', 'Венера К.', 'Олжас А.',
  'Сабина Д.', 'Ильяс Р.', 'Ботагоз Б.', 'Максат К.', 'Диана С.',
  'Аскар В.', 'Ясмин Н.'
];

const ADDRESSES = [
  'г. Алматы, пр. Абая, 42',
  'г. Алматы, ул. Розыбакиева, 263 (ТРЦ Mega Center)',
  'г. Алматы, пр. Достык, 108',
  'г. Алматы, пр. Аль-Фараби, 77/7 (БЦ Esentai Tower)',
  'г. Алматы, ул. Гоголя, 87',
  'г. Алматы, мкр. Самал-2, 111 (ТРЦ Dostyk Plaza)',
  'г. Алматы, пр. Аль-Фараби, 19 к2b (БЦ Нурлы Тау)',
  'г. Алматы, ул. Желтоксан, 115',
  'г. Алматы, ул. Сейфуллина, 617 (ТРЦ Forum Almaty)',
  'г. Алматы, пр. Достык, 160 (БЦ Q2)',
  'г. Астана, пр. Кабанбай батыра, 21 (ТРЦ Mega Silk Way)',
  'г. Астана, ул. Достык, 9 (ТРЦ Керуен)',
  'г. Астана, бульвар Нуржол, 14 (БЦ Империал)',
  'г. Астана, пр. Мангилик Ел, 53',
  'г. Астана, ул. Кунаева, 12/1',
  'г. Алматы, ул. Кабанбай батыра, 85',
  'г. Алматы, ул. Панфилова, 110',
  'г. Алматы, пр. Назарбаева, 226',
  'г. Алматы, ул. Толе би, 187',
  'г. Алматы, ул. Сатпаева, 30А',
  'г. Астана, пр. Республики, 18',
  'г. Астана, ул. Сауран, 42',
  'г. Астана, пр. Туран, 37 (ТРЦ Хан Шатыр)',
  'г. Астана, ул. Сыганак, 17/1',
  'г. Астана, ул. Акмешит, 11',
  'г. Алматы, ул. Байтурсынова, 113',
  'г. Алматы, ул. Макатаева, 127 (ТРЦ MEGA Park)'
];

export const COFFEE_SHOPS: CoffeeShop[] = Array.from({ length: 27 }, (_, i) => {
  const shopId = i + 1;
  const isDowntown = shopId <= 8;
  const isMall = shopId >= 9 && shopId <= 15;
  const multiplier = isDowntown ? 1.4 : isMall ? 1.8 : 1.0;

  // Base averages per product
  const baseAvg: Record<string, number> = {};
  PRODUCTS.forEach((p) => {
    let base = 8;
    if (p.category === 'croissants') base = 18;
    if (p.category === 'sandwiches') base = 14;
    if (p.category === 'desserts') base = 12;
    if (p.category === 'bar_prep') base = 3;
    if (p.category === 'kitchen_prep') base = 4;
    if (p.category === 'new_items') base = 10;

    baseAvg[p.id] = Math.max(1, Math.round(base * multiplier));
  });

  // Determine top frequent items for this shop
  const frequentItems = PRODUCTS.filter((_, index) => (index + shopId) % 7 === 0)
    .slice(0, 5)
    .map((p) => p.id);

  const fullAddress = ADDRESSES[i] || `г. Алматы, Локация ${shopId}`;

  return {
    id: shopId,
    name: `Кофейня №${shopId} — ${fullAddress.split(', ').slice(1).join(', ')}`,
    address: fullAddress,
    manager: MANAGERS[i % MANAGERS.length],
    phone: `+7 707 ${100 + shopId} ${20 + shopId}${30 + shopId}`,
    district: DISTRICTS[i % DISTRICTS.length],
    frequentItems,
    historicalAvg: baseAvg
  };
});

// Generate initial state for 27 coffee shops (21 submitted, 6 draft/pending)
export const INITIAL_ORDERS: Record<number, ShopOrder> = {};

COFFEE_SHOPS.forEach((shop) => {
  const isSubmitted = shop.id <= 21; // 21 out of 27 submitted
  const isAccepted = shop.id <= 14;  // 14 already accepted by admin

  if (isSubmitted) {
    const items: Record<string, number> = {};
    const anomalies: Record<string, string> = {};

    PRODUCTS.forEach((p) => {
      const avg = shop.historicalAvg[p.id] || 10;
      let variance = (Math.random() * 0.4) - 0.2; // -20% to +20%
      
      // Inject demo anomaly on shop #3 and shop #7
      if (shop.id === 3 && p.id === 'croissant-chicken') {
        variance = 2.5; // +250% anomaly!
        anomalies[p.id] = '⚠️ Завышение заказа: +250% от средней нормы (45 шт vs среднее 18 шт)';
      } else if (shop.id === 7 && p.id === 'syrniki') {
        variance = -0.8; // -80% drop
        anomalies[p.id] = '⚠️ Занижение заказа: -80% от средней нормы (2 шт vs среднее 12 шт)';
      }

      items[p.id] = Math.max(1, Math.round(avg * (1 + variance)));
    });

    INITIAL_ORDERS[shop.id] = {
      shopId: shop.id,
      items,
      status: isAccepted ? 'accepted' : 'submitted',
      submittedAt: `09:${10 + (shop.id % 45)}`,
      acceptedAt: isAccepted ? `09:${50 + (shop.id % 9)}` : undefined,
      managerName: shop.manager,
      anomalies: Object.keys(anomalies).length > 0 ? anomalies : undefined
    };
  } else {
    // Draft / pending stores
    INITIAL_ORDERS[shop.id] = {
      shopId: shop.id,
      items: {},
      status: 'draft',
      managerName: shop.manager
    };
  }
});

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  employee: 'Внутренний сотрудник',
  territorial_manager: 'Территориальный управляющий',
  shop_manager: 'Менеджер точки'
};

export const INITIAL_STAFF: StaffMember[] = [
  { id: 'staff-1', name: 'Айгерим С.', role: 'shop_manager', shopId: 1, phone: '+7 707 101 21' },
  { id: 'staff-2', name: 'Данияр Т.', role: 'shop_manager', shopId: 2, phone: '+7 707 102 22' },
  { id: 'staff-3', name: 'Мадина К.', role: 'shop_manager', shopId: 3, phone: '+7 707 103 23' },
  {
    id: 'staff-4',
    name: 'Ерлан Б.',
    role: 'territorial_manager',
    shopId: null,
    phone: '+7 707 201 41',
    assignedShopIds: Array.from({ length: 14 }, (_, i) => i + 1)
  },
  {
    id: 'staff-5',
    name: 'Алина Р.',
    role: 'territorial_manager',
    shopId: null,
    phone: '+7 707 202 42',
    assignedShopIds: Array.from({ length: 13 }, (_, i) => i + 15)
  },
  { id: 'staff-6', name: 'Арман М.', role: 'employee', shopId: 1, phone: '+7 707 301 61' },
  { id: 'staff-7', name: 'Зарина Н.', role: 'employee', shopId: 4, phone: '+7 707 302 62' },
  { id: 'staff-8', name: 'Руслан А.', role: 'employee', shopId: 9, phone: '+7 707 303 63' }
];

export const INITIAL_REGISTRATION_REQUESTS: RegistrationRequest[] = [
  {
    id: 'reg-1',
    name: 'Камила В.',
    phone: '+7 707 405 55',
    requestedShopId: 5,
    requestedRole: 'employee',
    submittedAt: '08:12',
    status: 'pending'
  },
  {
    id: 'reg-2',
    name: 'Алишер С.',
    phone: '+7 707 406 56',
    requestedShopId: 12,
    requestedRole: 'shop_manager',
    submittedAt: '08:47',
    status: 'pending'
  }
];
