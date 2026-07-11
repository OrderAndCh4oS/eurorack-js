export function softLimitVoltage(value, limit, kneeRatio = 0.96) {
    if (!Number.isFinite(value)) return 0;
    const safeLimit = Math.max(0, Number.isFinite(limit) ? limit : 0);
    if (safeLimit === 0) return 0;

    const ratio = Math.min(0.999999, Math.max(0, kneeRatio));
    const knee = safeLimit * ratio;
    const amount = Math.abs(value);
    if (amount <= knee) return value;

    const width = safeLimit - knee;
    const limited = knee + width * (1 - Math.exp(-(amount - knee) / width));
    return Math.sign(value) * Math.min(safeLimit, limited);
}
