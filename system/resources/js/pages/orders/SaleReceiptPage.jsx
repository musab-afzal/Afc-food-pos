import { ArrowLeft, Printer } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import ReceiptPreview from '../../components/receipt/ReceiptPreview.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { api } from '../../services/api.js';
import { setCurrencyConfig } from '../../utils/format.js';
import { printReceiptDocument } from '../../utils/receiptTemplate.js';

export default function SaleReceiptPage() {
    const { id } = useParams();
    const [receipt, setReceipt] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api(`/sales/${id}/receipt`);
            if (response.data?.currency) setCurrencyConfig(response.data.currency);
            setReceipt(response.data);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    function printNow() {
        if (!receipt) return;
        try {
            printReceiptDocument(receipt);
        } catch (error) {
            toast.error(error.message || 'Unable to print receipt');
        }
    }

    if (loading) return <div className="h-64 animate-pulse card-panel" />;
    if (!receipt) return <div className="rounded-3xl bg-white p-12 text-center text-sm text-ink/45 soft-shadow">Receipt not found.</div>;

    return (
        <div>
            <PageHeader
                title={`Receipt ${receipt.invoice_number}`}
                description="Thermal receipt preview — print matches this layout."
                breadcrumbs={['Orders', 'Sales', 'Receipt']}
                actions={(
                    <div className="flex gap-2">
                        <Link to={`/sales/${id}`} className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">
                            <ArrowLeft size={16} /> Sale
                        </Link>
                        <button type="button" onClick={printNow} className="flex items-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-sm font-semibold text-ink">
                            <Printer size={16} /> Print
                        </button>
                    </div>
                )}
            />

            <div className="rounded-3xl bg-[#ececec] px-4 py-8 soft-shadow">
                <ReceiptPreview receipt={receipt} />
            </div>
        </div>
    );
}
