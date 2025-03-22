import React, { useEffect, useMemo, useRef, useState } from "react";
import Big from "big.js";
import {
  connectSuiWallet,
  getWalletBalance,
  isSuiWalletInstalled,
  getTradeRoute,
  getPriceInfo,
  getCoinMetadata,
  TOKEN_ADDRESS,
} from "../services/sui";
import { formatBalance, formatNumber } from "../utils";

const SuiAggregator: React.FC = () => {
  const [isWalletInstalled, setIsWalletInstalled] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [suiBalance, setSuiBalance] = useState<Big | null>(null);
  const [cetusBalance, setCetusBalance] = useState<Big | null>(null);
  const [fromToken, setFromToken] = useState<string>("SUI");
  const [toToken, setToToken] = useState<string>("CETUS");
  const [amount, setAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<Big | null>(null);
  const [route, setRoute] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [suiPrice, setSuiPrice] = useState<Big>(new Big(0));
  const [cetusPrice, setCetusPrice] = useState<Big>(new Big(0));
  const [slippage, setSlippage] = useState<Big>(new Big(0.5));
  const [isRateReversed, setIsRateReversed] = useState<boolean>(false);
  const [fromTokenMetadata, setFromTokenMetadata] = useState<any>(null);
  const [toTokenMetadata, setToTokenMetadata] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const toastRef = useRef<HTMLDivElement>(null);

  const fromFiatValue = amount
    ? new Big(amount.replace(/,/g, "")).mul(
        fromToken === "SUI" ? suiPrice : cetusPrice
      )
    : new Big(0);
  const toFiatValue = toAmount
    ? new Big(toAmount).mul(toToken === "CETUS" ? cetusPrice : suiPrice)
    : new Big(0);

  const exchangeRate = useMemo(() => {
    if (toAmount && amount) {
      return new Big(amount.replace(/,/g, "")).div(toAmount);
    }
    return new Big(0);
  }, [amount, toAmount]);

  const reversedExchangeRate = useMemo(() => {
    if (exchangeRate.gt(0)) {
      return new Big(1).div(exchangeRate);
    }
    return new Big(0);
  }, [exchangeRate]);

  const fetchTokenMetadata = async () => {
    try {
      const fromMetadata = await getCoinMetadata(TOKEN_ADDRESS[fromToken]);
      const toMetadata = await getCoinMetadata(TOKEN_ADDRESS[toToken]);
      setFromTokenMetadata(fromMetadata);
      setToTokenMetadata(toMetadata);
    } catch (error: any) {
      console.error("Failed to fetch token metadata:", error);
      if (error.response) {
        setErrorMessage(
          `Error ${error.response.status}: Failed to fetch token metadata`
        );
      } else {
        setErrorMessage(
          "An unexpected error occurred while fetching token metadata"
        );
      }
    }
  };

  const fetchBalanceAndPrice = async () => {
    try {
      const suiBal = await getWalletBalance(walletAddress!, "SUI");
      const cetusBal = await getWalletBalance(walletAddress!, "CETUS");
      setSuiBalance(new Big(suiBal));
      setCetusBalance(new Big(cetusBal));

      await fetchPrice();
    } catch (error: any) {
      console.error("Failed to fetch balance or price:", error);
      if (error.response) {
        setErrorMessage(
          `Error ${error.response.status}: Failed to fetch balance or price`
        );
      } else {
        setErrorMessage(
          "An unexpected error occurred while fetching balance or price"
        );
      }
    }
  };

  const fetchPrice = async () => {
    try {
      const suiPriceData = await getPriceInfo("SUI");
      const cetusPriceData = await getPriceInfo("CETUS");
      setSuiPrice(new Big(suiPriceData.price));
      setCetusPrice(new Big(cetusPriceData.price));
    } catch (error: any) {
      console.error("Failed to fetch price:", error);
      if (error.response) {
        setErrorMessage(
          `Error ${error.response.status}: Failed to fetch price`
        );
      } else {
        setErrorMessage("An unexpected error occurred while fetching price");
      }
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const account = await connectSuiWallet();
      setWalletAddress(account.address);
    } catch (error: any) {
      if (error.response) {
        setErrorMessage(
          `Error ${error.response.status}: Failed to connect to Sui Wallet`
        );
      } else {
        setErrorMessage("Failed to connect to Sui Wallet");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, "");
    if (/^\d*\.?\d{0,10}$/.test(value) || value === "") {
      
      try {
        const numericValue = value === "" ? new Big(0) : new Big(value);
        const maxBalance =
          fromToken === "SUI"
            ? suiBalance || new Big(0)
            : cetusBalance || new Big(0);
        if (
          value === "" ||
          (numericValue.lte(maxBalance) && numericValue.gte(0))
        ) {
          setAmount(value);
          if (numericValue.eq(0) || value === "") {
            setToAmount(null);
            setRoute("");
          }
        } else {
          setAmount(maxBalance.toString());
        }
      } catch (error) {
        console.error("Invalid big number:", error);
      }
    }
  };

  const handleSlippageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    try {
      const numericValue = new Big(value);
      if (numericValue.gte(0) && numericValue.lte(100)) {
        setSlippage(numericValue);
      }
    } catch (error) {
      console.error("Invalid slippage value:", error);
      setSlippage(new Big(0.5));
    }
  };

  const handleHalf = async () => {
    const maxBalance =
      fromToken === "SUI"
        ? suiBalance || new Big(0)
        : cetusBalance || new Big(0);
    if (maxBalance) {
      setAmount(formatNumber(maxBalance.div(2).toString()));
      setRoute("");
    }
  };

  const handleMax = async () => {
    const maxBalance =
      fromToken === "SUI"
        ? suiBalance || new Big(0)
        : cetusBalance || new Big(0);
    if (maxBalance) {
      setAmount(formatNumber(maxBalance.toString()));
      setRoute("");
    }
  };

  const handleSwitchDirection = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount("");
    setToAmount(null);
    setRoute("");
  };

  const fetchTradeRoute = async () => {
    if (!amount) {
      setToAmount(null);
      setRoute("");
      return;
    }

    try {
      const amountBig = new Big(amount.replace(/,/g, ""));

      if (amountBig.eq(0) && amount !== "0" && amount !== "0.") {
        setToAmount(null);
        setRoute("");
        return;
      }

      const quote = await getTradeRoute(
        fromToken,
        toToken,
        amountBig.toNumber()
      );
      setToAmount(new Big(quote.outputAmount));

      const bestRoute: any = quote.routes[0];

      if (!bestRoute) {
        throw new Error("No trade route found");
      }

      const pathDescriptions = bestRoute.paths.map(
        (path: any, index: number) => {
          const fromCoin = path.coinIn.type.split("::")[2];
          const toCoin = path.coinOut.type.split("::")[2];
          return `${fromCoin} → ${toCoin} via ${
            path.protocolName
          }`;
        }
      );
      setRoute(pathDescriptions.join(" → "));
    } catch (error: any) {
      console.error("Failed to fetch trade route:", error);
      if (error.response) {
        setErrorMessage(
          `Error ${error.response.status}: Failed to fetch trade route`
        );
      } else {
        setErrorMessage(
          "An unexpected error occurred while fetching trade route"
        );
      }
      setToAmount(null);
      setRoute("");
    }
  };

  const handleSwap = async () => {
    if (!amount || !walletAddress) return;
    setLoading(true);
    try {
    } catch (error) {
      console.error("Swap failed:", error);
      setErrorMessage("Swap failed!");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRateDirection = () => {
    setIsRateReversed((prev) => !prev);
  };

  const handleAmountBlur = () => {
    if (!amount) return;
    if (!amount.includes(",")) {
      setAmount(formatNumber(amount));
    }
  };

  useEffect(() => {
    if (amount) {
      fetchTradeRoute();
      fetchTokenMetadata();
    }
  }, [amount, fromToken, toToken]);

  useEffect(() => {
    if (errorMessage && toastRef.current) {
      toastRef.current.classList.add("show");

      const timer = setTimeout(() => {
        if (toastRef.current) {
          toastRef.current.classList.remove("show");
          setErrorMessage(null);
        }
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    const checkWallet = () => {
      const installed = isSuiWalletInstalled();
      setIsWalletInstalled(installed);
    };
    checkWallet();
    const timer = setTimeout(checkWallet, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (walletAddress) {
      fetchBalanceAndPrice();
    }
  }, [walletAddress, fromToken, toToken]);

  useEffect(() => {
    if (!walletAddress) return;

    const interval = setInterval(() => {
      fetchPrice();
    }, 10000);

    return () => clearInterval(interval);
  }, [walletAddress]);
  
  return (
    <div className="container min-vh-100 d-flex flex-column align-items-center py-4">
      <div
        className="toast-container position-fixed top-0 end-0 p-3"
        style={{ zIndex: 1050 }}
      >
        <div
          ref={toastRef}
          className="toast align-items-center text-white bg-danger border-0"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="d-flex">
            <div className="toast-body">{errorMessage}</div>
            <button
              type="button"
              className="btn-close btn-close-white me-2 m-auto"
              data-bs-dismiss="toast"
              aria-label="Close"
              onClick={() => {
                if (toastRef.current) {
                  toastRef.current.classList.remove("show");
                  setErrorMessage(null);
                }
              }}
            ></button>
          </div>
        </div>
      </div>

      <div
        className="d-flex justify-content-between w-100"
        style={{ maxWidth: "450px" }}
      >
        <h1 className="mb-4">Swap</h1>
        {walletAddress && (
          <div className="mb-4">
            <label className="form-label">Slippage Tolerance (%):</label>
            <input
              type="text"
              value={slippage.toString()}
              onChange={handleSlippageChange}
              placeholder="0.5"
              className="form-control"
            />
          </div>
        )}
      </div>
      {isWalletInstalled ? (
        walletAddress ? (
          <div className="card w-100" style={{ maxWidth: "450px" }}>
            <div className="card-body">
              <p className="card-text">
                Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
              <div className="mb-3">
                <label className="form-label">Pay:</label>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>
                    {fromTokenMetadata ? fromTokenMetadata.symbol : fromToken}{" "}
                    (Balance:{" "}
                    {fromToken === "SUI"
                      ? formatNumber(suiBalance!)
                      : formatNumber(cetusBalance!)}
                    )
                  </span>
                  <div>
                    <button
                      onClick={handleHalf}
                      className="btn btn-outline-secondary btn-sm me-2"
                    >
                      Half
                    </button>
                    <button
                      onClick={handleMax}
                      className="btn btn-outline-secondary btn-sm"
                    >
                      Max
                    </button>
                  </div>
                </div>
                <div className="input-group">
                  <input
                    type="text"
                    value={amount}
                    onChange={handleAmountChange}
                    onBlur={handleAmountBlur}
                    placeholder="0.0"
                    className="form-control"
                  />
                </div>
                <small className="text-muted">
                  ${fromFiatValue.toFixed(2)}
                </small>
              </div>
              <div className="d-flex justify-content-center mb-3">
                <button
                  onClick={handleSwitchDirection}
                  className="btn btn-outline-primary"
                >
                  ⇆
                </button>
              </div>
              <div className="mb-3">
                <label className="form-label">Receive:</label>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>
                    {toTokenMetadata ? toTokenMetadata.symbol : toToken}{" "}
                    (Balance:{" "}
                    {toToken === "SUI"
                      ? formatNumber(suiBalance!)
                      : formatNumber(cetusBalance!)}
                    )
                  </span>
                </div>
                <input
                  type="text"
                  value={
                    toAmount !== null
                      ? formatBalance(toAmount, toTokenMetadata?.decimals)
                      : "0.0"
                  }
                  disabled
                  className="form-control"
                />
                <small className="text-muted">${toFiatValue.toFixed(2)}</small>
              </div>
              <div className="d-flex align-items-center">
                <p className="text-muted mb-0">
                  {isRateReversed
                    ? `1 ${fromToken} = ${reversedExchangeRate.toFixed(
                        4
                      )} ${toToken}`
                    : `1 ${toToken} = ${exchangeRate.toFixed(4)} ${fromToken}`}
                </p>
                <button
                  onClick={handleToggleRateDirection}
                  className="btn p-0 ms-2"
                  style={{ fontSize: "1rem", lineHeight: "1" }}
                >
                  ⇆
                </button>
              </div>
              <p className="text-muted">Route: {route || "N/A"}</p>
              <button
                onClick={handleSwap}
                disabled={!amount || loading}
                className={`btn w-100 ${
                  !amount || loading ? "btn-secondary" : "btn-success"
                }`}
              >
                {loading ? "Swapping..." : "Trade"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className={`btn ${
              loading ? "btn-secondary" : "btn-primary"
            } px-4 py-2`}
          >
            {loading ? "Connecting..." : "Connect Sui Wallet"}
          </button>
        )
      ) : (
        <p className="text-danger">
          Sui Wallet is not installed. Please install it from Chrome Web Store.
        </p>
      )}
    </div>
  );
};

export default SuiAggregator;