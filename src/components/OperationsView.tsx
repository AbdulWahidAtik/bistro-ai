import React, { useState } from 'react';
import { MenuItem, Order, OrderItem, OrderStatus, OrderType, Reservation, ReservationSource, ReservationStatus } from '../types';

interface OperationsViewProps {
  reservations: Reservation[];
  orders: Order[];
  menuItems: MenuItem[];
  onAddReservation: (reservation: Reservation) => void;
  onUpdateReservation: (reservation: Reservation) => void;
  onDeleteReservation: (id: string) => void;
  onAddOrder: (order: Order) => void;
  onUpdateOrder: (order: Order) => void;
  onDeleteOrder: (id: string) => void;
  globalSearchTerm?: string;
}

const reservationStatuses: ReservationStatus[] = ['pending', 'confirmed', 'seated', 'cancelled'];
const reservationSources: ReservationSource[] = ['staff', 'ai-call', 'web'];
const orderStatuses: OrderStatus[] = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
const orderTypes: OrderType[] = ['takeout', 'dine-in', 'delivery'];

function statusTone(status: string) {
  if (['confirmed', 'completed', 'ready', 'seated'].includes(status)) {
    return 'bg-primary/10 text-primary border-primary/20';
  }
  if (['pending', 'preparing'].includes(status)) {
    return 'bg-secondary/10 text-secondary border-secondary/20';
  }
  return 'bg-error/10 text-error border-error/20';
}

