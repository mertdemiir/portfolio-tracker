import { useState, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ChevronDown, ChevronUp, Flame, TrendingUp, Shield, Zap } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useSettings } from '../context/SettingsContext';
import { useFireSettings } from '../hooks/useFireSettings';
import { getChartColors, getChartPalette } from '../hooks/useTheme';
import { formatCurrency, formatCompactCurrency, formatPercent } from '../utils/formatters';

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

function computeProjection(
  currentValue: number,
  monthlyContribution: number,
  annualReturn: number,
  fireTarget: number,
  currentAge: number,
) {
  const monthlyReturn = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  const data: { month: number; age: number; value: number; target: number }[] = [];
  let value = currentValue;
  let fireMonth: number | null = null;

  const maxMonths = 600; // 50 years cap
  for (let m = 0; m <= maxMonths; m++) {
    const age = currentAge + m / 12;
    data.push({ month: m, age: Math.round(age * 10) / 10, value, target: fireTarget });

    if (value >= fireTarget && fireMonth === null) {
      fireMonth = m;
    }

    // Grow
    if (monthlyReturn > 0) {
      value = value * (1 + monthlyReturn) + monthlyContribution;
    } else {
      value = value + monthlyContribution;
    }

    // Stop projecting 5 years past FIRE or at 50 year cap
    if (fireMonth !== null && m > fireMonth + 60) break;
  }

  return { data, fireMonth, fireAge: fireMonth !== null ? currentAge + fireMonth / 12 : null };
}

function runMonteCarlo(
  startingPortfolio: number,
  annualWithdrawal: number,
  years: number,
  meanReturn: number,
  stdDev: number,
  inflationRate: number,
  numSimulations: number,
) {
  const yearlyResults: number[][] = Array.from({ length: years + 1 }, () => []);
  let successCount = 0;

  for (let sim = 0; sim < numSimulations; sim++) {
    let portfolio = startingPortfolio;
    let withdrawal = annualWithdrawal;
    let failed = false;

    yearlyResults[0].push(portfolio);

    for (let y = 1; y <= years; y++) {
      if (!failed) {
        // Inflate withdrawal for years after the first
        if (y > 1) withdrawal *= 1 + inflationRate;
        portfolio -= withdrawal;
        if (portfolio <= 0) {
          portfolio = 0;
          failed = true;
        } else {
          const r = normalRandom(meanReturn, stdDev);
          portfolio *= 1 + r;
          if (portfolio < 0) portfolio = 0;
        }
      }
      yearlyResults[y].push(portfolio);
    }

    if (portfolio > 0) successCount++;
  }

  // Compute percentiles
  const percentiles = yearlyResults.map((yearVals) => {
    const sorted = [...yearVals].sort((a, b) => a - b);
    const p = (pct: number) => sorted[Math.floor(pct / 100 * (sorted.length - 1))];
    return { p10: p(10), p25: p(25), p50: p(50), p75: p(75), p90: p(90) };
  });

  return { percentiles, successRate: (successCount / numSimulations) * 100 };
}

// ─── Input Field Component ──────────────────────────────────────────────────

function SettingsInput({
  label,
  value,
  onChange,
  suffix,
  hint,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
  min?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-t-muted font-medium mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min ?? 0}
          step={step ?? 1}
          className="w-full bg-surface-alt border border-b-default card-radius px-3 py-2 text-sm text-t-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        {suffix && <span className="text-xs text-t-faint whitespace-nowrap">{suffix}</span>}
      </div>
      {hint && <p className="text-[10px] text-t-faint mt-0.5">{hint}</p>}
    </div>
  );
}

// ─── Variant Card Component ─────────────────────────────────────────────────

function VariantCard({
  label,
  icon: Icon,
  target,
  progress,
  color,
  reached,
}: {
  label: string;
  icon: typeof Flame;
  target: number;
  progress: number;
  color: string;
  reached?: boolean;
}) {
  const clampedProgress = Math.min(progress, 100);
  return (
    <div className="bg-surface-card card-radius border border-b-default p-4 card-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-xs font-semibold text-t-primary">{label}</span>
        </div>
        {reached && (
          <span className="text-[10px] font-bold text-gain bg-gain-bg px-1.5 py-0.5 badge-radius badge-transform">
            Reached
          </span>
        )}
      </div>
      <p className="text-lg font-bold tabular-nums text-t-primary">{formatCurrency(target)}</p>
      <div className="mt-2 h-2 bg-surface-alt rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${clampedProgress}%`,
            backgroundColor: progress >= 100 ? 'var(--gain)' : 'var(--accent)',
          }}
        />
      </div>
      <p className={`text-xs font-semibold tabular-nums mt-1 ${progress >= 100 ? 'text-gain' : 'text-t-muted'}`}>
        {progress.toFixed(1)}%
      </p>
    </div>
  );
}

