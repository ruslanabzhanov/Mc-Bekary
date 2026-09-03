import React, { useState, useRef } from 'react';
import {
  Product,
  SemiFinishedProduct,
  DishCosting,
  SemiIngredient,
  DishSemiItem,
  DishRawItem,
  RawMaterial
} from '../types';
import { calculateSemiCost, calculateDishPrimeCost } from '../data/costingData';
import { compressImage } from '../utils/compressImage';
import {
  Utensils,
  ChefHat,
  Plus,
  Trash2,
  DollarSign,
  Info,
  Edit3,
  CheckCircle2,
  BookOpen,
  Package,
  Search,
  Tag,
  X,
  Sparkles,
  Camera,
  ChevronDown
} from 'lucide-react';

// Product.department mirrors Product.category except croissants/bakery — see DEPT_CATEGORY_MAP in App.tsx.
const CATEGORY_TO_DEPARTMENT: Record<string, Product['department']> = {
  croissants: 'bakery',
  sandwiches: 'sandwiches',
  desserts: 'desserts',
  bar_prep: 'bar_prep',
  kitchen_prep: 'kitchen_prep',
  new_items: 'new_items'
};

interface CostingsManagerProps {
  products: Product[];
  semiFinishedList: SemiFinishedProduct[];
  dishCostings: Record<string, DishCosting>;
  onUpdateSemiFinished: (list: SemiFinishedProduct[]) => void;
  onUpdateDishCostings: (costings: Record<string, DishCosting>) => void;
  onUpdateProduct: (productId: string, updates: Partial<Product>) => void;
  onAddProduct: (product: Product) => void;
  rawMaterials: RawMaterial[];
  setRawMaterials: React.Dispatch<React.SetStateAction<RawMaterial[]>>;
  rawCategoryDefs: { key: string; label: string }[];
  setRawCategoryDefs: React.Dispatch<React.SetStateAction<{ key: string; label: string }[]>>;
  semiCategoryDefs: { key: string; label: string }[];
  setSemiCategoryDefs: React.Dispatch<React.SetStateAction<{ key: string; label: string }[]>>;
}

