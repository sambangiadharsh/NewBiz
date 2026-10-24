import React, { useState } from 'react';
import { X, HelpCircle, MessageSquare, Phone, Mail, FileQuestion, ChevronRight } from 'lucide-react';

interface HelpConciergeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpConciergeModal: React.FC<HelpConciergeModalProps> = ({ isOpen, onClose }) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  if (!isOpen) return null;

  const faqs = [
    {
      q: 'How does complimentary express shipping work?',
      a: 'All orders containing ₹499 or more in merchandise qualify for free 2-3 business day carbon-neutral delivery.',
    },
    {
      q: 'What is your return policy?',
      a: 'We offer a 30-day risk-free return policy. We provide pre-paid return labels and full refunds directly to your payment method.',
    },
    {
      q: 'Are all electronics covered by warranty?',
      a: 'Yes, all audio gear and hardware include an official 2-year manufacturer warranty against defects.',
    },
    {
      q: 'How do I redeem my promotional coupon code?',
      a: 'Open your shopping bag drawer and enter your promo code (e.g. FLASH20) in the coupon input field before checkout.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#FAF9F6] rounded-3xl shadow-modal border border-stone-200/80 p-8 overflow-hidden max-h-[90vh] overflow-y-auto animate-slide-up">
        <button
          onClick={onClose}
          aria-label="Close concierge modal"
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Saamaan Customer Support</h3>
            <p className="text-xs text-slate-500">We are here to assist with every inquiry</p>
          </div>
        </div>

        {/* Contact Channels */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center hover:bg-slate-100 transition-colors cursor-pointer">
            <MessageSquare className="w-5 h-5 text-primary-600 mx-auto mb-1.5" />
            <h4 className="text-xs font-bold text-slate-900">Live Chat</h4>
            <span className="text-[10px] text-emerald-600 font-medium">Available now</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center hover:bg-slate-100 transition-colors cursor-pointer">
            <Phone className="w-5 h-5 text-primary-600 mx-auto mb-1.5" />
            <h4 className="text-xs font-bold text-slate-900">Phone</h4>
            <span className="text-[10px] text-slate-500">1-800-492-Saamaan</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center hover:bg-slate-100 transition-colors cursor-pointer">
            <Mail className="w-5 h-5 text-primary-600 mx-auto mb-1.5" />
            <h4 className="text-xs font-bold text-slate-900">Email</h4>
            <span className="text-[10px] text-slate-500">support@Saamaan.com</span>
          </div>
        </div>

        {/* Top Questions */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            Frequently Asked Questions
          </h4>
          {faqs.map((f, i) => (
            <div
              key={i}
              className="border border-slate-200/80 rounded-2xl p-3.5 hover:border-slate-300 transition-colors"
            >
              <button
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-800"
              >
                <span>{f.q}</span>
                <ChevronRight
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    activeFaq === i ? 'rotate-90 text-primary-600' : ''
                  }`}
                />
              </button>
              {activeFaq === i && (
                <p className="text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100 leading-relaxed animate-fade-in">
                  {f.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
