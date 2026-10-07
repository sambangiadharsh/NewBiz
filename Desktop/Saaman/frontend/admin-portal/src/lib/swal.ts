import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

export const customSwal = Swal.mixin({
  customClass: {
    container: 'z-[99999]',
    popup: 'rounded-3xl p-6 shadow-2xl border border-slate-100 font-sans',
    title: 'text-lg font-bold text-slate-900',
    htmlContainer: 'text-sm text-slate-600',
    confirmButton:
      'px-5 py-2.5 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-500/20 cursor-pointer outline-none',
    cancelButton:
      'px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer outline-none mr-2',
    actions: 'gap-3 mt-4',
  },
  buttonsStyling: false,
});

export interface ConfirmProceedOptions {
  title: string;
  text?: string;
  html?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  icon?: 'warning' | 'info' | 'question' | 'error' | 'success';
}

/**
 * Display a modern SweetAlert confirmation dialog with a "Proceed" button.
 * Resolves to `true` if the user clicks "Proceed", `false` otherwise.
 */
export const confirmProceed = async ({
  title,
  text,
  html,
  confirmButtonText = 'Proceed',
  cancelButtonText = 'Cancel',
  icon = 'warning',
}: ConfirmProceedOptions): Promise<boolean> => {
  const result = await customSwal.fire({
    title,
    text,
    html,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    focusCancel: true,
  });

  return result.isConfirmed;
};

/**
 * Show a sleek SweetAlert Toast notification
 */
export const showSweetToast = (
  title: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'success'
) => {
  return Swal.fire({
    toast: true,
    position: 'bottom-end',
    icon: type,
    title,
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    customClass: {
      container: 'z-[99999]',
      popup: 'rounded-2xl shadow-xl border border-slate-100 text-sm font-sans',
    },
  });
};
