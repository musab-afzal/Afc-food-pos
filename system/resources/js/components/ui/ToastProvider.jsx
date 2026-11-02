import { Toaster } from 'sonner';

export default function ToastProvider() {
    return (
        <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
                className: 'font-sans',
                style: { borderRadius: '14px' },
            }}
        />
    );
}
