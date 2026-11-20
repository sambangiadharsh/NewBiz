import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  Home,
  Building,
  Loader2,
  AlertCircle,
  X,
  Edit2,
} from 'lucide-react';
import { addressesApi, CustomerAddress, CreateAddressPayload } from '../../lib/addressesApi';

interface AddressesPageProps {
  user?: { name: string; email: string } | null;
}

export const AddressesPage: React.FC<AddressesPageProps> = ({ user }) => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State for Add / Edit Address
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [recipientName, setRecipientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressLabel, setAddressLabel] = useState('Home');
  const [isDefaultShipping, setIsDefaultShipping] = useState(false);
  const [gstin, setGstin] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);

  const fetchAddresses = () => {
    setLoading(true);
    addressesApi
      .getAddresses()
      .then((data) => setAddresses(data))
      .catch((err) => setActionError(err.message || 'Failed to load addresses'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAddresses();
  }, [user]);

  // Lock body scroll when address modal is open
  useEffect(() => {
    if (!isModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalOpen]);

  const resetForm = () => {
    setRecipientName('');
    setPhoneNumber('');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setState('');
    setPostalCode('');
    setAddressLabel('Home');
    setIsDefaultShipping(false);
    setGstin('');
    setEditingAddressId(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    if (user?.name) setRecipientName(user.name);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (addr: CustomerAddress) => {
    setEditingAddressId(addr.CustomerAddressID);
    setRecipientName(addr.RecipientName || '');
    setPhoneNumber(addr.PhoneNumber || '');
    setAddressLine1(addr.AddressLine1 || '');
    setAddressLine2(addr.AddressLine2 || '');
    setCity(addr.City || '');
    setState(addr.State || '');
    setPostalCode(addr.PostalCode || '');
    setAddressLabel(addr.AddressLabel || 'Home');
    setIsDefaultShipping(Boolean(addr.IsDefaultShipping));
    setGstin(addr.GSTIN || '');
    setIsModalOpen(true);
  };

  const handlePincodeChange = async (val: string) => {
    setPostalCode(val);
    const clean = val.trim();
    if (clean.length === 6 && /^\d{6}$/.test(clean)) {
      setPincodeLoading(true);
      try {
        const info = await addressesApi.lookupPincode(clean);
        if (info && info.city) {
          setCity(info.city);
          setState(info.state);
        }
      } catch (err) {
        // silent fail if lookup fails
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !addressLine1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      setActionError('Please fill out all mandatory address fields.');
      return;
    }

    setSaving(true);
    setActionError(null);

    const payload: CreateAddressPayload = {
      recipientName: recipientName.trim(),
      phoneNumber: phoneNumber.trim() || undefined,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
      addressLabel,
      isDefaultShipping,
      gstin: gstin.trim() || undefined,
    };

    try {
      if (editingAddressId) {
        await addressesApi.updateAddress(editingAddressId, payload);
        setSuccessMessage('Address updated successfully!');
      } else {
        await addressesApi.createAddress(payload);
        setSuccessMessage('New delivery address saved!');
      }
      setIsModalOpen(false);
      resetForm();
      fetchAddresses();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save address.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this delivery address?')) return;
    try {
      await addressesApi.deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.CustomerAddressID !== id));
      setSuccessMessage('Address removed.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete address.');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await addressesApi.setDefaultAddress(id);
      setAddresses((prev) =>
        prev.map((a) => ({
          ...a,
          IsDefaultShipping: a.CustomerAddressID === id,
        }))
      );
      setSuccessMessage('Default delivery address updated.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to set default address.');
    }
  };

  return (
    <div className="bg-canvas min-h-screen py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link to="/" className="hover:text-primary-700 transition-colors">
                Home
              </Link>
              <span>/</span>
              <span className="font-semibold text-slate-900">Saved Addresses</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <MapPin className="w-7 h-7 text-primary-600" />
              <span>Saved Delivery Addresses</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage your delivery locations and preferences for fast, 1-click checkout.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {actionError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button type="button" onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Addresses Grid */}
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary-600 mb-2" />
            <p className="text-xs font-semibold">Loading saved delivery addresses...</p>
          </div>
        ) : addresses.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-stone-200/80 shadow-xs max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 stroke-1" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No delivery addresses saved yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Add your home, office, or secondary delivery location to speed up your order checkouts.
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Address</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div
                key={addr.CustomerAddressID}
                className={`bg-white rounded-3xl p-6 border transition-all relative flex flex-col justify-between shadow-xs ${
                  addr.IsDefaultShipping
                    ? 'border-primary-500/80 ring-2 ring-primary-500/10'
                    : 'border-stone-200/80 hover:border-stone-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                        {addr.AddressLabel?.toUpperCase() === 'WORK' ? (
                          <Building className="w-3 h-3 text-slate-500" />
                        ) : (
                          <Home className="w-3 h-3 text-slate-500" />
                        )}
                        <span>{addr.AddressLabel || 'Home'}</span>
                      </span>

                      {addr.IsDefaultShipping && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Default Shipping
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(addr)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary-700 hover:bg-primary-50 transition-colors"
                        title="Edit address"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.CustomerAddressID)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete address"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{addr.RecipientName}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {addr.AddressLine1}
                    {addr.AddressLine2 ? `, ${addr.AddressLine2}` : ''}
                    <br />
                    {addr.City}, {addr.State} - <span className="font-mono font-bold">{addr.PostalCode}</span>
                  </p>

                  {addr.PhoneNumber && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      <span className="font-semibold text-slate-700">Phone:</span> {addr.PhoneNumber}
                    </p>
                  )}

                  {addr.GSTIN && (
                    <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      <span className="font-semibold text-slate-700">GSTIN:</span> {addr.GSTIN}
                    </p>
                  )}
                </div>

                {!addr.IsDefaultShipping && (
                  <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr.CustomerAddressID)}
                      className="text-xs font-bold text-primary-700 hover:text-primary-800 hover:underline cursor-pointer"
                    >
                      Set as Default
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit Address Modal */}
        {isModalOpen && createPortal(
          <div
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[99999] overflow-y-auto bg-slate-900/50 flex items-center justify-center p-4 animate-in fade-in duration-150"
            style={{ margin: 0, padding: '1rem', width: '100vw', height: '100vh', top: 0, left: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
          >
            <div className="relative w-full max-w-lg bg-[#FAF9F6] rounded-3xl shadow-2xl shadow-slate-900/15 border border-stone-200/80 ring-1 ring-slate-900/5 p-6 sm:p-8 max-h-[90vh] overflow-y-auto scrollbar-dot animate-slide-up my-auto">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-1">
                <MapPin className="w-5 h-5 text-primary-600" />
                <span>{editingAddressId ? 'Edit Delivery Address' : 'Add New Delivery Address'}</span>
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Ensure your delivery details and PIN code are accurate for reliable shipping.
              </p>

              <form onSubmit={handleSaveAddress} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Recipient Name *</label>
                    <input
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Address Line 1 (House/Building/Street) *</label>
                  <input
                    type="text"
                    required
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="e.g. Flat 402, Green Valley Apartments"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Address Line 2 (Area/Landmark)</label>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    placeholder="e.g. Near Metro Station"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">PIN Code *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={postalCode}
                        onChange={(e) => handlePincodeChange(e.target.value)}
                        placeholder="6 digits"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                      />
                      {pincodeLoading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600 absolute right-3 top-3" />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">State *</label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Maharashtra"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Address Type</label>
                    <div className="flex items-center gap-2">
                      {['Home', 'Work', 'Other'].map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setAddressLabel(lbl)}
                          className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                            addressLabel === lbl
                              ? 'bg-primary-50 border-primary-600 text-primary-700 shadow-xs'
                              : 'bg-white border-stone-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN (Optional)</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="Business GST number"
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 uppercase"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDefaultShipping}
                      onChange={(e) => setIsDefaultShipping(e.target.checked)}
                      className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-stone-300"
                    />
                    <span className="text-xs font-semibold text-slate-700">Make this my default shipping address</span>
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-500/25 transition-all flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingAddressId ? 'Save Changes' : 'Add Address'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

