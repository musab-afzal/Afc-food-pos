import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { api } from '../../services/api.js';
import { currency } from '../../utils/format.js';

export default function RecipeCostingPage() {
    const [rows, setRows] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api('/recipes/costing')
            .then((response) => setRows(response.data || []))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, []);

    const filtered = rows.filter((row) => `${row.dish_name} ${row.variant_name || ''}`.toLowerCase().includes(query.toLowerCase()));

    return (
        <div>
            <PageHeader
                title="Recipe Costing"
                description="Food cost percentage and margin based on current average ingredient costs."
                breadcrumbs={['Recipes', 'Costing']}
            />
            <div className="mb-4 max-w-md">
                <SearchInput value={query} onChange={setQuery} placeholder="Search dishes…" />
            </div>
            <DataTable
                loading={loading}
                rows={filtered.map((row, index) => ({ ...row, id: row.recipe_id || index }))}
                emptyMessage="No recipes available for costing."
                columns={[
                    { key: 'dish_name', label: 'Dish', render: (row) => <div><p className="font-semibold">{row.dish_name}</p><p className="text-xs text-ink/40">{row.variant_name || 'Standard'}</p></div> },
                    { key: 'selling_price', label: 'Selling price', render: (row) => currency(row.selling_price) },
                    { key: 'recipe_cost', label: 'Recipe cost', render: (row) => currency(row.recipe_cost) },
                    { key: 'gross_margin', label: 'Gross margin', render: (row) => currency(row.gross_margin) },
                    {
                        key: 'food_cost_percent',
                        label: 'Food cost %',
                        render: (row) => {
                            const pct = Number(row.food_cost_percent || 0);
                            const tone = pct > 35 ? 'text-coral' : pct > 28 ? 'text-amber-700' : 'text-herb';
                            return <span className={`font-semibold ${tone}`}>{pct.toFixed(1)}%</span>;
                        },
                    },
                ]}
            />
        </div>
    );
}
