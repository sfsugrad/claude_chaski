'use client';

import { clsx } from 'clsx';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

export interface DonutChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: DonutChartDataPoint[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  showLabels?: boolean;
  className?: string;
  title?: string;
  centerLabel?: string;
  centerValue?: string | number;
  formatValue?: (value: number) => string;
}

// Default color palette matching design system
const defaultColors = [
  '#3B82F6', // primary-500
  '#10B981', // success-500
  '#F59E0B', // warning-500
  '#EF4444', // error-500
  '#8B5CF6', // violet-500
  '#06B6D4', // cyan-500
  '#EC4899', // pink-500
  '#F97316', // orange-500
];

export function DonutChart({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  showLabels = false,
  className,
  title,
  centerLabel,
  centerValue,
  formatValue,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const percentage = ((entry.value / total) * 100).toFixed(1);
      return (
        <div className="bg-white border border-surface-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-surface-900 flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.payload.fill }}
            />
            {entry.name}
          </p>
          <p className="text-sm text-surface-600">
            {formatValue ? formatValue(entry.value) : entry.value.toLocaleString()}
            <span className="text-surface-400 ml-1">({percentage}%)</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    name,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't show labels for small slices

    return (
      <text
        x={x}
        y={y}
        fill="#374151"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs"
      >
        {name} ({(percent * 100).toFixed(0)}%)
      </text>
    );
  };

  const CustomLegend = ({ payload }: any) => (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-surface-600">{entry.value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className={clsx('w-full', className)}>
      {title && (
        <h3 className="text-sm font-medium text-surface-700 mb-4">{title}</h3>
      )}
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
              label={showLabels ? renderCustomizedLabel : undefined}
              labelLine={showLabels}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || defaultColors[index % defaultColors.length]}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend content={<CustomLegend />} />}
          </PieChart>
        </ResponsiveContainer>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center" style={{ marginTop: showLegend ? -40 : 0 }}>
              {centerValue !== undefined && (
                <p className="text-2xl font-bold text-surface-900">
                  {typeof centerValue === 'number'
                    ? centerValue.toLocaleString()
                    : centerValue}
                </p>
              )}
              {centerLabel && (
                <p className="text-sm text-surface-500">{centerLabel}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DonutChart;
