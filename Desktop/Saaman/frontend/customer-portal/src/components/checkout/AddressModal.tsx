import React, { useState } from 'react';
import { X, MapPin, Plus, Check, Bookmark, User, Phone, Home, Loader2, AlertCircle } from 'lucide-react';
import { CustomerAddress, CreateAddressPayload } from '../../lib/addressesApi';

export interface AddressData {
  label: string;
  fullName: string;
  phone: string;
  email?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  addressId?: string;
}

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedAddresses: CustomerAddress[];
  selectedAddressId?: string;
  isLoggedIn: boolean;
  onSelectAddress: (addr: AddressData) => void;
  onSaveNewAddress: (payload: CreateAddressPayload) => Promise<CustomerAddress | null>;
}

export const AddressModal: React.FC<AddressModalProps> = ({
  isOpen,
  onClose,
  savedAddresses,
  selectedAddressId,
  isLoggedIn,
  onSelectAddress,
  onSaveNewAddress,
}) => {
  const [view, setView] = useState<'list' | 'new'>(savedAddresses.length > 0 ? 'list' : 'new');
  
  // New address form state
  const [label, setLabel] = useState('Home');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [saveToAccount, setSaveToAccount] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required';
    if (!phone.trim() || !/^\d{10}$/.test(phone.trim())) {
      errs.phone = 'Valid 10-digit mobile number is required';
    }
    if (!line1.trim()) errs.line1 = 'Address line 1 is required';
    if (!city.trim()) errs.city = 'City is required';
    if (!state.trim()) errs.state = 'State is required';
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'Valid 6-digit PIN code is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSelectExisting = (addr: CustomerAddress) => {
    onSelectAddress({
      label: addr.AddressLabel || 'Home',
      fullName: addr.RecipientName,
      phone: addr.PhoneNumber || '',
      line1: addr.AddressLine1,
      line2: addr.AddressLine2 || '',
      city: addr.City,
      state: addr.State,
      pincode: addr.PostalCode,
      addressId: addr.CustomerAddressID,
    });
    onClose();
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      let createdAddressId: string | undefined = undefined;

      if (isLoggedIn && saveToAccount) {
        const saved = await onSaveNewAddress({
          addressLabel: label,
          recipientName: fullName.trim(),
          phoneNumber: phone.trim(),
          addressLine1: line1.trim(),
          addressLine2: line2.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          postalCode: pincode.trim(),
          isDefaultShipping: savedAddresses.length === 0,
        });
        if (saved) {
          createdAddressId = saved.CustomerAddressID;
        }
      }

      onSelectAddress({
        label,
        fullName: fullName.trim(),
        phone: phone.trim(),
        line1: line1.trim(),
        line2: line2.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        addressId: createdAddressId,
      });

      onClose();
    } catch (err: any) {
      setErrors({ form: err.message || 'Failed to save address' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (err?: string) =>
    `w-full px-3.5 py-2.5 text-xs border rounded-xl bg-white transition-all focus:outline-none focus:ring-2 ${
      err
        ? 'border-rose-400 focus:ring-rose-400/20 focus:border-rose-500'
        : 'border-slate-200 focus:ring-primary-500/20 focus:border-primary-500'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">
              {view === 'list' ? 'Select Delivery Address' : 'Add New Address'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {view === 'list' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Saved Addresses</span>
                <button
                  type="button"
                  onClick={() => setView('new')}
                  className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New
                </button>
              </div>

              <div className="space-y-2.5">
                {savedAddresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.CustomerAddressID;
                  return (
                    <div
                      key={addr.CustomerAddressID}
                      onClick={() => handleSelectExisting(addr)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'border-primary-600 bg-primary-50/50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {addr.AddressLabel || 'Home'}
                          </span>
                          {addr.IsDefaultShipping && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {addr.RecipientName}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {addr.AddressLine1}{addr.AddressLine2 ? `, ${addr.AddressLine2}` : ''}, {addr.City}, {addr.State} — {addr.PostalCode}
                        </p>
                        {addr.PhoneNumber && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            📞 {addr.PhoneNumber}
                          </p>
                        )}
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                          isSelected ? 'border-primary-600 bg-primary-600' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setView('new')}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 mt-2"
              >
                <Plus className="w-4 h-4" />
                Add A Different Address
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateNew} className="space-y-4">
              {savedAddresses.length > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
                  >
                    ← Pick from saved addresses
                  </button>
                </div>
              )}

              {/* Address Label */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Address Type
                </label>
                <div className="flex gap-2">
                  {['Home', 'Work', 'Other'].map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setLabel(lbl)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                        label === lbl
                          ? 'bg-primary-600 text-white border-primary-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Recipient Name *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className={`${inputCls(errors.fullName)} pl-8.5`}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-[10px] text-rose-500 mt-1">{errors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit mobile"
                      className={`${inputCls(errors.phone)} pl-8.5`}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-[10px] text-rose-500 mt-1">{errors.phone}</p>
                  )}
                </div>
              </div>

              {/* Line 1 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Address Line 1 *
                </label>
                <div className="relative">
                  <Home className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    placeholder="House / Flat no., Building, Street"
                    className={`${inputCls(errors.line1)} pl-8.5`}
                  />
                </div>
                {errors.line1 && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.line1}</p>
                )}
              </div>

              {/* Line 2 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Address Line 2 <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  placeholder="Landmark, Area, Colony"
                  className={inputCls()}
                />
              </div>

              {/* City, State, PIN */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className={inputCls(errors.city)}
                  />
                  {errors.city && (
                    <p className="text-[10px] text-rose-500 mt-1">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State *</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className={inputCls(errors.state)}
                  />
                  {errors.state && (
                    <p className="text-[10px] text-rose-500 mt-1">{errors.state}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PIN *</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6 digits"
                    className={inputCls(errors.pincode)}
                  />
                  {errors.pincode && (
                    <p className="text-[10px] text-rose-500 mt-1">{errors.pincode}</p>
                  )}
                </div>
              </div>

              {/* Save address checkbox (if logged in) */}
              {isLoggedIn && (
                <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={saveToAccount}
                    onChange={(e) => setSaveToAccount(e.target.checked)}
                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Save this address to my profile
                  </span>
                </label>
              )}

              {errors.form && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{errors.form}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 disabled:opacity-75 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 mt-2 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving Address...
                  </>
                ) : (
                  <>
                    Deliver to this Address
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