export default function OperationsView({
  reservations,
  orders,
  menuItems,
  onAddReservation,
  onUpdateReservation,
  onDeleteReservation,
  onAddOrder,
  onUpdateOrder,
  onDeleteOrder,
  globalSearchTerm = '',
}: OperationsViewProps) {
  const [activeTab, setActiveTab] = useState<'reservations' | 'orders'>('reservations');
  const [localSearch, setLocalSearch] = useState('');
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [reservationForm, setReservationForm] = useState({
    customerName: '',
    phone: '',
    partySize: '2',
    reservationDate: new Date().toISOString().slice(0, 10),
    reservationTime: '19:00',
    notes: '',
    status: 'pending' as ReservationStatus,
    source: 'staff' as ReservationSource,
  });
  const [reservationFormError, setReservationFormError] = useState('');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    phone: '',
    status: 'pending' as OrderStatus,
    type: 'takeout' as OrderType,
    notes: '',
    items: [] as OrderItem[],
  });
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState('1');
  const [orderFormError, setOrderFormError] = useState('');
  const search = [globalSearchTerm, localSearch].join(' ').trim().toLowerCase();

  const visibleReservations = reservations.filter((reservation) => {
    if (!search) return true;
    return [
      reservation.customerName,
      reservation.phone,
      reservation.reservationDate,
      reservation.reservationTime,
      reservation.status,
      reservation.source,
      reservation.notes,
    ].some((value) => String(value).toLowerCase().includes(search));
  });

  const visibleOrders = orders.filter((order) => {
    if (!search) return true;
    return [
      order.id,
      order.customerName,
      order.phone,
      order.status,
      order.type,
      order.notes,
      ...order.items.map((item) => item.name),
    ].some((value) => String(value).toLowerCase().includes(search));
  });

  const pendingReservations = reservations.filter((reservation) => reservation.status === 'pending').length;
  const openOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length;
  const revenue = orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + order.total, 0);

  const resetReservationForm = () => {
    setEditingReservation(null);
    setReservationForm({
      customerName: '',
      phone: '',
      partySize: '2',
      reservationDate: new Date().toISOString().slice(0, 10),
      reservationTime: '19:00',
      notes: '',
      status: 'pending',
      source: 'staff',
    });
    setReservationFormError('');
  };

  const openReservationCreate = () => {
    resetReservationForm();
    setIsReservationModalOpen(true);
  };

  const openReservationEdit = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setReservationForm({
      customerName: reservation.customerName,
      phone: reservation.phone,
      partySize: String(reservation.partySize),
      reservationDate: reservation.reservationDate,
      reservationTime: reservation.reservationTime,
      notes: reservation.notes,
      status: reservation.status,
      source: reservation.source,
    });
    setReservationFormError('');
    setIsReservationModalOpen(true);
  };

  const closeReservationModal = () => {
    setIsReservationModalOpen(false);
    resetReservationForm();
  };

  const handleReservationSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const partySize = Number(reservationForm.partySize);

    if (!reservationForm.customerName.trim() || !reservationForm.phone.trim()) {
      setReservationFormError('Guest name and phone are required.');
      return;
    }
    if (!Number.isInteger(partySize) || partySize <= 0) {
      setReservationFormError('Party size must be a positive whole number.');
      return;
    }

    const reservation: Reservation = {
      id: editingReservation?.id || `reservation-${Date.now()}`,
      customerName: reservationForm.customerName.trim(),
      phone: reservationForm.phone.trim(),
      partySize,
      reservationDate: reservationForm.reservationDate,
      reservationTime: reservationForm.reservationTime,
      notes: reservationForm.notes.trim(),
      status: reservationForm.status,
      source: reservationForm.source,
    };

    if (editingReservation) {
      onUpdateReservation(reservation);
    } else {
      onAddReservation(reservation);
    }

    closeReservationModal();
  };

  const orderTotal = orderForm.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const resetOrderForm = () => {
    setEditingOrder(null);
    setOrderForm({
      customerName: '',
      phone: '',
      status: 'pending',
      type: 'takeout',
      notes: '',
      items: [],
    });
    setSelectedMenuItemId('');
    setSelectedQuantity('1');
    setOrderFormError('');
  };

  const openOrderCreate = () => {
    resetOrderForm();
    setActiveTab('orders');
    setIsOrderModalOpen(true);
  };

  const openOrderEdit = (order: Order) => {
    setEditingOrder(order);
    setOrderForm({
      customerName: order.customerName,
      phone: order.phone,
      status: order.status,
      type: order.type,
      notes: order.notes,
      items: order.items,
    });
    setSelectedMenuItemId('');
    setSelectedQuantity('1');
    setOrderFormError('');
    setIsOrderModalOpen(true);
  };

  const closeOrderModal = () => {
    setIsOrderModalOpen(false);
    resetOrderForm();
  };

  const addSelectedOrderItem = () => {
    const menuItem = menuItems.find((item) => item.id === selectedMenuItemId);
    const quantity = Number(selectedQuantity);

    if (!menuItem) {
      setOrderFormError('Select a menu item first.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setOrderFormError('Quantity must be a positive whole number.');
      return;
    }

    const nextItem: OrderItem = {
      menuItemId: menuItem.id,
      name: menuItem.name,
      quantity,
      price: menuItem.price,
    };

    setOrderForm({
      ...orderForm,
      items: [...orderForm.items, nextItem],
    });
    setSelectedMenuItemId('');
    setSelectedQuantity('1');
    setOrderFormError('');
  };

  const removeOrderItem = (index: number) => {
    setOrderForm({
      ...orderForm,
      items: orderForm.items.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const handleOrderSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!orderForm.customerName.trim() || !orderForm.phone.trim()) {
      setOrderFormError('Customer name and phone are required.');
      return;
    }
    if (orderForm.items.length === 0) {
      setOrderFormError('Add at least one menu item to the order.');
      return;
    }

    const order: Order = {
      id: editingOrder?.id || `order-${Date.now()}`,
      customerName: orderForm.customerName.trim(),
      phone: orderForm.phone.trim(),
      items: orderForm.items,
      total: orderTotal,
      status: orderForm.status,
      type: orderForm.type,
      placedAt: editingOrder?.placedAt || new Date().toISOString(),
      notes: orderForm.notes.trim(),
    };

    if (editingOrder) {
      onUpdateOrder(order);
    } else {
      onAddOrder(order);
    }

    closeOrderModal();
  };

  const handleDeleteReservation = (reservation: Reservation) => {
    const confirmed = window.confirm(`Delete reservation for ${reservation.customerName}?`);
    if (confirmed) {
      onDeleteReservation(reservation.id);
    }
  };

  const handleDeleteOrder = (order: Order) => {
    const confirmed = window.confirm(`Delete order ${order.id}?`);
    if (confirmed) {
      onDeleteOrder(order.id);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div>
          <h2 className="font-geist text-headline-xl font-extrabold bg-gradient-to-r from-white to-on-surface-variant bg-clip-text text-transparent tracking-tight leading-tight">
            Operations
          </h2>
          <p className="font-sans text-body-md text-on-surface-variant/70 mt-1">
            Review live reservations, order flow, and front-of-house fulfillment status.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[18px] leading-none text-on-surface-variant/60">
              search
            </span>
            <input
              type="text"
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              placeholder="Search reservations and orders..."
              className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-on-surface placeholder:text-on-surface-variant/40"
            />
          </div>
          <button
            type="button"
            onClick={openReservationCreate}
            className="flex items-center justify-center gap-2 border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 rounded-xl font-geist font-bold text-sm text-on-surface hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">event_available</span>
            New Reservation
          </button>
          <button
            type="button"
            onClick={openOrderCreate}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-emerald-500 text-on-primary px-5 py-2.5 rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-primary/10 border border-emerald-400/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            New Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
        <div className="glass-card p-5 rounded-2xl border border-white/[0.04]">
          <p className="text-on-surface-variant/80 font-geist font-medium text-[11px] uppercase tracking-wider">Reservations</p>
          <h3 className="font-geist text-headline-xl font-bold text-on-surface mt-1">{reservations.length}</h3>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-white/[0.04]">
          <p className="text-on-surface-variant/80 font-geist font-medium text-[11px] uppercase tracking-wider">Pending Tables</p>
          <h3 className="font-geist text-headline-xl font-bold text-secondary mt-1">{pendingReservations}</h3>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-white/[0.04]">
          <p className="text-on-surface-variant/80 font-geist font-medium text-[11px] uppercase tracking-wider">Open Orders</p>
          <h3 className="font-geist text-headline-xl font-bold text-primary mt-1">{openOrders}</h3>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-white/[0.04]">
          <p className="text-on-surface-variant/80 font-geist font-medium text-[11px] uppercase tracking-wider">Order Revenue</p>
          <h3 className="font-geist text-headline-xl font-bold text-on-surface mt-1">${revenue.toFixed(2)}</h3>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/[0.04] overflow-hidden shadow-md">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('reservations')}
            className={`px-4 py-2 rounded-xl text-xs font-geist font-bold transition-all ${
              activeTab === 'reservations'
                ? 'bg-primary text-on-primary'
                : 'bg-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.08]'
            }`}
          >
            Reservations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-geist font-bold transition-all ${
              activeTab === 'orders'
                ? 'bg-primary text-on-primary'
                : 'bg-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.08]'
            }`}
          >
            Orders
          </button>
        </div>

        {activeTab === 'reservations' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.01] border-b border-white/[0.06] text-[10px] text-on-surface-variant/80 uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Guest</th>
                  <th className="px-6 py-4">When</th>
                  <th className="px-6 py-4">Party</th>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {visibleReservations.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-geist font-bold text-sm text-on-surface">{reservation.customerName}</p>
                      <p className="font-sans text-[11px] text-on-surface-variant/60 mt-0.5">{reservation.phone}</p>
                    </td>
                    <td className="px-6 py-4 font-geist text-xs text-on-surface">
                      {reservation.reservationDate} at {reservation.reservationTime}
                    </td>
                    <td className="px-6 py-4 font-geist text-sm font-bold text-primary">{reservation.partySize}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 bg-white/5 border border-white/[0.06] rounded font-geist font-bold text-[9px] uppercase tracking-wider text-on-surface-variant">
                        {reservation.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={reservation.status}
                        onChange={(event) => onUpdateReservation({ ...reservation, status: event.target.value as ReservationStatus })}
                        className={`border rounded-lg px-2.5 py-1.5 text-[10px] font-geist font-bold uppercase bg-[#0b0e10] ${statusTone(reservation.status)}`}
                      >
                        {reservationStatuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant/70 max-w-xs truncate" title={reservation.notes}>
                      {reservation.notes || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openReservationEdit(reservation)}
                          className="p-1.5 text-on-surface-variant/80 hover:text-primary hover:bg-white/5 rounded-lg transition-colors"
                          title="Edit reservation"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReservation(reservation)}
                          className="p-1.5 text-on-surface-variant/80 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                          title="Delete reservation"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleReservations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant/60 font-sans text-xs">
                      No reservations match the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.01] border-b border-white/[0.06] text-[10px] text-on-surface-variant/80 uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Order</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {visibleOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-geist font-bold text-sm text-on-surface">{order.id}</p>
                      <p className="font-sans text-[11px] text-on-surface-variant/60 mt-0.5">{order.customerName}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant/80">
                      {order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 bg-white/5 border border-white/[0.06] rounded font-geist font-bold text-[9px] uppercase tracking-wider text-on-surface-variant">
                        {order.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-geist text-sm font-bold text-primary">${order.total.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <select
                        value={order.status}
                        onChange={(event) => onUpdateOrder({ ...order, status: event.target.value as OrderStatus })}
                        className={`border rounded-lg px-2.5 py-1.5 text-[10px] font-geist font-bold uppercase bg-[#0b0e10] ${statusTone(order.status)}`}
                      >
                        {orderStatuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant/70 max-w-xs truncate" title={order.notes}>
                      {order.notes || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openOrderEdit(order)}
                          className="p-1.5 text-on-surface-variant/80 hover:text-primary hover:bg-white/5 rounded-lg transition-colors"
                          title="Edit order"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order)}
                          className="p-1.5 text-on-surface-variant/80 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                          title="Delete order"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant/60 font-sans text-xs">
                      No orders match the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isReservationModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#12161a] border border-white/10 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-geist text-headline-lg font-bold text-on-surface">
                {editingReservation ? 'Edit Reservation' : 'New Reservation'}
              </h3>
              <button
                onClick={closeReservationModal}
                type="button"
                className="p-1.5 hover:bg-white/5 rounded-full text-on-surface-variant transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {reservationFormError && (
              <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-semibold">
                {reservationFormError}
              </div>
            )}

            <form onSubmit={handleReservationSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Guest Name</label>
                  <input
                    type="text"
                    required
                    value={reservationForm.customerName}
                    onChange={(event) => setReservationForm({ ...reservationForm, customerName: event.target.value })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Phone</label>
                  <input
                    type="tel"
                    required
                    value={reservationForm.phone}
                    onChange={(event) => setReservationForm({ ...reservationForm, phone: event.target.value })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Date</label>
                  <input
                    type="date"
                    required
                    value={reservationForm.reservationDate}
                    onChange={(event) => setReservationForm({ ...reservationForm, reservationDate: event.target.value })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Time</label>
                  <input
                    type="time"
                    required
                    value={reservationForm.reservationTime}
                    onChange={(event) => setReservationForm({ ...reservationForm, reservationTime: event.target.value })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Party Size</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={reservationForm.partySize}
                    onChange={(event) => setReservationForm({ ...reservationForm, partySize: event.target.value })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Status</label>
                  <select
                    value={reservationForm.status}
                    onChange={(event) => setReservationForm({ ...reservationForm, status: event.target.value as ReservationStatus })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {reservationStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Source</label>
                  <select
                    value={reservationForm.source}
                    onChange={(event) => setReservationForm({ ...reservationForm, source: event.target.value as ReservationSource })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {reservationSources.map((source) => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Notes</label>
                <textarea
                  rows={3}
                  value={reservationForm.notes}
                  onChange={(event) => setReservationForm({ ...reservationForm, notes: event.target.value })}
                  className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeReservationModal}
                  className="flex-1 px-4 py-3 border border-white/10 rounded-xl font-geist font-bold text-sm text-on-surface hover:bg-white/5 transition-colors active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-emerald-500 text-on-primary rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-primary/10 border border-emerald-400/20 cursor-pointer"
                >
                  {editingReservation ? 'Save Reservation' : 'Create Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOrderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#12161a] border border-white/10 w-full max-w-3xl rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-geist text-headline-lg font-bold text-on-surface">
                {editingOrder ? 'Edit Order' : 'New Order'}
              </h3>
              <button
                onClick={closeOrderModal}
                type="button"
                className="p-1.5 hover:bg-white/5 rounded-full text-on-surface-variant transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {orderFormError && (
              <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-semibold">
                {orderFormError}
              </div>
            )}

            <form onSubmit={handleOrderSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={orderForm.customerName}
                    onChange={(event) => setOrderForm({ ...orderForm, customerName: event.target.value })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Phone</label>
                  <input
                    type="tel"
                    required
                    value={orderForm.phone}
                    onChange={(event) => setOrderForm({ ...orderForm, phone: event.target.value })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Type</label>
                  <select
                    value={orderForm.type}
                    onChange={(event) => setOrderForm({ ...orderForm, type: event.target.value as OrderType })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {orderTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Status</label>
                  <select
                    value={orderForm.status}
                    onChange={(event) => setOrderForm({ ...orderForm, status: event.target.value as OrderStatus })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {orderStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="glass-card border border-white/[0.04] rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-3">
                  <select
                    value={selectedMenuItemId}
                    onChange={(event) => setSelectedMenuItemId(event.target.value)}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select menu item</option>
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} - ${item.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={selectedQuantity}
                    onChange={(event) => setSelectedQuantity(event.target.value)}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={addSelectedOrderItem}
                    className="px-4 py-3 bg-white/5 hover:bg-white/[0.08] text-on-surface font-geist font-bold text-xs rounded-xl active:scale-95 transition-all border border-white/[0.06] cursor-pointer"
                  >
                    Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {orderForm.items.map((item, index) => (
                    <div key={`${item.menuItemId}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                      <div>
                        <p className="font-geist font-bold text-sm text-on-surface">{item.quantity}x {item.name}</p>
                        <p className="text-[11px] text-on-surface-variant/60">${item.price.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-geist font-bold text-primary">${(item.quantity * item.price).toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => removeOrderItem(index)}
                          className="p-1.5 text-on-surface-variant/80 hover:text-error hover:bg-white/5 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {orderForm.items.length === 0 && (
                    <div className="py-8 text-center text-on-surface-variant/60 font-sans text-xs">
                      No items added yet.
                    </div>
                  )}
                </div>

                <div className="flex justify-end border-t border-white/[0.06] pt-3">
                  <div className="text-right">
                    <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-wider font-geist font-bold">Total</p>
                    <p className="font-geist text-headline-md font-extrabold text-primary">${orderTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Notes</label>
                <textarea
                  rows={3}
                  value={orderForm.notes}
                  onChange={(event) => setOrderForm({ ...orderForm, notes: event.target.value })}
                  className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeOrderModal}
                  className="flex-1 px-4 py-3 border border-white/10 rounded-xl font-geist font-bold text-sm text-on-surface hover:bg-white/5 transition-colors active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-emerald-500 text-on-primary rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-primary/10 border border-emerald-400/20 cursor-pointer"
                >
                  {editingOrder ? 'Save Order' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
