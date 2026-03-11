
import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, LineChart, Line, Cell, ResponsiveContainer,
  ReferenceLine, Legend
} from 'recharts';

interface ChartProps {
  data: any[];
  dataKey: string;
  secondaryDataKey?: string;
  xKey: string;
  color?: string;
  height?: number;
  type?: 'area' | 'bar' | 'line' | 'stock';
  format?: (val: any) => string;
}

const StockTooltip: React.FC<any> = ({ active, payload, label, format, isPositive }) => {
  if (!active || !payload || payload.length === 0) return null;

  const priceEntry = payload.find((p: any) => p.dataKey === 'priceIndex' || p.dataKey === 'closePrice');
  const totalReturnEntry = payload.find((p: any) => p.dataKey === 'totalReturnIndex');

  return (
    <div style={{
      backgroundColor: 'rgba(2, 45, 91, 0.95)',
      border: `1px solid ${isPositive ? '#34d399' : '#f87171'}`,
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '600',
      padding: '8px 12px',
    }}>
      <div style={{ color: '#5F9AAE', fontSize: '9px', marginBottom: '4px', fontWeight: 700, letterSpacing: '0.05em' }}>{label}</div>
      {priceEntry && (
        <div style={{ color: '#f1f5f9', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#5F9AAE' }}>Price</span>
          <span>{format(priceEntry.value)}</span>
        </div>
      )}
      {totalReturnEntry && (
        <div style={{ color: '#f1f5f9', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#FF9D3C' }}>Total Return</span>
          <span>{format(totalReturnEntry.value)}</span>
        </div>
      )}
    </div>
  );
};

export const MetricChart: React.FC<ChartProps> = ({
  data,
  dataKey,
  secondaryDataKey,
  xKey,
  color = "#48A3CC",
  height = 300,
  type = 'area',
  format = (v) => v
}) => {
  const tooltipFormatter = (value: any) => {
    return [format(value)];
  };

  // For stock chart: determine if overall performance is positive or negative
  const stockMeta = useMemo(() => {
    if (type !== 'stock' || !data || data.length < 2) return null;
    const first = data[0]?.[dataKey];
    const last = data[data.length - 1]?.[dataKey];
    const isPositive = last >= first;
    const changePercent = first > 0 ? ((last - first) / first) * 100 : 0;
    // Determine if dots should be shown based on data density
    const showDots = data.length <= 120;
    const dotSize = data.length <= 30 ? 3 : data.length <= 60 ? 2.5 : 2;
    return { first, last, isPositive, changePercent, showDots, dotSize };
  }, [data, dataKey, type]);

  return (
    <div style={{ width: '100%', height, overflow: 'hidden' }} className="font-tertiary">
      <ResponsiveContainer width="100%" height={height}>
        {type === 'stock' ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`stock-gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={stockMeta?.isPositive ? '#34d399' : '#f87171'}
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor={stockMeta?.isPositive ? '#34d399' : '#f87171'}
                  stopOpacity={0.01}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(95, 154, 174, 0.08)"
              vertical={false}
            />
            {stockMeta && (
              <ReferenceLine
                y={stockMeta.first}
                stroke="rgba(95, 154, 174, 0.3)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <XAxis
              dataKey={xKey}
              stroke="#5F9AAE"
              fontSize={9}
              tickLine={false}
              axisLine={{ stroke: 'rgba(95, 154, 174, 0.15)', strokeWidth: 1 }}
              tick={{ fill: '#5F9AAE', fontWeight: 600 }}
              dy={8}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              stroke="#5F9AAE"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              tickFormatter={format}
              tick={{ fill: '#5F9AAE', fontWeight: 600 }}
              dx={-5}
              domain={['auto', 'auto']}
              padding={{ top: 10, bottom: 10 }}
            />
            <Tooltip
              content={<StockTooltip format={format} isPositive={stockMeta?.isPositive} />}
              cursor={{
                stroke: 'rgba(95, 154, 174, 0.4)',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
            />
            {/* Price line (primary) */}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={stockMeta?.isPositive ? '#34d399' : '#f87171'}
              fillOpacity={1}
              fill={`url(#stock-gradient-${dataKey})`}
              strokeWidth={2}
              animationDuration={1200}
              dot={stockMeta?.showDots ? {
                r: stockMeta.dotSize,
                fill: stockMeta.isPositive ? '#34d399' : '#f87171',
                stroke: 'rgba(1, 4, 9, 0.6)',
                strokeWidth: 1,
              } : false}
              activeDot={{
                r: 5,
                fill: stockMeta?.isPositive ? '#34d399' : '#f87171',
                stroke: '#010409',
                strokeWidth: 2,
              }}
              name="Price"
            />
            {/* Total Return line (secondary, dashed orange) */}
            {secondaryDataKey && (
              <Area
                type="monotone"
                dataKey={secondaryDataKey}
                stroke="#FF9D3C"
                fill="transparent"
                fillOpacity={0}
                strokeWidth={1.5}
                strokeDasharray="6 3"
                animationDuration={1200}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: '#FF9D3C',
                  stroke: '#010409',
                  strokeWidth: 2,
                }}
                name="Total Return"
              />
            )}
            {secondaryDataKey && (
              <Legend
                verticalAlign="top"
                align="right"
                height={24}
                iconSize={10}
                wrapperStyle={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                formatter={(value: string) => (
                  <span style={{ color: value === 'Price' ? (stockMeta?.isPositive ? '#34d399' : '#f87171') : '#FF9D3C' }}>
                    {value}
                  </span>
                )}
              />
            )}
          </AreaChart>
        ) : type === 'area' ? (
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 154, 174, 0.15)" vertical={false} />
            <XAxis
              dataKey={xKey}
              stroke="#5F9AAE"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#5F9AAE', fontWeight: 600 }}
              dy={10}
            />
            <YAxis
              stroke="#5F9AAE"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={format}
              tick={{ fill: '#5F9AAE', fontWeight: 600 }}
              dx={-10}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(2, 45, 91, 0.95)', border: '1px solid #5F9AAE', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}
              itemStyle={{ color: '#f1f5f9' }}
              cursor={{ stroke: '#FF9D3C', strokeWidth: 1 }}
              formatter={tooltipFormatter}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fillOpacity={1}
              fill={`url(#gradient-${dataKey})`}
              strokeWidth={3}
              animationDuration={1500}
            />
          </AreaChart>
        ) : type === 'bar' ? (
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 154, 174, 0.15)" vertical={false} />
            <XAxis dataKey={xKey} stroke="#5F9AAE" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 600 }} dy={10} />
            <YAxis stroke="#5F9AAE" fontSize={10} tickLine={false} axisLine={false} tickFormatter={format} tick={{ fontWeight: 600 }} dx={-10} />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(2, 45, 91, 0.95)', border: '1px solid #5F9AAE', borderRadius: '4px', fontSize: '11px' }}
              formatter={tooltipFormatter}
            />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} animationDuration={1500}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fillOpacity={0.7 + (index / data.length) * 0.3} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
             <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 154, 174, 0.15)" vertical={false} />
             <XAxis dataKey={xKey} stroke="#5F9AAE" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 600 }} dy={10} />
             <YAxis stroke="#5F9AAE" fontSize={10} tickLine={false} axisLine={false} tickFormatter={format} tick={{ fontWeight: 600 }} dx={-10} />
             <Tooltip
              contentStyle={{ backgroundColor: 'rgba(2, 45, 91, 0.95)', border: '1px solid #5F9AAE', borderRadius: '4px', fontSize: '11px' }}
              formatter={tooltipFormatter}
            />
             <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={4} dot={{ r: 4, fill: '#010409', stroke: color, strokeWidth: 2 }} activeDot={{ r: 6, fill: '#FF9D3C' }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};
