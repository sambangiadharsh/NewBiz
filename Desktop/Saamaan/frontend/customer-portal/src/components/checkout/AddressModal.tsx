import React, { useState, useEffect } from 'react';
import { X, MapPin, Plus, Check, User, Phone, Home, Loader2, AlertCircle, CheckCircle2, Edit3, Trash2, Building2 } from 'lucide-react';
import { addressesApi, CustomerAddress, CreateAddressPayload, UpdateAddressPayload } from '../../lib/addressesApi';

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
  gstin?: string;
  addressId?: string;
}

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedAddresses: CustomerAddress[];
  selectedAddressId?: string;
  isLoggedIn: boolean;
  initialEditAddress?: CustomerAddress | null;
  onSelectAddress: (addr: AddressData) => void;
  onSaveNewAddress: (payload: CreateAddressPayload) => Promise<CustomerAddress | null>;
  onUpdateExistingAddress?: (addressId: string, payload: UpdateAddressPayload) => Promise<CustomerAddress | null>;
  onDeleteAddress?: (addressId: string) => Promise<void>;
}

export const AddressModal: React.FC<AddressModalProps> = ({
  isOpen,
  onClose,
  savedAddresses,
  selectedAddressId,
  isLoggedIn,
  initialEditAddress = null,
  onSelectAddress,
  onSaveNewAddress,
  onUpdateExistingAddress,
  onDeleteAddress,
}) => {
  const [view, setView] = useState<'list' | 'form'>(
    initialEditAddress ? 'form' : savedAddresses.length > 0 ? 'list' : 'form'
  );
  
  const [editingAddressId, setEditingAddressId] = useState<string | null>(
    initialEditAddress ? initialEditAddress.CustomerAddressID : null
  );

  // Address form state
  const [label, setLabel] = useState('Home');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [hasGst, setHasGst] = useState(false);
  const [saveToAccount, setSaveToAccount] = useState(true);

  // Auto-fill pincode lookup state
  const [isLookingUpPincode, setIsLookingUpPincode] = useState(false);
  const [pincodeLookupFeedback, setPincodeLookupFeedback] = useState<{
    status: 'idle' | 'success' | 'not_found';
    message?: string;
    gstStateCode?: string;
  }>({ status: 'idle' });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Initialize or reset form when modal opens or initialEditAddress changes
  useEffect(() => {
    if (initialEditAddress) {
      loadAddressForEdit(initialEditAddress);
    } else if (savedAddresses.length > 0) {
      setView('list');
      setEditingAddressId(null);
    } else {
      resetForm();
      setView('form');
    }
  }, [isOpen, initialEditAddress]);

  const resetForm = () => {
    setLabel('Home');
    setFullName('');
    setPhone('');
    setLine1('');
    setLine2('');
    setCity('');
    setState('');
    setPincode('');
    setGstin('');
    setHasGst(false);
    setSaveToAccount(true);
    setEditingAddressId(null);
    setErrors({});
    setPincodeLookupFeedback({ status: 'idle' });
  };

  const loadAddressForEdit = (addr: CustomerAddress) => {
    setEditingAddressId(addr.CustomerAddressID);
    setLabel(addr.AddressLabel || 'Home');
    setFullName(addr.RecipientName || '');
    setPhone(addr.PhoneNumber || '');
    setLine1(addr.AddressLine1 || '');
    setLine2(addr.AddressLine2 || '');
    setCity(addr.City || '');
    setState(addr.State || '');
    setPincode(addr.PostalCode || '');
    setGstin(addr.GSTIN || '');
    setHasGst(Boolean(addr.GSTIN) || addr.AddressLabel === 'Work' || addr.AddressLabel === 'Business');
    setErrors({});
    setView('form');
  };

  const handlePincodeChange = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);

    if (clean.length < 6) {
      setPincodeLookupFeedback({ status: 'idle' });
      return;
    }

    setIsLookingUpPincode(true);
    try {
      const data = await addressesApi.lookupPincode(clean);
      if (data && data.city && data.state) {
        setCity(data.city);
        setState(data.state);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.pincode;
          delete next.city;
          delete next.state;
          return next;
        });
        setPincodeLookupFeedback({
          status: 'success',
          message: `${data.city}, ${data.state}`,
          gstStateCode: data.gstStateCode,
        });
      } else {
        setPincodeLookupFeedback({
          status: 'not_found',
          message: 'Pincode not found in database. Please enter City & State manually.',
        });
      }
    } catch {
      setPincodeLookupFeedback({ status: 'idle' });
    } finally {
      setIsLookingUpPincode(false);
    }
  };

  if (!isOpen) return null;

  // Validate form
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) {
      errs.fullName = label === 'Work' || hasGst ? 'Business / Trade Name is required' : 'Full name is required';
    }
    if (!phone.trim() || !/^\d{10}$/.test(phone.trim())) {
      errs.phone = 'Valid 10-digit mobile number is required';
    }
    if (!line1.trim()) errs.line1 = 'Address line 1 is required';
    if (!city.trim()) errs.city = 'City is required';
    if (!state.trim()) errs.state = 'State is required';
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'Valid 6-digit PIN code is required';
    }

    const cleanGst = gstin.trim().toUpperCase();
    if (cleanGst) {
      // Standard: 2 state digits (01-38/97/99), 10 PAN chars, 1 entity digit, 1 char (Z/D/C/alphanumeric), 1 checksum char
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[A-Z0-9]{1}[0-9A-Z]{1}$/;
      if (!gstinRegex.test(cleanGst)) {
        errs.gstin = 'Invalid GSTIN format. Must be 15 alphanumeric characters (e.g., 37AAAAA0000A1Z5).';
      }
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
      gstin: addr.GSTIN || undefined,
      addressId: addr.CustomerAddressID,
    });
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, addressId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this address?')) return;

    setDeletingId(addressId);
    try {
      if (onDeleteAddress) {
        await onDeleteAddress(addressId);
      } else {
        await addressesApi.deleteAddress(addressId);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete address');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const cleanGst = gstin.trim().toUpperCase() || undefined;
      let addressIdResult = editingAddressId || undefined;

      if (editingAddressId) {
        // Edit existing address
        if (onUpdateExistingAddress) {
          const updated = await onUpdateExistingAddress(editingAddressId, {
            addressLabel: label,
            recipientName: fullName.trim(),
            phoneNumber: phone.trim(),
            addressLine1: line1.trim(),
            addressLine2: line2.trim() || undefined,
            city: city.trim(),
            state: state.trim(),
            postalCode: pincode.trim(),
            gstin: cleanGst,
          });
          if (updated) addressIdResult = updated.CustomerAddressID;
        } else {
          const updated = await addressesApi.updateAddress(editingAddressId, {
            addressLabel: label,
            recipientName: fullName.trim(),
            phoneNumber: phone.trim(),
            addressLine1: line1.trim(),
            addressLine2: line2.trim() || undefined,
            city: city.trim(),
            state: state.trim(),
            postalCode: pincode.trim(),
            gstin: cleanGst,
          });
          if (updated) addressIdResult = updated.CustomerAddressID;
        }
      } else {
        // Create new address
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
            gstin: cleanGst,
            isDefaultShipping: savedAddresses.length === 0,
          });
          if (saved) addressIdResult = saved.CustomerAddressID;
        }
      }

      // Notify parent of selected active address
      onSelectAddress({
        label,
        fullName: fullName.trim(),
        phone: phone.trim(),
        line1: line1.trim(),
        line2: line2.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        gstin: cleanGst,
        addressId: addressIdResult,
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

  // GST State Code match hint
  const cleanGstInput = gstin.trim().toUpperCase();
  const gstPrefix = cleanGstInput.slice(0, 2);
  const expectedGstCode = pincodeLookupFeedback.gstStateCode;
  const isGstPrefixMismatch = Boolean(
    expectedGstCode && gstPrefix.length === 2 && gstPrefix !== expectedGstCode
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#FAF9F6] rounded-3xl shadow-2xl border border-stone-200/80 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/70 bg-[#FAF9F6]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center">
              {editingAddressId ? <Edit3 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {view === 'list'
                  ? 'Select Delivery Address'
                  : editingAddressId
                  ? 'Edit Delivery Address'
                  : 'Add New Address'}
              </h3>
              {editingAddressId && (
                <p className="text-[10px] text-slate-500">Updating saved address details</p>
              )}
            </div>
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
                  onClick={() => {
                    resetForm();
                    setView('form');
                  }}
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
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {addr.AddressLabel || 'Home'}
                          </span>
                          {addr.IsDefaultShipping && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                              Default
                            </span>
                          )}
                          {addr.GSTIN && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-1">
                              <Building2 className="w-2.5 h-2.5" />
                              GSTIN: {addr.GSTIN}
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

                        {/* Card Action Buttons (Edit / Delete) */}
                        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadAddressForEdit(addr);
                            }}
                            className="text-[11px] font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit Address
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === addr.CustomerAddressID}
                            onClick={(e) => handleDelete(e, addr.CustomerAddressID)}
                            className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            {deletingId === addr.CustomerAddressID ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Delete
                          </button>
                        </div>
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
                onClick={() => {
                  resetForm();
                  setView('form');
                }}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 mt-2"
              >
                <Plus className="w-4 h-4" />
                Add A Different Address
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitForm} className="space-y-4">
              {savedAddresses.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">
                    {editingAddressId ? 'Editing Address' : 'New Address'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setView('list');
                    }}
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
                  {[
                    { id: 'Home', title: 'Home' },
                    { id: 'Work', title: 'Work / Business' },
                    { id: 'Other', title: 'Other' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setLabel(item.id);
                        if (item.id === 'Work') setHasGst(true);
                      }}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                        label === item.id
                          ? 'bg-primary-600 text-white border-primary-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {label === 'Work' || hasGst ? 'Business / Trade Name *' : 'Recipient Name *'}
                  </label>
                  <div className="relative">
                    {label === 'Work' || hasGst ? (
                      <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={label === 'Work' || hasGst ? 'e.g. Sri Venkateswara Enterprises' : 'e.g. Rahul Sharma'}
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

              {/* Optional GSTIN Section for B2B Retailers */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasGst}
                      onChange={(e) => {
                        setHasGst(e.target.checked);
                        if (!e.target.checked) setGstin('');
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      Add GSTIN for Business Purchase / ITC Claim
                    </span>
                  </label>
                </div>

                {hasGst && (
                  <div className="pt-1.5 space-y-1.5">
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={15}
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="15-digit GSTIN (e.g., 37AAAAA0000A1Z5)"
                        className={`${inputCls(errors.gstin)} font-mono uppercase tracking-wider`}
                      />
                      {cleanGstInput.length === 15 && !errors.gstin && !isGstPrefixMismatch && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                    </div>
                    {errors.gstin && (
                      <p className="text-[10px] text-rose-500">{errors.gstin}</p>
                    )}

                    {isGstPrefixMismatch && (
                      <div className="flex items-center gap-1.5 p-2 bg-amber-100/70 border border-amber-300 rounded-xl text-[10px] text-amber-900 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>
                          Notice: First 2 digits ({gstPrefix}) do not match {state}'s GST code ({expectedGstCode}).
                        </span>
                      </div>
                    )}
                    <p className="text-[10px] text-blue-700/80 leading-normal">
                      • Enter registered GSTIN to receive a compliant B2B Tax Invoice with Input Tax Credit.
                    </p>
                  </div>
                )}
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
                    placeholder="House / Flat / Shop no., Building, Street"
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

              {/* PIN, City, State with Instant Auto-Lookup */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2.5">
                  {/* PIN Code Input with Auto-Lookup */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>PIN *</span>
                      {isLookingUpPincode && (
                        <span className="text-[10px] text-primary-600 font-normal flex items-center gap-0.5">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={pincode}
                        onChange={(e) => handlePincodeChange(e.target.value)}
                        placeholder="6 digits"
                        className={`${inputCls(errors.pincode)} ${
                          isLookingUpPincode || pincodeLookupFeedback.status === 'success' ? 'pr-8' : ''
                        }`}
                      />
                      {isLookingUpPincode && (
                        <Loader2 className="w-3.5 h-3.5 text-primary-600 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                      {!isLookingUpPincode && pincodeLookupFeedback.status === 'success' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                    </div>
                    {errors.pincode && (
                      <p className="text-[10px] text-rose-500 mt-1">{errors.pincode}</p>
                    )}
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City / District"
                      className={`${inputCls(errors.city)} ${
                        pincodeLookupFeedback.status === 'success' ? 'bg-emerald-50/20' : ''
                      }`}
                    />
                    {errors.city && (
                      <p className="text-[10px] text-rose-500 mt-1">{errors.city}</p>
                    )}
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State"
                      className={`${inputCls(errors.state)} ${
                        pincodeLookupFeedback.status === 'success' ? 'bg-emerald-50/20' : ''
                      }`}
                    />
                    {errors.state && (
                      <p className="text-[10px] text-rose-500 mt-1">{errors.state}</p>
                    )}
                  </div>
                </div>

                {pincodeLookupFeedback.status === 'not_found' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 font-medium">
                    <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>{pincodeLookupFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* Save address checkbox (if logged in and not editing) */}
              {isLoggedIn && !editingAddressId && (
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
                    {editingAddressId ? 'Updating Address...' : 'Saving Address...'}
                  </>
                ) : (
                  <>
                    {editingAddressId ? 'Update & Use Address' : 'Deliver to this Address'}
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
