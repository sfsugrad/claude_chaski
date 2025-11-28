'use client';

import { clsx } from 'clsx';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

export interface BarChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  dataKey?: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  horizontal?: boolean;
  className?: string;
  title?: string;
  formatValue?: (value: number) => string;
  barSize?: number;
  multipleKeys?: string[];
  multipleColors?: Record<string, string>;
}

// Default color palette matching design system
const defaultColors = [
  '#3B82F6', // primary-500
  '#10B981', // success-500
  '#F59E0B', // warning-500
  '#EF4444', // error-500
  '#8B5CF6', // violet-500
  '#06B6D4', // cyan-500
];

export function BarChart({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  height = 300,
  color = '#3B82F6',
  colors,
  showGrid = true,
  showLegend = false,
  horizontal = false,
  className,
  title,
  formatValue,
  barSize,
  multipleKeys,
  multipleColors,
}: BarChartProps) {
  const colorArray = colors || defaultColors;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-surface-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-surface-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm text-surface-600">
              <span className="font-medium" style={{ color: entry.color }}>
                {entry.name}:
              </span>{' '}
              {formatValue ? formatValue(entry.value) : entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={clsx('w-full', className)}>
      {title && (
        <h3 className="text-sm font-medium text-surface-700 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#E5E7EB"
              vertical={!horizontal}
              horizontal={horizontal || true}
            />
          )}
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis
                dataKey={xAxisKey}
                type="category"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                width={100}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 12, fill: '#6B7280' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6B7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
              />
            </>
          )}
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: 16 }}
              formatter={(value) => (
                <span className="text-sm text-surface-600">{value}</span>
              )}
            />
          )}
          {multipleKeys ? (
            multipleKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={multipleColors?.[key] || colorArray[index % colorArray.length]}
                radius={[4, 4, 0, 0]}
                barSize={barSize}
              />
            ))
          ) : (
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} barSize={barSize}>
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors ? colorArray[index % colorArray.length] : color}
                />
              ))}
            </Bar>
          )}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BarChart;
