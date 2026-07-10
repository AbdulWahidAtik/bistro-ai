import React, { useRef, useState } from 'react';
import { generateBackendMenuDescription } from '../api';
import { MenuItem, CategoryType } from '../types';

interface MenuViewProps {
  menuItems: MenuItem[];
  onAddMenuItem: (item: MenuItem) => void;
  onUpdateMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem: (id: string) => void;
  globalSearchTerm?: string;
}

export default function MenuView({
  menuItems,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  globalSearchTerm = ''
}: MenuViewProps) {
  const [searchTerm, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemPendingDelete, setItemPendingDelete] = useState<MenuItem | null>(null);
  const [importMessage, setImportMessage] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Input states for Add New Item
  const [formName, setName] = useState('');
  const [formCategory, setCategory] = useState<CategoryType>('Main');
  const [formPrice, setPrice] = useState<string>('');
  const [formDesc, setFormDesc] = useState('');
  const [formIsSpecial, setFormIsSpecial] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;
  const categories: CategoryType[] = ['Starter', 'Appetizer', 'Main', 'Drink', 'Dessert'];

  const resetForm = () => {
    setEditingItem(null);
    setName('');
    setCategory('Main');
    setPrice('');
    setFormDesc('');
    setFormIsSpecial(false);
    setFormError('');
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setPrice(item.price.toFixed(2));
    setFormDesc(item.description);
    setFormIsSpecial(item.isSpecial);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleToggleStatus = (item: MenuItem) => {
    onUpdateMenuItem({
      ...item,
      status: item.status === 'active' ? 'inactive' : 'active'
    });
  };

  const getCategoryIcon = (category: CategoryType) => {
    switch (category) {
      case 'Main': return 'lunch_dining';
      case 'Appetizer': return 'tapas';
      case 'Starter': return 'dinner_dining';
      case 'Drink': return 'local_bar';
      case 'Dessert': return 'cookie';
      default: return 'restaurant';
    }
  };

  const totalItems = menuItems.length;
  const activeCount = menuItems.filter(i => i.status === 'active').length;
  const specialOffersCount = menuItems.filter(i => i.isSpecial).length;
  const averagePrice = menuItems.length > 0 
    ? (menuItems.reduce((acc, curr) => acc + curr.price, 0) / menuItems.length).toFixed(2)
    : '0.00';

  const normalizedGlobalSearchTerm = globalSearchTerm.trim().toLowerCase();
  const normalizedLocalSearchTerm = searchTerm.trim().toLowerCase();
  const filteredMenuItems = menuItems.filter(item => {
    const searchableValues = [item.name, item.description, item.category].map(value => value.toLowerCase());
    const matchesGlobalSearch = !normalizedGlobalSearchTerm ||
      searchableValues.some(value => value.includes(normalizedGlobalSearchTerm));
    const matchesLocalSearch = !normalizedLocalSearchTerm ||
      searchableValues.some(value => value.includes(normalizedLocalSearchTerm));
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    return matchesGlobalSearch && matchesLocalSearch && matchesCategory;
  });

  const paginatedItems = filteredMenuItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(filteredMenuItems.length / itemsPerPage) || 1;

  const handleSaveItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice) {
      setFormError('Name and valid Price are required.');
      return;
    }
    const parsedPrice = parseFloat(formPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setFormError('Please enter a valid positive number for Price.');
      return;
    }

    const savedItem: MenuItem = {
      id: editingItem?.id || `menu-${Date.now()}`,
      name: formName.trim(),
      category: formCategory,
      price: parsedPrice,
      description: formDesc.trim() || 'A delightful dish custom crafted by Bistro chefs.',
      isSpecial: formIsSpecial,
      status: editingItem?.status || 'active'
    };

    if (editingItem) {
      onUpdateMenuItem(savedItem);
    } else {
      onAddMenuItem(savedItem);
    }

    resetForm();
    setIsModalOpen(false);
  };

  // Automated AI writer description synthesis helper
  const handleAiWriter = async () => {
    if (!formName.trim()) {
      setFormError('Define the dish name first to initialize the AI description writer.');
      return;
    }
    setIsAiGenerating(true);
    setFormError('');

    try {
      const result = await generateBackendMenuDescription({
        name: formName.trim(),
        category: formCategory,
        price: formPrice,
        isSpecial: formIsSpecial,
      });
      setFormDesc(result.description);
    } catch {
      const descriptions = [
        `Our signature culinary creation of ${formName.trim()} captures authentic notes, featuring a rich, slow-simmered savory glaze and fresh seasonal herbs. Readily customized for guest allergies.`,
        `Enjoy this exquisite ${formName.trim()} crafted by our culinary experts, combining seared crisp layers with aromatic truffle essence and subtle cracked black pepper accents.`,
        `A classic table favorite, this artisanal ${formName.trim()} highlights tender cuts, a delicate fusion of spices, and chef-recommended garnishes designed to captivate calling reservations.`
      ];
      setFormDesc(descriptions[Math.floor(Math.random() * descriptions.length)]);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const parseCsvLine = (line: string) => {
    const values: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (const char of line) {
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values.map(value => value.replace(/^"|"$/g, ''));
  };

  const handleMenuUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportMessage('Please upload a CSV file. PDF parsing will be added with the backend importer.');
      event.target.value = '';
      return;
    }

    const text = await file.text();
    const rows = text.split(/\r?\n/).map(row => row.trim()).filter(Boolean);

    if (rows.length < 2) {
      setImportMessage('CSV needs a header and at least one menu item row.');
      event.target.value = '';
      return;
    }

    const importedItems = rows.slice(1).map((row, index) => {
      const [name, category, price, description, isSpecial] = parseCsvLine(row);
      const normalizedCategory = categories.includes(category as CategoryType) ? category as CategoryType : 'Main';
      const parsedPrice = Number.parseFloat(price);

      if (!name || Number.isNaN(parsedPrice)) {
        return null;
      }

      return {
        id: `menu-import-${Date.now()}-${index}`,
        name,
        category: normalizedCategory,
        price: parsedPrice,
        description: description || 'Imported menu item ready for AI voice descriptions.',
        isSpecial: ['true', 'yes', '1', 'special'].includes((isSpecial || '').toLowerCase()),
        status: 'active' as const
      };
    }).filter((item): item is MenuItem => Boolean(item));

    importedItems.forEach(onAddMenuItem);
    setImportMessage(importedItems.length > 0
      ? `Imported ${importedItems.length} menu items from CSV.`
      : 'No valid menu items found. Use columns: name, category, price, description, isSpecial.'
    );
    event.target.value = '';
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div>
          <h2 className="font-geist text-headline-xl font-extrabold bg-gradient-to-r from-white to-on-surface-variant bg-clip-text text-transparent tracking-tight leading-tight">
            Menu Management
          </h2>
          <p className="font-sans text-body-md text-on-surface-variant/70 mt-1">
            Manage your digital AI menu, update prices, and configure special recommendation tags.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleMenuUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            type="button"
            className="flex items-center gap-2 border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 rounded-xl font-geist font-bold text-sm text-on-surface hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Upload CSV
          </button>
          
          <button
            onClick={openCreateModal}
            type="button"
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-emerald-500 text-on-primary px-5 py-2.5 rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-primary/10 border border-emerald-400/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add New Item
          </button>
        </div>
      </div>

      {importMessage && (
        <div className="bg-primary/5 border border-primary/20 text-primary px-4 py-3 rounded-xl text-xs font-geist font-semibold flex items-center justify-between gap-3">
          <span>{importMessage}</span>
          <button
            type="button"
            onClick={() => setImportMessage('')}
            className="text-on-surface-variant hover:text-on-surface"
            title="Dismiss import message"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Stats Bento Grid layer */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
        {/* Total stats */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.04] flex flex-col justify-between h-28 relative overflow-hidden group">
          <div className="z-10">
            <p className="text-on-surface-variant/80 font-geist font-medium text-[11px] uppercase tracking-wider">Total Items</p>
            <h3 className="font-geist text-headline-xl font-bold text-on-surface mt-1">{totalItems}</h3>
          </div>
          <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[90px] opacity-[0.02] text-on-surface select-none pointer-events-none group-hover:scale-105 transition-transform duration-300">
            restaurant
          </span>
        </div>

        {/* Active item stats */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.04] flex flex-col justify-between h-28 relative overflow-hidden group">
          <div className="z-10">
            <p className="text-on-surface-variant/80 font-geist font-medium text-[11px] uppercase tracking-wider">Active Now</p>
            <div className="flex items-center gap-2 mt-1">
              <h3 className="font-geist text-headline-xl font-bold text-primary">{activeCount}</h3>
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            </div>
          </div>
          <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[90px] opacity-[0.02] text-on-surface select-none pointer-events-none group-hover:scale-105 transition-transform duration-300">
            check_circle
          </span>
        </div>

        {/* Special Offer stats */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.04] flex flex-col justify-between h-28 relative overflow-hidden group">
          <div className="z-10">
            <p className="text-on-surface-variant/80 font-geist font-medium text-[11px] uppercase tracking-wider">Special Offers</p>
            <h3 className="font-geist text-headline-xl font-bold text-secondary mt-1">{specialOffersCount}</h3>
          </div>
          <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[90px] opacity-[0.02] text-on-surface select-none pointer-events-none group-hover:scale-105 transition-transform duration-300">
            local_fire_department
          </span>
        </div>

        {/* Calculated Avg Price stats */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.04] flex flex-col justify-between h-28 relative overflow-hidden group">
          <div className="z-10">
            <p className="text-on-surface-variant/80 font-geist font-medium text-[11px] uppercase tracking-wider">Avg. Price</p>
            <h3 className="font-geist text-headline-xl font-bold text-on-surface mt-1">${averagePrice}</h3>
          </div>
          <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[90px] opacity-[0.02] text-on-surface select-none pointer-events-none group-hover:scale-105 transition-transform duration-300">
            payments
          </span>
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="glass-panel rounded-2xl border border-white/[0.04] overflow-hidden shadow-md">
        {/* Toolbar & Filter view switches */}
        <div className="p-4 bg-white/[0.01] border-b border-white/[0.06] flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search menu..."
                className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-on-surface placeholder:text-on-surface-variant/40"
              />
            </div>
            
            {/* Grid/Table layout toggler */}
            <div className="flex items-center bg-white/5 border border-white/[0.06] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant/70 hover:text-on-surface'}`}
                title="Grid layout view"
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md flex items-center justify-center transition-all ${viewMode === 'table' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant/70 hover:text-on-surface'}`}
                title="List layout view"
              >
                <span className="material-symbols-outlined text-[18px]">list</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-1 sm:pb-0">
            {['All', 'Starter', 'Appetizer', 'Main', 'Drink', 'Dessert'].map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategoryFilter(cat); setCurrentPage(1); }}
                type="button"
                className={`py-1.5 px-3.5 rounded-lg text-xs font-geist font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-primary text-on-primary'
                    : 'bg-white/5 text-on-surface hover:bg-white/[0.08]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic content area depending on viewMode state */}
        {viewMode === 'grid' ? (
          /* Bento Cards Layout */
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item) => (
                <div
                  key={item.id}
                  className={`glass-card p-5 rounded-2xl border border-white/[0.04] flex flex-col justify-between gap-4 relative overflow-hidden group hover:scale-[1.01] transition-transform ${item.status === 'inactive' ? 'opacity-60' : ''}`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.06] flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-300">
                        <span className="material-symbols-outlined text-[20px]">{getCategoryIcon(item.category)}</span>
                      </div>
                      
                      {/* Action Tags */}
                      <div className="flex items-center gap-1.5">
                        {item.isSpecial && (
                          <span className="px-2 py-0.5 rounded-md bg-secondary/10 border border-secondary/20 text-secondary font-geist font-bold text-[9px] uppercase tracking-wide">
                            Special
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/[0.06] font-geist font-bold text-[9px] uppercase tracking-wide text-on-surface-variant/80">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-geist font-bold text-sm text-on-surface">{item.name}</h4>
                      <p className="font-sans text-[11px] text-on-surface-variant/70 leading-relaxed mt-1.5 line-clamp-3" title={item.description}>
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between">
                    {/* Price */}
                    <div className="font-geist font-extrabold text-base text-primary">${item.price.toFixed(2)}</div>
                    
                    {/* Operation details and switches */}
                    <div className="flex items-center gap-3">
                      {/* Live Toggle */}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.status === 'active'}
                          onChange={() => handleToggleStatus(item)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/20 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-primary"></div>
                      </label>

                      {/* Edit Buttons */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => openEditModal(item)}
                          type="button"
                          className="p-1.5 text-on-surface-variant/80 hover:text-primary hover:bg-white/5 rounded-lg transition-colors"
                          title="Edit dish"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          onClick={() => setItemPendingDelete(item)}
                          type="button"
                          className="p-1.5 text-on-surface-variant/80 hover:text-error hover:bg-white/5 rounded-lg transition-colors"
                          title="Delete dish"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center text-on-surface-variant/70 font-sans text-xs">
                No items match the specific category or query parameters.
              </div>
            )}
          </div>
        ) : (
          /* Structured Table Layout */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.01] border-b border-white/[0.06] text-[10px] text-on-surface-variant/80 uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Availability</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-white/[0.01] transition-colors ${item.status === 'inactive' ? 'opacity-60' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-primary border border-white/[0.06]">
                            <span className="material-symbols-outlined text-[18px]">
                              {getCategoryIcon(item.category)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-geist font-bold text-sm text-on-surface truncate">{item.name}</p>
                            <p className="font-sans text-[11px] text-on-surface-variant/60 truncate max-w-xs" title={item.description}>
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-white/5 border border-white/[0.06] rounded font-geist font-bold text-[9px] text-on-surface-variant uppercase tracking-wider">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-geist font-bold text-sm text-on-surface">
                        ${item.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {item.isSpecial ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-secondary/10 text-secondary border border-secondary/20 rounded-full font-geist font-bold text-[9px] tracking-wide w-fit uppercase">
                            <span className="w-1 h-1 rounded-full bg-secondary animate-pulse"></span>
                            Special Offer
                          </span>
                        ) : (
                          <span className="text-on-surface-variant/40">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.status === 'active'}
                            onChange={() => handleToggleStatus(item)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4.5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/20 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            type="button"
                            className="p-1.5 text-on-surface-variant/80 hover:text-primary hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            onClick={() => setItemPendingDelete(item)}
                            type="button"
                            className="p-1.5 text-on-surface-variant/80 hover:text-error hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant/60 font-sans text-xs">
                      No items match the specific category or query parameters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table/Grid footer pagination */}
        <div className="px-6 py-4 bg-white/[0.01] border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-4 text-xs font-sans text-on-surface-variant/80">
          <p>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredMenuItems.length)} of {filteredMenuItems.length} dishes
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              type="button"
              className="p-1.5 border border-white/[0.06] rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                type="button"
                className={`w-7 h-7 rounded-lg font-geist font-bold flex items-center justify-center transition-all cursor-pointer ${
                  currentPage === idx + 1
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'border border-white/[0.06] hover:bg-white/5'
                }`}
              >
                {idx + 1}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              type="button"
              className="p-1.5 border border-white/[0.06] rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Optimizing tip box */}
      <div className="bg-primary/5 border border-primary/10 p-5 rounded-2xl flex items-center gap-5">
        <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center text-primary flex-shrink-0">
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
        </div>
        <div>
          <h4 className="font-geist text-headline-md font-bold text-primary mb-0.5">Optimize Vocal Assistant Cadence</h4>
          <p className="font-sans text-body-sm text-on-surface-variant/70 leading-relaxed">
            AI agents describe dishes more naturally to callers when sensory flavor details are added (e.g. &quot;golden crispy arancini core&quot; instead of &quot;mozzarella balls&quot;). Use our embedded AI Writer to generate premium voice descriptors!
          </p>
        </div>
      </div>

      {/* MODAL WINDOW: ADD/EDIT DISH */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#12161a] border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-geist text-headline-lg font-bold text-on-surface">
                {editingItem ? 'Edit Menu Item' : 'Add New Item'}
              </h3>
              <button
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                type="button"
                className="p-1.5 hover:bg-white/5 rounded-full text-on-surface-variant transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveItemSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lobster Thermidor"
                  value={formName}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setCategory(e.target.value as CategoryType)}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="24.50"
                    value={formPrice}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/30"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">
                    AI Vocal Assistant Description
                  </label>
                  <button
                    type="button"
                    onClick={handleAiWriter}
                    disabled={isAiGenerating}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-md text-[10px] font-geist font-bold text-primary hover:brightness-105 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[12px] animate-pulse">auto_awesome</span>
                    {isAiGenerating ? 'Synthesizing...' : 'AI Writer'}
                  </button>
                </div>
                <textarea
                  rows={3.5}
                  required
                  placeholder="Tell Jamie how to describe ingredients, rich flavor accents, and potential allergens..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/30"
                ></textarea>
              </div>

              <div className="flex items-center gap-3 py-1.5">
                <input
                  type="checkbox"
                  id="modalIsSpecial"
                  checked={formIsSpecial}
                  onChange={(e) => setFormIsSpecial(e.target.checked)}
                  className="rounded border-white/10 bg-[#0b0e10] text-primary focus:ring-primary focus:ring-offset-0 h-5 w-5"
                />
                <label htmlFor="modalIsSpecial" className="text-sm font-geist font-bold text-on-surface cursor-pointer select-none">
                  Highlight as Special Offer
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="flex-1 px-4 py-3 border border-white/10 rounded-xl font-geist font-bold text-sm text-on-surface hover:bg-white/5 transition-colors active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-emerald-500 text-on-primary rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-primary/10 border border-emerald-400/20 cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Create Menu Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemPendingDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#12161a] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="w-11 h-11 rounded-full bg-error/10 text-error flex items-center justify-center mb-4">
              <span className="material-symbols-outlined">delete</span>
            </div>
            <h3 className="font-geist text-headline-md font-bold text-on-surface">Delete menu item?</h3>
            <p className="text-sm text-on-surface-variant/80 mt-2 leading-relaxed">
              This will remove "{itemPendingDelete.name}" from the active AI menu workspace.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setItemPendingDelete(null)}
                className="flex-1 px-4 py-3 border border-white/10 rounded-xl font-geist font-bold text-sm text-on-surface hover:bg-white/5 transition-colors active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteMenuItem(itemPendingDelete.id);
                  setItemPendingDelete(null);
                }}
                className="flex-1 px-4 py-3 bg-error text-on-error rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
