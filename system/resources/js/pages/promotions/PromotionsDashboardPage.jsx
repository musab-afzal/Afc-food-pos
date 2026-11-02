import { BadgePercent, Ticket, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader.jsx';
import KpiCard from '../../components/ui/KpiCard.jsx';
import { api } from '../../services/api.js';
import { currency } from '../../utils/format.js';

export default function PromotionsDashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api('/promotions/dashboard')
            .then((response) => setData(response.data))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <PageHeader
                title="Promotions"
                description="Discounts, coupons, and loyalty at a glance."
                breadcrumbs={['Promotions', 'Dashboard']}
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Link to="/promotions/discounts" className="btn-primary">Discounts</Link>
                        <Link to="/promotions/coupons" className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold">Coupons</Link>
                    </div>
                )}
            />

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-white" />)}</div>
            ) : (
                <>
                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <KpiCard label="Active discounts" value={data?.discounts?.active ?? data?.active_discounts ?? 0} icon={BadgePercent} tone="bg-lime" />
                        <KpiCard label="Active coupons" value={data?.coupons?.active ?? data?.active_coupons ?? 0} icon={Ticket} tone="bg-[#dfe9d6]" />
                        <KpiCard label="Expiring soon" value={data?.coupons?.expiring_soon ?? data?.expiring_soon ?? 0} icon={Ticket} tone="bg-[#fff0bd]" />
                        <KpiCard label="Loyalty points" value={data?.loyalty?.points_outstanding ?? data?.loyalty_points ?? 0} icon={Users} tone="bg-[#d8e8ff]" />
                    </section>

                    <section className="mt-5 grid gap-5 xl:grid-cols-2">
                        <article className="card-panel p-6">
                            <p className="font-semibold">Coupon usage</p>
                            <p className="mt-1 text-sm text-ink/45">Redemptions and discount given</p>
                            <div className="mt-6 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-ink/40">Uses</p>
                                    <p className="mt-1 text-3xl font-semibold">{data?.coupons?.total_uses ?? data?.coupon_uses ?? 0}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-ink/40">Discount given</p>
                                    <p className="mt-1 text-3xl font-semibold">{currency(data?.coupons?.discount_given ?? data?.discount_given)}</p>
                                </div>
                            </div>
                        </article>
                        <article className="card-panel p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">Top coupons</p>
                                    <p className="text-sm text-ink/45">By usage</p>
                                </div>
                                <Link to="/promotions/coupons" className="text-sm font-semibold text-herb">Manage</Link>
                            </div>
                            <div className="mt-4 divide-y divide-ink/7">
                                {(data?.top_coupons || data?.coupons?.top || []).length
                                    ? (data.top_coupons || data.coupons.top).map((coupon) => (
                                        <div key={coupon.id || coupon.code} className="flex justify-between py-3 text-sm">
                                            <span className="font-medium">{coupon.code}</span>
                                            <span className="text-ink/50">{coupon.used_count ?? coupon.uses ?? 0} uses</span>
                                        </div>
                                    ))
                                    : <p className="py-10 text-center text-sm text-ink/40">No coupon usage yet.</p>}
                            </div>
                        </article>
                    </section>
                </>
            )}
        </div>
    );
}
