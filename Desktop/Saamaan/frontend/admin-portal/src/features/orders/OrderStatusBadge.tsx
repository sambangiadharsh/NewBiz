import React from 'react';

interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status, size = 'md' }) => {
  const normStatus = (status || '').toUpperCase().trim();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';
  let displayLabel = normStatus.replace(/_/g, ' ');

  switch (normStatus) {
    case 'CONFIRMED':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      dotColor = 'bg-blue-500';
      displayLabel = 'Confirmed';
      break;
    case 'ALLOCATED':
      colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      dotColor = 'bg-purple-500';
      displayLabel = 'Allocated';
      break;
    case 'PACKED':
    case 'PENDING_PICKUP':
      colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      dotColor = 'bg-indigo-500';
      displayLabel = normStatus === 'PENDING_PICKUP' ? 'Ready to Ship' : 'Packed';
      break;
    case 'SHIPPED':
    case 'IN_TRANSIT':
      colorClasses = 'bg-sky-50 text-sky-700 border-sky-200';
      dotColor = 'bg-sky-500';
      displayLabel = 'In Transit';
      break;
    case 'DELIVERED':
    case 'SUCCESS':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      displayLabel = 'Delivered';
      break;
    case 'PENDING':
    case 'PENDING_PAYMENT':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      dotColor = 'bg-amber-500';
      displayLabel = 'Pending Payment';
      break;
    case 'CANCELLED':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      dotColor = 'bg-rose-500';
      displayLabel = 'Cancelled';
      break;
    case 'PAYMENT_FAILED':
    case 'PAYMENT_EXPIRED':
      colorClasses = 'bg-red-50 text-red-700 border-red-200';
      dotColor = 'bg-red-500';
      displayLabel = normStatus === 'PAYMENT_EXPIRED' ? 'Expired (15m TTL)' : 'Payment Failed';
      break;
    case 'RTO':
    case 'RETURNED':
      colorClasses = 'bg-orange-50 text-orange-700 border-orange-200';
      dotColor = 'bg-orange-500';
      displayLabel = 'Returned / RTO';
      break;
    case 'REFUND_PENDING':
      colorClasses = 'bg-amber-50 text-amber-800 border-amber-300';
      dotColor = 'bg-amber-500';
      displayLabel = 'Refund Pending';
      break;
    default:
      break;
  }

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${paddingClass} ${colorClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{displayLabel}</span>
    </span>
  );
};

