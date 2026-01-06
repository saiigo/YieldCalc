// 投资年化收益率计算工具

/**
 * 单利计算
 * @param {number} principal - 本金
 * @param {number} totalAmount - 本息合计
 * @param {number} days - 投资天数
 * @returns {number} 年化收益率（百分比）
 */
export const calculateSimpleInterest = (principal, totalAmount, days) => {
  if (principal <= 0 || days <= 0) return 0;
  const interest = totalAmount - principal;
  const dailyRate = interest / principal / days;
  return dailyRate * 365 * 100;
};

/**
 * 复利计算
 * @param {number} principal - 本金
 * @param {number} totalAmount - 本息合计
 * @param {number} years - 投资年数
 * @returns {number} 年化收益率（百分比）
 */
export const calculateCompoundInterest = (principal, totalAmount, years) => {
  if (principal <= 0 || years <= 0) return 0;
  const ratio = totalAmount / principal;
  const annualRate = Math.pow(ratio, 1 / years) - 1;
  return annualRate * 100;
};

/**
 * 计算IRR（内部收益率）- 简化版本
 * @param {Array<number>} cashFlows - 现金流数组，初始投资为负数，后续收益为正数
 * @param {number} guess - 初始猜测值，默认为0.1（10%）
 * @returns {number} 年化收益率（百分比）
 */
export const calculateIRR = (cashFlows, guess = 0.1) => {
  const maxIterations = 1000;
  const tolerance = 1e-6;
  let irr = guess;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let npvDerivative = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + irr, t);
      npvDerivative += -t * cashFlows[t] / Math.pow(1 + irr, t + 1);
    }

    const newIrr = irr - npv / npvDerivative;
    if (Math.abs(newIrr - irr) < tolerance) {
      return newIrr * 100;
    }
    irr = newIrr;
  }

  return 0;
};

/**
 * 计算投资期限的总天数
 * @param {number} period - 投资期限数值
 * @param {string} unit - 时间单位（day, month, year）
 * @returns {number} 总天数
 */
export const calculateTotalDays = (period, unit) => {
  const daysPerMonth = 30;
  const daysPerYear = 365;

  switch (unit) {
    case 'day':
      return period;
    case 'month':
      return period * daysPerMonth;
    case 'year':
      return period * daysPerYear;
    default:
      return period;
  }
};

/**
 * 计算投资期限的总年数
 * @param {number} period - 投资期限数值
 * @param {string} unit - 时间单位（day, month, year）
 * @returns {number} 总年数
 */
export const calculateTotalYears = (period, unit) => {
  const monthsPerYear = 12;
  const daysPerYear = 365;

  switch (unit) {
    case 'day':
      return period / daysPerYear;
    case 'month':
      return period / monthsPerYear;
    case 'year':
      return period;
    default:
      return period;
  }
};

/**
 * 格式化百分比
 * @param {number} value - 数值
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的百分比字符串
 */
export const formatPercent = (value, decimals = 2) => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * 格式化金额
 * @param {number} value - 金额数值
 * @returns {string} 格式化后的金额字符串
 */
export const formatAmount = (value) => {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};