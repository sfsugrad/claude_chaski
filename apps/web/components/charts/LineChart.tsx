'use client';

import { clsx } from 'clsx';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';

export interface LineChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface LineChartProps {
  data: LineChartDataPoint[];
  dataKey?: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
  showDots?: boolean;
  showArea?: boolean;
  curved?: boolean;
  className?: string;
  title?: string;
  formatValue?: (value: number) => string;
  multipleLines?: Array<{
    key: string;
    color: string;
    name?: string;
  }>;
}

export function LineChart({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  height = 300,
  color = '#3B82F6',
  showGrid = true,
  showDots = true,
  showArea = false,
  curved = true,
  className,
  title,
  formatValue,
  multipleLines,
}: LineChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-surface-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-surface-900 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm text-surface-600">
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-medium">{entry.name}:</span>{' '}
              {formatValue ? formatValue(entry.value) : entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const curveType = curved ? 'monotone' : 'linear';

  // Use AreaChart if showArea is true, otherwise LineChart
  const ChartComponent = showArea ? AreaChart : RechartsLineChart;

  return (
    <div className={clsx('w-full', className)}>
      {title && (
        <h3 className="text-sm font-medium text-surface-700 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          )}
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
          <Tooltip content={<CustomTooltip />} />
          {multipleLines && (
            <Legend
              wrapperStyle={{ paddingTop: 16 }}
              formatter={(value) => (
                <span className="text-sm text-surface-600">{value}</span>
              )}
            />
          )}
          {multipleLines ? (
            multipleLines.map((line) =>
              showArea ? (
                <Area
                  key={line.key}
                  type={curveType}
                  dataKey={line.key}
                  name={line.name || line.key}
                  stroke={line.color}
                  fill={line.color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={showDots ? { fill: line.color, strokeWidth: 2, r: 4 } : false}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              ) : (
                <Line
                  key={line.key}
                  type={curveType}
                  dataKey={line.key}
                  name={line.name || line.key}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={showDots ? { fill: line.color, strokeWidth: 2, r: 4 } : false}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              )
            )
          ) : showArea ? (
            <Area
              type={curveType}
              dataKey={dataKey}
              stroke={color}
              fill={color}
              fillOpacity={0.1}
              strokeWidth={2}
              dot={showDots ? { fill: color, strokeWidth: 2, r: 4 } : false}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          ) : (
            <Line
              type={curveType}
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={showDots ? { fill: color, strokeWidth: 2, r: 4 } : false}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

export default LineChart;
