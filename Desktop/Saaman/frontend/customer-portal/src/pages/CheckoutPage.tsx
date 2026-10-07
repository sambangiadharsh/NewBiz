import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight, Truck, Check,
  CreditCard, Smartphone, Banknote, MapPin, Sparkles, Lock, ArrowLeft,
  Package, Tag, X, ShieldCheck, Loader2, ShoppingBag, Edit3, Plus, Minus, Trash2,
  Building2, Wallet, AlertCircle
} from 'lucide-react';
import { CartItem } from '../types';
import { addressesApi, CustomerAddress, CreateAddressPayload } from '../lib/addressesApi';
import { paymentModesApi, PaymentModeItem } from '../lib/paymentModesApi';
import { promotionsApi, ValidatedPromotion } from '../lib/promotionsApi';
import { ordersApi, PlaceOrderPayload } from '../lib/ordersApi';
import { AddressModal, AddressData } from '../components/checkout/AddressModal';

interface CheckoutPageProps {
  cart: CartItem[];
  currency: string;
  onUpdateQuantity?: (productId: string, quantity: number) => void;
  onRemoveItem?: (productId: string) => void;
  onOrderPlaced: () => void;
}

type CheckoutStep = 'delivery' | 'payment';

const CURR     = '₹';
const SHIP_FEE = 49;
const COD_FEE  = 29;

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onOrderPlaced,
}) => {
  const navigate = useNavigate();

  // ── Step State (2-step clean checkout) ────────────────────────────────────
  const [step, setStep] = useState<CheckoutStep>('delivery');

  // ── Delivery Address State ────────────────────────────────────────────────
  const [selectedAddress, setSelectedAddress]       = useState<AddressData | null>(() => {
    try {
      const saved = sessionStorage.getItem('saamaan_checkout_address');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [savedAddresses, setSavedAddresses]         = useState<CustomerAddress[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn]                 = useState<boolean>(false);

  // ── Dynamic Payment Modes State ───────────────────────────────────────────
  const [paymentModes, setPaymentModes]               = useState<PaymentModeItem[]>([]);
  const [loadingPaymentModes, setLoadingPaymentModes] = useState<boolean>(true);
  const [payMethod, setPayMethod]                     = useState<string>('cod');
  const [upiId, setUpiId]                             = useState<string>('');
  const [cardNumber, setCardNumber]                   = useState<string>('');
  const [cardName, setCardName]                       = useState<string>('');
  const [cardExpiry, setCardExpiry]                   = useState<string>('');
  const [cardCvv, setCardCvv]                         = useState<string>('');

  // ── Promotions / Coupon State ─────────────────────────────────────────────
  const [appliedPromo, setAppliedPromo] = useState<ValidatedPromotion | null>(() => {
    try {
      const raw = sessionStorage.getItem('saamaan_applied_coupon');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [couponCode, setCouponCode]       = useState<string>('');
  const [couponLoading, setCouponLoading] = useState<boolean>(false);
  const [couponError, setCouponError]     = useState<string>('');

  // ── Order Placement State ─────────────────────────────────────────────────
  const [placing, setPlacing]       = useState<boolean>(false);
  const [placed, setPlaced]         = useState<boolean>(false);
  const [orderId, setOrderId]       = useState<string>('');
  const [orderError, setOrderError] = useState<string>('');

  // ── Initial Data Hydration ────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('saamaan_customer_token');
    const hasToken = !!token;
    setIsLoggedIn(hasToken);

    // Fetch saved addresses if customer is logged in
    if (hasToken) {
      addressesApi
        .getAddresses()
        .then((addrs) => {
          setSavedAddresses(addrs);
          // If no address selected yet, auto-select default shipping address
          if (!selectedAddress && addrs.length > 0) {
            const def = addrs.find((a) => a.IsDefaultShipping) || addrs[0];
            const activeData: AddressData = {
              label: def.AddressLabel || 'Home',
              fullName: def.RecipientName,
              phone: def.PhoneNumber || '',
              line1: def.AddressLine1,
              line2: def.AddressLine2 || '',
              city: def.City,
              state: def.State,
              pincode: def.PostalCode,
              addressId: def.CustomerAddressID,
            };
            setSelectedAddress(activeData);
            try {
              sessionStorage.setItem('saamaan_checkout_address', JSON.stringify(activeData));
            } catch {}
          }
        })
        .catch((err) => {
          console.warn('Could not load saved addresses:', err);
        });
    }

    // Fetch dynamic payment modes
    setLoadingPaymentModes(true);
    paymentModesApi
      .getPaymentModes()
      .then((modes) => {
        setPaymentModes(modes);
        if (modes.length > 0) {
          setPayMethod(modes[0].code.toLowerCase());
        }
      })
      .catch((err) => {
        console.warn('Could not load payment modes, defaulting to COD:', err);
        setPaymentModes([
          {
            id: '1',
            code: 'COD',
            name: 'Cash on Delivery',
            type: 'CASH',
            description: 'Pay with cash upon delivery at your doorstep',
            status: 'ACTIVE',
          },
        ]);
        setPayMethod('cod');
      })
      .finally(() => {
        setLoadingPaymentModes(false);
      });
  }, []);

  // ── Save chosen address ───────────────────────────────────────────────────
  const handleSelectAddress = (addr: AddressData) => {
    setSelectedAddress(addr);
    try {
      sessionStorage.setItem('saamaan_checkout_address', JSON.stringify(addr));
    } catch {}
  };

  const handleSaveNewAddress = async (payload: CreateAddressPayload): Promise<CustomerAddress | null> => {
    try {
      const saved = await addressesApi.createAddress(payload);
      setSavedAddresses((prev) => [saved, ...prev]);
      return saved;
    } catch (err) {
      console.warn('Failed to save address to DB:', err);
      return null;
    }
  };

  // ── Pricing Calculations ──────────────────────────────────────────────────
  const subtotalRaw = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const discountAmt = appliedPromo
    ? appliedPromo.discountType === 'PERCENTAGE'
      ? Math.min((subtotalRaw * appliedPromo.discountValue) / 100, appliedPromo.maxDiscountAmount || Infinity)
      : Math.min(appliedPromo.discountValue, subtotalRaw)
    : 0;
  const subtotalNet = Math.max(0, subtotalRaw - discountAmt);
  const shipping    = cart.length === 0 ? 0 : SHIP_FEE;

  // IMPORTANT: COD fee is strictly applied ONLY when user is in the payment step AND chose COD
  const isCodSelected = step === 'payment' && payMethod === 'cod';
  const codFee        = isCodSelected ? COD_FEE : 0;
  const total         = subtotalNet + shipping + codFee;
  const totalItems    = cart.reduce((s, i) => s + i.quantity, 0);

  // Total retail discount savings (MRP vs price)
  const productSavings = cart.reduce((acc, item) => {
    if (item.product.originalPrice && item.product.originalPrice > item.product.price) {
      return acc + (item.product.originalPrice - item.product.price) * item.quantity;
    }
    return acc;
  }, 0);
  const totalSavings = productSavings + discountAmt;

  // ── Step Navigation Handlers ──────────────────────────────────────────────
  const handleProceedToPayment = () => {
    if (!selectedAddress) {
      setIsAddressModalOpen(true);
      return;
    }
    setStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Coupon Handlers ───────────────────────────────────────────────────────
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim();
    if (!code) return;

    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await promotionsApi.validate(code, subtotalRaw);
      setAppliedPromo(res.promotion);
      try {
        sessionStorage.setItem('saamaan_applied_coupon', JSON.stringify(res.promotion));
      } catch {}
      setCouponCode('');
    } catch (err: any) {
      setCouponError(err.message || 'Invalid promotion code');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedPromo(null);
    setCouponCode('');
    setCouponError('');
    try {
      sessionStorage.removeItem('saamaan_applied_coupon');
    } catch {}
  };

  // ── Place Order Handler ───────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      setIsAddressModalOpen(true);
      return;
    }

    if (cart.length === 0) return;

    setPlacing(true);
    setOrderError('');

    try {
      const payload: PlaceOrderPayload = {
        shippingAddressId: selectedAddress.addressId,
        rawAddress: {
          recipientName: selectedAddress.fullName,
          phoneNumber: selectedAddress.phone,
          addressLine1: selectedAddress.line1,
          addressLine2: selectedAddress.line2,
          city: selectedAddress.city,
          state: selectedAddress.state,
          postalCode: selectedAddress.pincode,
          addressLabel: selectedAddress.label || 'Home',
        },
        paymentModeCode: payMethod.toUpperCase(),
        couponCode: appliedPromo?.code,
        items: cart.map((ci) => ({
          productId: String(ci.product.id),
          sellerProductId: ci.sellerProductId,
          quantity: ci.quantity,
          price: ci.product.price,
          originalPrice: ci.product.originalPrice,
        })),
      };

      const res = await ordersApi.placeOrder(payload);
      setOrderId(res.orderNumber);
      setPlaced(true);

      try {
        sessionStorage.removeItem('saamaan_applied_coupon');
        sessionStorage.removeItem('saamaan_checkout_address');
      } catch {}

      onOrderPlaced();
    } catch (err: any) {
      console.error('Order placement failed:', err);
      setOrderError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  // ── Payment Icons & Subtitles ─────────────────────────────────────────────
  const getPaymentIcon = (code: string, type: string) => {
    const c = code.toUpperCase();
    const t = type.toUpperCase();
    if (c === 'COD' || t === 'CASH') return Banknote;
    if (c === 'UPI' || t === 'UPI') return Smartphone;
    if (c === 'CARD' || t === 'CARD') return CreditCard;
    if (c === 'NETBANKING' || t === 'NETBANKING' || t === 'BANK') return Building2;
    if (c === 'WALLET' || t === 'WALLET') return Wallet;
    return CreditCard;
  };

  const getPaymentSubtitle = (mode: PaymentModeItem) => {
    if (mode.description) return mode.description;
    const c = mode.code.toUpperCase();
    if (c === 'COD') return 'Pay with cash upon delivery at your doorstep';
    if (c === 'UPI') return 'GPay, PhonePe, Paytm, BHIM or any UPI app';
    if (c === 'CARD') return 'Credit or Debit Card (Visa, Mastercard, RuPay)';
    return 'Secure payment gateway';
  };

  const selectedPaymentModeObj = paymentModes.find(
    (m) => m.code.toLowerCase() === payMethod.toLowerCase()
  );

  // ── Order Placed State Screen ─────────────────────────────────────────────
  if (placed) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-16 text-center space-y-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-emerald-50 flex items-center justify-center shadow-lg">
            <Check className="w-12 h-12 text-emerald-500" strokeWidth={2.5} />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900">Order Placed Successfully!</h1>
          <p className="text-sm text-slate-600 max-w-sm">
            Thank you, <strong>{selectedAddress?.fullName || 'Customer'}</strong>. Your order
            has been confirmed and is being prepared for dispatch.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-xs font-mono font-bold text-slate-700 mt-2">
            <Package className="w-4 h-4 text-slate-500" />
            Order #{orderId.startsWith('#') ? orderId.slice(1) : orderId}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-xs w-full">
          {[
            { icon: Check,   label: 'Confirmed',  sub: 'Order verified' },
            { icon: Package, label: 'Packing',    sub: 'Warehouse prep' },
            { icon: Truck,   label: 'Delivery',   sub: '2-4 days' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
              <Icon className="w-5 h-5 text-primary-600 mx-auto mb-1" />
              <p className="text-[11px] font-bold text-slate-800">{label}</p>
              <p className="text-[10px] text-slate-400">{sub}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 rounded-2xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 transition-colors"
          >
            Continue Shopping
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="px-6 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
          >
            My Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* ── Breadcrumb & Navigation Bar ─────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-2 flex items-center justify-between">
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link to="/" className="hover:text-primary-600 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-800 font-bold">Checkout</span>
        </nav>
        <button
          onClick={() => (step === 'payment' ? setStep('delivery') : navigate(-1))}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {step === 'payment' ? 'Back to Order & Address' : 'Back to Cart'}
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-2">
        {/* Title & Trust Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              {step === 'delivery' ? 'Review & Delivery' : 'Payment Method'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              
              {/* <span>
                {step === 'delivery'
                  ? 'Step 1 of 2: Confirm address & items'
                  : 'Step 2 of 2: Select payment method'}
              </span> */}
            </p>
          </div>
        </div>

        {/* Wide Step Progress Flow */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 mb-8 shadow-2xs">
          <div className="max-w-2xl mx-auto flex items-center justify-between relative px-2 sm:px-6">
            {/* Connecting progress track */}
            <div className="absolute left-10 sm:left-14 right-10 sm:right-14 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full z-0">
              <div
                className={`h-full bg-primary-600 rounded-full transition-all duration-300 ${
                  step === 'payment' ? 'w-full' : 'w-0'
                }`}
              />
            </div>

            {/* Step 1: Delivery */}
            <button
              type="button"
              onClick={() => setStep('delivery')}
              className="relative z-10 flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white transition-all text-left group"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  step === 'delivery'
                    ? 'bg-primary-600 text-white ring-4 ring-primary-100 shadow-xs'
                    : 'bg-emerald-500 text-white ring-4 ring-emerald-50'
                }`}
              >
                {step === 'payment' ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
              </div>
              <div>
                <p className={`text-xs sm:text-sm font-extrabold ${step === 'delivery' ? 'text-primary-700' : 'text-slate-800'}`}>
                  1. Delivery
                </p>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Address & Cart
                </p>
              </div>
            </button>

            {/* Step 2: Payment */}
            <button
              type="button"
              onClick={() => {
                if (selectedAddress) setStep('payment');
                else setIsAddressModalOpen(true);
              }}
              className="relative z-10 flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white transition-all text-left group"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  step === 'payment'
                    ? 'bg-primary-600 text-white ring-4 ring-primary-100 shadow-xs'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                2
              </div>
              <div>
                <p className={`text-xs sm:text-sm font-extrabold ${step === 'payment' ? 'text-primary-700' : 'text-slate-400'}`}>
                  2. Payment
                </p>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Method & Order
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* ── Main Two Column Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ══════════════════════════════════════════════════════════════════
              LEFT COLUMN (7 cols): Items List (Step 1) OR Payment (Step 2)
             ══════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* ── STEP 1 LEFT: Order Items Showcase ────────────────────────── */}
            {step === 'delivery' && (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                      <ShoppingBag className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                        Order Items ({totalItems})
                      </h2>
                      <p className="text-[11px] text-slate-400 font-medium">Review your items before proceeding</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    <Truck className="w-3.5 h-3.5" />
                    Delivery in 2-4 days
                  </span>
                </div>

                {/* Items List */}
                {cart.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <ShoppingBag className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Your shopping bag is empty</h3>
                      <p className="text-xs text-slate-500 mt-1">There are currently no items in your order.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="px-6 py-2.5 rounded-2xl bg-primary-600 text-white font-bold text-xs hover:bg-primary-700 transition-colors shadow-xs"
                    >
                      Continue Shopping
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {cart.map((item) => {
                      const hasDiscount =
                        item.product.originalPrice && item.product.originalPrice > item.product.price;
                      const discountPct = hasDiscount
                        ? Math.round(
                            ((item.product.originalPrice - item.product.price) /
                              item.product.originalPrice) *
                              100
                          )
                        : 0;
                      const lineTotal = item.product.price * item.quantity;
                      const brandOrCat = item.product.brand?.brandName || item.product.category;

                      return (
                        <div
                          key={item.product.id || item.cartItemId}
                          className="group relative bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 transition-all hover:border-slate-300 hover:shadow-xs flex gap-4"
                        >
                          {/* Thumbnail */}
                          <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl bg-white border border-slate-200/80 flex-shrink-0 p-1 flex items-center justify-center overflow-hidden">
                            <img
                              src={
                                item.product.thumbnail ||
                                (item.product.images && item.product.images[0]) ||
                                ''
                              }
                              alt={item.product.name}
                              className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80';
                              }}
                            />
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md truncate max-w-[150px]">
                                  {brandOrCat}
                                </span>
                                <span className="text-sm font-black text-slate-900 flex-shrink-0">
                                  {CURR}{lineTotal.toFixed(2)}
                                </span>
                              </div>

                              <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 mt-1 group-hover:text-primary-600 transition-colors">
                                {item.product.name}
                              </h3>

                              {(item.selectedSize || item.selectedColor) && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  {item.selectedSize && (
                                    <span className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                      Size: {item.selectedSize}
                                    </span>
                                  )}
                                  {item.selectedColor && (
                                    <span className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                      Color: {item.selectedColor}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Direct Checkout Editing Controls */}
                            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-200/50 text-xs">
                              <div className="flex items-center gap-3">
                                {/* Interactive Quantity Stepper */}
                                {onUpdateQuantity ? (
                                  <div className="flex items-center border border-slate-200 bg-white rounded-xl shadow-2xs overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                                      className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                      title="Decrease quantity"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="px-2.5 min-w-[24px] text-center font-black text-slate-900 text-xs select-none">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                                      className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                      title="Increase quantity"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-bold text-[10px]">
                                    Qty {item.quantity}
                                  </span>
                                )}

                                {/* Remove Button */}
                                {onRemoveItem && (
                                  <button
                                    type="button"
                                    onClick={() => onRemoveItem(item.product.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Remove item from order"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Unit Price */}
                                <span className="text-[11px] text-slate-400">
                                  ({CURR}{item.product.price.toFixed(0)} each)
                                </span>
                              </div>

                              {hasDiscount && (
                                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {discountPct}% OFF
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2 LEFT: Payment Method Selector ─────────────────────── */}
            {step === 'payment' && (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                      <CreditCard className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                        Select Payment Method
                      </h2>
                      <p className="text-[11px] text-slate-400 font-medium">Choose how you want to pay</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    100% Secure
                  </span>
                </div>

                {/* Dynamic Payment Method List */}
                {loadingPaymentModes ? (
                  <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                    <span className="text-xs font-semibold">Loading payment methods...</span>
                  </div>
                ) : paymentModes.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                    No payment methods configured.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentModes.map((mode) => {
                      const modeKey = mode.code.toLowerCase();
                      const Icon = getPaymentIcon(mode.code, mode.type);
                      const isSelected = payMethod === modeKey;
                      return (
                        <button
                          key={mode.id || mode.code}
                          type="button"
                          onClick={() => setPayMethod(modeKey)}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                            isSelected
                              ? 'border-primary-600 bg-primary-50/60 shadow-2xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900">{mode.name}</p>
                            <p className="text-[11px] text-slate-500">{getPaymentSubtitle(mode)}</p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? 'border-primary-600 bg-primary-600'
                                : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Sub-inputs if user selects UPI or Card */}
                {payMethod === 'upi' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">UPI ID / VPA</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. mobile@upi or username@okhdfcbank"
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                    <p className="text-[11px] text-slate-400">
                      Zero convenience fee on UPI transactions.
                    </p>
                  </div>
                )}

                {payMethod === 'card' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Card Number</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) =>
                          setCardNumber(
                            e.target.value
                              .replace(/\D/g, '')
                              .slice(0, 16)
                              .replace(/(.{4})/g, '$1 ')
                              .trim()
                          )
                        }
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                        className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Expiry</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => {
                            let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                            if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                            setCardExpiry(v);
                          }}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">CVV</label>
                        <input
                          type="password"
                          value={cardCvv}
                          onChange={(e) =>
                            setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="•••"
                          maxLength={4}
                          className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {payMethod === 'cod' && (
                  <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 space-y-1">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-amber-700" />
                      Cash on Delivery
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Pay with cash or delivery agent QR code at your doorstep. A standard convenience fee of ₹29 applies.
                    </p>
                  </div>
                )}

                {payMethod !== 'upi' && payMethod !== 'card' && payMethod !== 'cod' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-primary-600" />
                      {selectedPaymentModeObj?.name || 'Online Payment'}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      You will be prompted to complete the transaction securely via {selectedPaymentModeObj?.name || 'the payment provider'}. Zero extra convenience fee applies.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              RIGHT COLUMN (5 cols): Address Card + Bill Details + CTA
             ══════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-5">

            {/* ── 1. Delivery Address Card ─────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary-600" />
                  <span className="text-xs font-extrabold text-slate-900">
                    {selectedAddress ? `Delivering to ${selectedAddress.label}` : 'Delivery Address'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(true)}
                  className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  {selectedAddress ? (
                    <>
                      <Edit3 className="w-3.5 h-3.5" />
                      Change
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Add Address
                    </>
                  )}
                </button>
              </div>

              {selectedAddress ? (
                <div className="text-xs space-y-1 pt-0.5">
                  <p className="font-bold text-slate-900 flex items-center justify-between">
                    <span>{selectedAddress.fullName}</span>
                    {selectedAddress.phone && (
                      <span className="font-semibold text-slate-500">📞 {selectedAddress.phone}</span>
                    )}
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    {selectedAddress.line1}
                    {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}, {selectedAddress.city}, {selectedAddress.state} — {selectedAddress.pincode}, India
                  </p>
                </div>
              ) : (
                <div
                  onClick={() => setIsAddressModalOpen(true)}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-dashed border-slate-200 rounded-2xl cursor-pointer text-center space-y-1 transition-colors"
                >
                  <p className="text-xs font-bold text-slate-800">No Address Selected</p>
                  <p className="text-[11px] text-slate-400">Click to choose or enter delivery address</p>
                </div>
              )}
            </div>

            {/* ── 2. Bill Summary & Coupon Card ────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-5 sticky top-24">
              
              {/* Savings Highlight */}
              {totalSavings > 0 && (
                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200/90 px-3.5 py-2.5 rounded-2xl text-emerald-800 text-xs shadow-2xs">
                
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-emerald-900">
                      Total Savings: {CURR}{totalSavings.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-emerald-700 font-medium">
                      Applied via discounts & active promotions
                    </p>
                  </div>
                </div>
              )}

              {/* Coupon Form */}
              <div>
                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/80 rounded-2xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      <div>
                        <p className="text-xs font-extrabold text-emerald-800">
                          {appliedPromo.code} Applied
                        </p>
                        <p className="text-[10px] text-emerald-600">
                          {appliedPromo.discountType === 'PERCENTAGE'
                            ? `${appliedPromo.discountValue}% off`
                            : `Flat ₹${appliedPromo.discountValue} off`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors"
                      title="Remove coupon"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600">
                      Have a coupon code?
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="e.g. FLASH20, SAVE10"
                        className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                      />
                      <button
                        type="submit"
                        disabled={couponLoading || !couponCode.trim()}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        {couponLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                        Apply
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-[11px] text-rose-500 font-medium">{couponError}</p>
                    )}
                  </form>
                )}
              </div>

              {/* Bill Details */}
              <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-slate-900">{CURR}{subtotalRaw.toFixed(2)}</span>
                </div>

                {productSavings > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Retail Discount
                    </span>
                    <span className="font-semibold">-{CURR}{productSavings.toFixed(2)}</span>
                  </div>
                )}

                {discountAmt > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Coupon Discount ({appliedPromo?.code})
                    </span>
                    <span>-{CURR}{discountAmt.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3 h-3 text-slate-400" />
                    Delivery Charges
                  </span>
                  <span className={`font-semibold ${shipping === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {shipping === 0 ? 'FREE' : `${CURR}${shipping.toFixed(2)}`}
                  </span>
                </div>

                {/* COD Fee ONLY displayed when COD is selected in Step 2 */}
                {isCodSelected && (
                  <div className="flex justify-between text-amber-600">
                    <span className="flex items-center gap-1">
                      <Banknote className="w-3 h-3" />
                      COD Convenience Fee
                    </span>
                    <span className="font-semibold">+{CURR}{COD_FEE}</span>
                  </div>
                )}

                <div className="flex justify-between pt-3 border-t border-slate-100 text-base font-extrabold text-slate-950">
                  <span>Total Payable</span>
                  <span className="text-primary-600 text-lg">{CURR}{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Order Error Notification */}
              {orderError && (
                <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{orderError}</span>
                </div>
              )}

              {/* Primary Action Button */}
              {step === 'delivery' ? (
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={cart.length === 0}
                  className="w-full py-4 rounded-2xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-600/25"
                >
                  Proceed to Payment
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={placing || cart.length === 0}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25"
                >
                  {placing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Placing your order...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Place Order · {CURR}{total.toFixed(2)}
                    </>
                  )}
                </button>
              )}

              {/* Trust badges */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-center gap-4 text-[10px] text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Safe & Secure
                </span>
                <span>•</span>
                <span>Easy Returns</span>
                <span>•</span>
                <span>100% Authentic</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Address Switcher / Creator Modal ──────────────────────────────── */}
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        savedAddresses={savedAddresses}
        selectedAddressId={selectedAddress?.addressId}
        isLoggedIn={isLoggedIn}
        onSelectAddress={handleSelectAddress}
        onSaveNewAddress={handleSaveNewAddress}
      />
    </div>
  );
};
