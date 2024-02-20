import DbContext from '../lowdb/DbContext';
import Logger from '../other/logger';
import { AddressData, SwapOnDexData } from '../lowdb/types';
import { Account, AllowArray, cairo, Call, CallData, Contract, num, RpcProvider } from 'starknet';
import { General } from '../../config';
import BalanceHandler from '../handlers/balanceHandler';
import { chainContract } from '../other/constants';
import { fetchHandler } from '../clients/httpClient';
import h from '../handlers/h';
import TxConfirmation from '../other/txConfirmation';
import { RouteFailure } from 'fibrous-router-sdk';
import { RouteSuccess } from 'fibrous-router-sdk/dist/types/route';
import { BigNumber } from '@ethersproject/bignumber';
import { Retryable } from 'typescript-retry-decorator';
import { abiMySwap } from '../other/abi';

type AvnuResponse = {
    quoteId: string;
    amountOutAvnu: number;
    state: boolean;
}

type FibrousResponse = {
    amountOutFibrous: number;
    state: boolean;
}

type EkuboResponse = {
    response: any
    amountOutEkubo: number;
    state: boolean;
}

export default class ProcessAutoSell {
    dbContext: DbContext;
    logger: Logger;
    addressData: AddressData;
    moduleStr: string;
    provider!: RpcProvider;
    account!: Account;
    starkBalance!: bigint;
    src!: string;
    dst!: string;
    address!: string;
    swapOnDex: SwapOnDexData;


    constructor (dbContext: DbContext, logger: Logger, addressData: AddressData, moduleStr: string) {
        this.dbContext = dbContext;
        this.logger = logger;
        this.addressData = addressData;
        this.moduleStr = moduleStr;
        this.swapOnDex = this.addressData.swapOnDex;
    }

    public async initialize (): Promise<void> {
        this.provider = new RpcProvider({ nodeUrl: General.rpc[0] });
        this.account= new Account(this.provider, this.addressData.info.address, this.addressData.info.privateKey, '1');
        this.starkBalance = <bigint> await BalanceHandler.balanceCheckerForToken('STRK', this.account.address);
        this.src = chainContract.STRK;
        this.dst = chainContract.ETH;
        this.address = this.account.address;
    }

    public async processAutoSell () {

        if (!General.autoSellOnDex) {
            return;
        }

        if (this.swapOnDex.status === 'done') {
            return;
        }

        if (this.swapOnDex.status === 'get_payload' || this.swapOnDex.status === 'check_balance') {
            await this.sendAndConfirmTx();
            return;
        } else {
            const resultAvnu: AvnuResponse = await this.checkAvnuResponse();
            if (resultAvnu.state) {
                await this.processAvnu(resultAvnu);
                await this.sendAndConfirmTx();
                return;
            }

            const resultFibrous: FibrousResponse = await this.checkFibrousResponse();
            if (resultFibrous.state) {
                await this.processFibrous(resultFibrous);
                await this.sendAndConfirmTx();
                return;
            }

            const resultEkubo: EkuboResponse = await this.checkEkuboResponse();
            const resultMySwap: boolean = await this.checkMySwap();

            if (resultMySwap) {
                await this.sendAndConfirmTx();
                return;
            }

            if (resultEkubo.state) {
                await this.processEkubo(resultEkubo);
                await this.sendAndConfirmTx();
                return;
            }

            await this.logger.info({
                message: 'No suitable route found for STRK to ETH, skipping.',
                moduleString: this.moduleStr,
            });
        }
    }


