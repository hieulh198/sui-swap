import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";
import {
  getWallets,
  WalletAccount,
  StandardConnectFeature,
} from "@mysten/wallet-standard";
import axios from "axios";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
const AFTERMATH_API_BASE = "https://aftermath.finance/api";

export const TOKEN_ADDRESS: any = {
  SUI: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  CETUS: "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
};

export const isSuiWalletInstalled = (): boolean => {
  if (typeof window === "undefined") return false;

  const wallets = getWallets().get();
  const suiWallet = wallets.find((wallet) => wallet.name === "Sui Wallet");
  return !!suiWallet;
};

export const connectSuiWallet = async (): Promise<WalletAccount> => {
  const wallets = getWallets().get();
  const suiWallet = wallets.find((wallet) => wallet.name === "Sui Wallet");
  if (!suiWallet) {
    throw new Error("Sui Wallet is not installed or not detected");
  }

  try {
    const connectFeature = suiWallet.features["standard:connect"] as
      | StandardConnectFeature["standard:connect"]
      | undefined;
    if (!connectFeature) {
      throw new Error("Sui Wallet does not support standard:connect");
    }
    const { accounts } = await connectFeature.connect();
    return accounts[0];
  } catch (error) {
    console.error("Error connecting to Sui Wallet:", error);
    throw error;
  }
};

export const getCoinMetadata = async (coinType: string): Promise<{ name: string; symbol: string; decimals: number } | null> => {
  try {
    const metadata = await client.getCoinMetadata({ coinType });
    if (!metadata) {
      throw new Error(`No metadata found for coinType: ${coinType}`);
    }
    return {
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
    };
  } catch (error) {
    console.error("Error fetching coin metadata:", error);
    return null;
  }
};

export const getWalletBalance = async (address: string, token: string = "SUI"): Promise<number> => {
  const metadata = await getCoinMetadata(TOKEN_ADDRESS[token]);
  const decimals = metadata?.decimals || 9;
  const balance = await client.getBalance({
    owner: address,
    coinType: TOKEN_ADDRESS[token],
  });
  return Number(balance.totalBalance) / Math.pow(10, decimals);
};

export const getTradeRoute = async (
  fromToken: string,
  toToken: string,
  amount: number
): Promise<{ outputAmount: number; routes: string }> => {
  if (!TOKEN_ADDRESS[fromToken] || !TOKEN_ADDRESS[toToken]) {
    throw new Error("Invalid token type");
  }

  const fromMetadata = await getCoinMetadata(TOKEN_ADDRESS[fromToken]);
  const toMetadata = await getCoinMetadata(TOKEN_ADDRESS[toToken]);
  const fromDecimals = fromMetadata?.decimals || 9;
  const toDecimals = toMetadata?.decimals || 9;

  const coinInAmount = `${Math.floor(amount * Math.pow(10, fromDecimals))}n`;

  try {
    const response = await axios.post(`${AFTERMATH_API_BASE}/router/trade-route`, {
      coinInType: TOKEN_ADDRESS[fromToken],
      coinInAmount,
      coinOutType: TOKEN_ADDRESS[toToken],
    });

    const routes = response.data.routes;
    if (!routes || routes.length === 0) throw new Error("No trade route found");

    const outputAmountRaw = response.data.coinOut?.amount;
    if (!outputAmountRaw) throw new Error("No output amount found in response");

    const outputAmount = Number(outputAmountRaw.replace("n", "")) / Math.pow(10, toDecimals);

    return { outputAmount, routes };
  } catch (error) {
    console.error("Error fetching trade route from Aftermath:", error);
    throw error;
  }
};

export const getPriceInfo = async (
  token: string
): Promise<{ price: number }> => {
  try {
    const response = await axios.post(`${AFTERMATH_API_BASE}/price-info`, {
     coins: [TOKEN_ADDRESS[token]]
    });
    const priceData: { [key: string]: { price: number; priceChange24HoursPercentage: number } } = response.data;
    const tokenAddr = TOKEN_ADDRESS[token];
    const price = priceData[tokenAddr]?.price || 0;

    return { price };

  } catch (error) {
    console.error("Error fetching price info from Aftermath:", error);
    return { price: 0 };
  }
};