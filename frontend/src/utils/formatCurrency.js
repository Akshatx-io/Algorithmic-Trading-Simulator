export const formatCurrency = (num) => {
  if (num === null || num === undefined) return "$0.00";

  return `$${Number(num).toFixed(2)}`;
};