import {
    Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const DEFAULT_COLORS = ['#FE9F43', '#0E9384', '#6938EF', '#F04438'];

/**
 * Shared line/area trend chart for dashboard and reports.
 */
export default function LineTrendChart({
    data = [],
    xKey = 'label',
    series = [],
    height = 288,
    formatter,
    emptyLabel = 'No data for this period.',
}) {
    if (!data.length || !series.length) {
        return (
            <div className="grid place-items-center rounded-[8px] bg-light text-sm text-muted" style={{ height }}>
                {emptyLabel}
            </div>
        );
    }

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                        {series.map((item, index) => {
                            const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                            return (
                                <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                                </linearGradient>
                            );
                        })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6EAED" />
                    <XAxis dataKey={xKey} tick={{ fill: '#646B72', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis tick={{ fill: '#646B72', fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
                    <Tooltip
                        formatter={formatter}
                        contentStyle={{ borderRadius: 8, borderColor: '#E6EAED' }}
                        labelStyle={{ fontWeight: 700 }}
                    />
                    <Legend />
                    {series.map((item, index) => {
                        const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                        if (item.area === false) return null;
                        return (
                            <Area
                                key={`area-${item.key}`}
                                type="monotone"
                                dataKey={item.key}
                                name={item.name}
                                stroke="none"
                                fill={`url(#fill-${item.key})`}
                                legendType="none"
                                isAnimationActive={false}
                            />
                        );
                    })}
                    {series.map((item, index) => {
                        const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                        return (
                            <Line
                                key={`line-${item.key}`}
                                type="monotone"
                                dataKey={item.key}
                                name={item.name}
                                stroke={color}
                                strokeWidth={2.5}
                                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                                activeDot={{ r: 5 }}
                            />
                        );
                    })}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
