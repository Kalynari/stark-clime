import Logger from './logger';
import { Telegraf } from 'telegraf';
import { General } from '../../config';
import { AddressData } from '../lowdb/types';
import { ERROR, SUCCESS } from './constants';

export const sendSingleMessageToChats = async (moduleString: string, logger: Logger): Promise<void> => {
    try {
        const TGToken:string = General.TGToken;
        const idChats: string[] = General.ChatsID;
        const bot = new Telegraf(TGToken);

        if (Array.isArray(idChats) && idChats.length > 0) {
            for (const chatId of idChats) {
                await bot.telegram.sendMessage(chatId, moduleString);
            }

        } else {
            await logger.error({
                message: 'Error sending message to Telegram',
                moduleString: moduleString,
            });
        }
    } catch (error) {
        await logger.error({
            message: 'Error sending message to Telegram',
            moduleString: moduleString,
            error: error,
        });
    }
};

export function getStringToSend (addressData: AddressData, moduleString: string): string {

    let msgToSend = moduleString + '\n';

    let claimStr: string = '';
    if ( addressData.claim.status === 'done' ) {
        claimStr = `${SUCCESS} Claim | ${addressData.claim.amount} | <a href="${addressData.claim.amount}">link</a>`;
    } else if (addressData.claim.status === 'error') {
        claimStr = `${ERROR} Claim | ${addressData.claim.amount} | <a href="${addressData.claim.amount}">link</a>`;
    } else if (!addressData.info.eligible) {
        claimStr = `${ERROR}  Not Eligible`;
    }

    msgToSend += claimStr + '\n';

    if (addressData.transferETH.status === 'done') {
        msgToSend += `${SUCCESS} ${addressData.transferETH.amount} ETH to ${addressData.info.address}` + '\n';
    } else if (addressData.transferETH.status === 'error') {
        msgToSend += `${ERROR} ${addressData.transferETH.amount} ETH to ${addressData.info.address}` + '\n';
    }

    if (addressData.transferSTRK.status === 'done') {
        msgToSend += `${SUCCESS} ${addressData.transferSTRK.amount} STRK to ${addressData.info.address}` + '\n';
    } else if (addressData.transferSTRK.status === 'error') {
        msgToSend += `${ERROR} ${addressData.transferSTRK.amount} STRK to ${addressData.info.address}` + '\n';
    }

    return msgToSend;
}