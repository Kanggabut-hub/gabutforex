/**
 * Core Evaluation Market Analytics Engine
 * Memetakan bias tren finansial pasar riil berdasarkan pembacaan indikator kuantitatif
 */

class VanguardAnalysisEngine {
    static evaluateMarketBias(rsiValue, priceChangePct) {
        if (rsiValue > 65 || priceChangePct > 0.5) {
            return { bias: "BULLISH", color: "text-emerald-500" };
        } else if (rsiValue < 35 || priceChangePct < -0.5) {
            return { bias: "BEARISH", color: "text-rose-500" };
        }
        return { bias: "NEUTRAL", color: "text-slate-400" };
    }

    static evaluateTrendStrength(changePct) {
        const absChange = Math.abs(changePct);
        if (absChange >= 1.0) return "STRONG OVEREXTENDED";
        if (absChange >= 0.4) return "TRENDING STABLE";
        if (absChange >= 0.1) return "MODERATE MOMENTUM";
        return "LOW VOLATILITY SIDEWAYS";
    }
}