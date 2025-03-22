import Big from "big.js";

export const formatNumber = (value: Big.BigSource) => {
  if (!value) return "";
  const bigValue = value instanceof Big ? value : new Big(value);

  const stringValue = bigValue.toString();
  const [integerPart, decimalPart] = stringValue.split(".");

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimalPart) {
    const trimmedDecimal = decimalPart.slice(0, 10);
    return `${formattedInteger}.${trimmedDecimal}`;
  }

  return formattedInteger;
};

export const formatBalance = (value: Big | null, decimals: number = 10) =>
  value !== null ? formatNumber(value.toFixed(decimals)) : "Loading...";