export const CostingsManager: React.FC<CostingsManagerProps> = ({
  products,
  semiFinishedList,
  dishCostings,
  onUpdateSemiFinished,
  onUpdateDishCostings,
  onUpdateProduct,
  onAddProduct,
  rawMaterials,
  setRawMaterials,
  rawCategoryDefs,
  setRawCategoryDefs,
  semiCategoryDefs,
  setSemiCategoryDefs
}) => {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'dishes' | 'semis' | 'raw_catalog'>('dishes');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || 'chicken-croissant');
  const [dishCategoryFilter, setDishCategoryFilter] = useState<string>('all');
  const [isDishCardOpen, setIsDishCardOpen] = useState(false);
  const [isAddDishModalOpen, setIsAddDishModalOpen] = useState(false);
  const [newDishItem, setNewDishItem] = useState<{
    name: string;
    category: string;
    categoryLabel: string;
    price: number;
    unit: string;
    unitWeight: string;
    shelfLife: string;
    imageEmoji: string;
    description: string;
  }>({
    name: '',
    category: 'croissants',
    categoryLabel: 'Выпечка',
    price: 0,
    unit: 'шт',
    unitWeight: '',
    shelfLife: '',
    imageEmoji: '🍽️',
    description: ''
  });
  const [semiCategoryFilter, setSemiCategoryFilter] = useState<string>('all');
  const [selectedSemiId, setSelectedSemiId] = useState<string | null>(null);
  const [isSemiCardOpen, setIsSemiCardOpen] = useState(false);
  const [isSemiTechOpen, setIsSemiTechOpen] = useState(false);
  const [isSemiIngredientSearchOpen, setIsSemiIngredientSearchOpen] = useState(false);
  const [semiIngredientSearch, setSemiIngredientSearch] = useState('');
  const [isIngredientSearchOpen, setIsIngredientSearchOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isAddSemiModalOpen, setIsAddSemiModalOpen] = useState(false);
  const [isAddSemiCategoryOpen, setIsAddSemiCategoryOpen] = useState(false);
  const [newSemiCategoryName, setNewSemiCategoryName] = useState('');
  const [newSemiItem, setNewSemiItem] = useState<{
    name: string;
    category: string;
    categoryLabel: string;
    unit: string;
  }>({
    name: '',
    category: 'prep_veg',
    categoryLabel: 'Нарезка и овощи',
    unit: 'кг'
  });

  // Master Raw Materials filters/UI (the catalog data itself is lifted to App so it survives closing this window)
  const [rawSearchQuery, setRawSearchQuery] = useState('');
  const [rawCategoryFilter, setRawCategoryFilter] = useState<string>('all');
  const [isAddRawModalOpen, setIsAddRawModalOpen] = useState(false);
  const [newRawItem, setNewRawItem] = useState<{
    name: string;
    category: string;
    categoryLabel: string;
    unit: string;
    defaultUnitPrice: number;
  }>({
    name: '',
    category: 'veg',
    categoryLabel: 'Овощи и зелень',
    unit: 'кг',
    defaultUnitPrice: 1000
  });

  const rawCategories = [{ key: 'all', label: 'Все категории' }, ...rawCategoryDefs];
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Category Label helper
  const getCategoryLabel = (cat: string) => rawCategoryDefs.find((c) => c.key === cat)?.label || cat;

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newCategoryName.trim();
    if (!label) return;
    const baseKey = label.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    const key = baseKey && !rawCategoryDefs.some((c) => c.key === baseKey) ? baseKey : `cat-${Date.now()}`;
    setRawCategoryDefs((prev) => [...prev, { key, label }]);
    setNewCategoryName('');
    setIsAddCategoryOpen(false);
  };

  const handleAddSemiCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newSemiCategoryName.trim();
    if (!label) return;
    const baseKey = label.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    const key = baseKey && !semiCategoryDefs.some((c) => c.key === baseKey) ? baseKey : `cat-${Date.now()}`;
    setSemiCategoryDefs((prev) => [...prev, { key, label }]);
    setNewSemiCategoryName('');
    setIsAddSemiCategoryOpen(false);
  };

  const handleUpdateRawMaterialCategory = (id: string, categoryKey: string) => {
    setRawMaterials((prev) =>
      prev.map((r) => (r.id === id ? { ...r, category: categoryKey, categoryLabel: getCategoryLabel(categoryKey) } : r))
    );
  };

  // Quick lookup map for Semis
  const semiMap = new Map<string, SemiFinishedProduct>(semiFinishedList.map((s) => [s.id, s]));

  // Dish categories derived from the product catalog
  const dishCategories: { key: string; label: string }[] = [
    { key: 'all', label: 'Все категории' },
    ...Array.from(new Map<string, string>(products.map((p) => [p.category, p.categoryLabel])).entries()).map(
      ([key, label]) => ({ key, label })
    )
  ];
  const filteredDishProducts =
    dishCategoryFilter === 'all' ? products : products.filter((p) => p.category === dishCategoryFilter);

  // Semi-finished categories derived from the semi-finished catalog
  const semiCategories: { key: string; label: string }[] = [
    { key: 'all', label: 'Все категории' },
    ...semiCategoryDefs
  ];
  const filteredSemiFinishedList =
    semiCategoryFilter === 'all'
      ? semiFinishedList
      : semiFinishedList.filter((s) => s.category === semiCategoryFilter);

  // Combined search across semi-finished items and raw materials, for the unified "add ingredient" search
  const ingredientSearchResults = ingredientSearch.trim()
    ? [
        ...semiFinishedList
          .filter((s) => s.name.toLowerCase().includes(ingredientSearch.trim().toLowerCase()))
          .map((s) => ({ type: 'semi' as const, id: s.id, name: s.name })),
        ...rawMaterials
          .filter((r) => r.name.toLowerCase().includes(ingredientSearch.trim().toLowerCase()))
          .map((r) => ({ type: 'raw' as const, id: r.id, name: r.name }))
      ].slice(0, 8)
    : [];

  // Selected semi-finished item (for the semi card modal)
  const selectedSemi = semiFinishedList.find((s) => s.id === selectedSemiId) || null;

  // Raw-material-only search for adding an ingredient to a semi-finished item
  // (a semi's ingredients are always raw materials, never other semi-finished items)
  const semiIngredientSearchResults = semiIngredientSearch.trim()
    ? rawMaterials
        .filter((r) => r.name.toLowerCase().includes(semiIngredientSearch.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  // Selected dish costing
  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const currentDishCosting = dishCostings[selectedProductId] || {
    productId: selectedProductId,
    semiFinishedItems: [],
    rawIngredients: []
  };

  // Dish Card Handlers (photo, category, price)
  const handleDishPhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) return;
    const productId = selectedProduct.id;
    compressImage(file)
      .then((dataUrl) => onUpdateProduct(productId, { imageUrl: dataUrl }))
      .catch((err) => console.error('Failed to process product photo:', err));
    e.target.value = '';
  };

  const handleDishCategoryChange = (categoryKey: string) => {
    if (!selectedProduct) return;
    const label = dishCategories.find((c) => c.key === categoryKey)?.label || selectedProduct.categoryLabel;
    onUpdateProduct(selectedProduct.id, { category: categoryKey as Product['category'], categoryLabel: label });
  };

  const handleDishPriceChange = (newPrice: number) => {
    if (!selectedProduct) return;
    onUpdateProduct(selectedProduct.id, { price: Math.max(0, newPrice) });
  };

  // Dish Handlers
  const handleUpdateDishSemiQty = (semiId: string, newQty: number) => {
    const updatedSemis = currentDishCosting.semiFinishedItems.map((item) =>
      item.semiFinishedId === semiId ? { ...item, quantity: Math.max(0, newQty) } : item
    );
    onUpdateDishCostings({
      ...dishCostings,
      [selectedProductId]: { ...currentDishCosting, semiFinishedItems: updatedSemis }
    });
  };

  const handleDeleteDishSemi = (semiId: string) => {
    const updatedSemis = currentDishCosting.semiFinishedItems.filter(
      (item) => item.semiFinishedId !== semiId
    );
    onUpdateDishCostings({
      ...dishCostings,
      [selectedProductId]: { ...currentDishCosting, semiFinishedItems: updatedSemis }
    });
  };

  const handleAddDishSemi = (semiId: string) => {
    if (!semiId) return;
    if (currentDishCosting.semiFinishedItems.some((s) => s.semiFinishedId === semiId)) return;
    const semi = semiMap.get(semiId);
    const newItem: DishSemiItem = {
      semiFinishedId: semiId,
      quantity: 0.05,
      unit: semi?.unit || 'кг'
    };
    onUpdateDishCostings({
      ...dishCostings,
      [selectedProductId]: {
        ...currentDishCosting,
        semiFinishedItems: [...currentDishCosting.semiFinishedItems, newItem]
      }
    });
  };

  const handleUpdateDishRawQty = (rawId: string, newQty: number) => {
    const updatedRaw = currentDishCosting.rawIngredients.map((item) =>
      item.id === rawId ? { ...item, quantity: Math.max(0, newQty) } : item
    );
    onUpdateDishCostings({
      ...dishCostings,
      [selectedProductId]: { ...currentDishCosting, rawIngredients: updatedRaw }
    });
  };

  const handleDeleteDishRaw = (rawId: string) => {
    const updatedRaw = currentDishCosting.rawIngredients.filter((item) => item.id !== rawId);
    onUpdateDishCostings({
      ...dishCostings,
      [selectedProductId]: { ...currentDishCosting, rawIngredients: updatedRaw }
    });
  };

  // Add Dish Raw Item from Catalog Dropdown
  const handleAddDishRawFromCatalog = (rawMatId: string) => {
    if (!rawMatId) return;
    const raw = rawMaterials.find((r) => r.id === rawMatId);
    if (!raw) return;

    const newRawItem: DishRawItem = {
      id: `raw-${Date.now()}`,
      name: raw.name,
      quantity: raw.unit === 'шт' ? 1 : 0.05,
      unit: raw.unit,
      unitPrice: raw.defaultUnitPrice
    };

    onUpdateDishCostings({
      ...dishCostings,
      [selectedProductId]: {
        ...currentDishCosting,
        rawIngredients: [...currentDishCosting.rawIngredients, newRawItem]
      }
    });
  };

  // Unified search: add either a semi-finished item or a raw ingredient to the dish
  const handleSelectIngredientFromSearch = (type: 'semi' | 'raw', id: string) => {
    if (type === 'semi') {
      handleAddDishSemi(id);
    } else {
      handleAddDishRawFromCatalog(id);
    }
    setIngredientSearch('');
    setIsIngredientSearchOpen(false);
  };

  // Semi-Finished Handlers
  const handleUpdateSemiIngredient = (
    semiId: string,
    ingId: string,
    field: keyof SemiIngredient,
    value: string | number
  ) => {
    const updated = semiFinishedList.map((semi) => {
      if (semi.id !== semiId) return semi;
      const updatedIngs = semi.ingredients.map((ing) => {
        if (ing.id !== ingId) return ing;
        return { ...ing, [field]: value };
      });
      const newCost = updatedIngs.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
      return { ...semi, ingredients: updatedIngs, unitCost: Math.round(newCost / (semi.yieldQuantity || 1)) };
    });
    onUpdateSemiFinished(updated);
  };

  // Add Semi Ingredient from Catalog Dropdown
  const handleAddSemiIngredientFromCatalog = (semiId: string, rawMatId: string) => {
    if (!rawMatId) return;
    const raw = rawMaterials.find((r) => r.id === rawMatId);
    if (!raw) return;

    const updated = semiFinishedList.map((semi) => {
      if (semi.id !== semiId) return semi;
      const newIng: SemiIngredient = {
        id: `ing-${Date.now()}`,
        rawMaterialName: raw.name,
        quantity: raw.unit === 'шт' ? 1 : 0.1,
        unit: raw.unit,
        unitPrice: raw.defaultUnitPrice
      };
      const updatedIngs = [...semi.ingredients, newIng];
      const newCost = updatedIngs.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
      return { ...semi, ingredients: updatedIngs, unitCost: Math.round(newCost / (semi.yieldQuantity || 1)) };
    });
    onUpdateSemiFinished(updated);
  };

  const handleAddSemiIngredientManual = (semiId: string) => {
    const updated = semiFinishedList.map((semi) => {
      if (semi.id !== semiId) return semi;
      const newIng: SemiIngredient = {
        id: `ing-${Date.now()}`,
        rawMaterialName: 'Новое сырье',
        quantity: 0.1,
        unit: 'кг',
        unitPrice: 1000
      };
      const updatedIngs = [...semi.ingredients, newIng];
      const newCost = updatedIngs.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
      return { ...semi, ingredients: updatedIngs, unitCost: Math.round(newCost / (semi.yieldQuantity || 1)) };
    });
    onUpdateSemiFinished(updated);
  };

  const handleDeleteSemiIngredient = (semiId: string, ingId: string) => {
    const updated = semiFinishedList.map((semi) => {
      if (semi.id !== semiId) return semi;
      const updatedIngs = semi.ingredients.filter((i) => i.id !== ingId);
      const newCost = updatedIngs.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
      return { ...semi, ingredients: updatedIngs, unitCost: Math.round(newCost / (semi.yieldQuantity || 1)) };
    });
    onUpdateSemiFinished(updated);
  };

  const handleUpdateSemiInstructions = (semiId: string, instructions: string) => {
    const updated = semiFinishedList.map((semi) =>
      semi.id === semiId ? { ...semi, prepInstructions: instructions } : semi
    );
    onUpdateSemiFinished(updated);
  };

  const handleUpdateSemiYield = (semiId: string, yieldQuantity: number) => {
    const updated = semiFinishedList.map((semi) => {
      if (semi.id !== semiId) return semi;
      const totalCost = semi.ingredients.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
      return { ...semi, yieldQuantity, unitCost: Math.round(totalCost / (yieldQuantity || 1)) };
    });
    onUpdateSemiFinished(updated);
  };

  const handleUpdateSemiName = (semiId: string, name: string) => {
    onUpdateSemiFinished(semiFinishedList.map((semi) => (semi.id === semiId ? { ...semi, name } : semi)));
  };

  const handleUpdateSemiCategory = (semiId: string, categoryKey: string) => {
    const label = semiCategoryDefs.find((c) => c.key === categoryKey)?.label || categoryKey;
    onUpdateSemiFinished(
      semiFinishedList.map((semi) =>
        semi.id === semiId ? { ...semi, category: categoryKey, categoryLabel: label } : semi
      )
    );
  };

  const handleUpdateSemiUnit = (semiId: string, unit: string) => {
    onUpdateSemiFinished(semiFinishedList.map((semi) => (semi.id === semiId ? { ...semi, unit } : semi)));
  };

  const handleCreateNewSemi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSemiItem.name.trim()) return;

    const newSemi: SemiFinishedProduct = {
      id: `semi-${Date.now()}`,
      name: newSemiItem.name.trim(),
      unit: newSemiItem.unit,
      unitCost: 0,
      category: newSemiItem.category,
      categoryLabel: newSemiItem.categoryLabel,
      prepInstructions: '',
      ingredients: [],
      yieldQuantity: 1
    };
    onUpdateSemiFinished([...semiFinishedList, newSemi]);
    setNewSemiItem({ name: '', category: newSemiItem.category, categoryLabel: newSemiItem.categoryLabel, unit: newSemiItem.unit });
    setIsAddSemiModalOpen(false);
  };

  const handleCreateNewDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishItem.name.trim()) return;

    const newProduct: Product = {
      id: `dish-${Date.now()}`,
      name: newDishItem.name.trim(),
      category: newDishItem.category as Product['category'],
      categoryLabel: newDishItem.categoryLabel,
      unit: newDishItem.unit,
      price: newDishItem.price,
      unitWeight: newDishItem.unitWeight,
      shelfLife: newDishItem.shelfLife,
      department: CATEGORY_TO_DEPARTMENT[newDishItem.category] || 'new_items',
      imageEmoji: newDishItem.imageEmoji || '🍽️',
      imageUrl: '',
      description: newDishItem.description
    };
    onAddProduct(newProduct);
    setNewDishItem({ ...newDishItem, name: '', price: 0, unitWeight: '', shelfLife: '', description: '' });
    setIsAddDishModalOpen(false);
  };

  // Master Catalog Handlers
  const handleUpdateRawMaterial = (id: string, field: keyof RawMaterial, value: string | number) => {
    setRawMaterials((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleDeleteRawMaterial = (id: string) => {
    setRawMaterials((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDeleteSemiProduct = (id: string) => {
    if (!window.confirm('Удалить этот полуфабрикат целиком? Это действие нельзя отменить.')) return;
    onUpdateSemiFinished(semiFinishedList.filter((s) => s.id !== id));
    setIsSemiCardOpen(false);
    setSelectedSemiId(null);
  };

  const handleCreateNewRawMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRawItem.name.trim()) return;

    const item: RawMaterial = {
      id: `raw-custom-${Date.now()}`,
      name: newRawItem.name.trim(),
      category: newRawItem.category,
      categoryLabel: getCategoryLabel(newRawItem.category),
      unit: newRawItem.unit,
      defaultUnitPrice: Number(newRawItem.defaultUnitPrice) || 0
    };

    setRawMaterials((prev) => [item, ...prev]);
    setIsAddRawModalOpen(false);
    setNewRawItem({
      name: '',
      category: 'veg',
      categoryLabel: 'Овощи и зелень',
      unit: 'кг',
      defaultUnitPrice: 1000
    });
  };

  // Filtered Raw Materials
  const filteredRawMaterials = rawMaterials.filter((item) => {
    const matchesCategory = rawCategoryFilter === 'all' || item.category === rawCategoryFilter;
    const matchesSearch = item.name.toLowerCase().includes(rawSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Sub-Header / Mode Toggles */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ChefHat className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
              Блюда, Полуфабрикаты и Продукты
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Конструктор ТКК, стандартизированный каталог ингредиентов и авто-расчет себестоимости
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('dishes')}
            className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-1.5 ${
              activeTab === 'dishes'
                ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Блюда ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('semis')}
            className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-1.5 ${
              activeTab === 'semis'
                ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Полуфабрикаты ({semiFinishedList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('raw_catalog')}
            className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-1.5 ${
              activeTab === 'raw_catalog'
                ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-indigo-600" />
            <span>Продукты ({rawMaterials.length})</span>
          </button>
        </div>
      </div>

      {/* DISH COSTINGS TAB */}
      {activeTab === 'dishes' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between px-2 flex-wrap gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Выберите блюдо витрины (нажмите, чтобы открыть карточку):
            </h4>

            <button
              onClick={() => setIsAddDishModalOpen(true)}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить блюдо</span>
            </button>
          </div>

          {/* Category Filter */}
          <div className="px-2">
            <select
              value={dishCategoryFilter}
              onChange={(e) => setDishCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white cursor-pointer"
            >
              {dishCategories.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredDishProducts.map((p) => {
              const costing = dishCostings[p.id] || { productId: p.id, semiFinishedItems: [], rawIngredients: [] };
              const prime = calculateDishPrimeCost(costing, semiMap);
              const fc = Math.round((prime / p.price) * 100);

              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProductId(p.id);
                    setIsDishCardOpen(true);
                  }}
                  className="w-full p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-left transition-all flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{p.imageEmoji}</span>
                    <div>
                      <div className="font-bold text-slate-900 text-sm group-hover:text-indigo-600">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Цена: <strong>{p.price} ₸</strong> | {p.unitWeight}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-black text-indigo-900">{prime} ₸</div>
                    <div
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded inline-block mt-0.5 ${
                        fc > 40 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      FC: {fc}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* DISH CARD MODAL: opens with the full recipe calculation for the selected dish */}
      {isDishCardOpen && activeTab === 'dishes' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xl space-y-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">

            {/* Close Button */}
            <div className="flex justify-end -mb-2">
              <button
                onClick={() => setIsDishCardOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dish Header Info */}
            <div className="space-y-3 pb-4 border-b border-slate-100">
              {/* Full-width dish name, one line */}
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight truncate">
                {selectedProduct.name}
              </h3>

              {/* Active Tiles: bigger Photo on the left, Category & Price (stacked) on the right */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Photo Tile - click to upload a new photo */}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="relative w-full sm:flex-1 sm:min-w-0 h-40 sm:h-56 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group"
                  title="Нажмите, чтобы загрузить новое фото"
                >
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/60 transition-all flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-bold uppercase flex items-center gap-1.5 transition-opacity">
                      <Camera className="w-4 h-4" />
                      Сменить фото
                    </span>
                  </div>
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleDishPhotoSelected}
                />

                <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:w-28 sm:shrink-0 min-w-0">
                  {/* Category Tile - click to change */}
                  <div className="relative min-w-0 sm:flex-1">
                    <button
                      type="button"
                      onClick={() => setIsCategoryPickerOpen((v) => !v)}
                      className="w-full h-full min-w-0 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-lg p-2 flex flex-col justify-center items-start text-left transition-all overflow-hidden"
                    >
                      <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Категория</span>
                      <span className="w-full block truncate font-bold text-indigo-900 text-[10px] leading-tight uppercase tracking-wide">
                        {selectedProduct.categoryLabel}
                      </span>
                    </button>

                    {isCategoryPickerOpen && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1 max-h-56 overflow-y-auto">
                        {dishCategories
                          .filter((c) => c.key !== 'all')
                          .map((c) => (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => {
                                handleDishCategoryChange(c.key);
                                setIsCategoryPickerOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 ${
                                c.key === selectedProduct.category
                                  ? 'font-bold text-indigo-900 bg-indigo-50/60'
                                  : 'text-slate-700'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Price Tile - click to edit */}
                  <div className="flex-1 min-w-0 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-lg p-2 flex flex-col justify-center transition-all overflow-hidden">
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5 truncate">Цена продажи</span>
                    <div className="flex items-baseline min-w-0">
                      <input
                        type="number"
                        min="0"
                        value={selectedProduct.price}
                        onChange={(e) => handleDishPriceChange(parseFloat(e.target.value) || 0)}
                        className="w-full min-w-0 bg-transparent font-black text-slate-900 text-sm focus:outline-none"
                      />
                      <span className="text-slate-500 font-bold text-[10px] shrink-0">₸</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Состав блюда: полуфабрикаты + сырьё через единый поиск */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                  <ChefHat className="w-4 h-4 text-indigo-600" />
                  <span>Состав блюда (полуфабрикаты и сырьё):</span>
                </h4>

                <button
                  type="button"
                  onClick={() => setIsIngredientSearchOpen((v) => !v)}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить</span>
                </button>
              </div>

              {isIngredientSearchOpen && (
                <div className="w-full bg-white border border-slate-200 rounded-lg shadow-sm z-20 p-2">
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      placeholder="Поиск полуфабриката или сырья..."
                      className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {ingredientSearchResults.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic text-center py-3">
                        {ingredientSearch.trim() ? 'Ничего не найдено' : 'Начните вводить название...'}
                      </p>
                    ) : (
                      ingredientSearchResults.map((r) => (
                        <button
                          key={`${r.type}-${r.id}`}
                          type="button"
                          onClick={() => handleSelectIngredientFromSearch(r.type, r.id)}
                          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-indigo-50 flex items-center justify-between gap-2 text-xs group"
                        >
                          <span className="font-medium text-slate-800 group-hover:text-indigo-900 truncate">
                            {r.name}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                              r.type === 'semi' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.type === 'semi' ? 'п/ф' : 'сырьё'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Наименование</th>
                      <th className="py-2.5 px-3 text-center">Норма на 1 шт</th>
                      <th className="py-2.5 px-3 text-center w-10">Удалить</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentDishCosting.semiFinishedItems.length === 0 && currentDishCosting.rawIngredients.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400 italic">
                          Состав не заполнен. Нажмите «Добавить», чтобы найти полуфабрикат или сырьё.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {currentDishCosting.semiFinishedItems.map((item) => {
                          const semi = semiMap.get(item.semiFinishedId);
                          if (!semi) return null;

                          return (
                            <tr key={`semi-${item.semiFinishedId}`} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {semi.name}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleUpdateDishSemiQty(item.semiFinishedId, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-20 px-2 py-1 text-center border border-slate-300 rounded font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                  <span className="text-slate-500 font-medium">{item.unit}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  onClick={() => handleDeleteDishSemi(item.semiFinishedId)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                  title="Удалить из рецептуры"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {currentDishCosting.rawIngredients.map((item) => (
                          <tr key={`raw-${item.id}`} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {item.name}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateDishRawQty(item.id, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-20 px-2 py-1 text-center border border-slate-300 rounded font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <span className="text-slate-500 font-medium">{item.unit}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleDeleteDishRaw(item.id)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="Удалить"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SEMI-FINISHED COSTINGS TAB */}
      {activeTab === 'semis' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Калькуляции и нормативные рецептуры Полуфабрикатов (Цех Заготовок)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Расчет закладки исходного сырья из Справочника на 1 кг или 1 литр готового полуфабриката
              </p>
            </div>

            <button
              onClick={() => setIsAddSemiModalOpen(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded text-xs uppercase tracking-wider transition-all shadow-sm"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Создать новый полуфабрикат</span>
            </button>
          </div>

          {/* Category Filter + add-category */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={semiCategoryFilter}
              onChange={(e) => setSemiCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white cursor-pointer"
            >
              {semiCategories.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>

            {isAddSemiCategoryOpen ? (
              <form onSubmit={handleAddSemiCategory} className="flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  value={newSemiCategoryName}
                  onChange={(e) => setNewSemiCategoryName(e.target.value)}
                  onBlur={() => {
                    if (!newSemiCategoryName.trim()) setIsAddSemiCategoryOpen(false);
                  }}
                  placeholder="Название категории"
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
                >
                  +
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsAddSemiCategoryOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-700 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Категория</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredSemiFinishedList.map((semi) => {
              const currentCost = calculateSemiCost(semi);

              return (
                <button
                  key={semi.id}
                  onClick={() => {
                    setSelectedSemiId(semi.id);
                    setIsSemiCardOpen(true);
                    setIsSemiTechOpen(false);
                    setIsSemiIngredientSearchOpen(false);
                    setSemiIngredientSearch('');
                  }}
                  className="w-full p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-left transition-all group shadow-sm space-y-1"
                >
                  <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 inline-block">
                    {semi.categoryLabel}
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 truncate">
                      {semi.name}
                    </div>
                    <div className="text-xs font-black text-indigo-900 shrink-0">
                      {currentCost.toLocaleString('ru-RU')} ₸
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">Выход: {semi.yieldQuantity} {semi.unit}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SEMI-FINISHED CARD MODAL: opens with the full recipe/ingredients editor for the selected item */}
      {isSemiCardOpen && selectedSemi && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xl space-y-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center -mb-2">
              <button
                onClick={() => handleDeleteSemiProduct(selectedSemi.id)}
                className="flex items-center space-x-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg text-xs font-bold"
                title="Удалить полуфабрикат"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить</span>
              </button>
              <button
                onClick={() => setIsSemiCardOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Card Header: name on top, category/cost/technology together below it */}
            <div className="space-y-2.5 border-b border-slate-100 pb-3">
              <input
                type="text"
                value={selectedSemi.name}
                onChange={(e) => handleUpdateSemiName(selectedSemi.id, e.target.value)}
                className="w-full font-bold text-slate-900 text-base leading-snug bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none"
              />

              <div className="flex items-stretch gap-2 flex-wrap">
                <select
                  value={selectedSemi.category}
                  onChange={(e) => handleUpdateSemiCategory(selectedSemi.id, e.target.value)}
                  className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 px-2.5 py-1.5 rounded-lg border border-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {semiCategoryDefs.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>

                <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-slate-400 block leading-none mb-0.5">Себестоимость 1 {selectedSemi.unit}</span>
                  <span className="text-sm font-black text-indigo-900 leading-none">
                    {calculateSemiCost(selectedSemi).toLocaleString('ru-RU')} ₸
                  </span>
                </div>

                <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-slate-400 block leading-none mb-0.5">Выход</span>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={selectedSemi.yieldQuantity}
                      onChange={(e) => handleUpdateSemiYield(selectedSemi.id, parseFloat(e.target.value) || 0)}
                      className="w-12 bg-transparent font-black text-indigo-900 text-sm leading-none focus:outline-none"
                    />
                    <select
                      value={selectedSemi.unit}
                      onChange={(e) => handleUpdateSemiUnit(selectedSemi.id, e.target.value)}
                      className="bg-transparent text-slate-500 font-bold text-[10px] leading-none focus:outline-none cursor-pointer"
                    >
                      <option value="кг">кг</option>
                      <option value="л">л</option>
                      <option value="шт">шт</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setIsSemiTechOpen((v) => !v)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide transition-all ${
                    isSemiTechOpen
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300'
                  }`}
                >
                  <span>📋 Технология</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSemiTechOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {isSemiTechOpen && (
              /* Technology Prep Instructions */
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 block mb-1">
                  📋 Технологическая инструкция заготовки:
                </span>
                <textarea
                  rows={2}
                  value={selectedSemi.prepInstructions}
                  onChange={(e) => handleUpdateSemiInstructions(selectedSemi.id, e.target.value)}
                  className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Ingredients Table (raw quantities actually used) — always visible, not behind Технология */}
            <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase flex-wrap gap-2">
                    <span>Закладка сырья (сколько взяли):</span>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsSemiIngredientSearchOpen((v) => !v)}
                        className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-all shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Добавить</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddSemiIngredientManual(selectedSemi.id)}
                        className="text-slate-600 hover:text-slate-900 text-[11px] font-bold flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded transition-all"
                      >
                        <Plus className="w-3 h-3 text-indigo-600" />
                        <span>Ввод вручную</span>
                      </button>
                    </div>
                  </div>

                  {isSemiIngredientSearchOpen && (
                    <div className="w-full bg-white border border-slate-200 rounded-lg shadow-sm z-20 p-2">
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={semiIngredientSearch}
                          onChange={(e) => setSemiIngredientSearch(e.target.value)}
                          placeholder="Поиск сырья..."
                          className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-0.5">
                        {semiIngredientSearchResults.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic text-center py-3">
                            {semiIngredientSearch.trim() ? 'Ничего не найдено' : 'Начните вводить название...'}
                          </p>
                        ) : (
                          semiIngredientSearchResults.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                handleAddSemiIngredientFromCatalog(selectedSemi.id, r.id);
                                setSemiIngredientSearch('');
                                setIsSemiIngredientSearchOpen(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-indigo-50 flex items-center justify-between gap-2 text-xs group"
                            >
                              <span className="font-medium text-slate-800 group-hover:text-indigo-900 truncate">
                                {r.name}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {r.defaultUnitPrice} ₸/{r.unit}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-xs text-left min-w-[480px]">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Наименование сырья</th>
                          <th className="py-2 px-3 text-center">Количество</th>
                          <th className="py-2 px-3 text-right">Цена сырья (₸)</th>
                          <th className="py-2 px-3 text-right">Сумма</th>
                          <th className="py-2 px-3 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSemi.ingredients.map((ing) => {
                      const sum = Math.round(ing.quantity * ing.unitPrice);

                      return (
                        <tr key={ing.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={ing.rawMaterialName}
                              onChange={(e) =>
                                handleUpdateSemiIngredient(selectedSemi.id, ing.id, 'rawMaterialName', e.target.value)
                              }
                              className="w-full bg-transparent font-medium text-slate-900 border-b border-transparent focus:border-indigo-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <input
                                type="number"
                                step="0.01"
                                value={ing.quantity}
                                onChange={(e) =>
                                  handleUpdateSemiIngredient(
                                    selectedSemi.id,
                                    ing.id,
                                    'quantity',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-16 px-1.5 py-0.5 text-center border border-slate-300 rounded font-bold text-slate-900 focus:outline-none"
                              />
                              <span className="text-slate-500 text-[11px]">{ing.unit}</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input
                              type="number"
                              value={ing.unitPrice}
                              onChange={(e) =>
                                handleUpdateSemiIngredient(
                                  selectedSemi.id,
                                  ing.id,
                                  'unitPrice',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-20 px-1.5 py-0.5 text-right border border-slate-300 rounded text-slate-800 focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right font-bold text-indigo-900">
                            {sum.toLocaleString('ru-RU')} ₸
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <button
                              onClick={() => handleDeleteSemiIngredient(selectedSemi.id, ing.id)}
                              className="text-slate-400 hover:text-rose-600 p-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MASTER RAW MATERIALS CATALOG TAB */}
      {activeTab === 'raw_catalog' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          
          {/* Catalog Top Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center space-x-2">
                <Package className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
                  Товары ({rawMaterials.length})
                </h3>
              </div>
            </div>

            <button
              id="btn-open-add-raw-modal"
              onClick={() => setIsAddRawModalOpen(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Добавить новое сырье в справочник</span>
            </button>
          </div>

          {/* Search and Category Filters */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={rawSearchQuery}
                onChange={(e) => setRawSearchQuery(e.target.value)}
                placeholder="Поиск ингредиента по названию..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1">
              {rawCategories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setRawCategoryFilter(cat.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    rawCategoryFilter === cat.key
                      ? 'bg-indigo-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}

              {isAddCategoryOpen ? (
                <form onSubmit={handleAddCategory} className="flex items-center gap-1">
                  <input
                    type="text"
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onBlur={() => {
                      if (!newCategoryName.trim()) setIsAddCategoryOpen(false);
                    }}
                    placeholder="Название категории"
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
                  >
                    +
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-700 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Категория</span>
                </button>
              )}
            </div>
          </div>

          {/* Raw Materials Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Наименование Сырья / Ингредиента</th>
                  <th className="py-3 px-4">Категория</th>
                  <th className="py-3 px-4 text-center">Единица измерения</th>
                  <th className="py-3 px-4 text-right">Базовая закуп цена (₸)</th>
                  <th className="py-3 px-4 text-center w-16">Удалить</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRawMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      Ингредиенты не найдены. Попробуйте изменить фильтр или добавить новую позицию.
                    </td>
                  </tr>
                ) : (
                  filteredRawMaterials.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateRawMaterial(item.id, 'name', e.target.value)}
                          className="w-full font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={item.category}
                          onChange={(e) => handleUpdateRawMaterialCategory(item.id, e.target.value)}
                          className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          {rawCategoryDefs.map((cat) => (
                            <option key={cat.key} value={cat.key}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <select
                          value={item.unit}
                          onChange={(e) => handleUpdateRawMaterial(item.id, 'unit', e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 font-bold text-slate-800 text-center focus:outline-none"
                        >
                          <option value="кг">кг</option>
                          <option value="л">л</option>
                          <option value="шт">шт</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <input
                            type="number"
                            value={item.defaultUnitPrice}
                            onChange={(e) =>
                              handleUpdateRawMaterial(item.id, 'defaultUnitPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-28 px-2 py-1 text-right font-black text-indigo-900 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-slate-500 font-bold">₸ / {item.unit}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteRawMaterial(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                          title="Удалить из справочника"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* MODAL: Add New Raw Material */}
      {isAddSemiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-200">

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ChefHat className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Создать новый полуфабрикат
                </h3>
              </div>
              <button
                onClick={() => setIsAddSemiModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewSemi} className="space-y-4 text-xs">

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                  Название полуфабриката:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Куриное филе запеченное"
                  value={newSemiItem.name}
                  onChange={(e) => setNewSemiItem({ ...newSemiItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                    Категория:
                  </label>
                  <select
                    value={newSemiItem.category}
                    onChange={(e) => {
                      const label = semiCategories.find((c) => c.key === e.target.value)?.label || newSemiItem.categoryLabel;
                      setNewSemiItem({ ...newSemiItem, category: e.target.value, categoryLabel: label });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
                  >
                    {semiCategories.filter((c) => c.key !== 'all').length > 0 ? (
                      semiCategories
                        .filter((c) => c.key !== 'all')
                        .map((cat) => (
                          <option key={cat.key} value={cat.key}>
                            {cat.label}
                          </option>
                        ))
                    ) : (
                      <option value="prep_veg">Нарезка и овощи</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                    Ед. измерения:
                  </label>
                  <select
                    value={newSemiItem.unit}
                    onChange={(e) => setNewSemiItem({ ...newSemiItem, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
                  >
                    <option value="кг">кг</option>
                    <option value="л">л</option>
                    <option value="шт">шт</option>
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Ингредиенты и технологию приготовления можно будет добавить сразу после создания, на карточке полуфабриката.
              </p>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddSemiModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-all"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add New Dish */}
      {isAddDishModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Utensils className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Добавить новое блюдо</h3>
              </div>
              <button
                onClick={() => setIsAddDishModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewDish} className="space-y-4 text-xs">

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                  Название блюда:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Круассан с миндалем"
                  value={newDishItem.name}
                  onChange={(e) => setNewDishItem({ ...newDishItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                    Категория:
                  </label>
                  <select
                    value={newDishItem.category}
                    onChange={(e) => {
                      const label = dishCategories.find((c) => c.key === e.target.value)?.label || newDishItem.categoryLabel;
                      setNewDishItem({ ...newDishItem, category: e.target.value, categoryLabel: label });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
                  >
                    {dishCategories
                      .filter((c) => c.key !== 'all')
                      .map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                    Цена продажи (₸):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newDishItem.price}
                    onChange={(e) => setNewDishItem({ ...newDishItem, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                    Вес/объём (например 120г):
                  </label>
                  <input
                    type="text"
                    placeholder="120г"
                    value={newDishItem.unitWeight}
                    onChange={(e) => setNewDishItem({ ...newDishItem, unitWeight: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                    Срок годности:
                  </label>
                  <input
                    type="text"
                    placeholder="24 часа"
                    value={newDishItem.shelfLife}
                    onChange={(e) => setNewDishItem({ ...newDishItem, shelfLife: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Себестоимость и состав (полуфабрикаты и сырьё) можно будет заполнить сразу после создания, на карточке блюда.
              </p>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddDishModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-all"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddRawModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Добавить сырье в справочник
                </h3>
              </div>
              <button
                onClick={() => setIsAddRawModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewRawMaterial} className="space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                  Наименование ингредиента / продукта:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Авокадо Хасс свежий"
                  value={newRawItem.name}
                  onChange={(e) => setNewRawItem({ ...newRawItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                    Категория:
                  </label>
                  <select
                    value={newRawItem.category}
                    onChange={(e) =>
                      setNewRawItem({
                        ...newRawItem,
                        category: e.target.value,
                        categoryLabel: getCategoryLabel(e.target.value)
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
                  >
                    {rawCategoryDefs.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                    Ед. измерения:
                  </label>
                  <select
                    value={newRawItem.unit}
                    onChange={(e) => setNewRawItem({ ...newRawItem, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
                  >
                    <option value="кг">кг</option>
                    <option value="л">л</option>
                    <option value="шт">шт</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                  Базовая цена закупки за 1 {newRawItem.unit} (₸):
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newRawItem.defaultUnitPrice}
                  onChange={(e) => setNewRawItem({ ...newRawItem, defaultUnitPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddRawModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-all"
                >
                  Сохранить в справочник
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