// ─── Custom Chart Tooltip ───────────────────────────────────────────────────

function ProjectionTooltip({ active, payload, label, cc }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="text-xs p-2 border card-radius"
      style={{ backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.tooltipText }}
    >
      <p className="font-semibold mb-1">Age {typeof label === 'number' ? label.toFixed(1) : label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="tabular-nums" style={{ color: p.color }}>
          {p.name}: {formatCompactCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

function MonteCarloTooltip({ active, payload, label, cc }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="text-xs p-2 border card-radius"
      style={{ backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.tooltipText }}
    >
      <p className="font-semibold mb-1">Year {label}</p>
      {payload
        .filter((p: any) => p.dataKey === 'p50')
        .map((p: any, i: number) => (
          <p key={i} className="tabular-nums">
            Median: {formatCompactCurrency(p.value)}
          </p>
        ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function FirePage() {
  const { netWorthSummary } = usePortfolioContext();
  const { theme } = useSettings();
  const [settings, updateSettings] = useFireSettings();
  const [showSettings, setShowSettings] = useState(true);

  const cc = getChartColors(theme);
  const palette = getChartPalette(theme);

  const currentNetWorth = netWorthSummary.totalNetWorth;

  // ─── FIRE Calculations ──────────────────────────────────────────────────

  const fireNumber = useMemo(() => {
    if (settings.safeWithdrawalRate <= 0 || settings.annualExpenses <= 0) return 0;
    return settings.annualExpenses / (settings.safeWithdrawalRate / 100);
  }, [settings.annualExpenses, settings.safeWithdrawalRate]);

  const progress = useMemo(() => {
    if (fireNumber <= 0) return 0;
    return (currentNetWorth / fireNumber) * 100;
  }, [currentNetWorth, fireNumber]);

  // Lean / Regular / Fat / Coast variants
  const variants = useMemo(() => {
    const swr = settings.safeWithdrawalRate / 100;
    if (swr <= 0 || settings.annualExpenses <= 0) {
      return { lean: 0, regular: 0, fat: 0, coast: 0 };
    }

    const lean = (settings.annualExpenses * settings.leanMultiplier) / swr;
    const regular = settings.annualExpenses / swr;
    const fat = (settings.annualExpenses * settings.fatMultiplier) / swr;

    // Coast FIRE — works with negative real returns too
    // (negative real return → coast > regular, meaning you need MORE today)
    const yearsToRetirement = settings.targetRetirementAge - settings.currentAge;
    let coast = 0;
    if (yearsToRetirement > 0) {
      const realReturn = (1 + settings.expectedReturn / 100) / (1 + settings.inflationRate / 100) - 1;
      const growthFactor = Math.pow(1 + realReturn, yearsToRetirement);
      // growthFactor ≤ 0 means money loses all value — coasting is impossible
      coast = growthFactor > 0 ? regular / growthFactor : regular * 10;
    }

    return { lean, regular, fat, coast };
  }, [settings]);

  // ─── Time to FIRE Projection ────────────────────────────────────────────

  const projection = useMemo(() => {
    if (fireNumber <= 0) return null;
    return computeProjection(
      currentNetWorth,
      settings.monthlyContribution,
      settings.expectedReturn,
      fireNumber,
      settings.currentAge,
    );
  }, [currentNetWorth, settings.monthlyContribution, settings.expectedReturn, fireNumber, settings.currentAge]);

  // Downsample projection data for chart (every 12th point = yearly)
  const projectionChartData = useMemo(() => {
    if (!projection) return [];
    return projection.data.filter((_, i) => i % 12 === 0).map((d) => ({
      age: Math.round(d.age),
      value: Math.round(d.value),
      target: d.target,
    }));
  }, [projection]);

  // ─── Monte Carlo Withdrawal Simulation ──────────────────────────────────

  // Monte Carlo simulates: "Starting from my FIRE number, withdrawing annual expenses,
  // will my portfolio survive 30 years?" — the standard Trinity Study framing.
  const monteCarlo = useMemo(() => {
    if (fireNumber <= 0) return null;
    return runMonteCarlo(
      fireNumber,
      settings.annualExpenses,
      30, // 30 year retirement
      settings.expectedReturn / 100,
      settings.portfolioVolatility / 100,
      settings.inflationRate / 100,
      1000,
    );
  }, [settings.annualExpenses, settings.expectedReturn, settings.portfolioVolatility, settings.inflationRate, fireNumber]);

  const monteCarloChartData = useMemo(() => {
    if (!monteCarlo) return [];
    return monteCarlo.percentiles.map((p, year) => ({
      year,
      p10: Math.round(p.p10),
      p25: Math.round(p.p25),
      p50: Math.round(p.p50),
      p75: Math.round(p.p75),
      p90: Math.round(p.p90),
    }));
  }, [monteCarlo]);

  const handleChange = useCallback(
    (field: string) => (value: number) => {
      updateSettings({ [field]: value });
    },
    [updateSettings],
  );

  // ─── Empty State ────────────────────────────────────────────────────────

  const needsSetup = settings.annualExpenses <= 0;

  return (
    <div>
      {/* ── Settings Panel ────────────────────────────────────────────────── */}
      <div className="bg-surface-card card-radius border border-b-default card-shadow mb-6">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between p-5"
        >
          <h3 className="text-sm font-semibold text-t-primary flex items-center gap-2">
            <Flame className="w-4 h-4 text-accent" />
            FIRE Settings
          </h3>
          {showSettings ? (
            <ChevronUp className="w-4 h-4 text-t-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-t-muted" />
          )}
        </button>

        {showSettings && (
          <div className="px-5 pb-5 border-t border-b-subtle pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <SettingsInput
                label="Annual Expenses"
                value={settings.annualExpenses}
                onChange={handleChange('annualExpenses')}
                suffix="/ yr"
                hint="Your yearly spending"
              />
              <SettingsInput
                label="Monthly Savings"
                value={settings.monthlyContribution}
                onChange={handleChange('monthlyContribution')}
                suffix="/ mo"
                hint="Amount you invest monthly"
              />
              <SettingsInput
                label="Current Age"
                value={settings.currentAge}
                onChange={handleChange('currentAge')}
                min={1}
              />
              <SettingsInput
                label="Retirement Age"
                value={settings.targetRetirementAge}
                onChange={handleChange('targetRetirementAge')}
                min={settings.currentAge + 1}
              />
              <SettingsInput
                label="Expected Return"
                value={settings.expectedReturn}
                onChange={handleChange('expectedReturn')}
                suffix="%"
                step={0.5}
                hint="7% is a common real return"
              />
              <SettingsInput
                label="Inflation Rate"
                value={settings.inflationRate}
                onChange={handleChange('inflationRate')}
                suffix="%"
                step={0.5}
              />
              <SettingsInput
                label="Safe Withdrawal Rate"
                value={settings.safeWithdrawalRate}
                onChange={handleChange('safeWithdrawalRate')}
                suffix="%"
                step={0.25}
                hint="4% is the Trinity Study rule"
              />
              <SettingsInput
                label="Lean Multiplier"
                value={settings.leanMultiplier}
                onChange={handleChange('leanMultiplier')}
                suffix="x"
                step={0.05}
                hint="0.7 = 70% of expenses"
              />
              <SettingsInput
                label="Fat Multiplier"
                value={settings.fatMultiplier}
                onChange={handleChange('fatMultiplier')}
                suffix="x"
                step={0.05}
                hint="1.5 = 150% of expenses"
              />
              <SettingsInput
                label="Volatility"
                value={settings.portfolioVolatility}
                onChange={handleChange('portfolioVolatility')}
                suffix="%"
                step={0.5}
                hint="15% ≈ 90/10 · 10% ≈ 60/40"
              />
            </div>
            {currentNetWorth > 0 && (
              <p className="text-xs text-t-faint mt-3">
                Using current net worth of <span className="font-semibold text-t-muted">{formatCurrency(currentNetWorth)}</span> as starting point.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Prompt to enter expenses ──────────────────────────────────────── */}
      {needsSetup && (
        <div className="bg-surface-card card-radius border border-b-default p-8 text-center card-shadow">
          <Flame className="w-10 h-10 text-accent mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-t-primary mb-2">Set Up Your FIRE Plan</h3>
          <p className="text-sm text-t-muted max-w-md mx-auto">
            Enter your annual expenses in the settings above to calculate your FIRE number and see your path to financial independence.
          </p>
        </div>
      )}

      {!needsSetup && (
        <>
          {/* ── FIRE Progress Hero ──────────────────────────────────────────── */}
          <div className="bg-surface-card card-radius border border-b-default p-5 mb-6 card-shadow">
            <h3 className="text-sm font-semibold text-t-primary mb-4">FIRE Progress</h3>

            {/* Progress bar */}
            <div className="relative h-6 bg-surface-alt rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(progress, 100)}%`,
                  backgroundColor: progress >= 100 ? 'var(--gain)' : 'var(--accent)',
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-t-primary">
                {progress.toFixed(1)}%
              </span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <span className="text-xs text-t-muted font-medium">Current Net Worth</span>
                <p className="text-lg font-bold tabular-nums text-t-primary">{formatCurrency(currentNetWorth)}</p>
              </div>
              <div>
                <span className="text-xs text-t-muted font-medium">FIRE Number</span>
                <p className="text-lg font-bold tabular-nums text-accent">{formatCurrency(fireNumber)}</p>
              </div>
              <div>
                <span className="text-xs text-t-muted font-medium">Remaining</span>
                <p className={`text-lg font-bold tabular-nums ${fireNumber - currentNetWorth <= 0 ? 'text-gain' : 'text-t-primary'}`}>
                  {fireNumber - currentNetWorth <= 0
                    ? 'FIRE Achieved!'
                    : formatCurrency(fireNumber - currentNetWorth)}
                </p>
              </div>
              <div>
                <span className="text-xs text-t-muted font-medium">
                  {projection?.fireAge ? 'FIRE Age' : 'Est. FIRE Age'}
                </span>
                <p className="text-lg font-bold tabular-nums text-t-primary">
                  {projection?.fireAge
                    ? `Age ${Math.ceil(projection.fireAge)}`
                    : progress >= 100
                    ? 'Now!'
                    : '50+ years'}
                </p>
              </div>
            </div>
          </div>

          {/* ── FIRE Variants ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <VariantCard
              label="Lean FIRE"
              icon={Zap}
              target={variants.lean}
              progress={variants.lean > 0 ? (currentNetWorth / variants.lean) * 100 : 0}
              color="text-amber-500"
              reached={variants.lean > 0 && currentNetWorth >= variants.lean}
            />
            <VariantCard
              label="Regular FIRE"
              icon={Flame}
              target={variants.regular}
              progress={variants.regular > 0 ? (currentNetWorth / variants.regular) * 100 : 0}
              color="text-accent"
              reached={variants.regular > 0 && currentNetWorth >= variants.regular}
            />
            <VariantCard
              label="Fat FIRE"
              icon={TrendingUp}
              target={variants.fat}
              progress={variants.fat > 0 ? (currentNetWorth / variants.fat) * 100 : 0}
              color="text-purple-500"
              reached={variants.fat > 0 && currentNetWorth >= variants.fat}
            />
            <VariantCard
              label="Coast FIRE"
              icon={Shield}
              target={variants.coast}
              progress={variants.coast > 0 ? (currentNetWorth / variants.coast) * 100 : 0}
              color="text-cyan-500"
              reached={variants.coast > 0 && currentNetWorth >= variants.coast}
            />
          </div>

          {/* ── Time to FIRE Projection Chart ──────────────────────────────── */}
          {projectionChartData.length > 0 && (
            <div className="bg-surface-card card-radius border border-b-default p-5 mb-6 card-shadow">
              <h3 className="text-sm font-semibold text-t-primary mb-1">Time to FIRE</h3>
              <p className="text-xs text-t-faint mb-4">
                Projection based on {formatPercent(settings.expectedReturn).replace('+', '')} annual return
                {settings.monthlyContribution > 0 && ` + ${formatCurrency(settings.monthlyContribution)}/mo contributions`}
              </p>

              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={projectionChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                  <XAxis
                    dataKey="age"
                    tick={{ fontSize: 11, fill: cc.axis }}
                    tickFormatter={(v: number) => `${v}`}
                    label={{ value: 'Age', position: 'insideBottomRight', offset: -5, fontSize: 11, fill: cc.axis }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: cc.axis }}
                    tickFormatter={(v: number) => formatCompactCurrency(v)}
                    width={70}
                  />
                  <Tooltip content={<ProjectionTooltip cc={cc} />} />
                  <ReferenceLine
                    y={fireNumber}
                    stroke={palette[3]}
                    strokeDasharray="8 4"
                    strokeWidth={2}
                    label={{
                      value: `FIRE: ${formatCompactCurrency(fireNumber)}`,
                      position: 'right',
                      fontSize: 11,
                      fill: palette[3],
                    }}
                  />
                  {projection?.fireAge && (
                    <ReferenceLine
                      x={Math.ceil(projection.fireAge)}
                      stroke={palette[3]}
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Portfolio"
                    stroke={palette[0]}
                    fill={palette[0]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              {projection?.fireAge && (
                <p className="text-xs text-gain font-semibold mt-2 text-center">
                  FIRE target reached at age {Math.ceil(projection.fireAge)} ({Math.ceil(projection.fireAge) - settings.currentAge} years from now)
                </p>
              )}
              {!projection?.fireAge && progress < 100 && (
                <p className="text-xs text-t-faint mt-2 text-center">
                  Based on current inputs, FIRE target is not reached within 50 years.
                  Try increasing monthly contributions or expected return.
                </p>
              )}
            </div>
          )}

          {/* ── Monte Carlo Withdrawal Simulation ──────────────────────────── */}
          {monteCarlo && monteCarloChartData.length > 0 && (
            <div className="bg-surface-card card-radius border border-b-default p-5 mb-6 card-shadow">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-t-primary">Withdrawal Simulation</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-t-muted">Success Rate</span>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      monteCarlo.successRate >= 90
                        ? 'text-gain'
                        : monteCarlo.successRate >= 75
                        ? 'text-amber-500'
                        : 'text-loss'
                    }`}
                  >
                    {monteCarlo.successRate.toFixed(1)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-t-faint mb-4">
                1,000 simulations starting from {formatCompactCurrency(fireNumber)} FIRE number · {formatCurrency(settings.annualExpenses)}/yr withdrawal · {settings.portfolioVolatility}% volatility
              </p>

              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={monteCarloChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: cc.axis }}
                    label={{ value: 'Retirement Year', position: 'insideBottomRight', offset: -5, fontSize: 11, fill: cc.axis }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: cc.axis }}
                    tickFormatter={(v: number) => formatCompactCurrency(v)}
                    width={70}
                  />
                  <Tooltip content={<MonteCarloTooltip cc={cc} />} />

                  {/* Band: 10th - 25th percentile */}
                  <Area
                    type="monotone"
                    dataKey="p10"
                    stroke="none"
                    fill={palette[4]}
                    fillOpacity={0.08}
                    dot={false}
                    activeDot={false}
                    name="10th Percentile"
                  />
                  <Area
                    type="monotone"
                    dataKey="p25"
                    stroke="none"
                    fill={palette[4]}
                    fillOpacity={0.1}
                    dot={false}
                    activeDot={false}
                    name="25th Percentile"
                  />

                  {/* Median line */}
                  <Area
                    type="monotone"
                    dataKey="p50"
                    stroke={palette[0]}
                    fill={palette[0]}
                    fillOpacity={0.12}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="Median"
                  />

                  {/* Band: 75th - 90th percentile */}
                  <Area
                    type="monotone"
                    dataKey="p75"
                    stroke="none"
                    fill={palette[2]}
                    fillOpacity={0.1}
                    dot={false}
                    activeDot={false}
                    name="75th Percentile"
                  />
                  <Area
                    type="monotone"
                    dataKey="p90"
                    stroke="none"
                    fill={palette[2]}
                    fillOpacity={0.08}
                    dot={false}
                    activeDot={false}
                    name="90th Percentile"
                  />

                  <ReferenceLine y={0} stroke={cc.refLine} />
                </AreaChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center">
                  <span className="text-xs text-t-muted font-medium">Worst Case (10th %ile)</span>
                  <p className="text-sm font-bold tabular-nums text-t-primary">
                    {formatCompactCurrency(monteCarlo.percentiles[30]?.p10 ?? 0)}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-xs text-t-muted font-medium">Median Outcome</span>
                  <p className="text-sm font-bold tabular-nums text-accent">
                    {formatCompactCurrency(monteCarlo.percentiles[30]?.p50 ?? 0)}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-xs text-t-muted font-medium">Best Case (90th %ile)</span>
                  <p className="text-sm font-bold tabular-nums text-t-primary">
                    {formatCompactCurrency(monteCarlo.percentiles[30]?.p90 ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
