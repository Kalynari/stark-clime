import DbContext from '../lowdb/DbContext';
import Logger from './logger';
import { DbSchema } from '../lowdb/createDb';
import ExcelJS from 'exceljs';

export async function createExcelTable (dbContext: DbContext, logger: Logger): Promise<void> {

    const data: DbSchema | undefined = await dbContext.getAllAddresses();

    if (!data) {
        await logger.error({
            message: 'No data found',
            moduleString: '[createExcelTable]'
        });
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Addresses');

    sheet.columns = [
        { header: 'Address', key: 'address', width: 32 },
        { header: 'Private Key', key: 'privateKey', width: 64 },
        { header: 'Eligible', key: 'eligible', width: 18 },
        { header: 'Status claim', key: 'statusClaimSTRK', width: 18 },
        { header: 'Transfer STRK Amount', key: 'transferSTRKAmount', width: 22 },
        { header: 'Transfer ETH Amount', key: 'transferETHAmount', width: 20 },
    ];

    Object.values(data).forEach(addressData => {
        sheet.addRow({
            address: addressData.info.address,
            privateKey: addressData.info.privateKey,
            eligible: addressData.info.eligible,
            statusClaimSTRK: addressData.claim.status,
            transferSTRKAmount: addressData.transferSTRK.amount,
            transferETHAmount: addressData.transferETH.amount,
        });
    });

    try {
        const fileName = 'AddressData.xlsx';
        await workbook.xlsx.writeFile(fileName);
        await logger.info({
            message: `Excel table created successfully: ${fileName}`,
            moduleString: '[createExcelTable]'
        });
    } catch (error) {
        await logger.error({
            message: 'Failed to create Excel table:',
            error: error,
            moduleString: '[createExcelTable]'
        });
    }
}