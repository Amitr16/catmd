/**
 * Minimal line chart in react-native-svg — no new deps, no animations.
 * Built for weight / SRR / water-intake trends. Keep it boring.
 */
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';
import { space } from '../theme/tokens';

export type Point = { x: number; y: number; label?: string };

export type LineChartProps = {
  data: Point[];               // must be pre-sorted by x ascending
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  yUnit?: string;              // e.g. "kg", "bpm"
  yMin?: number;               // clamp floor
  yMax?: number;               // clamp ceiling
  yLines?: number[];           // horizontal reference lines (e.g. [30] for SRR alert)
  showDots?: boolean;
  emptyHint?: string;
  style?: ViewStyle;
};

export function LineChart({
  data,
  width = 320,
  height = 180,
  strokeColor,
  fillColor,
  yUnit,
  yMin,
  yMax,
  yLines = [],
  showDots = true,
  emptyHint = 'No data yet.',
  style,
}: LineChartProps) {
  const t = useTheme();
  const stroke = strokeColor ?? t.primary500;
  const fill = fillColor ?? 'rgba(91, 138, 122, 0.10)';

  const padX = 28;
  const padY = 18;

  if (data.length === 0) {
    return (
      <View
        style={[{
          width, height,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.surfaceElevated,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: t.borderSubtle,
        }, style]}
      >
        <Text token="caption" color="textMuted">{emptyHint}</Text>
      </View>
    );
  }

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const rawMin = yMin ?? Math.min(...ys, ...yLines);
  const rawMax = yMax ?? Math.max(...ys, ...yLines);
  // Give 10% breathing room on Y so line doesn't touch edges
  const padRange = (rawMax - rawMin) * 0.1 || 1;
  const yLo = rawMin - padRange;
  const yHi = rawMax + padRange;
  const xRange = Math.max(1, xMax - xMin);
  const yRange = Math.max(0.001, yHi - yLo);

  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const toXY = (p: Point) => ({
    x: padX + ((p.x - xMin) / xRange) * plotW,
    y: padY + (1 - (p.y - yLo) / yRange) * plotH,
  });

  const pts = data.map(toXY);
  const path =
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

  // Filled area under the line (closed to baseline)
  const baselineY = padY + plotH;
  const areaPath =
    `M ${pts[0]!.x.toFixed(2)} ${baselineY.toFixed(2)} ` +
    pts.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +
    ` L ${pts[pts.length - 1]!.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;

  return (
    <View style={style}>
      <Svg width={width} height={height}>
        {/* Horizontal grid lines at min + mid + max */}
        {[yLo, (yLo + yHi) / 2, yHi].map((yVal, i) => {
          const y = padY + (1 - (yVal - yLo) / yRange) * plotH;
          return (
            <Line
              key={`grid-${i}`}
              x1={padX}
              x2={padX + plotW}
              y1={y}
              y2={y}
              stroke={t.borderSubtle}
              strokeWidth={1}
            />
          );
        })}
        {/* User-supplied reference lines (e.g. SRR alert threshold) */}
        {yLines.map((yVal, i) => {
          const y = padY + (1 - (yVal - yLo) / yRange) * plotH;
          return (
            <Line
              key={`ref-${i}`}
              x1={padX}
              x2={padX + plotW}
              y1={y}
              y2={y}
              stroke={t.urgencyConcern}
              strokeWidth={1.5}
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Area fill */}
        <Path d={areaPath} fill={fill} />
        {/* Line */}
        <Path d={path} stroke={stroke} strokeWidth={2.5} fill="none" />
        {/* Dots */}
        {showDots && pts.map((p, i) => (
          <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={4} fill={stroke} />
        ))}

        {/* Y-axis min/max labels */}
        <SvgText x={4} y={padY + 4} fontSize={10} fill={t.textMuted}>
          {yHi.toFixed(yHi >= 10 ? 0 : 1)}{yUnit ? ` ${yUnit}` : ''}
        </SvgText>
        <SvgText x={4} y={padY + plotH + 2} fontSize={10} fill={t.textMuted}>
          {yLo.toFixed(yLo >= 10 ? 0 : 1)}{yUnit ? ` ${yUnit}` : ''}
        </SvgText>
      </Svg>
      <View style={{ height: space[1] }} />
    </View>
  );
}