    @Retryable({
        maxAttempts: General.maxRetry,
        backOff: 5000
    })
    public async processAvnu (resultAvnu: AvnuResponse) {
        try {
            let urlTx = 'https://starknet.api.avnu.fi/swap/v1/build';

            let data = {
                'quoteId': resultAvnu.quoteId,
                'takerAddress': this.address,
                'slippage': 1 / 100,
            };

            let responseAvnuPayload = await fetchHandler({
                url: urlTx,
                method: 'POST',
                data: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json',
                },
                logger: this.logger,
                moduleString: '[avnu][Payload]',
            });

            responseAvnuPayload = await responseAvnuPayload.json();

            let txPayload: AllowArray<Call> = [{
                contractAddress: responseAvnuPayload.data.contractAddress,
                entrypoint: responseAvnuPayload.data.entrypoint,
                calldata: CallData.compile(responseAvnuPayload.data.calldata),
            }];

            this.swapOnDex.balanceCash = Number(await BalanceHandler.balanceCheckerForToken('ETH', this.account.address));
            this.swapOnDex.dex = 'AVNU';
            this.swapOnDex.amountETH = resultAvnu.amountOutAvnu;
            this.swapOnDex.payload = txPayload;
            this.swapOnDex.status = 'get_payload';
            await this.dbContext.saveData();

        } catch (e) {
            await this.logger.error({
                message: 'Error fetching payload from Avnu, skipping.',
                moduleString: `${this.moduleStr}[avnu]`,
                error: e
            });
            throw e;
        }
    }

    @Retryable({
        maxAttempts: General.maxRetry,
        backOff: 5000
    })
    public async processFibrous (resultFibrous: FibrousResponse) {

        try {
            const fibrous = new FibrousRouter();
            const approveCall: Call = await fibrous.buildApprove(
                BigNumber.from((this.starkBalance).toString()),
                this.src,
            );

            const swapCall: Call = await fibrous.buildTransaction(
                BigNumber.from((resultFibrous.amountOutFibrous).toString()),
                this.src,
                this.dst,
                0.01,
                this.address,
            );

            const txPayload: AllowArray<Call> = [approveCall, swapCall];

            this.swapOnDex.balanceCash = Number(await BalanceHandler.balanceCheckerForToken('ETH', this.account.address));
            this.swapOnDex.dex = 'Fibrous';
            this.swapOnDex.amountETH = Number(resultFibrous.amountOutFibrous);
            this.swapOnDex.payload = txPayload;
            this.swapOnDex.status = 'get_payload';
            await this.dbContext.saveData();
        } catch (e) {
            await this.logger.error({
                message: 'Error fetching payload from Fibrous, skipping.',
                moduleString: `${this.moduleStr}[fibrous]`,
                error: e
            });
            throw e;
        }
    }


    public async processEkubo (responseEkubo: EkuboResponse) {

        const clear = {
            contractAddress: '0x03266fe47923e1500aec0fa973df8093b5850bbce8dcd0666d3f47298b4b806e', // Ekubo: Router V2.0.1
            entrypoint: 'swap',
            calldata: CallData.compile([{
                contract_address: this.src
            }]),
        };

        const transfer = {
            contractAddress: this.src,
            entrypoint: 'transfer',
            calldata: CallData.compile({
                contract_address: this.address,
                amount: cairo.uint256(this.starkBalance)
            }),
        };

        const swap = {
            contractAddress: '0x03266fe47923e1500aec0fa973df8093b5850bbce8dcd0666d3f47298b4b806e', // Ekubo: Router V2.0.1
            entrypoint: 'swap',
            calldata: CallData.compile({
                node: {
                    pool_key: {
                        token0: responseEkubo.response.route.pool_key.token0,
                        token1: responseEkubo.response.route.pool_key.token1,
                        fee: responseEkubo.response.route.pool_key.fee,
                        tick_spacing: responseEkubo.response.route.pool_key.tick_spacing,
                        extension: responseEkubo.response.route.pool_key.extension
                    },
                    sqrt_ratio_limit: cairo.uint256(responseEkubo.response.route.sqrt_ratio_limit),
                    skip_ahead: '0'
                },
                token_amount: {
                    token: this.src,
                    amount: {
                        mag: this.starkBalance,
                        sign: '0'
                    }
                }
            }),
        };

        const clearMinimum = {
            contractAddress: '0x03266fe47923e1500aec0fa973df8093b5850bbce8dcd0666d3f47298b4b806e', // Ekubo: Router V2.0.1
            entrypoint: 'clear_minimum',
            calldata: CallData.compile({
                token: {
                    contract_address: this.dst
                },
                minimum: cairo.uint256(responseEkubo.amountOutEkubo)
            }),
        };

        const payload: AllowArray<Call> = [clear, transfer, swap, clearMinimum];

        this.swapOnDex.balanceCash = Number(await BalanceHandler.balanceCheckerForToken('ETH', this.account.address));
        this.swapOnDex.dex = 'Ekubo';
        this.swapOnDex.amountETH = responseEkubo.amountOutEkubo;
        this.swapOnDex.payload = payload;
        this.swapOnDex.status = 'get_payload';
        await this.dbContext.saveData();

    };


    private async checkMySwap (): Promise<boolean> {
        try {
            const contract = new Contract(abiMySwap, '0x01114c7103e12c2b2ecbd3a2472ba9c48ddcbf702b1c242dd570057e26212111', this.provider);

            const poolkey = await contract.pool_key(this.src, this.dst, 500n);

            const sqrtPrice = await contract.current_sqrt_price(poolkey);

            const price = Number(sqrtPrice) ** 2 / 2 ** 192; // 1 STRK = price ETH (above $5)

            if (price * Number(this.starkBalance) < General.amountAutoSellFrom * 10 ** 18) {
                await this.logger.info({
                    message: `Amount out from MySwap ${h.formatNumber(price * Number(this.starkBalance) / 10 ** 18, 5)} is less than ${General.amountAutoSellFrom} ETH, skipping.`,
                    moduleString: this.moduleStr,
                });
                return false;
            }

            await this.logger.info({
                message: `Amount out from MySwap ${h.formatNumber(price * Number(this.starkBalance) / 10 ** 18, 5)} is more than ${General.amountAutoSellFrom} ETH, processing sell .`,
                moduleString: this.moduleStr,
            });

            const txPayload = {
                contractAddress: '0x01114c7103e12c2b2ecbd3a2472ba9c48ddcbf702b1c242dd570057e26212111', // mySwap: CL AMM Swap
                entrypoint: 'swap',
                calldata: CallData.compile({
                    token: poolkey,
                    zero_for_one: '0',
                    amount: cairo.uint256(this.starkBalance),
                    exact_input: '1',
                    sqrt_price_limit_x96: cairo.uint256(sqrtPrice)
                }),
            };

            this.swapOnDex.balanceCash = Number(await BalanceHandler.balanceCheckerForToken('ETH', this.account.address));
            this.swapOnDex.dex = 'MySwap';
            this.swapOnDex.amountETH = price;
            this.swapOnDex.payload = txPayload;
            this.swapOnDex.status = 'get_payload';
            await this.dbContext.saveData();

            return true;
        } catch (e) {
            await this.logger.error({
                message: 'checkMySwap pool error',
                error: e,
                moduleString: this.moduleStr
            });
            return false;
        }
    };


    private async checkAvnuResponse (): Promise<AvnuResponse> {
        try {
            let urlQuoteId = `https://starknet.api.avnu.fi/internal/swap/quotes-with-prices?sellTokenAddress=${this.src}&buyTokenAddress=${this.dst}&sellAmount=${num.toHexString(this.starkBalance)}&takerAddress=${this.address}&size=3&excludeSources=JediSwapV2&integratorName=AVNU%20Portal`;
            let responseQuoteId = await fetchHandler({
                url: urlQuoteId,
                method: 'GET',
                logger: this.logger,
                moduleString: '[avnu][QuoteId]',
            });

            responseQuoteId = await responseQuoteId.json();
            const quoteId = responseQuoteId.quotes[0].quoteId;
            const amountOutAvnu = Number(responseQuoteId.quotes[0].buyAmount);

            if (amountOutAvnu < General.amountAutoSellFrom * 10 ** 18) {
                await this.logger.info({
                    message: `Amount out from Avnu ${h.formatNumber(amountOutAvnu / 10 ** 18, 5)} is less than ${General.amountAutoSellFrom} ETH, skipping.`,
                    moduleString: this.moduleStr,
                });
                return {
                    quoteId: quoteId,
                    amountOutAvnu,
                    state: false
                };
            }

            await this.logger.info({
                message: `Amount out from Avnu ${h.formatNumber(amountOutAvnu / 10 ** 18, 5)} is more than ${General.amountAutoSellFrom} ETH, processing sell .`,
                moduleString: this.moduleStr,
            });

            return {
                quoteId: quoteId,
                amountOutAvnu,
                state: true
            };
        } catch (e) {
            await this.logger.error({
                message: 'Error fetching quoteId from Avnu, skipping.',
                moduleString: `${this.moduleStr}[avnu]`,
                error: e
            });
            return {
                quoteId: '',
                amountOutAvnu: 0,
                state: false
            };
        }
    }
    private async checkFibrousResponse (): Promise<FibrousResponse> {
        try {
            const fibrous = new FibrousRouter();
            const bestRoute: RouteFailure | RouteSuccess = await fibrous.getBestRoute(
                BigNumber.from((this.starkBalance).toString()),
                this.src,
                this.dst,
            );

            if (!bestRoute.success) {
                await this.logger.info({
                    message: 'No route found for STRK to ETH, skipping.',
                    moduleString: `${this.moduleStr}[fibrous]`,
                });
                return {
                    amountOutFibrous: 0,
                    state: false
                };
            }

            const amountOutFibrous = bestRoute.outputAmount;

            if (Number(amountOutFibrous) < General.amountAutoSellFrom * 10 ** 18) {
                await this.logger.info({
                    message: `Amount out from Fibrous ${h.formatNumber(Number(amountOutFibrous) / 10 ** 18, 5)} is less than ${General.amountAutoSellFrom} ETH, skipping.`,
                    moduleString: this.moduleStr,
                });
                return {
                    amountOutFibrous: Number(amountOutFibrous),
                    state: false
                };
            }

            await this.logger.info({
                message: `Amount out from Fibrous ${h.formatNumber(Number(amountOutFibrous) / 10 ** 18, 5)} is more than ${General.amountAutoSellFrom} ETH, processing sell .`,
                moduleString: this.moduleStr,
            });

            return {
                amountOutFibrous: Number(amountOutFibrous),
                state: true
            };
        } catch (e) {
            await this.logger.error({
                message: 'Error fetching best route from Fibrous, skipping.',
                moduleString: `${this.moduleStr}[fibrous]`,
                error: e
            });
            return {
                amountOutFibrous: 0,
                state: false
            };
        }
    }
    private async checkEkuboResponse (): Promise<EkuboResponse> {
        try {
            let responseEkubo = await fetchHandler({
                url: `https://mainnet-api.ekubo.org/quote/${this.starkBalance}/${this.src}/${this.dst}`,
                method: 'GET',
                logger: this.logger,
                moduleString: `${this.moduleStr}[ekubo]`,
            });

            responseEkubo = await responseEkubo.json();

            const amountOutEkubo = Number(responseEkubo.amount);

            if (amountOutEkubo < General.amountAutoSellFrom * 10 ** 18) {
                await this.logger.info({
                    message: `Amount out from Ekubo ${h.formatNumber(amountOutEkubo / 10 ** 18, 5)} is less than ${General.amountAutoSellFrom} ETH, skipping.`,
                    moduleString: this.moduleStr,
                });
                return {
                    response: responseEkubo,
                    amountOutEkubo: 0,
                    state: false
                };
            }

            await this.logger.info({
                message: `Amount out from Ekubo ${h.formatNumber(amountOutEkubo / 10 ** 18, 5)} is more than ${General.amountAutoSellFrom} ETH, processing sell .`,
                moduleString: this.moduleStr,
            });


            return {
                response: responseEkubo,
                amountOutEkubo,
                state: true

            };
        } catch (e) {
            await this.logger.error({
                message: 'Error fetching quote from Ekubo, skipping.',
                moduleString: `${this.moduleStr}[ekubo]`,
                error: e
            });
            return {
                response: {},
                amountOutEkubo: 0,
                state: false
            };
        }
    }


    @Retryable({
        maxAttempts: General.maxRetry,
        backOff: 5000
    })
    private async sendAndConfirmTx () {
        try {

            if (this.swapOnDex.payload === undefined) {
                return;
            }

            await new TxConfirmation({
                dbContext: this.dbContext,
                logger: this.logger,
                txPayload: this.swapOnDex.payload,
                account: this.account,
                provider: this.provider,
                transactionData: this.swapOnDex,
                moduleString: `${this.moduleStr}[autoSell][${this.swapOnDex.dex}]`
            }).executeWithRetry();

            if (this.swapOnDex.status !== 'check_balance') {
                return;
            }

            await BalanceHandler.waitForUpdateBalanceStarkForExactToken({
                address: this.address,
                logger: this.logger,
                balanceCash: this.swapOnDex.balanceCash,
                moduleString: `${this.moduleStr}[balanceCashETH]`,
                tokenName: 'ETH',
                provider: this.provider
            });

            this.swapOnDex.status = 'done';
            await this.dbContext.saveData();
        } catch (e) {
            await this.logger.error({
                message: 'Error sending and confirming tx, skipping.',
                moduleString: `${this.moduleStr}[autoSell][${this.swapOnDex.dex}]`,
                error: e
            });
            throw e;
        }
    }
}