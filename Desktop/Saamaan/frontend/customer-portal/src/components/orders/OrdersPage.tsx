import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck } from 'lucide-react';
import { CustomerOrder, ordersApi } from '../../lib/ordersApi';
import { CustomerOrdersSection } from '../profile/CustomerOrdersSection';

interface OrdersPageProps {
  onOpenTrackOrder?: () => void;
  user?: { name: string; email: string } | null;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({ onOpenTrackOrder, user }) => {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);

  const fetchOrders = () => {
    setLoadingOrders(true);
    ordersApi
      .getMyOrders()
      .then((data) => setOrders(data))
      .catch((err) => console.warn('Could not load orders:', err))
      .finally(() => setLoadingOrders(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  return (
    <div className="bg-canvas min-h-screen py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link to="/" className="hover:text-primary-700 transition-colors">
                Home
              </Link>
              <span>/</span>
              <span className="font-semibold text-slate-900">My Orders</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Package className="w-7 h-7 text-primary-600" />
              <span>My Orders</span>
            </h1>
          
          </div>

          {onOpenTrackOrder && (
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onOpenTrackOrder}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-500/20 active:scale-95 transition-all"
              >
                <Truck className="w-4 h-4" />
                <span>Track By Tracking ID</span>
              </button>
            </div>
          )}
        </div>

        {/* Orders List & Filters */}
        <CustomerOrdersSection
          orders={orders}
          loadingOrders={loadingOrders}
          onOpenTrackOrder={onOpenTrackOrder}
          onRefreshOrders={fetchOrders}
        />
      </div>
    </div>
  );
};

